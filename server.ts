/**
 * server.ts: NADA UNION LEDGER
 *
 * Express + Vite + Gemini backend.
 *
 * Endpoints
 *   POST /api/gemini/chat             -> the assistant (chat + transaction drafting)
 *   POST /api/gemini/autofill-entry   -> alias of /chat (kept for frontend compatibility)
 *   POST /api/gemini/analyze-templates-> 4 personalised quick-transaction templates
 *   GET  /api/health                  -> quick sanity check
 *
 * Design in one paragraph:
 *   The AI only *proposes* a voucher (list of debit lines + credit lines). This server then
 *   VERIFIES it before the frontend ever sees it: accounts must exist in the chart, totals
 *   must balance to the paisa, an account can't be on both sides, etc. If a check fails the
 *   model gets one automatic chance to fix its own mistake. The frontend response shape is
 *   unchanged: { reply, hasSuggestedEntry, suggestedEntry, followUpSuggestions }.
 *
 * Optional .env settings
 *   GEMINI_API_KEY (required) | GEMINI_MODEL (default gemini-2.5-flash) | APP_TIMEZONE (default Asia/Kolkata)
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// =============================================================================
// 0. CONFIG & TYPES
// =============================================================================

const PORT = 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const HISTORY_TURNS = 10; // how many recent messages the assistant remembers
const HISTORY_CHARS = 1500; // per-message cap, keeps requests fast
const MAX_PROMPT_CHARS = 4000;
const MAX_ATTACHMENT_BYTES = 14 * 1024 * 1024;
const ATTACHMENT_TYPES = /^(image\/(png|jpeg|webp|heic|heif)|application\/pdf)$/;

// Your chart: Cash = '1', Bank = '2'. Resolved against the real chart at request time.
const DEFAULT_CASH_ID = '1';
const DEFAULT_BANK_ID = '2';

type Account = { id: string; name: string; type: string };

type EntryLine = {
  accountId: string;
  accountName: string;
  accountType: string;
  amount: number;
  isNewAccount?: boolean;
};

type VoucherDraft = {
  debitAccountId: string;
  debitAccountName: string;
  debitAccountType: string;
  creditAccountId: string;
  creditAccountName: string;
  creditAccountType: string;
  amount: number;
  narration: string;
  date: string;
  isCompound: boolean;
  debits: EntryLine[];
  credits: EntryLine[];
  newAccounts: { name: string; type: string }[];
};

type ChatResponse = {
  reply: string;
  hasSuggestedEntry: boolean;
  suggestedEntry: VoucherDraft | null;
  followUpSuggestions: string[];
};

type Turn = { role: 'user' | 'model'; parts: any[] };

type CheckContext = {
  chart: Account[];
  today: string;
  metrics: any;
  cashId: string;
  bankId: string;
};

class ConfigError extends Error {}

// =============================================================================
// 1. GEMINI CLIENT & SCHEMAS
// =============================================================================

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ConfigError('GEMINI_API_KEY environment variable is not defined on the server side.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
}

const lineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    accountId: {
      type: Type.STRING,
      description: 'Exact id from the chart of accounts. Empty string "" only for a brand-new account.',
    },
    accountName: { type: Type.STRING },
    accountType: {
      type: Type.STRING,
      description: 'Only needed for a NEW account (e.g. Liability for a person payable).',
    },
    amount: { type: Type.NUMBER, description: 'Rupees, positive, max 2 decimals.' },
    isNewAccount: { type: Type.BOOLEAN },
  },
  required: ['accountId', 'accountName', 'amount'],
  propertyOrdering: ['accountId', 'accountName', 'accountType', 'amount', 'isNewAccount'],
};

const chatSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hasSuggestedEntry: {
      type: Type.BOOLEAN,
      description: 'True ONLY when a complete, ready-to-save transaction is included.',
    },
    suggestedEntry: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        debits: { type: Type.ARRAY, items: lineSchema },
        credits: { type: Type.ARRAY, items: lineSchema },
        narration: { type: Type.STRING, description: 'One clear English sentence for the books.' },
        date: { type: Type.STRING, description: 'YYYY-MM-DD' },
      },
      required: ['debits', 'credits', 'narration', 'date'],
      propertyOrdering: ['debits', 'credits', 'narration', 'date'],
    },
    reply: { type: Type.STRING, description: 'Plain-text message to the treasurer.' },
    followUpSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['hasSuggestedEntry', 'reply'],
  // Entry is produced BEFORE the reply so the reply always matches the numbers.
  propertyOrdering: ['hasSuggestedEntry', 'suggestedEntry', 'reply', 'followUpSuggestions'],
};

const templatesSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING },
      desc: { type: Type.STRING },
      debit: { type: Type.STRING },
      credit: { type: Type.STRING },
      narration: { type: Type.STRING },
    },
    required: ['label', 'desc', 'debit', 'credit', 'narration'],
  },
};

// =============================================================================
// 2. SMALL UTILITIES
// =============================================================================

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function parseMoney(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

const toMoney = (v: unknown): number => Math.round((parseMoney(v) ?? 0) * 100) / 100;
const paise = (n: number) => Math.round(n * 100);

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);

function getToday() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // YYYY-MM-DD
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'long' }).format(now);
  return { date, weekday };
}

function normalizeAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw)) return [];
  const out: Account[] = [];
  for (const a of raw as any[]) {
    const id = a?.id ?? a?.accountId ?? a?.code;
    const name = a?.name ?? a?.accountName ?? a?.title;
    if (id === undefined || id === null || !name) continue;
    if (a?.isActive === false || a?.active === false) continue;
    out.push({
      id: String(id),
      name: String(name),
      type: String(a?.type ?? a?.accountType ?? a?.category ?? 'Unknown'),
    });
  }
  return out;
}

/** Finds the real Cash and Bank accounts (falls back to ids '1' and '2'). */
function findCoreAccounts(chart: Account[]) {
  const pick = (id: string, re: RegExp, exclude?: RegExp) =>
    chart.find((a) => a.id === id && re.test(a.name)) ??
    chart.find((a) => re.test(a.name) && !(exclude && exclude.test(a.name)));
  return {
    cashId: pick(DEFAULT_CASH_ID, /cash/i)?.id ?? DEFAULT_CASH_ID,
    bankId: pick(DEFAULT_BANK_ID, /bank|upi/i, /charge|fee|interest|expense/i)?.id ?? DEFAULT_BANK_ID,
  };
}

