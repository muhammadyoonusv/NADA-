import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, 
  Sparkles, 
  Check, 
  Paperclip, 
  X, 
  ArrowLeftRight, 
  AlertTriangle,
  Receipt,
  RotateCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface EntryLine {
  accountId: string;
  accountName: string;
  accountType?: string;
  amount: number;
  isNewAccount?: boolean;
}

interface SuggestedVoucher {
  debitAccountId?: string;
  debitAccountName?: string;
  debitAccountType?: string;
  creditAccountId?: string;
  creditAccountName?: string;
  creditAccountType?: string;
  amount: number;
  narration: string;
  date: string;
  isCompound?: boolean;
  debits: EntryLine[];
  credits: EntryLine[];
  newAccounts?: { name: string; type: string }[];
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  transaction?: SuggestedVoucher;
  suggestions?: string[];
  recorded?: boolean;
  attachmentPreview?: string;
}

interface AIChatBotProps {
  accounts: any[];
  entries: any[];
  students: any[];
  sheetName: string;
  treasurerName: string;
  academicYear: string;
  isEditor: boolean;
  onAddEntry: (entry: any) => Promise<boolean>;
  onAddAccount?: (account: any) => Promise<string | undefined>;
  onNavigateTab?: (tab: string) => void;
  showToast?: (message: string, type?: 'success' | 'err' | 'info') => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIChatBot({
  accounts,
  entries,
  students,
  sheetName,
  treasurerName,
  academicYear,
  isEditor,
  onAddEntry,
  onAddAccount,
  onNavigateTab,
  showToast,
  isOpen,
  onOpenChange,
}: AIChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: `Hey ${treasurerName || 'there'}! I'm your assistant for **${sheetName || 'NADA Union Ledger'}**.\n\nYou can talk to me about anything—college stuff, exams, or whatever's on your mind. Whenever money moves, just tell me naturally (*"Paid ₹450 cash for samosas"* or *"Anu sent ₹300 dues on GPay"*), and I'll prepare the entry for you to record in one tap!`,
      suggestions: [
        'Paid ₹450 cash for snacks',
        'Collected ₹1,500 dues via UPI',
        'How is our cash balance?'
      ]
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [attachment, setAttachment] = useState<{ base64: string; type: string; name: string } | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Compute live financial metrics to send to server.ts
  const financialMetrics = useMemo(() => {
    let cashBalance = 0;
    let bankBalance = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    const cashAcc = accounts.find(a => a.id === '1' || a.name.toLowerCase().includes('cash'));
    const bankAcc = accounts.find(a => a.id === '2' || a.name.toLowerCase().includes('bank'));

    entries.forEach(entry => {
      const amt = Number(entry.amount) || 0;
      if (cashAcc) {
        if (entry.debitAccount === cashAcc.id) cashBalance += amt;
        if (entry.creditAccount === cashAcc.id) cashBalance -= amt;
      }
      if (bankAcc) {
        if (entry.debitAccount === bankAcc.id) bankBalance += amt;
        if (entry.creditAccount === bankAcc.id) bankBalance -= amt;
      }
      const debitAcc = accounts.find(a => a.id === entry.debitAccount);
      const creditAcc = accounts.find(a => a.id === entry.creditAccount);
      if (debitAcc?.type === 'Expense') totalExpenses += amt;
      if (creditAcc?.type === 'Income') totalIncome += amt;
    });

    const totalDuesOutstanding = (students || []).reduce((acc, s) => {
      const due = (Number(s.totalDue) || 0) - (Number(s.amountPaid) || 0);
      return acc + (due > 0 ? due : 0);
    }, 0);

    return {
      cashBalance: `₹${cashBalance.toLocaleString('en-IN')}`,
      bankBalance: `₹${bankBalance.toLocaleString('en-IN')}`,
      totalIncome: `₹${totalIncome.toLocaleString('en-IN')}`,
      totalExpenses: `₹${totalExpenses.toLocaleString('en-IN')}`,
      netSurplus: `₹${(totalIncome - totalExpenses).toLocaleString('en-IN')}`,
      totalDuesOutstanding: `₹${totalDuesOutstanding.toLocaleString('en-IN')}`
    };
  }, [accounts, entries, students]);

  // Handle receipt/image attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      showToast?.('File is too large. Please select an image under 12MB.', 'err');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        base64: reader.result as string,
        type: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async (textToSend?: string) => {
    const userMsg = (textToSend !== undefined ? textToSend : input).trim();
    if ((!userMsg && !attachment) || isLoading) return;

    const currentAttachment = attachment;
    const userMessageObj: ChatMessage = {
      role: 'user',
      text: userMsg || 'Please review this attachment.',
      attachmentPreview: currentAttachment?.base64
    };

    const updatedMessages = [...messages, userMessageObj];
    setMessages(updatedMessages);
    setInput('');
    setAttachment(null);
    setIsLoading(true);

    try {
      // Send conversation history with trimmed context to match server.ts
      const historyPayload = updatedMessages.slice(-8).map(m => ({
        role: m.role,
        text: m.text,
        suggestedEntry: m.transaction || undefined
      }));

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          history: historyPayload,
          attachment: currentAttachment ? {
            base64: currentAttachment.base64,
            type: currentAttachment.type
          } : undefined,
          context: {
            accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type })),
            recentEntries: entries.slice(-20).map(e => ({
              date: e.date,
              amount: e.amount,
              narration: e.narration,
              debitAccount: e.debitAccount,
              creditAccount: e.creditAccount
            })),
            financialMetrics,
            orgInfo: { sheetName, treasurerName, academicYear }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          text: data.reply || "I've reviewed that for you.",
          transaction: data.hasSuggestedEntry && data.suggestedEntry ? data.suggestedEntry : undefined,
          suggestions: data.followUpSuggestions || []
        }
      ]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          text: "I couldn't reach the backend server. Please make sure the app server is running with your `GEMINI_API_KEY`."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Resolves existing account IDs or creates brand-new accounts (e.g. personal advances)
  const resolveAccountId = async (line: EntryLine, defaultType: string = 'Expense'): Promise<string> => {
    const cleanId = String(line.accountId || '').trim();
    const cleanName = String(line.accountName || '').trim();

    if (cleanId) {
      const match = accounts.find(a => String(a.id) === cleanId);
      if (match) return match.id;
    }

    if (cleanName) {
      const match = accounts.find(a => a.name.toLowerCase().trim() === cleanName.toLowerCase());
      if (match) return match.id;
    }

    // Auto-create new account if flagged by server.ts
    if (line.isNewAccount && cleanName && onAddAccount && isEditor) {
      try {
        const createdId = await onAddAccount({
          name: cleanName,
          type: line.accountType || defaultType
        });
        if (createdId) return createdId;
      } catch (err) {
        console.warn('Failed to auto-create account:', err);
      }
    }

    return cleanId || '1';
  };

  const handleRecordTransaction = async (msgIndex: number, tx: SuggestedVoucher) => {
    if (!isEditor) {
      showToast?.('Access denied: You must be an authorized editor to record transactions.', 'err');
      return;
    }

    setRecordingId(msgIndex);

    try {
      const today = new Date().toISOString().split('T')[0];
      const entryDate = tx.date || today;

      // Handle Compound / Multi-leg entries
      if (tx.isCompound || tx.debits?.length > 1 || tx.credits?.length > 1) {
        const resolvedDebits = await Promise.all((tx.debits || []).map(async d => ({
          accountId: await resolveAccountId(d, 'Expense'),
          accountName: d.accountName,
          amount: Number(d.amount) || 0,
          type: d.accountType || 'Expense'
        })));

        const resolvedCredits = await Promise.all((tx.credits || []).map(async c => ({
          accountId: await resolveAccountId(c, 'Asset'),
          accountName: c.accountName,
          amount: Number(c.amount) || 0,
          type: c.accountType || 'Asset'
        })));

        const totalAmt = resolvedDebits.reduce((sum, d) => sum + d.amount, 0);

        const payload = {
          date: entryDate,
          debitAccount: resolvedDebits[0]?.accountId || '1',
          creditAccount: resolvedCredits[0]?.accountId || '2',
          amount: totalAmt,
          narration: tx.narration || 'Split transaction recorded via AI',
          isCompound: true,
          debits: resolvedDebits,
          credits: resolvedCredits,
          debitAccountType: resolvedDebits[0]?.type || 'Expense',
          creditAccountType: resolvedCredits[0]?.type || 'Asset'
        };

        const success = await onAddEntry(payload);
        if (success) {
          setMessages(prev => prev.map((m, idx) => idx === msgIndex ? { ...m, recorded: true } : m));
          showToast?.('Voucher recorded directly to your ledger!', 'success');
        }
      } else {
        // Standard single debit-credit entry
        const d0 = tx.debits?.[0] || { 
          accountId: tx.debitAccountId || '', 
          accountName: tx.debitAccountName || '', 
          accountType: tx.debitAccountType || 'Expense',
          amount: tx.amount 
        };
        const c0 = tx.credits?.[0] || { 
          accountId: tx.creditAccountId || '', 
          accountName: tx.creditAccountName || '', 
          accountType: tx.creditAccountType || 'Asset',
          amount: tx.amount 
        };

        const drId = await resolveAccountId(d0, 'Expense');
        const crId = await resolveAccountId(c0, 'Asset');

        const payload = {
          date: entryDate,
          debitAccount: drId,
          creditAccount: crId,
          amount: Number(tx.amount) || 0,
          narration: tx.narration || 'Transaction recorded via AI',
          isCompound: false,
          debitAccountType: d0.accountType || 'Expense',
          creditAccountType: c0.accountType || 'Asset'
        };

        const success = await onAddEntry(payload);
        if (success) {
          setMessages(prev => prev.map((m, idx) => idx === msgIndex ? { ...m, recorded: true } : m));
          showToast?.('Voucher recorded directly to your ledger!', 'success');
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast?.(err.message || 'Failed to record entry.', 'err');
    } finally {
      setRecordingId(null);
    }
  };

  return (
    <>
      {/* Floating launcher button in top right */}
      {!isOpen && (
        <button
          onClick={() => onOpenChange(true)}
          className="fixed top-20 right-6 z-50 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white p-3.5 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer group border-2 border-white/80"
          title="Open Assistant"
        >
          <Sparkles size={22} className="animate-pulse" />
          <span className="absolute right-full mr-3 bg-slate-900 text-white text-[11px] font-bold px-3 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg whitespace-nowrap pointer-events-none">
            Union Assistant ✨
          </span>
        </button>
      )}

      {/* Main Chat Window */}
      {isOpen && (
        <div className="fixed top-20 right-4 sm:right-6 w-[340px] sm:w-[400px] h-[520px] bg-white border border-slate-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
          
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white flex justify-between items-center shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
                <Sparkles size={17} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-xs block leading-tight tracking-wide">NADA Assistant</span>
                <span className="text-[10px] text-blue-100/90 font-medium">Smart Union Companion</span>
              </div>
            </div>
            <button 
              onClick={() => onOpenChange(false)} 
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
          
          {/* Messages list */}
          <div ref={scrollRef} className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-slate-50/60">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-2xl text-xs max-w-[88%] leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-xs shadow-xs' 
                    : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-xs'
                }`}>
                  
                  {/* Image attachment preview if user sent one */}
                  {m.attachmentPreview && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-white/20 max-h-36">
                      <img src={m.attachmentPreview} alt="attachment" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Body text with Markdown */}
                  <div className="whitespace-pre-wrap">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                  
                  {/* Suggested Transaction Voucher Card */}
                  {m.transaction && (
                    <div className="mt-3 p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-indigo-900 font-bold text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Receipt size={13} className="text-indigo-600" />
                          <span>Ready-to-Save Voucher</span>
                        </div>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-indigo-100 font-mono">
                          {m.transaction.date}
                        </span>
                      </div>
                      
                      <p className="text-xs font-semibold text-slate-900">
                        {m.transaction.narration}
                      </p>

                      {/* Line breakdown for splits & single entries */}
                      <div className="bg-white p-2 rounded-lg border border-indigo-100/80 text-[11px] space-y-1 font-mono">
                        <div className="text-slate-500 text-[10px] font-sans font-semibold uppercase tracking-wider">
                          Money Flow Details:
                        </div>
                        {m.transaction.debits?.map((d, i) => (
                          <div key={`d-${i}`} className="flex justify-between text-emerald-700">
                            <span>(+) {d.accountName}</span>
                            <span>₹{d.amount}</span>
                          </div>
                        ))}
                        {m.transaction.credits?.map((c, i) => (
                          <div key={`c-${i}`} className="flex justify-between text-rose-700">
                            <span>(-) {c.accountName}</span>
                            <span>₹{c.amount}</span>
                          </div>
                        ))}
                        <div className="pt-1 mt-1 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                          <span>Total Amount:</span>
                          <span>₹{m.transaction.amount}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      {m.recorded ? (
                        <div className="w-full py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                          <Check size={14} className="text-emerald-600 stroke-[3]" />
                          <span>Recorded to Union Ledger!</span>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          disabled={recordingId === idx}
                          onClick={() => handleRecordTransaction(idx, m.transaction!)} 
                          className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {recordingId === idx ? (
                            <>
                              <RotateCw size={13} className="animate-spin" />
                              <span>Saving to ledger...</span>
                            </>
                          ) : (
                            <>
                              <Check size={14} />
                              <span>Record to Union Ledger</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Suggestion Chips */}
                  {m.suggestions && m.suggestions.length > 0 && !m.recorded && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                      {m.suggestions.map(s => (
                        <button 
                          key={s} 
                          onClick={() => handleSend(s)} 
                          className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl text-xs text-slate-500 shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="ml-1 font-medium text-[11px]">Assistant is thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Attachment Preview Strip above input */}
          {attachment && (
            <div className="px-3.5 py-1.5 bg-indigo-50/80 border-t border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
              <span className="truncate max-w-[240px] font-medium">📎 {attachment.name}</span>
              <button 
                onClick={() => setAttachment(null)}
                className="text-slate-500 hover:text-rose-600 p-0.5 rounded cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className="p-2.5 bg-white border-t border-slate-100 flex gap-2 items-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*,application/pdf" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-slate-400 hover:text-indigo-600 p-2 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Attach receipt photo or bill"
            >
              <Paperclip size={17} />
            </button>

            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-slate-50/50" 
              placeholder="Ask anything or type a transaction..."
            />
            
            <button 
              onClick={() => handleSend()} 
              disabled={(!input.trim() && !attachment) || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center shrink-0"
              title="Send message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}