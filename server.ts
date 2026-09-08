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

      // Call Gemini 3.5-flash with structured JSON schema
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
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
      const aiTemplates = JSON.parse(responseText.trim());

      return res.json({ templates: aiTemplates });
    } catch (err: any) {
      console.error('Gemini template analysis error:', err);
      return res.status(500).json({ error: err.message || 'Failure performing AI template analysis.' });
    }
  });

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