function parseJSON(text?: string) {
  const cleaned = (text ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function cleanChips(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    const t = String(c ?? '').trim().slice(0, 40);
    if (t && !seen.has(norm(t))) {
      seen.add(norm(t));
      out.push(t);
    }
  }
  return out.slice(0, 3);
}

const plainReply = (reply: string, chips: string[] = []): ChatResponse => ({
  reply,
  hasSuggestedEntry: false,
  suggestedEntry: null,
  followUpSuggestions: chips,
});

/** One model call with JSON output, speed-tuned, with a single retry on transient errors. */
async function callModel(opts: {
  contents: any[];
  systemInstruction: string;
  schema: Schema;
  temperature?: number;
}) {
  const ai = getAI();
  let lastErr: any;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: opts.contents,
        config: {
          systemInstruction: opts.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: opts.schema,
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 }, // instant replies (no "thinking" delay)
        },
      });
      return parseJSON(response.text);
    } catch (err: any) {
      lastErr = err;
      const status = Number(err?.status ?? err?.code);
      const retryable = !status || [408, 429, 500, 502, 503, 504].includes(status);
      if (!retryable || attempt === 1) break;
      await sleep(700);
    }
  }
  throw lastErr;
}

// =============================================================================
// 3. THE ASSISTANT'S BRAIN (system prompt)
// =============================================================================

