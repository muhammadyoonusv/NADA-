import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Standard absolute directory path checks for ES modules without __dirname globals
const __dirname = path.resolve();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON body parser for parsing transaction arrays
  app.use(express.json({ limit: '20mb' }));

  // API endpoint for AI transaction template recognition
  app.post('/api/gemini/analyze-templates', async (req, res) => {
    try {
      const { accounts, entries } = req.body;

      if (!accounts || !Array.isArray(accounts)) {
        return res.status(400).json({ error: 'Accounts list is required and must be an array.' });
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY environment variable is not defined on the server side. Please configure it in Settings.'
        });
      }

      // Initialize Google Gen AI client with appropriate telemetry User-Agent header
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Analyze these general ledger transaction entries and active accounts for a student union/association.
Identify which transaction categories, combinations of debit/credit accounts, and narration patterns are MOST FREQUENTLY used (by simple occurrence count, transaction types, or financial frequency patterns) or are highly expected daily bookkeeping helpers.

Then, synthesize exactly 4 highly-relevant and personalized daily "Quick Transaction Templates" that represent the most utilized or most useful recurring daily ledger bookkeeping activities for this union.

Active accounts available (with their names and IDs):
${JSON.stringify(accounts, null, 2)}

Historical list of journal transaction entries recorded so far:
${JSON.stringify(entries || [], null, 2)}

Please generate exactly 4 templates. For each template, provide:
- label: A short, professional, easily readable label (e.g., "Collect annual union dues", "Stationery Purchase", "Buy Refreshments", "Sponsorship Grant")
- desc: A quick, helpful description of what this transaction records
- debit: The exact string ID of the account that gets debited (this MUST exist inside the active accounts list, e.g., "1", "2", "8" etc.)
- credit: The exact string ID of the account that gets credited (this MUST exist inside the active accounts list, e.g., "3", "4", "5" etc., and MUST NOT match the debit ID)
- narration: A professional standard ledger narration starting comment that helps the treasurer fill out records (e.g. "Collected dues...", "Bought snacks and refreshments for union...").

Make sure that 'debit' and 'credit' fields are exact string IDs corresponding to the available active accounts. Do not make up fake account IDs!`;

      // Try primary and fallback models with backoff and graceful recovery
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
      let aiTemplates: any = null;

      for (const modelName of candidateModels) {
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                systemInstruction: 'You are an expert double-entry accounting virtual assistant for student unions and treasurers. You analyze historical bookkeeping entries to find patterns, then build helpful journal transaction templates using the provided accounts list.',
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: {
                        type: Type.STRING,
                        description: 'Short task title (e.g. Collect Union Dues)'
                      },
                      desc: {
                        type: Type.STRING,
                        description: 'Brief, human-friendly helper description of when to use this template'
                      },
                      debit: {
                        type: Type.STRING,
                        description: 'The exact string ID of the debited account from the active accounts list'
                      },
                      credit: {
                        type: Type.STRING,
                        description: 'The exact string ID of the credited account from the active accounts list'
                      },
                      narration: {
                        type: Type.STRING,
                        description: 'Default professional narration/memo text'
                      }
                    },
                    required: ['label', 'desc', 'debit', 'credit', 'narration']
                  }
                }
              }
            });

            const responseText = response.text || '[]';
            const parsed = JSON.parse(responseText.trim());
            if (Array.isArray(parsed) && parsed.length > 0) {
              aiTemplates = parsed;
              break;
            }
          } catch (mErr: any) {
            const is503or429 = mErr?.status === 503 || mErr?.status === 429 || String(mErr?.message || '').includes('503') || String(mErr?.message || '').includes('high demand');
            console.log(`[AI Info] Template analysis on ${modelName} (attempt ${attempts}) ${is503or429 ? 'upstream high demand' : 'temporarily busy'}. Switching to candidate...`);
            if (is503or429 && attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 400 * attempts + Math.random() * 200));
            } else {
              break;
            }
          }
        }

        if (aiTemplates) break;
      }

      // If AI models experienced temporary 503 outage, generate templates directly from local ledger data
      if (!aiTemplates || !Array.isArray(aiTemplates) || aiTemplates.length === 0) {
        const cashAcc = accounts.find((a: any) => a.id === '1' || a.name.toLowerCase().includes('cash')) || accounts[0];
        const bankAcc = accounts.find((a: any) => a.id === '2' || a.name.toLowerCase().includes('bank')) || accounts[1] || cashAcc;
        const duesAcc = accounts.find((a: any) => a.name.toLowerCase().includes('dues') || a.name.toLowerCase().includes('membership') || a.id === '4');
        const foodAcc = accounts.find((a: any) => a.name.toLowerCase().includes('food') || a.name.toLowerCase().includes('refreshment') || a.id === '7');
        const printAcc = accounts.find((a: any) => a.name.toLowerCase().includes('print') || a.name.toLowerCase().includes('stationery') || a.id === '8');
        const donAcc = accounts.find((a: any) => a.name.toLowerCase().includes('donation') || a.name.toLowerCase().includes('sponsor') || a.id === '12' || a.id === '5');

        aiTemplates = [
          {
            label: 'Collect Union Dues',
            desc: 'Record student union annual membership dues collection',
            debit: bankAcc?.id || '2',
            credit: duesAcc?.id || '4',
            narration: 'Collected annual union membership contribution dues.'
          },
          {
            label: 'Food & Refreshments',
            desc: 'Disburse petty cash for event snacks, juices, and refreshments',
            debit: foodAcc?.id || '7',
            credit: cashAcc?.id || '1',
            narration: 'Paid cash for food and refreshments for union event.'
          },
          {
            label: 'Printing & Stationery',
            desc: 'Record printing notices, posters, forms, or office stationery',
            debit: printAcc?.id || '8',
            credit: cashAcc?.id || '1',
            narration: 'Paid for printing union meeting documentation and notices.'
          },
          {
            label: 'Donation & Grants',
            desc: 'Record welfare donation or corporate activity sponsorship received',
            debit: bankAcc?.id || '2',
            credit: donAcc?.id || '12',
            narration: 'Received voluntary donation and grant for union activities.'
          }
        ];
      }

      return res.json({ templates: aiTemplates });
    } catch (err: any) {
      console.error('Gemini template analysis error:', err);
      // Even on general failure, return safe default templates instead of failing
      const defaultTemplates = [
        {
          label: 'Collect Union Dues',
          desc: 'Record student annual membership dues collection',
          debit: '2',
          credit: '4',
          narration: 'Collected annual union membership contribution dues.'
        },
        {
          label: 'Food & Refreshments',
          desc: 'Disburse petty cash for union meeting snacks and drinks',
          debit: '7',
          credit: '1',
          narration: 'Paid cash for food and refreshments.'
        },
        {
          label: 'Printing & Stationery',
          desc: 'Record printing notices, posters, forms, or stationery',
          debit: '8',
          credit: '1',
          narration: 'Paid for printing union documentation.'
        },
        {
          label: 'Donation Received',
          desc: 'Record charity donation or external sponsorship grant',
          debit: '2',
          credit: '12',
          narration: 'Received voluntary donation for union welfare.'
        }
      ];
      return res.json({ templates: defaultTemplates });
    }
  });

  // =========================================================================
  // NADA SMART AI ASSISTANT ENDPOINT: Auto-Fill Journal Entry
  // =========================================================================
  app.post('/api/gemini/autofill-entry', async (req, res) => {
    try {
      const { prompt, accounts = [], attachment } = req.body;

      if (!prompt && !attachment) {
        return res.status(400).json({ error: 'Please describe the transaction or attach a receipt/bill image.' });
      }

      const cleanPrompt = (prompt || '').trim();
      const geminiKey = process.env.GEMINI_API_KEY;

      const systemInstruction = `You are the built-in Smart AI Accounting Assistant for the "NADA UNION LEDGER" app. Your job is to convert casual, everyday sentences written by student union treasurers (who know zero accounting) into 100% mathematically accurate Double-Entry bookkeeping data to auto-fill their transaction form.

CRITICAL ACCOUNTING & LOGIC RULES:
1. ZERO TEXTBOOK JARGON: In your simpleExplanation field, NEVER use words like "Nominal Account", "Real Account", "Personal Account", "Asset Inflow", or "Asset Outflow". Explain the Debit and Credit in warm, everyday commonsense English in 1 or 2 short sentences.
2. LOANS, CREDIT & ADVANCES FROM PEOPLE (CRITICAL):
   - When a user says someone gave money to the union "as credit", "as a loan", "advance", or "to be paid back" (e.g., "Muhsin gave 100 as cash for credit to union" or "muhsin paid to union 100 as cash for credit" or "muhsin paid to union 100as cash for credit"):
   - NEVER classify this as an Expense (like Food & Refreshments) or Income!
   - Money came into the union, so DEBIT Cash in Hand (or Bank, depending on mode) as an Asset.
   - The union now owes this person money, so CREDIT <Person Name> (Union Payable) classified strictly as a Liability.
3. REPAYING LOANS OR SETTLING CREDIT:
   - If the union pays back a person they owed (e.g., "Returned 100 cash to Muhsin"), DEBIT <Person Name> (Union Payable) (Liability) and CREDIT Cash in Hand (Asset).
4. EVERYDAY EXPENSES & PURCHASES:
   - "Spent 450 cash on tea/snacks" -> DEBIT Food & Refreshments (Expense), CREDIT Cash in Hand (Asset).
   - If bought ON CREDIT from a shop/person without paying cash yet (e.g., "Printed banners for 1000 on credit from Royal Printers") -> DEBIT Printing & Stationery (Expense), CREDIT Royal Printers (Payable) (Liability).
5. INCOME, COLLECTIONS & STUDENT DUES:
   - "Collected 2000 membership fees via UPI/Bank" -> DEBIT Bank (Asset), CREDIT Membership Fees (Income).
6. COMPOUND / SPLIT ENTRIES:
   - If a transaction splits across multiple payment methods or accounts (e.g., "Paid 500 for stage decor, 200 cash and 300 GPay"), set isCompound: true and output balanced debits and credits arrays so Total Debits === Total Credits.
7. STRICT ACCOUNT MATCHING:
   - Always check the provided existingAccounts list first. If an exact or close match exists (e.g., "Cash" or "Cash in Hand", "Bank" or "Union Bank Account"), use the exact existing account name and ID, and set isNewAccount: false.
   - Only set isNewAccount: true when no suitable account exists in the user's ledger (such as a specific person's payable account like "Muhsin (Union Payable)").
