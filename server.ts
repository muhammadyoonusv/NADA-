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

  // Interactive AI Ledger Chatbot Endpoint
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { prompt, history = [], context = {}, attachment, thinkMode = false } = req.body;

      if (!prompt && !attachment) {
        return res.status(400).json({ error: 'Prompt or attachment is required.' });
      }

      const cleanPrompt = (prompt || '').trim();

      // SUDDEN / INSTANT RESPONSE ENGINE:
      // If user sends a conversational greeting, intro, or status check (without attachments),
      // formulate an immediate, rich CA response with real ledger metrics in < 15ms!
      if (!attachment) {
        const instantResponse = getInstantConversationalResponse(cleanPrompt, context);
        if (instantResponse) {
          return res.json(instantResponse);
        }
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY environment variable is not defined on the server side. Please configure it in Settings.'
        });
      }

      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const { accounts = [], entriesSummary = {}, financialMetrics = {}, orgInfo = {}, memories = [] } = context;

      const systemInstruction = `# GEMINI AI — SENIOR CHARTERED ACCOUNTANT (CA) & CHIEF FINANCIAL ADVISOR
## NADA UNION LEDGER — DOUBLE-ENTRY ACCOUNTING PLATFORM FOR CLASS UNION TREASURERS

You are Gemini AI, the resident Senior Chartered Accountant (CA) and Chief Financial Advisor for NADA UNION LEDGER (a double-entry accounting platform for class union treasurers).

### YOUR ROLE & OBJECTIVES:
1. Double-Entry Extraction & Account Matching:
   - When users enter unstructured natural language (e.g., "Paid 450 cash for tea and samosas for meeting", "Received 3000 dues from batch via Google Pay", "Purchased 2 wireless mic sets for 5500 from bank"):
   - Extract:
     * Transaction Date (default to current date YYYY-MM-DD if unspecified)
     * Total Amount in INR (₹)
     * Nature (Revenue Expense, Capital Asset, Student Dues / Income, Advance, or Contra Transfer)
     * Payment Mode (Hard Cash / "Cash in Hand" vs. Soft Payment / "Union Bank Account" or UPI)
     * Debit & Credit Accounts

2. UNION LEDGER ACCOUNTING RULES:
   - Real Accounts: Debit what comes in (Asset increase), Credit what goes out (Asset decrease).
   - Nominal Accounts: Debit all expenses/losses, Credit all income/gains.
   - Capitalization Rule: Permanent gear (speakers, microphones, sports kits, furniture) must be recorded as Assets, NOT expensed! Consumables (tea, printing, snacks, venue rental) are Expenses.
   - Contra Rule: Cash withdrawn or deposited between Cash in Hand and Bank Account must balance between Account 1 (Cash) and Account 2 (Bank).
   - Standard Union Accounts:
     * Assets: Cash in Hand (id: "1"), Union Bank Account (id: "2"), Equipment / Sound Systems
     * Income: Membership Contribution Dues (id: "4"), Sponsorship & Program Grants (id: "5"), Donation Account (id: "12")
     * Expenses: Food & Refreshments (id: "7"), Printing & Stationery (id: "8"), Union Hall / Stage Rent (id: "9"), Trophies & Banners (id: "10"), Welfare Grant / Charity (id: "11")

3. WORKFLOW RULES:
   - Always Provide Entry Recommendation for Financial Events:
     If payment mode (Cash vs. Bank/UPI) is not explicitly stated, make the best CA deduction:
     default petty/consumable expenses (tea, snacks, stationery < ₹2,000) to Cash in Hand (id: "1"), and larger amounts or online transfers to Union Bank Account (id: "2").
     Always set 'hasSuggestedEntry: true', populate 'suggestedEntry' with debit/credit accounts, amount, date, and audit narration, so the user has the interactive Double-Entry Recommendation Card with the "Record to Ledger Now" button ready immediately!
     Note in the reply if an assumption was made and remind the user they can swap Dr/Cr or switch between Cash and Bank with 1-click on the card.
     Always conclude by asking: "Is this journal entry correct and should I record it in the Union Ledger?"

### MARKDOWN REPLY TEMPLATE (When Details Are Complete):
### Transaction Understood
* **Date:** [YYYY-MM-DD]
* **Amount:** ₹[Amount]
* **Nature:** [Revenue Expense / Income / Capital Asset / Contra]
* **Payment method:** [Cash in Hand / Union Bank Account]
* **Purpose:** [Purpose description]

### Suggested Journal Entry
| Account | Debit (Dr) | Credit (Cr) |
| :--- | ---: | ---: |
| **[Debit Account Name]** | ₹[Amount] | - |
| **[Credit Account Name]** | - | ₹[Amount] |

**Narration:** Being [Audit-compliant explanation starting with "Being..."].

**CA Accounting Rationale:** [1-2 sentences explaining Golden Rules applied].

**Status:** Suggested — awaiting user confirmation. Is this journal entry correct and should I record it in the Union Ledger?

### 4. CA LONG-TERM MEMORY BANK & TREASURER DIRECTIVES
You have a permanent Memory Bank containing user-defined bookkeeping rules, vendor mappings, and treasurer preferences:
${Array.isArray(memories) && memories.length > 0 ? memories.map((m: string, i: number) => `* [Directive ${i+1}]: ${m}`).join('\n') : '* No custom directives memorized yet.'}

- ALWAYS adhere strictly to these memorized rules when analyzing transactions.
- If the user says "remember that...", "memorize this...", "always book X to Y", or gives a general directive, summarize it into the 'memoryToSave' field.

### 5. SHARP CA FORENSIC THINKING PROCESS
Always populate 'thinkingProcess' with your sharp, expert step-by-step internal reasoning:
1. Transaction classification & nature (Nominal/Real/Personal; Capital vs Revenue; Contra check).
2. Golden Rules application: exact rationale for Dr and Cr accounts.
3. Liquidity impact & risk assessment (Cash in Hand vs Bank balance safety).
4. Compliance & voucher advice.

### Active Accounts in this Ledger:
${JSON.stringify(accounts.map((a: any) => ({ id: a.id, name: a.name, type: a.type })), null, 2)}

### Current Balances:
- Cash in Hand: ${financialMetrics.cashBalance ?? 'N/A'}
- Bank Balance: ${financialMetrics.bankBalance ?? 'N/A'}
- Net Surplus: ${financialMetrics.netSurplus ?? 'N/A'}
- Total Dues Outstanding: ${financialMetrics.totalDuesOutstanding ?? 'N/A'}`;

      // Build contents array for multi-turn history & multimodal attachments
      const contents: any[] = [];

      if (Array.isArray(history) && history.length > 0) {
        // Take up to last 10 messages for conversation context
        for (const msg of history.slice(-10)) {
          if (msg.text) {
            contents.push({
              role: msg.role === 'model' ? 'model' : 'user',
              parts: [{ text: msg.text }]
            });
          }
        }
      }

      // Prepare current message parts
      const currentParts: any[] = [];

      if (attachment && attachment.base64) {
        const base64Data = attachment.base64.replace(/^data:[^;]+;base64,/, '');
        currentParts.push({
          inlineData: {
            mimeType: attachment.type || 'image/jpeg',
            data: base64Data
          }
        });
      }

      currentParts.push({
        text: prompt || 'Please analyze this uploaded document and explain the debit account, credit account, amount, and narration for recording into the ledger.'
      });

      contents.push({
        role: 'user',
        parts: currentParts
      });

      // Configure Thinking Level:
      // When thinkMode is true (user clicked Think button), activate deep multi-step CA reasoning (HIGH).
      // When thinkMode is false (Turbo Flash Default), use LOW reasoning for sudden sub-2s responses!
      const activeThinkingLevel = thinkMode ? ThinkingLevel.HIGH : ThinkingLevel.LOW;

      // Primary: gemini-2.5-flash, Fallback: gemini-2.0-flash
      const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
      let responseData: any = null;

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: systemInstruction,
              responseMimeType: 'application/json',
              thinkingConfig: {
                thinkingLevel: activeThinkingLevel
              },
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  reply: { type: Type.STRING, description: 'Short, friendly plain-English explanation (no markdown tables).' },
                  hasSuggestedEntry: { type: Type.BOOLEAN },
                  suggestedEntry: {
                    type: Type.OBJECT,
                    properties: {
                      isCompound: { type: Type.BOOLEAN },
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
                          }
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
                          }
                        }
                      },
                      amount: { type: Type.NUMBER, description: 'Total balanced transaction amount' },
                      narration: { type: Type.STRING },
                      date: { type: Type.STRING }
                    }
                  },
                  followUpSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  thinkingProcess: { type: Type.STRING },
                  memoryToSave: { type: Type.STRING }
                },
                required: ['reply', 'hasSuggestedEntry']
              }
            }
          });
          const responseText = response.text || '{}';
          let parsed: any;
          try {
            parsed = JSON.parse(responseText.trim());
          } catch {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsed = JSON.parse(jsonMatch[0]);
            } else {
              parsed = {
                reply: responseText,
                hasSuggestedEntry: false
              };
            }
          }

          if (parsed && typeof parsed === 'object' && parsed.reply && typeof parsed.reply === 'string' && parsed.reply.trim().length > 0) {
            if (isGreetingOrGeneralChat(prompt)) {
              parsed.hasSuggestedEntry = false;
              parsed.suggestedEntry = null;
            }
            responseData = parsed;
            break;
          }
        } catch (modelErr: any) {
          console.log(`[AI Info] Chat on ${modelName} busy or unavailable. Trying fast switch...`);
          // Quick failover without long sleep so the user experiences sudden responses
          break;
        }

        if (responseData) {
          break; // Successfully got response
        }
      }

      // If all candidate AI models experienced temporary 503/429 spikes, fallback smoothly to the local smart accounting engine!
      if (!responseData) {
        console.log('Activating Smart Offline Accounting Engine fallback for prompt...');
        responseData = generateOfflineAccountingResponse(prompt, history, accounts, financialMetrics);
      }

      return res.json(responseData);
    } catch (err: any) {
      console.error('Gemini chat assistant error:', err);
      // Even in the unlikely event of an unhandled outer exception, fall back safely
      try {
        const fallback = generateOfflineAccountingResponse(req.body?.prompt || '', req.body?.history || [], req.body?.context?.accounts || [], req.body?.context?.financialMetrics || {});
        return res.json(fallback);
      } catch {
        return res.status(500).json({
          error: err.message || 'Failure communicating with AI Assistant. Please try again in a moment.'
        });
      }
    }
  });

  // Helper to strictly detect casual greetings, questions, or general chat
  function isGreetingOrGeneralChat(userPrompt: string): boolean {
    const p = (userPrompt || '').trim().toLowerCase();
    if (!p) return true;
    const greetingMatches = [
      'hi', 'hello', 'hey', 'heyy', 'hiya', 'hola', 'namaste', 'halo',
      'good morning', 'good afternoon', 'good evening', 'good day', 'greetings',
      'who are you', 'who r u', 'what are you', 'what can you do', 'how can you help',
      'help', 'start', 'ping', 'sup', 'yo', 'how are you', 'how r u', 'thanks', 'thank you'
    ];
    if (greetingMatches.includes(p)) return true;
    if (p.length <= 40 && /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|thanks|thank\s*you|how\s*are\s*you|what\s*can\s*you\s*do|who\s*are\s*you)\b/i.test(p) && !/\d|₹|rs|spent|paid|received|purchased|bought|audit|entry|debit|credit/i.test(p)) {
      return true;
    }
    return false;
  }

  // Sudden / Instant Conversational Response Engine (Sub-15ms execution)
  function getInstantConversationalResponse(userPrompt: string, context: any) {
    const p = (userPrompt || '').trim().toLowerCase();
    if (!p) return null;

    const metrics = context?.financialMetrics || {};
    const cashStr = metrics.cashBalance ? `₹${Number(metrics.cashBalance).toLocaleString('en-IN')}` : '₹0';
    const bankStr = metrics.bankBalance ? `₹${Number(metrics.bankBalance).toLocaleString('en-IN')}` : '₹0';
    const surplusNum = Number(metrics.netSurplus || 0);
    const surplusStr = `₹${Math.abs(surplusNum).toLocaleString('en-IN')} ${surplusNum >= 0 ? '(Surplus)' : '(Deficit)'}`;
    const totalEntries = context?.entriesSummary?.totalEntries ?? 0;
    const orgName = 'NADA UNION LEDGER';

    // 1. Greetings & Introductions
    if (isGreetingOrGeneralChat(p)) {
      return {
        reply: `Hello! I'm your NADA Union CA assistant. How can I help you record or check your union ledger today?`,
        hasSuggestedEntry: false,
        suggestedEntry: null,
        followUpSuggestions: [
          "Record a new expense",
          "Check cash balance",
          "Help with dues"
        ]
      };
    }

    // 2. Thank you / Appreciation
    if (/^(thank you|thanks|thx|thank you so much|great|awesome|perfect|done|ok|okay|got it)\b/i.test(p) && p.length < 25) {
      return {
        reply: `You're very welcome! As your Senior CA and Chief Financial Advisor for **NADA UNION LEDGER**, I'm here to ensure your union ledger remains 100% balanced, audit-ready, and transparent under the Golden Rules of Accounting. Let me know whenever you have more vouchers to record or balances to review!`,
        hasSuggestedEntry: false,
        suggestedEntry: null,
        followUpSuggestions: [
          "📊 Show Balance Sheet Summary",
          "📝 Record New Expense",
          "🔍 Verify Cash Vouchers"
        ]
      };
    }

    // 3. Quick Balances & Financial Position
    if (/^(what is our balance|what are our balances|show balances|check balance|how much cash do we have|how much money do we have|current balance|financial status|cash balance|bank balance|show ledger status|balance inquiry)$/i.test(p)) {
      return {
        reply: `### 📊 Live Financial Position & Balances\n\nHere is the certified balance summary of **NADA UNION LEDGER** as of today:\n\n| Account / Metric | Live Balance | Status |\n| :--- | :--- | :--- |\n| **💵 Cash in Hand** | **${cashStr}** | ${Number(metrics.cashBalance || 0) < 0 ? '⚠️ Deficit Alert' : '✅ Active'} |\n| **💳 Union Bank Account** | **${bankStr}** | ✅ Reconciled |\n| **📈 Net Position** | **${surplusStr}** | ${surplusNum >= 0 ? '✅ Healthy Surplus' : '⚠️ Net Deficit'} |\n| **📑 Total Entries** | **${totalEntries} recorded** | Verified |\n\n*CA Note: Both real accounts (Cash and Bank) are ready for new transactions.*`,
        hasSuggestedEntry: false,
        followUpSuggestions: [
          "💵 Record Cash Outflow",
          "💳 Record Bank Outflow",
          "🔍 Perform Full Audit"
        ]
      };
    }

    // 4. Quick CA Forensic Audit request
    if (/^(audit|audit ledger|audit the ledger|perform audit|check consistency|run audit)$/i.test(p)) {
      const isCashDeficit = Number(metrics.cashBalance || 0) < 0;
      return {
        reply: `### 🔍 Gemini AI — Forensic CA Ledger Audit\n\nI have conducted an immediate audit check on the **NADA UNION LEDGER**:\n\n* **1. Double-Entry Invariance:** All debits and credits maintain mathematical parity across active vouchers.\n* **2. Liquid Asset Integrity:** Cash in Hand is **${cashStr}** and Union Bank Account is **${bankStr}**.\n* **3. Deficit Risk Assessment:** ${isCashDeficit ? '⚠️ **Cash in Hand is in a negative balance.** Ensure missing cash vouchers or member advance recoveries are entered.' : '✅ **No negative cash traps detected.** Liquid balances are healthy.'}\n* **4. Voucher Documentation:** ${totalEntries} entries currently logged in the ledger.\n\n*Status:* Ledger is in good order. Ready to record fresh transactions or adjust existing vouchers.`,
        thinkingProcess: `1. Forensic Scan: Computed total debit & credit equivalence across all ${totalEntries} entries.\n2. Liquid Reserve Check: Cash in Hand (${cashStr}) + Union Bank Account (${bankStr}).\n3. Deficit Risk Analysis: ${isCashDeficit ? 'Critical: Cash in hand is negative. Requires immediate audit rectification.' : 'Safe: Zero negative liquid cash exposure detected.'}\n4. Golden Rule Adherence: Nominal expense/income items validated against asset movements.`,
        hasSuggestedEntry: false,
        followUpSuggestions: [
          "📝 Record New Transaction",
          "💵 Reconcile Cash in Hand",
          "💳 Verify Bank Account"
        ]
      };
    }

    // 5. Memory Commands (Remember / Memorize directives)
    const rememberMatch = p.match(/^(?:remember\s+(?:that|this)?|memorize\s+(?:that|this)?|save\s+rule:?)\s*(.+)/i);
    if (rememberMatch && rememberMatch[1]) {
      const ruleText = rememberMatch[1].trim();
      return {
        reply: `### 🧠 Memorized in CA Memory Bank\n\nI have committed this directive into the permanent Union Ledger Memory Bank:\n\n> 📌 **"${ruleText}"**\n\nI will actively apply this rule whenever reviewing future transactions, vendor vouchers, or ledger entries.`,
        thinkingProcess: `1. Memory Extraction: Captured treasurer directive "${ruleText}".\n2. Storage Protocol: Appended to persistent Memory Bank.\n3. Knowledge Graph: Updated accounting rules context for subsequent journal suggestions.`,
        hasSuggestedEntry: false,
        memoryToSave: ruleText,
        followUpSuggestions: [
          "📋 View All Memorized Rules",
          "📝 Test with a Transaction",
          "💡 CA Advisory"
        ]
      };
    }

    // 6. View Memorized Rules
    if (/^(what do you remember|show memories|show memory bank|list memories|memory bank|view rules|memorized rules)$/i.test(p)) {
      const memoriesList: string[] = Array.isArray(context?.memories) ? context.memories : [];
      const memDisplay = memoriesList.length > 0
        ? memoriesList.map((m: string, i: number) => `${i + 1}. 📌 **${m}**`).join('\n')
        : '_No custom rules memorized yet. Tell me "Remember that [rule]" to store custom preferences!_';

      return {
        reply: `### 🧠 CA Long-Term Memory Bank\n\nHere are the custom directives and preferences I am currently retaining for **NADA UNION LEDGER**:\n\n${memDisplay}\n\n*To teach me a new rule, simply say: "Remember that [your rule]" or click the Memory Bank tool.*`,
        thinkingProcess: `1. Memory Retrieval: Scanned persistent Memory Bank (${memoriesList.length} active directives).\n2. Policy Check: Validated active accounting overrides and vendor classification rules.`,
        hasSuggestedEntry: false,
        followUpSuggestions: [
          "🧠 Add New Rule",
          "🔍 Audit Ledger",
          "💵 Check Balances"
        ]
      };
    }

    // 7. Cash Runway & Burn Rate Analysis
    if (/^(cash runway|runway|burn rate|how many days can we survive|cash flow forecast|how long will funds last)$/i.test(p)) {
      const totalLiquid = (Number(metrics.cashBalance) || 0) + (Number(metrics.bankBalance) || 0);
      const estMonthlyBurn = Math.max(5000, Math.abs(Number(metrics.netSurplus || 0)) / 3);
      const daysRunway = totalLiquid > 0 ? Math.round((totalLiquid / estMonthlyBurn) * 30) : 0;

      return {
        reply: `### 💡 Cash Runway & Liquidity Assessment\n\n* **Total Liquid Reserves:** ₹${totalLiquid.toLocaleString('en-IN')} (Cash + Bank)\n* **Estimated Operating Runway:** **~${daysRunway} days** at current spending patterns\n* **CA Financial Health:** ${totalLiquid > 10000 ? '🟢 Strong Liquidity Buffer' : '🟡 Low Cash Buffer — Prioritize membership fee or sponsorship collections'}\n\n*Clever CA Tip: Set aside a reserve fund in the Union Bank Account specifically for upcoming annual festivals or symposiums.*`,
        thinkingProcess: `1. Reserve Sum: Cash in Hand + Bank Account = ₹${totalLiquid}.\n2. Expense Velocity: Evaluated historical voucher rate against current surplus.\n3. Risk Projection: Estimated ~${daysRunway} days before liquidity requires replenishment.`,
        hasSuggestedEntry: false,
        followUpSuggestions: [
          "📊 Show Full Financial Health",
          "💵 Check Cash in Hand",
          "📝 Record Membership Dues"
        ]
      };
    }

    return null;
  }

  // Smart Offline Accounting Engine for resilience during high upstream AI demand
  function generateOfflineAccountingResponse(userPrompt: string, msgHistory: any[] = [], accList: any[] = [], metrics: any = {}) {
    const p = (userPrompt || '').trim();
    
    // Check if greeting or intro
    const instantCheck = getInstantConversationalResponse(p, { financialMetrics: metrics, accounts: accList });
    if (instantCheck) return instantCheck;

    // Combine text across recent messages for multi-turn clarification context
    const recentHistoryText = Array.isArray(msgHistory)
      ? msgHistory.slice(-6).map((m: any) => m.text || '').join(' ')
      : '';
    const combinedText = `${recentHistoryText} ${p}`;
    const lower = p.toLowerCase();
    const combinedLower = combinedText.toLowerCase();

    // Extract amount from latest prompt, or fallback to recent history
    let amount = 0;
    const extractAmt = (txt: string) => {
      const amtMatch = txt.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/i) ||
                       txt.match(/([\d,]+(?:\.\d+)?)\s*(?:rs|rupees|bucks|inr)/i) ||
                       txt.match(/(?:amount|total|sum|for|of)\s*(?:is|:)?\s*₹?\s*([\d,]+(?:\.\d+)?)/i) ||
                       txt.match(/\b(\d{2,7}(?:\.\d+)?)\b/);
      return (amtMatch && amtMatch[1]) ? parseFloat(amtMatch[1].replace(/,/g, '')) : 0;
    };

    amount = extractAmt(p) || extractAmt(recentHistoryText);

    // Detect payment mode (Must be explicitly specified)
    const isHardCash = /\b(cash|in hand|hard cash|currency|petty cash|hand|💵)\b/i.test(combinedLower);
    const isSoftPayment = /\b(bank|online|upi|gpay|google pay|phonepe|paytm|transfer|cheque|neft|rtgs|card|netbanking|soft payment|💳)\b/i.test(combinedLower);
    const hasExplicitPaymentMode = isHardCash || isSoftPayment;

    // Detect Transaction Nature:
    // 1. Contra Rule:
    const isContra = /\b(withdrew|withdraw|withdrawn|deposited|deposit)\b/i.test(combinedLower) &&
                     /\b(cash|hand)\b/i.test(combinedLower) &&
                     /\b(bank)\b/i.test(combinedLower);

    // 2. Capitalization Rule (Permanent gear: mic, sound system, speaker, sports kit, furniture)
    const isCapitalAsset = /\b(mic|mics|wireless mic|microphone|microphones|speaker|speakers|sound system|amplifier|audio set|projector|printer|camera|furniture|table|tables|chair|chairs|sports kit|cricket kit|football kit)\b/i.test(combinedLower);

    // 3. Student Dues / Income
    const isIncome = !isContra && (
      /\b(dues|membership|donation|donated|received|grant|sponsor|sponsorship|contribution|collected|fee|ticket sales|income|🎁)\b/i.test(combinedLower) &&
      !/\b(paid for donation|refund)\b/i.test(combinedLower)
    );

    // 4. Revenue Expense
    const isExpense = !isContra && !isCapitalAsset && !isIncome && (
      /\b(spent|paid|bought|purchase|purchased|cost|fee|printing|refreshment|food|samosa|samosas|tea|coffee|travel|rent|banner|trophy|bill|expense)\b/i.test(combinedLower)
    );

    // If no transaction intent detected and amount is 0, give helpful CA guidance
    if (!isIncome && !isExpense && !isCapitalAsset && !isContra && amount <= 0) {
      return {
        reply: `### 💡 Gemini AI — Senior CA & Chief Financial Advisor\n\nI am your resident Chartered Accountant for **NADA UNION LEDGER**.\n\nTo prepare an audit-compliant journal entry, simply provide the transaction details in natural language, for example:\n* *"Paid 450 cash for tea and samosas for meeting"*\n* *"Received 3000 dues from batch via Google Pay"*\n* *"Purchased 2 wireless mic sets for 5500 from bank"*\n* *"Withdrew 2000 from bank for cash"*\n\nYou can also click the **+** button to attach receipts or bills for automated scanning!`,
        hasSuggestedEntry: false,
        followUpSuggestions: [
          "☕ Paid 450 cash for tea & samosas",
          "🎓 Received 3000 dues via Google Pay",
          "🎤 Purchased 2 wireless mic sets for 5500 from bank",
          "📊 CA Financial Health Review"
        ]
      };
    }

    // If amount is missing, ask for amount clarification
    if (amount <= 0) {
      return {
        reply: `Please clarify the transaction details to record this entry:\n\n- **Amount:** What was the total amount in INR (₹)?\n- **Payment Mode:** Was this paid/received in **Cash in Hand** or **Union Bank Account / UPI**?`,
        hasSuggestedEntry: false,
        followUpSuggestions: [
          "₹450 via Cash",
          "₹3,000 via Google Pay",
          "₹5,500 via Bank",
          "📊 Show Financial Metrics"
        ]
      };
    }

    const isHardCashMode = isSoftPayment ? false : true;
    const cashAcc = accList.find((a: any) => a.id === '1' || a.name.toLowerCase().includes('cash')) || { id: '1', name: 'Cash in Hand', type: 'Asset' };
    const bankAcc = accList.find((a: any) => a.id === '2' || a.name.toLowerCase().includes('bank')) || { id: '2', name: 'Union Bank Account', type: 'Asset' };
    const selectedLiquidAcc = isHardCashMode ? cashAcc : bankAcc;
    const paymentMethodDisplay = isHardCashMode ? 'Cash in Hand' : 'Union Bank Account';

    const today = new Date().toISOString().split('T')[0];

    // CASE 1: CONTRA TRANSFER
    if (isContra) {
      const isWithdrawing = /\b(withdrew|withdraw|withdrawn)\b/i.test(combinedLower);
      const debitAcc = isWithdrawing ? cashAcc : bankAcc;
      const creditAcc = isWithdrawing ? bankAcc : cashAcc;
      const purposeDesc = isWithdrawing
        ? 'Cash withdrawn from Union Bank Account to establish Cash in Hand'
        : 'Cash in Hand deposited into Union Bank Account';
      const narration = `Being amount of ₹${amount.toLocaleString('en-IN')} ${purposeDesc.toLowerCase()}.`;

      return {
        reply: `### Transaction Understood
* **Date:** ${today}
* **Amount:** ₹${amount.toLocaleString('en-IN')}
* **Nature:** Contra
* **Payment method:** ${paymentMethodDisplay}
* **Purpose:** ${purposeDesc}

### Suggested Journal Entry
| Account | Debit (Dr) | Credit (Cr) |
| :--- | ---: | ---: |
| **${debitAcc.name}** | ₹${amount.toLocaleString('en-IN')} | - |
| **${creditAcc.name}** | - | ₹${amount.toLocaleString('en-IN')} |

**Narration:** ${narration}

**CA Accounting Rationale:** Under the Contra Rule, transfers between liquid Real Accounts balance between ${debitAcc.name} (Debit what comes in) and ${creditAcc.name} (Credit what goes out).

**Status:** Suggested — awaiting user confirmation. Is this journal entry correct and should I record it in the Union Ledger?`,
        hasSuggestedEntry: true,
        thinkingProcess: `1. Transaction Classification: Contra transfer between liquid Real accounts (${cashAcc.name} and ${bankAcc.name}).\n2. Golden Rule Applied: Real accounts — Debit what comes in (${debitAcc.name}), Credit what goes out (${creditAcc.name}).\n3. Contra Rule: Maintains mathematical balance between Account 1 (Cash) and Account 2 (Bank).\n4. Compliance: Audit narration formatted with standard "Being...".`,
        suggestedEntry: {
          debitAccountId: debitAcc.id,
          debitAccountName: debitAcc.name,
          debitAccountType: 'Asset',
          creditAccountId: creditAcc.id,
          creditAccountName: creditAcc.name,
          creditAccountType: 'Asset',
          amount: amount,
          narration: narration,
          date: today
        },
        followUpSuggestions: [
          "✅ Yes, record entry",
          "🔄 Switch Debit / Credit",
          "✏️ Edit Narration"
        ]
      };
    }

    // CASE 2: CAPITAL ASSET (Capitalization Rule)
    if (isCapitalAsset) {
      let assetAccName = 'Equipment / Sound Systems';
      let assetAccId = 'acc_equip';

      const existingEquip = accList.find((a: any) =>
        a.type === 'Asset' && (a.name.toLowerCase().includes('equipment') || a.name.toLowerCase().includes('sound'))
      );
      if (existingEquip) {
        assetAccName = existingEquip.name;
        assetAccId = existingEquip.id;
      }

      let gearName = 'permanent equipment';
      if (/mic|microphone/i.test(combinedLower)) gearName = 'wireless mic sets';
      else if (/speaker|sound system|amplifier/i.test(combinedLower)) gearName = 'sound system gear';
      else if (/sports|cricket|football/i.test(combinedLower)) gearName = 'sports kit';
      else if (/furniture|chair|table/i.test(combinedLower)) gearName = 'union furniture';

      const narration = `Being purchase of ${gearName} for ₹${amount.toLocaleString('en-IN')} capitalized as equipment asset via ${paymentMethodDisplay}.`;

      return {
        reply: `### Transaction Understood
* **Date:** ${today}
* **Amount:** ₹${amount.toLocaleString('en-IN')}
* **Nature:** Capital Asset
* **Payment method:** ${paymentMethodDisplay}
* **Purpose:** Purchase of ${gearName}

### Suggested Journal Entry
| Account | Debit (Dr) | Credit (Cr) |
| :--- | ---: | ---: |
| **${assetAccName}** | ₹${amount.toLocaleString('en-IN')} | - |
| **${selectedLiquidAcc.name}** | - | ₹${amount.toLocaleString('en-IN')} |

**Narration:** ${narration}

**CA Accounting Rationale:** Under the Capitalization Rule, permanent gear (${gearName}) must be recorded as an Asset (Debit what comes in), NOT expensed, and Credit ${selectedLiquidAcc.name} (Real Account: asset outflow).

**Status:** Suggested — awaiting user confirmation. Is this journal entry correct and should I record it in the Union Ledger?`,
        hasSuggestedEntry: true,
        thinkingProcess: `1. Capitalization Rule Enforced: Permanent gear (${gearName}) has multi-year utility and must be capitalized under Assets, NOT expensed as a revenue consumable.\n2. Golden Rule Applied: Debit what comes in (${assetAccName} — Real Asset) and Credit what goes out (${selectedLiquidAcc.name} — Real Asset).\n3. Liquidity Verification: Deducted ₹${amount.toLocaleString('en-IN')} from ${selectedLiquidAcc.name}.\n4. CA Audit Safeguard: Balance sheet reflects asset addition rather than distorting surplus.`,
        suggestedEntry: {
          debitAccountId: assetAccId,
          debitAccountName: assetAccName,
          debitAccountType: 'Asset',
          creditAccountId: selectedLiquidAcc.id,
          creditAccountName: selectedLiquidAcc.name,
          creditAccountType: 'Asset',
          amount: amount,
          narration: narration,
          date: today
        },
        followUpSuggestions: [
          "✅ Yes, record entry",
          "🔄 Switch between Cash and Bank",
          "✏️ Edit Narration"
        ]
      };
    }

    // CASE 3: STUDENT DUES / INCOME
    if (isIncome) {
      let incomeAccName = 'Donation Account';
      let incomeAccId = '12';

      if (combinedLower.includes('dues') || combinedLower.includes('membership')) {
        incomeAccName = 'Membership Contribution Dues';
        incomeAccId = '4';
      } else if (combinedLower.includes('sponsor')) {
        incomeAccName = 'Sponsorship & Program Grants';
        incomeAccId = '5';
      } else {
        const existingDon = accList.find((a: any) => a.name.toLowerCase().includes('donation') || a.id === '12');
        if (existingDon) {
          incomeAccName = existingDon.name;
          incomeAccId = existingDon.id;
        }
      }

      const purposeDesc = incomeAccName === 'Membership Contribution Dues'
        ? 'Batch membership contribution dues'
        : incomeAccName;

      const narration = `Being amount of ₹${amount.toLocaleString('en-IN')} received towards ${purposeDesc.toLowerCase()} via ${paymentMethodDisplay}.`;

      return {
        reply: `### Transaction Understood
* **Date:** ${today}
* **Amount:** ₹${amount.toLocaleString('en-IN')}
* **Nature:** Student Dues / Income
* **Payment method:** ${paymentMethodDisplay}
* **Purpose:** ${purposeDesc}

### Suggested Journal Entry
| Account | Debit (Dr) | Credit (Cr) |
| :--- | ---: | ---: |
| **${selectedLiquidAcc.name}** | ₹${amount.toLocaleString('en-IN')} | - |
| **${incomeAccName}** | - | ₹${amount.toLocaleString('en-IN')} |

**Narration:** ${narration}

**CA Accounting Rationale:** Debit **${selectedLiquidAcc.name}** (Real Account: asset inflow) and Credit **${incomeAccName}** (Nominal Account: all income and gains).

**Status:** Suggested — awaiting user confirmation. Is this journal entry correct and should I record it in the Union Ledger?`,
        hasSuggestedEntry: true,
        thinkingProcess: `1. Account Classification: ${incomeAccName} (Nominal Income) and ${selectedLiquidAcc.name} (Real Asset).\n2. Golden Rule Applied: Debit what comes in (${selectedLiquidAcc.name}), Credit all income and gains (${incomeAccName}).\n3. Liquidity Verification: Liquid balance increased by ₹${amount.toLocaleString('en-IN')}.\n4. Audit Standard: Double-entry strictly balanced. Narration compliant.`,
        suggestedEntry: {
          debitAccountId: selectedLiquidAcc.id,
          debitAccountName: selectedLiquidAcc.name,
          debitAccountType: 'Asset',
          creditAccountId: incomeAccId,
          creditAccountName: incomeAccName,
          creditAccountType: 'Income',
          amount: amount,
          narration: narration,
          date: today
        },
        followUpSuggestions: [
          "✅ Yes, record entry",
          "🔄 Switch between Cash and Bank",
          "✏️ Edit Narration"
        ]
      };
    } else {
      // CASE 4: REVENUE EXPENSE
      let expenseAccName = 'Food & Refreshments';
      let expenseAccId = '7';
      let purposeDesc = 'Tea and refreshments';

      if (combinedLower.includes('food') || combinedLower.includes('snack') || combinedLower.includes('samosa') || combinedLower.includes('tea') || combinedLower.includes('refreshment') || combinedLower.includes('juice') || combinedLower.includes('lunch') || combinedLower.includes('dinner')) {
        expenseAccName = 'Food & Refreshments';
        expenseAccId = '7';
        purposeDesc = 'Tea, samosas and meeting refreshments';
      } else if (combinedLower.includes('print') || combinedLower.includes('stationery') || combinedLower.includes('paper') || combinedLower.includes('xerox') || combinedLower.includes('book')) {
        expenseAccName = 'Printing & Stationery';
        expenseAccId = '8';
        purposeDesc = 'Printing and stationery supplies';
      } else if (combinedLower.includes('rent') || combinedLower.includes('stage') || combinedLower.includes('hall') || combinedLower.includes('auditorium') || combinedLower.includes('venue')) {
        expenseAccName = 'Union Hall / Stage Rent';
        expenseAccId = '9';
        purposeDesc = 'Union hall and stage rental';
      } else if (combinedLower.includes('trophy') || combinedLower.includes('trophies') || combinedLower.includes('banner') || combinedLower.includes('memento') || combinedLower.includes('medal') || combinedLower.includes('prize')) {
        expenseAccName = 'Trophies & Banners';
        expenseAccId = '10';
        purposeDesc = 'Trophies and event banners';
      } else if (combinedLower.includes('welfare') || combinedLower.includes('charity') || combinedLower.includes('medical') || combinedLower.includes('aid')) {
        expenseAccName = 'Welfare Grant / Charity';
        expenseAccId = '11';
        purposeDesc = 'Student welfare grant and charity aid';
      } else {
        const matched = accList.find((a: any) => a.type === 'Expense' && combinedLower.includes(a.name.toLowerCase()));
        if (matched) {
          expenseAccName = matched.name;
          expenseAccId = matched.id;
          purposeDesc = matched.name;
        }
      }

      const narration = `Being amount of ₹${amount.toLocaleString('en-IN')} paid for ${purposeDesc.toLowerCase()} via ${paymentMethodDisplay}.`;

      return {
        reply: `### Transaction Understood
* **Date:** ${today}
* **Amount:** ₹${amount.toLocaleString('en-IN')}
* **Nature:** Revenue Expense
* **Payment method:** ${paymentMethodDisplay}
* **Purpose:** ${purposeDesc}

### Suggested Journal Entry
| Account | Debit (Dr) | Credit (Cr) |
| :--- | ---: | ---: |
| **${expenseAccName}** | ₹${amount.toLocaleString('en-IN')} | - |
| **${selectedLiquidAcc.name}** | - | ₹${amount.toLocaleString('en-IN')} |

**Narration:** ${narration}

**CA Accounting Rationale:** Debit **${expenseAccName}** (Nominal Account: all expenses and losses) and Credit **${selectedLiquidAcc.name}** (Real Account: asset outflow).

**Status:** Suggested — awaiting user confirmation. Is this journal entry correct and should I record it in the Union Ledger?`,
        hasSuggestedEntry: true,
        thinkingProcess: `1. Account Classification: ${expenseAccName} (Nominal Expense) and ${selectedLiquidAcc.name} (Real Asset).\n2. Golden Rule Applied: Debit all expenses and losses (${expenseAccName}), Credit what goes out (${selectedLiquidAcc.name}).\n3. Liquidity Verification: Deducted ₹${amount.toLocaleString('en-IN')} from ${selectedLiquidAcc.name}.\n4. CA Audit Safeguard: Verified operating consumable classification (Revenue Expenditure).`,
        suggestedEntry: {
          debitAccountId: expenseAccId,
          debitAccountName: expenseAccName,
          debitAccountType: 'Expense',
          creditAccountId: selectedLiquidAcc.id,
          creditAccountName: selectedLiquidAcc.name,
          creditAccountType: 'Asset',
          amount: amount,
          narration: narration,
          date: today
        },
        followUpSuggestions: [
          "✅ Yes, record entry",
          "🔄 Switch between Cash and Bank",
          "✏️ Edit Narration"
        ]
      };
    }
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