function buildChatSystemPrompt(p: {
  org: string;
  today: { date: string; weekday: string };
  chart: Account[];
  cashId: string;
  bankId: string;
  metrics: any;
  recent: unknown;
}): string {
  const chartBlock = p.chart.length
    ? p.chart.map((a) => `${a.id} | ${a.name} | ${a.type}`).join('\n')
    : '(No accounts were provided. Do not create entries; tell the treasurer to add accounts first.)';

  const m = p.metrics || {};
  const figures = p.metrics
    ? `Cash in hand: ${m.cashBalance ?? 'unknown'} | Bank balance: ${m.bankBalance ?? 'unknown'} | Net surplus: ${m.netSurplus ?? 'unknown'}`
    : 'Not provided.';

  const recentBlock =
    Array.isArray(p.recent) && p.recent.length
      ? `\nRECENT ENTRIES (newest last; if a new transaction looks identical to one of these, gently ask if it's a duplicate):\n${JSON.stringify(
          p.recent.slice(-25)
        ).slice(0, 3500)}\n`
      : '';

  return `You are the built-in assistant of "${p.org}", the class union's money-tracking app, talking to the union's student treasurer. You are a smart, warm, quick-witted peer who happens to know bookkeeping really well: never a stiff accountant, never a lecturer.

TODAY: ${p.today.date} (${p.today.weekday}). Currency: Indian rupees (₹).

VOICE
- Start with the answer. No filler openers ("Sure!", "Certainly", "As an AI...").
- Mirror the treasurer's language and vibe: English, Manglish, Hinglish, Malayalam or Hindi, reply the same way. Keep the books' narration in English.
- Short replies. Plain text only: no markdown symbols (no #, *, backticks, tables).
- Kind but honest: if something looks off (odd amount, possible duplicate, cash going negative), say so gently in one sentence.

TWO MODES. Pick by what the message is about.

MODE 1: GENERAL CHAT (hi, college, exams, stress, boredom, jokes, coding, science, advice, anything not about the union's money)
- Be a genuinely good conversation partner: warm, curious, a bit witty, and actually helpful. Answer questions fully (study help, code, writing, ideas).
- Do NOT mention accounts, books, vouchers, balances or money unless they do.
- hasSuggestedEntry=false, suggestedEntry=null. Give 2-3 natural followUpSuggestions.

MODE 2: UNION MONEY (spent, paid, collected, received, borrowed, repaid, deposited, bill, receipt, "how much do we have")
The treasurer has no accounting background. In your reply NEVER use words like debit, credit, ledger, journal, nominal, real account, inflow. Say what changes in plain words ("Cash goes down ₹450, Food & Refreshments goes up ₹450"). If asked why or how, teach simply with an everyday analogy (a wallet and a notebook) in a few lines.
If a message mixes both ("exam stress ugh, also paid 200 for printing"), give one short human line, then handle the money.

How to work out an entry. Think in this order:
1. What came in, what went out, who is owed?
2. Money the union RECEIVES (dues, donation, sponsorship, refund): Debit Cash or Bank, Credit the matching income account.
3. Money the union PAYS: Credit Cash or Bank, Debit what it was spent on.
4. Cash vs Bank: UPI, GPay, PhonePe, Paytm, online, net banking, card, cheque, bank transfer or a payment screenshot means Bank. "Cash", "from the cash box", "in hand" means Cash.
5. Lasting items used beyond this academic year (speakers, mics, sports gear, furniture, electronics) go to an Asset/Equipment account. Everyday or one-time things (tea, snacks, printing, stationery, hall rent, event banners/flex, prizes, travel) are Expenses. If borderline, pick the likelier one and say so in one short line.
6. Money BORROWED from a classmate (a loan or advance to the union): Debit Cash/Bank, Credit "<Person Name> (Union Payable)" (Liability). NEVER treat it as income or a donation.
7. Someone paid for the union out of their own pocket (no union cash involved): Debit the expense/asset, Credit "<Person Name> (Union Payable)". No payment-method question needed.
8. Repaying someone: Debit "<Person Name> (Union Payable)", Credit Cash/Bank.
9. Union gives money to someone to get back later: Debit "<Person Name> (Union Receivable)" (Asset), Credit Cash/Bank. Them returning it is the reverse.
10. Cash deposited into bank: Debit Bank, Credit Cash. Cash withdrawn from bank: Debit Cash, Credit Bank.
11. Split payments (part cash, part UPI; one bill with two items) use several lines. Total of debit lines MUST equal total of credit lines to the paisa. Add the numbers up before answering.
12. Use accounts ONLY from the chart below and copy the id exactly. Prefer an existing account and match by meaning ("chai" -> Food & Refreshments). Reuse a person's existing Payable/Receivable account if the chart already has one. Only if nothing fits (typically a new person's Payable/Receivable), set accountId "" and isNewAccount true with a clear accountName and accountType.
13. Narration: one clear English sentence with who/what/why, e.g. "Paid ₹450 cash for tea and snacks for the union meeting."

Missing information:
- If the AMOUNT is missing, or money moved through the union and Cash vs Bank is unclear, or money from a person could be either a gift/dues OR a loan to be returned: hasSuggestedEntry=false, ask exactly ONE short question, and give one-tap chips that answer it (e.g. "Paid by Cash", "Paid via UPI").
- Never ask about things you can sensibly assume (date = today, category = best match).
- If the latest message is just a chip answer ("Cash"), combine it with the earlier messages and finish the entry. Don't ask again.
- If they correct a draft ("make it 600", "it was UPI"), return the full corrected voucher.

When ready:
- hasSuggestedEntry=true and fill suggestedEntry.
- reply = one friendly line, then in plain words what changes (one line per part for split entries). Mention a flag only if there is something worth flagging. The reply MUST match the numbers in suggestedEntry exactly.
- The entry is a DRAFT the treasurer saves with one tap. Never say it is already saved.
- ONE voucher per reply. If the message holds several transactions, prepare the first, mention the others are waiting, and add a chip to record the next.
- Dates: today unless stated ("yesterday", "last Friday", "on the 12th"). Resolve to YYYY-MM-DD using TODAY.

Balances: answer only from CURRENT FIGURES. If the data isn't there, say so. Never invent numbers.

Receipts and screenshots: read vendor, date, items and total. A UPI/GPay/PhonePe screenshot means Bank. If the image isn't about money, just talk about it normally. If it's unreadable, say what you couldn't read and ask for it.

followUpSuggestions: 2-3 short chips (under 30 characters) worded the way the treasurer would say them.

Examples (use the chart's real ids):
- "paid 450 for tea and snacks, cash" -> Debit Food & Refreshments 450 / Credit Cash 450.
- "collected 300 dues from Anu on GPay" -> Debit Bank 300 / Credit Union Dues 300.
- "bought a speaker for 6000, 4000 cash and rest UPI" -> Debit Equipment 6000 / Credit Cash 4000 + Credit Bank 2000.
- "Priya paid 300 from her pocket for printing" -> Debit Printing 300 / Credit "Priya (Union Payable)" 300 (new account if not in chart).
- "Rahul gave 2000 via GPay" -> unclear (gift or loan?). Ask one question with chips "It's a loan to return" / "It's a contribution".
- "spent 500 on posters" -> payment method missing. Ask with chips "Paid by Cash" / "Paid via UPI".

ACTIVE CHART OF ACCOUNTS (id | name | type):
${chartBlock}
Cash account id: ${p.cashId}. Bank account id: ${p.bankId}.

CURRENT FIGURES: ${figures}
${recentBlock}`;
}