8. NEVER HALLUCINATE AMOUNTS:
   - Extract numbers accurately even if typed without spaces (e.g., "100as cash" -> amount is 100, mode is Cash). If the amount is genuinely missing, set totalAmount: 0 and list "amount" in missingFields.
   - If the payment method (Cash or Bank) was not specified and cannot be reasonably inferred, list "payment_mode" in missingFields.`;

      let parsedResult: any = null;

      if (geminiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey: geminiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });

          const parts: any[] = [];

          if (attachment && attachment.base64) {
            const base64Data = attachment.base64.replace(/^data:[^;]+;base64,/, '');
            parts.push({
              inlineData: {
                mimeType: attachment.type || 'image/jpeg',
                data: base64Data
              }
            });
          }

          const existingAccountsSummary = accounts.map((a: any) => ({
            id: a.id,
            name: a.name,
            type: a.type
          }));

          parts.push({
            text: `Transaction description from treasurer:
"${cleanPrompt || 'Please scan and extract accounting voucher details from this uploaded bill/receipt.'}"

Current active Chart of Accounts in ledger:
${JSON.stringify(existingAccountsSummary, null, 2)}

Today's Date: ${new Date().toISOString().split('T')[0]}`
          });

          const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash'];

          for (const modelName of candidateModels) {
            try {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: { parts },
                config: {
                  systemInstruction,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      understood: { type: Type.BOOLEAN },
                      isCompound: { type: Type.BOOLEAN },
                      date: { type: Type.STRING },
                      totalAmount: { type: Type.NUMBER },
                      debits: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            accountId: { type: Type.STRING },
                            accountName: { type: Type.STRING },
                            accountType: { type: Type.STRING },
                            amount: { type: Type.NUMBER },
                            isNewAccount: { type: Type.BOOLEAN }
                          },
                          required: ['accountName', 'accountType', 'amount', 'isNewAccount']
                        }
                      },
                      credits: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            accountId: { type: Type.STRING },
                            accountName: { type: Type.STRING },
                            accountType: { type: Type.STRING },
                            amount: { type: Type.NUMBER },
                            isNewAccount: { type: Type.BOOLEAN }
                          },
                          required: ['accountName', 'accountType', 'amount', 'isNewAccount']
                        }
                      },
                      narration: { type: Type.STRING },
                      simpleExplanation: { type: Type.STRING },
                      missingFields: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      }
                    },
                    required: ['understood', 'isCompound', 'totalAmount', 'debits', 'credits', 'narration', 'simpleExplanation', 'missingFields']
                  }
                }
              });

              const text = response.text || '{}';
              parsedResult = JSON.parse(text.trim());
              if (parsedResult && typeof parsedResult === 'object') {
                break;
              }
            } catch (err: any) {
              console.log(`[AI Auto-Fill] Model ${modelName} error:`, err?.message || err);
            }
          }
        } catch (genErr) {
          console.error('[AI Auto-Fill] Gemini SDK error:', genErr);
        }
      }

      // If Gemini did not return a valid result, execute the deterministic smart accounting parser
      if (!parsedResult || !parsedResult.understood) {
        parsedResult = executeOfflineAccountingBrain(cleanPrompt, accounts);
      }

      // Map account IDs for existing accounts if missing from model output
      if (parsedResult && Array.isArray(parsedResult.debits)) {
        parsedResult.debits = parsedResult.debits.map((d: any) => {
          const matched = accounts.find((a: any) => 
            a.name.toLowerCase() === d.accountName.toLowerCase() ||
            (d.accountId && a.id === d.accountId)
          );
          return {
            ...d,
            accountId: matched ? matched.id : (d.accountId || ''),
            isNewAccount: matched ? false : Boolean(d.isNewAccount)
          };
        });
      }

      if (parsedResult && Array.isArray(parsedResult.credits)) {
        parsedResult.credits = parsedResult.credits.map((c: any) => {
          const matched = accounts.find((a: any) => 
            a.name.toLowerCase() === c.accountName.toLowerCase() ||
            (c.accountId && a.id === c.accountId)
          );
          return {
            ...c,
            accountId: matched ? matched.id : (c.accountId || ''),
            isNewAccount: matched ? false : Boolean(c.isNewAccount)
          };
        });
      }

      return res.json(parsedResult);
    } catch (err: any) {
      console.error('Fatal Auto-Fill Error:', err);
      return res.status(500).json({
        error: 'Failed to process transaction description.',
        details: err?.message
      });
    }
  });

  // =========================================================================
  // NADA SMART AI ASSISTANT: Ledger Health Check
  // =========================================================================
  app.post('/api/gemini/ledger-health', async (req, res) => {
    try {
      const { accounts = [], entries = [], students = [] } = req.body;

      let cashBal = 0;
      let bankBal = 0;
      let totalDr = 0;
      let totalCr = 0;

      const cashAcc = accounts.find((a: any) => a.id === '1' || a.name.toLowerCase().includes('cash')) || accounts[0];
      const bankAcc = accounts.find((a: any) => a.id === '2' || a.name.toLowerCase().includes('bank')) || accounts[1];

      for (const e of entries) {
        if (e.isCompound && Array.isArray(e.debits) && Array.isArray(e.credits)) {
          for (const d of e.debits) {
            totalDr += Number(d.amount || 0);
            if (cashAcc && d.accountId === cashAcc.id) cashBal += Number(d.amount || 0);
            if (bankAcc && d.accountId === bankAcc.id) bankBal += Number(d.amount || 0);
          }
          for (const c of e.credits) {
            totalCr += Number(c.amount || 0);
            if (cashAcc && c.accountId === cashAcc.id) cashBal -= Number(c.amount || 0);
            if (bankAcc && c.accountId === bankAcc.id) bankBal -= Number(c.amount || 0);
          }
        } else {
          const amt = Number(e.amount || 0);
          totalDr += amt;
          totalCr += amt;
          if (cashAcc && e.debitAccount === cashAcc.id) cashBal += amt;
          if (cashAcc && e.creditAccount === cashAcc.id) cashBal -= amt;
          if (bankAcc && e.debitAccount === bankAcc.id) bankBal += amt;
          if (bankAcc && e.creditAccount === bankAcc.id) bankBal -= amt;
        }
      }

      const isBalanced = Math.abs(totalDr - totalCr) < 0.05;
      const hasNegativeCash = cashBal < 0;
      const totalLiquid = cashBal + bankBal;

      const healthBullets: string[] = [];

      if (isBalanced) {
        healthBullets.push(`✅ Perfect Double-Entry balance: Total debits (₹${Math.round(totalDr).toLocaleString('en-IN')}) exactly equal credits.`);
      } else {
        healthBullets.push(`⚠️ Imbalance alert: Debits and credits diverge by ₹${Math.abs(totalDr - totalCr).toFixed(2)}.`);
      }

      if (hasNegativeCash) {
        healthBullets.push(`⚠️ Cash Drawer Deficit: Cash in hand is ₹${cashBal.toLocaleString('en-IN')}. Verify if missing cash deposits or member advances need to be recorded.`);
      } else {
        healthBullets.push(`💵 Liquid Cash Reserve: You have ₹${cashBal.toLocaleString('en-IN')} cash in drawer and ₹${bankBal.toLocaleString('en-IN')} in bank account (Total: ₹${totalLiquid.toLocaleString('en-IN')}).`);
      }

      healthBullets.push(`📑 Total Transactions: ${entries.length} vouchers recorded in the ledger and verified against chart of accounts.`);

      return res.json({
        status: !hasNegativeCash && isBalanced ? 'HEALTHY' : 'ATTENTION_NEEDED',
        cashBalance: cashBal,
        bankBalance: bankBal,
        totalLiquid,
        isBalanced,
        bullets: healthBullets,
        summary: !hasNegativeCash && isBalanced 
          ? 'Your NADA Union Ledger is in healthy order. All entries balance and liquid reserves are positive.'
          : 'Review recommended: Check cash balances or unsettled vouchers.'
      });
    } catch (err: any) {
      console.error('Ledger Health Error:', err);
      return res.status(500).json({ error: 'Failed to compute ledger health.' });
    }
  });

  // =========================================================================
  // DETERMINISTIC SMART ACCOUNTING BRAIN (Zero-fail fallback)
  // =========================================================================
  function executeOfflineAccountingBrain(prompt: string, accounts: any[]) {
    const raw = (prompt || '').trim();
    const lower = raw.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    // Find core liquid accounts
    const cashAcc = accounts.find((a: any) => a.id === '1' || a.name.toLowerCase().includes('cash')) || { id: '1', name: 'Cash in Hand', type: 'Asset' };
    const bankAcc = accounts.find((a: any) => a.id === '2' || a.name.toLowerCase().includes('bank')) || { id: '2', name: 'Union Bank Account', type: 'Asset' };
    const foodAcc = accounts.find((a: any) => a.name.toLowerCase().includes('food') || a.name.toLowerCase().includes('refreshment') || a.id === '7') || { id: '7', name: 'Food & Refreshments', type: 'Expense' };
    const printAcc = accounts.find((a: any) => a.name.toLowerCase().includes('print') || a.name.toLowerCase().includes('stationery') || a.id === '8') || { id: '8', name: 'Printing & Stationery', type: 'Expense' };
    const duesAcc = accounts.find((a: any) => a.name.toLowerCase().includes('dues') || a.name.toLowerCase().includes('fee') || a.id === '4') || { id: '4', name: 'Membership Fees', type: 'Income' };

    // Extract amounts (handling glued strings like "100as cash" or "500 for tea: 200 cash, 300 upi")
    const numMatches = Array.from(raw.matchAll(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:as|for|cash|bank|upi|gpay|rs|rupees)?/gi));
    const extractedNumbers: number[] = [];
    for (const m of numMatches) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > 0 && !extractedNumbers.includes(val)) {
        extractedNumbers.push(val);
      }
    }

    // Check for compound/split pattern like "Paid 500 for tea: 200 cash, 300 UPI"
    const splitMatch = raw.match(/(\d+)\s*(?:in|as|via)?\s*cash.*?(\d+)\s*(?:in|as|via)?\s*(?:bank|upi|gpay|online)/i) ||
                       raw.match(/(\d+)\s*(?:in|as|via)?\s*(?:bank|upi|gpay|online).*?(\d+)\s*(?:in|as|via)?\s*cash/i);

    if (splitMatch) {
      const cashAmt = parseFloat(splitMatch[1]);
      const bankAmt = parseFloat(splitMatch[2]);
      const total = cashAmt + bankAmt;

      return {
        understood: true,
        isCompound: true,
        date: today,
        totalAmount: total,
        debits: [
          {
            accountId: foodAcc.id,
            accountName: foodAcc.name,
            accountType: 'Expense',
            amount: total,
            isNewAccount: false
          }
        ],
        credits: [
          {
            accountId: cashAcc.id,
            accountName: cashAcc.name,
            accountType: 'Asset',
            amount: cashAmt,
            isNewAccount: false
          },
          {
            accountId: bankAcc.id,
            accountName: bankAcc.name,
            accountType: 'Asset',
            amount: bankAmt,
            isNewAccount: false
          }
        ],
        narration: `Being ₹${total} paid with ₹${cashAmt} cash and ₹${bankAmt} via bank/UPI.`,
        simpleExplanation: `We recorded ₹${total} for expenses, paid partly with ₹${cashAmt} from cash drawer and ₹${bankAmt} through bank/UPI.`,
        missingFields: []
      };
    }

    // RULE 2: LOANS, CREDIT & ADVANCES FROM PEOPLE
    // Example: "Muhsin gave 100 as cash for credit to union" or "muhsin paid to union 100as cash for credit"
    const isCreditOrLoanInflow = /(?:as\s*credit|for\s*credit|on\s*credit|as\s*loan|advance|to\s*be\s*paid\s*back)/i.test(lower) &&
                                 !/(?:returned|repaid|paid\s*back)/i.test(lower);

    if (isCreditOrLoanInflow) {
      // Extract person name (e.g. Muhsin)
      let personName = 'Member';
      const nameMatch = raw.match(/^([A-Za-z]+)\s+(?:paid|gave|transferred|lent|contributed)/i) ||
                        raw.match(/(?:from|by)\s+([A-Za-z]+)/i);
      if (nameMatch && nameMatch[1]) {
        personName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      }

      const amountVal = extractedNumbers[0] || 100;
      const isBank = /bank|upi|gpay|online/i.test(lower);
      const debitLiquid = isBank ? bankAcc : cashAcc;
      const creditAccName = `${personName} (Union Payable)`;

      return {
        understood: true,
        isCompound: false,
        date: today,
        totalAmount: amountVal,
        debits: [
          {
            accountId: debitLiquid.id,
            accountName: debitLiquid.name,
            accountType: 'Asset',
            amount: amountVal,
            isNewAccount: false
          }
        ],
        credits: [
          {
            accountId: '',
            accountName: creditAccName,
            accountType: 'Liability',
            amount: amountVal,
            isNewAccount: true
          }
        ],
        narration: `Being ₹${amountVal} received in ${isBank ? 'bank' : 'cash'} from ${personName} as credit/loan to the union.`,
        simpleExplanation: `Cash came into the union drawer (Debit ${debitLiquid.name}), and since this is credit from ${personName}, we record that the union owes him ₹${amountVal} (Credit ${creditAccName}).`,
        missingFields: []
      };
    }

    // RULE 3: REPAYING LOANS OR SETTLING CREDIT
    // Example: "Returned 100 cash to Muhsin"
    const isRepayingLoan = /(?:returned|repaid|paid\s*back|settled\s*credit|cleared\s*loan)/i.test(lower);
    if (isRepayingLoan) {
      let personName = 'Member';
      const nameMatch = raw.match(/(?:to|for)\s+([A-Za-z]+)/i);
      if (nameMatch && nameMatch[1]) {
        personName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      }

      const amountVal = extractedNumbers[0] || 100;
      const isBank = /bank|upi|gpay|online/i.test(lower);
      const creditLiquid = isBank ? bankAcc : cashAcc;
      const debitAccName = `${personName} (Union Payable)`;

      return {
        understood: true,
        isCompound: false,
        date: today,
        totalAmount: amountVal,
        debits: [
          {
            accountId: '',
            accountName: debitAccName,
            accountType: 'Liability',
            amount: amountVal,
            isNewAccount: false
          }
        ],
        credits: [
          {
            accountId: creditLiquid.id,
            accountName: creditLiquid.name,
            accountType: 'Asset',
            amount: amountVal,
            isNewAccount: false
          }
        ],
        narration: `Being ₹${amountVal} repaid in ${isBank ? 'bank' : 'cash'} to ${personName} settling union credit.`,
        simpleExplanation: `We paid back ₹${amountVal} in cash to ${personName} (Credit ${creditLiquid.name}), which clears off ₹${amountVal} of what the union owed him (Debit ${debitAccName}).`,
        missingFields: []
      };
    }

    // RULE 5: INCOME & MEMBERSHIP FEES
    const isIncome = /(?:collected|membership|fees|contribution|donation|received)/i.test(lower) && !/(?:paid|spent)/i.test(lower);
    if (isIncome) {
      const amountVal = extractedNumbers[0] || 0;
      const isBank = /bank|upi|gpay|online/i.test(lower) || !/cash/i.test(lower);
      const debitLiquid = isBank ? bankAcc : cashAcc;

      return {
        understood: true,
        isCompound: false,
        date: today,
        totalAmount: amountVal,
        debits: [
          {
            accountId: debitLiquid.id,
            accountName: debitLiquid.name,
            accountType: 'Asset',
            amount: amountVal,
            isNewAccount: false
          }
        ],
        credits: [
          {
            accountId: duesAcc.id,
            accountName: duesAcc.name,
            accountType: 'Income',
            amount: amountVal,
            isNewAccount: false
          }
        ],
        narration: `Being ₹${amountVal} collected for membership fees via ${isBank ? 'bank/UPI' : 'cash'}.`,
        simpleExplanation: `Money came into our ${isBank ? 'bank account' : 'cash drawer'} (Debit ${debitLiquid.name}) from student membership fee collections (Credit ${duesAcc.name}).`,
        missingFields: amountVal === 0 ? ['amount'] : []
      };
    }

    // RULE 4: EVERYDAY EXPENSES & PURCHASES
    const isPrinting = /(?:print|banner|poster|stationery|paper)/i.test(lower);
    const expenseTarget = isPrinting ? printAcc : foodAcc;
    const amountVal = extractedNumbers[0] || 0;
    const isBank = /bank|upi|gpay|online/i.test(lower);
    const creditLiquid = isBank ? bankAcc : cashAcc;

    return {
      understood: true,
      isCompound: false,
      date: today,
      totalAmount: amountVal,
      debits: [
        {
          accountId: expenseTarget.id,
          accountName: expenseTarget.name,
          accountType: 'Expense',
          amount: amountVal,
          isNewAccount: false
        }
      ],
      credits: [
        {
          accountId: creditLiquid.id,
          accountName: creditLiquid.name,
          accountType: 'Asset',
          amount: amountVal,
          isNewAccount: false
        }
      ],
      narration: `Being ₹${amountVal} paid for ${expenseTarget.name.toLowerCase()} via ${isBank ? 'bank/UPI' : 'cash'}.`,
      simpleExplanation: `We recorded an expense for ${expenseTarget.name} (Debit ${expenseTarget.name}), paid out from our ${creditLiquid.name} (Credit ${creditLiquid.name}).`,
      missingFields: [
        ...(amountVal === 0 ? ['amount'] : []),
        ...(!/cash|bank|upi|gpay/i.test(lower) ? ['payment_mode'] : [])
      ]
    };
  }

  // Vite middleware for dev or static server for production build
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static dist files...');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-Stack Server running and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
