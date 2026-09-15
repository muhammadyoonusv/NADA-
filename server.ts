import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
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
      const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
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
      const { prompt, history = [], context = {}, attachment } = req.body;

      if (!prompt && !attachment) {
        return res.status(400).json({ error: 'Prompt or attachment is required.' });
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

      const { accounts = [], entriesSummary = {}, financialMetrics = {}, orgInfo = {} } = context;

      const systemInstruction = `You are an expert Double-Entry Accountant Assistant (NADA BOT).
Your primary job is to SIMPLY, ACCURATELY, and CLEARLY handle accounting entries in short, simple words. NEVER write long paragraphs.

### 🔴 STRICT MANDATORY CLARIFICATION RULE:
You MUST NEVER generate a suggested journal entry until ALL required transaction details are known.
Specifically, every journal entry MUST have:
1. **Payment Mode**: MUST be explicitly known as either **Hard Cash (Cash in Hand)** or **Soft Payment (Bank / UPI / Online / Transfer)**.
   - If the user DID NOT explicitly state whether payment was in cash or bank/UPI, you MUST ALWAYS ASK FOR CLARIFICATION FIRST. NEVER guess, assume, or default to cash without confirmation!
2. **Amount**: Total transaction amount in ₹. If missing or ₹0, ask for the amount!
3. **Purpose**: What was the transaction for (e.g., Food, Stage, Rent, Donation, Printing).

### 🔄 STEP-BY-STEP WORKFLOW:

#### STEP 1 — MANDATORY CLARIFICATION (When Payment Mode or Amount is Missing):
- If Payment Mode is NOT explicitly stated by the user (or in recent conversation history):
  - **Do NOT provide a journal entry yet.**
  - Set \`hasSuggestedEntry: false\`.
  - Format your reply directly with concise bullet points:
    *Example:*
    Please clarify the transaction details:
    - **Payment Mode:** Was this paid/received in **Hard Cash (Cash in Hand)** or **Soft Payment (Bank / UPI)**?
    - **Amount:** What was the total amount in ₹? *(only if amount was also missing)*
  - Provide quick 1-tap options in \`followUpSuggestions\`:
    - "💵 Paid in Hard Cash (Cash in Hand)" (or "💵 Received in Hard Cash" if income)
    - "💳 Paid via Soft Payment (Bank / UPI)" (or "💳 Received via Bank / UPI" if income)

#### STEP 2 — GENERATE ENTRY (ONLY When Both Payment Mode AND Amount Are Confirmed):
- Once Payment Mode (Hard Cash or Soft Payment / Bank / UPI) AND Amount are both confirmed:
  - **For Income / Donation / Receipts (Money In)**:
    * **Debit (Dr):** Cash in Hand (if Hard Cash) OR Union Bank Account (if Soft Payment/Bank/UPI) *(Asset increases)*
    * **Credit (Cr):** Donation Account / Specific Income Account *(Income increases)*
    * Set \`debitAccountName\`: "Cash in Hand" or "Union Bank Account", \`creditAccountName\`: "[Income Account Name]", \`creditAccountType\`: "Income".
  - **For Expenses / Outflows (Money Out)**:
    * **Debit (Dr):** [Specific Expense Account Name] *(Expense increases)*
    * **Credit (Cr):** Cash in Hand (if Hard Cash) OR Union Bank Account (if Soft Payment/Bank/UPI) *(Asset decreases)*
    * Set \`debitAccountName\`: "[Expense Account Name]", \`creditAccountName\`: "Cash in Hand" or "Union Bank Account".

  - Format your message concisely:
    **Debit (Dr):** [Account Name]
    **Credit (Cr):** [Account Name]
    **Narration:** [Simple narration]
    **Amount:** ₹[Amount]

  - Set \`hasSuggestedEntry: true\` with the complete structured \`suggestedEntry\` object so the user can record it with 1-click.

### 🌟 ACCOUNT NAMING:
- Create a specific account name directly matching the user's activity/hint (e.g., "Donation Account", "Farewell Party Expense", "Stage & Decoration Expense", "Food & Refreshments").
- If it doesn't exist in the active accounts list below, leave \`debitAccountId: ""\` or \`creditAccountId: ""\` with the recommended name in \`debitAccountName\` or \`creditAccountName\`.

### STRICT RULES:
1. **NO GUESSING PAYMENT MODE**: Never assume Cash or Bank without user clarification. Always ask first if unstated.
2. **NO LONG PARAGRAPHS**: Keep all replies under 4-5 short lines. Use bullet points or bold labels only.
3. **NO PERSON NAMES**: Never mention personal names or greetings.
4. **NO JARGON**: Use simple, everyday words.

### Active Accounts in this Ledger:
${JSON.stringify(accounts.map((a: any) => ({ id: a.id, name: a.name, type: a.type })), null, 2)}

### Current Balances:
- Cash in Hand: ${financialMetrics.cashBalance ?? 'N/A'}
- Bank Balance: ${financialMetrics.bankBalance ?? 'N/A'}`;

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

      // Robust fallback list across current supported Gemini models to survive temporary 503/429 demand spikes
      const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let responseData: any = null;

      for (const modelName of candidateModels) {
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    reply: {
                      type: Type.STRING,
                      description: 'The comprehensive, direct markdown response explaining the accounting rationale, accounts to debit and credit, narration, and guidance without mentioning any person names'
                    },
                    hasSuggestedEntry: {
                      type: Type.BOOLEAN,
                      description: 'True if a journal entry should be recommended based on the transaction discussed'
                    },
                    suggestedEntry: {
                      type: Type.OBJECT,
                      properties: {
                        debitAccountId: { type: Type.STRING, description: 'ID of the account to debit from active accounts list if exists, or empty string' },
                        debitAccountName: { type: Type.STRING, description: 'Specific name of the account to debit created directly from hints' },
                        debitAccountType: { type: Type.STRING, description: 'Account category: Expense, Asset, Income, or Liability' },
                        creditAccountId: { type: Type.STRING, description: 'ID of the account to credit from active accounts list' },
                        creditAccountName: { type: Type.STRING, description: 'Name of the account to credit' },
                        creditAccountType: { type: Type.STRING, description: 'Account category: Asset, Liability, Equity, Income, or Expense' },
                        amount: { type: Type.NUMBER, description: 'Transaction amount or 0 if unspecified' },
                        narration: { type: Type.STRING, description: 'Audit-ready journal narration' },
                        date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' }
                      }
                    },
                    followUpSuggestions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: '2 to 3 short follow-up suggestions'
                    }
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

            if (parsed && typeof parsed === 'object') {
              responseData = parsed;
              break;
            }
          } catch (modelErr: any) {
            const is503or429 = modelErr?.status === 503 || modelErr?.status === 429 || String(modelErr?.message || '').includes('503') || String(modelErr?.message || '').includes('high demand');
            console.log(`[AI Info] Chat on ${modelName} (attempt ${attempts}) ${is503or429 ? 'upstream high demand' : 'busy'}. Switching candidate...`);
            if (is503or429 && attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 400 * attempts + Math.random() * 200));
            } else {
              break;
            }
          }
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

  // Smart Offline Accounting Engine for resilience during high upstream AI demand
  function generateOfflineAccountingResponse(userPrompt: string, msgHistory: any[] = [], accList: any[] = [], metrics: any = {}) {
    const p = (userPrompt || '').trim();
    
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
    const isHardCash = /\b(cash|in hand|hard cash|note|currency|petty cash|hand|💵)\b/i.test(combinedLower);
    const isSoftPayment = /\b(bank|online|upi|gpay|phonepe|paytm|transfer|cheque|neft|rtgs|card|netbanking|soft payment|💳)\b/i.test(combinedLower);
    const hasExplicitPaymentMode = isHardCash || isSoftPayment;

    // Detect Income vs Expense
    const isIncome = /\b(donation|donated|received|grant|sponsor|sponsorship|contribution|collected|dues|fee|membership|income|fund|ticket|🎁)\b/i.test(combinedLower) && !/\b(paid for donation|refund)\b/i.test(combinedLower);

    // STRICT MANDATORY CLARIFICATION: If Payment Mode or Amount is missing, ALWAYS ask clarification!
    if (!hasExplicitPaymentMode || amount <= 0) {
      if (!hasExplicitPaymentMode && amount > 0) {
        return {
          reply: `Please clarify the payment mode to prepare this entry:\n\n- **Payment Mode:** Was this ${isIncome ? 'received' : 'paid'} in **Hard Cash (Cash in Hand)** or **Soft Payment (Bank / UPI)**?`,
          hasSuggestedEntry: false,
          followUpSuggestions: isIncome ? [
            "💵 Received in Hard Cash (Cash in Hand)",
            "💳 Received via Soft Payment (Bank / UPI)"
          ] : [
            "💵 Paid in Hard Cash (Cash in Hand)",
            "💳 Paid via Soft Payment (Bank / UPI)"
          ]
        };
      }

      if (hasExplicitPaymentMode && amount <= 0) {
        return {
          reply: `Please clarify the transaction amount:\n\n- **Amount:** What was the total amount in ₹?`,
          hasSuggestedEntry: false,
          followUpSuggestions: [
            "₹500",
            "₹1,000",
            "₹2,500",
            "₹5,000"
          ]
        };
      }

      return {
        reply: `Please clarify the transaction details to record this entry:\n\n- **Payment Mode:** Was this paid/received in **Hard Cash (Cash in Hand)** or **Soft Payment (Bank / UPI)**?\n- **Amount:** What was the total amount in ₹?\n- **Purpose:** What was this transaction for?`,
        hasSuggestedEntry: false,
        followUpSuggestions: [
          "💵 Paid in Hard Cash (Cash in Hand)",
          "💳 Paid via Soft Payment (Bank / UPI)",
          "🎁 Received Donation in Cash"
        ]
      };
    }

    const cashAcc = accList.find((a: any) => a.id === '1' || a.name.toLowerCase().includes('cash')) || { id: '1', name: 'Cash in Hand', type: 'Asset' };
    const bankAcc = accList.find((a: any) => a.id === '2' || a.name.toLowerCase().includes('bank')) || { id: '2', name: 'Union Bank Account', type: 'Asset' };
    const selectedLiquidAcc = isHardCash ? cashAcc : bankAcc;

    const today = new Date().toISOString().split('T')[0];

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

      const narration = `Received ${incomeAccName.toLowerCase()} of ₹${amount.toLocaleString('en-IN')} via ${selectedLiquidAcc.name}.`;

      return {
        reply: `**Debit (Dr):** ${selectedLiquidAcc.name} *(Asset increases)*\n**Credit (Cr):** ${incomeAccName} *(Income increases)*\n**Amount:** ₹${amount.toLocaleString('en-IN')}\n**Narration:** ${narration}`,
        hasSuggestedEntry: true,
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
          "Record this transaction to ledger",
          "Switch between Cash and Bank",
          "Set Credit to Donation Account"
        ]
      };
    } else {
      // Expense
      let expenseAccName = 'General Union Expense';
      let expenseAccId = '';

      if (combinedLower.includes('food') || combinedLower.includes('snack') || combinedLower.includes('tea') || combinedLower.includes('refreshment') || combinedLower.includes('juice') || combinedLower.includes('lunch') || combinedLower.includes('dinner')) {
        expenseAccName = 'Food & Refreshments';
        expenseAccId = '7';
      } else if (combinedLower.includes('print') || combinedLower.includes('stationery') || combinedLower.includes('paper') || combinedLower.includes('xerox') || combinedLower.includes('book')) {
        expenseAccName = 'Printing & Stationery';
        expenseAccId = '8';
      } else if (combinedLower.includes('rent') || combinedLower.includes('stage') || combinedLower.includes('hall') || combinedLower.includes('auditorium') || combinedLower.includes('venue')) {
        expenseAccName = 'Union Hall / Stage Rent';
        expenseAccId = '9';
      } else if (combinedLower.includes('trophy') || combinedLower.includes('trophies') || combinedLower.includes('banner') || combinedLower.includes('memento') || combinedLower.includes('medal') || combinedLower.includes('prize')) {
        expenseAccName = 'Trophies & Banners';
        expenseAccId = '10';
      } else if (combinedLower.includes('welfare') || combinedLower.includes('charity') || combinedLower.includes('medical') || combinedLower.includes('aid')) {
        expenseAccName = 'Welfare Grant / Charity';
        expenseAccId = '11';
      } else if (combinedLower.includes('farewell')) {
        expenseAccName = 'Farewell Party Expense';
        expenseAccId = '';
      } else if (combinedLower.includes('sports') || combinedLower.includes('game') || combinedLower.includes('tournament') || combinedLower.includes('cricket') || combinedLower.includes('football')) {
        expenseAccName = 'Sports & Tournament Expense';
        expenseAccId = '';
      } else {
        const matched = accList.find((a: any) => a.type === 'Expense' && combinedLower.includes(a.name.toLowerCase()));
        if (matched) {
          expenseAccName = matched.name;
          expenseAccId = matched.id;
        }
      }

      const narration = `Paid ₹${amount.toLocaleString('en-IN')} for ${expenseAccName.toLowerCase()} via ${selectedLiquidAcc.name}.`;

      return {
        reply: `**Debit (Dr):** ${expenseAccName} *(Expense increases)*\n**Credit (Cr):** ${selectedLiquidAcc.name} *(Asset decreases)*\n**Amount:** ₹${amount.toLocaleString('en-IN')}\n**Narration:** ${narration}`,
        hasSuggestedEntry: true,
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
          "Record this transaction to ledger",
          "Switch between Cash and Bank",
          "Add specific details to narration"
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