// =============================================================================
// 4. CONVERSATION MEMORY
// =============================================================================

function pushTurn(turns: Turn[], role: Turn['role'], parts: any[]) {
  const last = turns[turns.length - 1];
  if (last && last.role === role) last.parts.push(...parts);
  else turns.push({ role, parts });
}

/** Builds a Gemini-valid conversation: starts with user, alternates, no duplicates. */
function buildContents(history: unknown, prompt: string, attachmentPart?: any): Turn[] {
  const turns: Turn[] = [];
  const recent = Array.isArray(history) ? [...history].slice(-HISTORY_TURNS) : [];

  // Some frontends include the current message at the end of history; drop that duplicate.
  const last: any = recent[recent.length - 1];
  const isModelRole = (r: unknown) => ['model', 'assistant', 'ai', 'bot'].includes(String(r).toLowerCase());
  if (last && !isModelRole(last.role) && String(last.text ?? '').trim() === prompt) recent.pop();

  for (const m of recent as any[]) {
    let text = String(m?.text ?? '').trim().slice(0, HISTORY_CHARS);
    if (m?.suggestedEntry) {
      text += `\n[Draft voucher that was shown: ${JSON.stringify(m.suggestedEntry).slice(0, 800)}]`;
    }
    if (!text.trim()) continue;
    const role: Turn['role'] = isModelRole(m?.role) ? 'model' : 'user';
    if (!turns.length && role === 'model') continue; // conversation must open with the user
    pushTurn(turns, role, [{ text }]);
  }

  const parts: any[] = [];
  if (attachmentPart) parts.push(attachmentPart);
  parts.push({ text: prompt || 'Please review this.' });
  pushTurn(turns, 'user', parts);
  return turns;
}

function parseAttachment(att: any): { part?: any; error?: string } {
  if (!att?.base64) return {};
  const raw = String(att.base64);
  const match = /^data:([^;]+);base64,/.exec(raw);
  let mimeType = String(match?.[1] || att.type || 'image/jpeg').toLowerCase();
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  if (!ATTACHMENT_TYPES.test(mimeType)) {
    return { error: 'I can read photos (JPG, PNG, WebP) and PDFs. That file type is not supported.' };
  }
  const data = raw.replace(/^data:[^;]+;base64,/, '');
  if (data.length * 0.75 > MAX_ATTACHMENT_BYTES) {
    return { error: 'That file is too large for me. Try a smaller or cropped photo of the receipt.' };
  }
  return { part: { inlineData: { mimeType, data } } };
}

// =============================================================================
// 5. VOUCHER VERIFICATION (the safety net between the AI and your ledger)
// =============================================================================

function normalizeLines(raw: unknown, chart: Account[], side: 'debit' | 'credit', problems: string[]): EntryLine[] {
  const lines: EntryLine[] = [];
  if (!Array.isArray(raw)) return lines;

  for (const l of raw as any[]) {
    const amount = toMoney(l?.amount);
    const name = String(l?.accountName ?? '').trim();
    const id = String(l?.accountId ?? '').trim();

    if (amount <= 0) {
      problems.push(`A ${side} line for "${name || id}" has no valid positive amount.`);
      continue;
    }

    const match =
      (id ? chart.find((a) => a.id === id) : undefined) ??
      (name ? chart.find((a) => norm(a.name) === norm(name)) : undefined);

    if (match) {
      lines.push({ accountId: match.id, accountName: match.name, accountType: match.type, amount });
    } else if (l?.isNewAccount === true && name) {
      lines.push({
        accountId: '',
        accountName: name,
        accountType: String(l?.accountType || 'Liability'),
        amount,
        isNewAccount: true,
      });
    } else {
      problems.push(
        `The ${side} account "${name || id}" is not in the chart. Use an existing id exactly, or set isNewAccount=true with a clear name.`
      );
    }
  }
  return lines;
}

const lineKey = (l: EntryLine) => l.accountId || `new:${norm(l.accountName)}`;
const sumPaise = (lines: EntryLine[]) => lines.reduce((s, l) => s + paise(l.amount), 0);

function buildEntry(raw: any, chart: Account[], today: string): { entry?: VoucherDraft; problems: string[] } {
  const problems: string[] = [];
  if (!raw || typeof raw !== 'object') return { problems: ['suggestedEntry is missing.'] };

  const debits = normalizeLines(raw.debits, chart, 'debit', problems);
  const credits = normalizeLines(raw.credits, chart, 'credit', problems);
  if (!debits.length) problems.push('There must be at least one debit line.');
  if (!credits.length) problems.push('There must be at least one credit line.');
  if (problems.length) return { problems };

  const totalD = sumPaise(debits);
  const totalC = sumPaise(credits);
  if (totalD !== totalC) {
    problems.push(`Debit lines total ${totalD / 100} but credit lines total ${totalC / 100}. They must be equal.`);
  }
  const debitKeys = new Set(debits.map(lineKey));
  if (credits.some((c) => debitKeys.has(lineKey(c)))) {
    problems.push('The same account appears on both the debit and credit side.');
  }
  if (problems.length) return { problems };

  const rawDate = String(raw.date ?? '').trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !Number.isNaN(Date.parse(rawDate)) ? rawDate : today;
  const narration = String(raw.narration ?? '').trim().slice(0, 200) || 'Transaction recorded via assistant';

  const d0 = debits[0];
  const c0 = credits[0];
  const newAccounts = [...debits, ...credits]
    .filter((l) => l.isNewAccount)
    .map((l) => ({ name: l.accountName, type: l.accountType }));

  return {
    problems,
    entry: {
      debitAccountId: d0.accountId,
      debitAccountName: d0.accountName,
      debitAccountType: d0.accountType,
      creditAccountId: c0.accountId,
      creditAccountName: c0.accountName,
      creditAccountType: c0.accountType,
      amount: totalD / 100,
      narration,
      date,
      isCompound: debits.length > 1 || credits.length > 1,
      debits,
      credits,
      newAccounts,
    },
  };
}

/** Gentle heads-up if a payment would push Cash or Bank below zero. */
function balanceWarning(entry: VoucherDraft, ctx: CheckContext): string | null {
  const checks = [
    { id: ctx.cashId, label: 'Cash in hand', balance: parseMoney(ctx.metrics?.cashBalance) },
    { id: ctx.bankId, label: 'Bank', balance: parseMoney(ctx.metrics?.bankBalance) },
  ];
  for (const c of checks) {
    if (c.balance === undefined) continue;
    const out =
      entry.credits.filter((l) => l.accountId === c.id).reduce((s, l) => s + l.amount, 0) -
      entry.debits.filter((l) => l.accountId === c.id).reduce((s, l) => s + l.amount, 0);
    if (out > c.balance + 0.001) {
      return `Heads-up: ${c.label} shows ${fmtINR(c.balance)}, so paying ${fmtINR(out)} would take it below zero. Worth checking that a deposit or collection isn't missing.`;
    }
  }
  return null;
}

function finalizeChat(data: any, ctx: CheckContext): { response?: ChatResponse; problems?: string[] } {
  const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
  const chips = cleanChips(data?.followUpSuggestions);

  if (data?.hasSuggestedEntry !== true) {
    return { response: plainReply(reply || "I'm here. What's on your mind?", chips) };
  }

  const { entry, problems } = buildEntry(data.suggestedEntry, ctx.chart, ctx.today);
  if (!entry) return { problems };

  let finalReply = reply || 'Here is the entry. Have a look and tap save if it looks right.';
  const warning = balanceWarning(entry, ctx);
  if (warning) finalReply += `\n\n${warning}`;

  return {
    response: {
      reply: finalReply,
      hasSuggestedEntry: true,
      suggestedEntry: entry,
      followUpSuggestions: chips.length ? chips : ['Change the amount', 'Record another transaction'],
    },
  };
}

function offlineFallback(prompt: string): ChatResponse {
  const looksFinancial = /(spent|paid|pay|collect|received|borrow|lent|dues|rupee|\brs\.?|inr|₹|\d)/i.test(prompt);
  return looksFinancial
    ? plainReply('I had a quick connection hiccup while checking that. Could you send the transaction details once more?', [
        'Try again',
      ])
    : plainReply("Hey, I'm here. Sorry about that brief glitch. What's on your mind?", [
        "I'm bored, let's chat",
        'Tell me a fun fact',
        'Record an expense',
      ]);
}

// =============================================================================
// 6. TEMPLATE HELPERS
// =============================================================================

type Template = { label: string; desc: string; debit: string; credit: string; narration: string };

const DEFAULT_TEMPLATES: Template[] = [
  { label: 'Collect Union Dues', desc: 'Record student union annual membership dues collection', debit: '2', credit: '4', narration: 'Collected annual union membership contribution dues.' },
  { label: 'Food & Refreshments', desc: 'Disburse petty cash for event snacks, juices, and refreshments', debit: '7', credit: '1', narration: 'Paid cash for food and refreshments for union event.' },
  { label: 'Printing & Stationery', desc: 'Record printing notices, posters, forms, or office stationery', debit: '8', credit: '1', narration: 'Paid for printing union meeting documentation and notices.' },
  { label: 'Donation & Grants', desc: 'Record welfare donation or corporate activity sponsorship received', debit: '2', credit: '12', narration: 'Received voluntary donation and grant for union activities.' },
];

function validTemplates(raw: unknown, chart: Account[]): Template[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(chart.map((a) => a.id));
  const seen = new Set<string>();
  const out: Template[] = [];
  for (const t of raw as any[]) {
    const tpl: Template = {
      label: String(t?.label ?? '').trim(),
      desc: String(t?.desc ?? '').trim(),
      debit: String(t?.debit ?? '').trim(),
      credit: String(t?.credit ?? '').trim(),
      narration: String(t?.narration ?? '').trim(),
    };
    const pair = `${tpl.debit}>${tpl.credit}`;
    if (!tpl.label || !tpl.narration || tpl.debit === tpl.credit || seen.has(pair)) continue;
    if (chart.length && (!ids.has(tpl.debit) || !ids.has(tpl.credit))) continue;
    seen.add(pair);
    out.push(tpl);
  }
  return out.slice(0, 4);
}

function completeTemplates(have: Template[], chart: Account[]): Template[] {
  const out = [...have];
  const seen = new Set(out.map((t) => `${t.debit}>${t.credit}`));
  const ids = new Set(chart.map((a) => a.id));
  for (const d of DEFAULT_TEMPLATES) {
    if (out.length >= 4) break;
    const pair = `${d.debit}>${d.credit}`;
    if (seen.has(pair)) continue;
    if (chart.length && (!ids.has(d.debit) || !ids.has(d.credit))) continue;
    seen.add(pair);
    out.push(d);
  }
  return out;
}

// =============================================================================
// 7. SERVER
// =============================================================================

async function startServer() {
  const app = express();

  // Large limit so receipt photos can be sent as base64
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: MODEL, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  // ---------------------------------------------------------------------------
  // 7a. QUICK TRANSACTION TEMPLATES
  // ---------------------------------------------------------------------------
  app.post('/api/gemini/analyze-templates', async (req, res) => {
    try {
      const { accounts, entries } = req.body ?? {};
      if (!accounts || !Array.isArray(accounts)) {
        return res.status(400).json({ error: 'Accounts list is required and must be an array.' });
      }
      const chart = normalizeAccounts(accounts);
      let templates: Template[] = [];

      try {
        const compactEntries = Array.isArray(entries) ? entries.slice(-150) : [];
        const prompt = `Look at this class union's accounts and past transactions. Find the transaction types used most often, or that a student treasurer will clearly need every week. Then create exactly 4 "Quick Transaction Templates".

ACCOUNTS (id | name | type):
${chart.map((a) => `${a.id} | ${a.name} | ${a.type}`).join('\n')}

PAST ENTRIES (may be empty):
${JSON.stringify(compactEntries).slice(0, 12000)}

Rules:
- "debit" and "credit" must be exact ids from the accounts list. Never invent ids. They must be different accounts.
- label: 2-3 words. desc: one plain-English line. narration: a reusable sentence with no amounts.
- Money coming in debits Cash/Bank. Money going out credits Cash/Bank.`;

        const data = await callModel({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction:
            'You build helpful one-tap journal templates for a student union treasurer who knows no accounting. Use only the accounts provided.',
          schema: templatesSchema,
          temperature: 0.3,
        });
        templates = validTemplates(data, chart);
      } catch (err: any) {
        if (err instanceof ConfigError) throw err;
        console.warn('[AI Templates] Model error:', err?.message || err);
      }

      return res.json({ templates: completeTemplates(templates, chart) });
    } catch (err: any) {
      if (err instanceof ConfigError) return res.status(500).json({ error: err.message });
      console.error('Template analysis error:', err);
      return res.json({ templates: DEFAULT_TEMPLATES });
    }
  });

  // ---------------------------------------------------------------------------
  // 7b. THE ASSISTANT (chat + transaction drafting)
  // ---------------------------------------------------------------------------
  const handleAIChatRequest = async (req: express.Request, res: express.Response) => {
    try {
      const body = req.body ?? {};
      const prompt = String(body.prompt ?? '').trim().slice(0, MAX_PROMPT_CHARS);
      if (!prompt && !body.attachment?.base64) {
        return res.status(400).json({ error: 'Prompt or attachment is required.' });
      }

      const attachment = parseAttachment(body.attachment);
      if (attachment.error) return res.json(plainReply(attachment.error, ['Type the details instead']));

      const context = body.context ?? {};
      const chart = normalizeAccounts(context.accounts?.length ? context.accounts : body.accounts);
      const { cashId, bankId } = findCoreAccounts(chart);
      const today = getToday();
      const ctx: CheckContext = { chart, today: today.date, metrics: context.financialMetrics, cashId, bankId };

      const systemInstruction = buildChatSystemPrompt({
        org: String(context.orgInfo?.sheetName || 'NADA Union Ledger').slice(0, 80),
        today,
        chart,
        cashId,
        bankId,
        metrics: context.financialMetrics,
        recent: context.recentEntries,
      });

      const contents = buildContents(body.history, prompt, attachment.part);

      let data = await callModel({ contents, systemInstruction, schema: chatSchema });
      let outcome = finalizeChat(data, ctx);

      // Self-repair: if the voucher failed verification, show the model its mistake once.
      if (!outcome.response) {
        contents.push(
          { role: 'model', parts: [{ text: JSON.stringify(data) }] },
          {
            role: 'user',
            parts: [
              {
                text: `AUTOMATIC CHECK FAILED: ${(outcome.problems || []).join(' ')} Return corrected JSON for the same transaction, using account ids exactly as in the chart. If it can't be fixed without more information, set hasSuggestedEntry=false and ask one short question.`,
              },
            ],
          }
        );
        data = await callModel({ contents, systemInstruction, schema: chatSchema });
        outcome = finalizeChat(data, ctx);
      }

      return res.json(
        outcome.response ??
          plainReply("I couldn't get that entry to balance cleanly. Could you resend the amounts and how it was paid?", [
            'Try again',
          ])
      );
    } catch (err: any) {
      if (err instanceof ConfigError) return res.status(500).json({ error: err.message });
      console.warn('[AI Engine] Error:', err?.message || err);
      return res.json(offlineFallback(String(req.body?.prompt ?? '')));
    }
  };

  // Both endpoints share one handler so the frontend works either way
  app.post('/api/gemini/chat', handleAIChatRequest);
  app.post('/api/gemini/autofill-entry', handleAIChatRequest);

  // Friendly JSON errors for oversized or malformed requests
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'That file is too large. Try a smaller photo.' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
    return next(err);
  });

  // ---------------------------------------------------------------------------
  // 7c. VITE (dev) / STATIC FILES (production)
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Using Vite Dev Server Middleware...');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Catch-all written as middleware so it works on both Express 4 and Express 5
    app.use((req, res) => {
      if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
      return res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static dist files...');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-Stack Server running and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();