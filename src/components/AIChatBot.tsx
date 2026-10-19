import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Paperclip, 
  Sparkles, 
  Zap,
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  ArrowRight, 
  PlusCircle, 
  ExternalLink,
  Receipt,
  FileText,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  CreditCard,
  ChevronDown,
  Edit3,
  Copy,
  Check,
  MoreVertical,
  SquarePen,
  MessageSquarePlus,
  Plus,
  Menu,
  MessageSquare,
  Clock,
  Search,
  ChevronLeft,
  PanelLeft,
  PanelLeftClose,
  Maximize2,
  Minimize2,
  Folder,
  BookOpen,
  Image as ImageIcon,
  Mic,
  Brain,
  Sparkle,
  Calendar,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowLeftRight,
  ChevronUp,
  BookmarkCheck,
  Bookmark,
  ShieldCheck,
  Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Account, JournalEntry, Student } from '../types';
import { DEFAULT_ACCOUNTS, resolveAccountName } from '../utils/accounting';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  edited?: boolean;
  attachment?: {
    name: string;
    type: string;
    size: number;
    base64: string;
  };
  suggestedEntry?: {
    debitAccountId?: string;
    debitAccountName?: string;
    debitAccountType?: string;
    creditAccountId?: string;
    creditAccountName?: string;
    creditAccountType?: string;
    amount?: number;
    narration?: string;
    date?: string;
  };
  recorded?: boolean;
  followUpSuggestions?: string[];
  thinkingProcess?: string;
  memoryAction?: {
    action: 'saved' | 'recalled';
    rule: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

interface AIChatBotProps {
  accounts: Account[];
  entries: JournalEntry[];
  students: Student[];
  sheetName: string;
  treasurerName: string;
  academicYear: string;
  isEditor: boolean;
  onAddEntry: (entry: Omit<JournalEntry, 'id'>) => Promise<boolean>;
  onAddAccount?: (account: Omit<Account, 'id'>) => Promise<string | void>;
  onNavigateTab?: (tab: string) => void;
  showToast: (msg: string, type?: 'success' | 'err' | 'info') => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const STARTER_PROMPTS = [
  {
    icon: '☕',
    label: 'Paid 450 cash for tea & samosas',
    prompt: 'Paid 450 cash for tea and samosas for meeting'
  },
  {
    icon: '🎓',
    label: 'Received 3000 dues via Google Pay',
    prompt: 'Received 3000 dues from batch via Google Pay'
  },
  {
    icon: '🎤',
    label: 'Purchased 2 wireless mic sets for 5500',
    prompt: 'Purchased 2 wireless mic sets for 5500 from bank'
  },
  {
    icon: '📊',
    label: 'Senior CA Financial Health Review',
    prompt: 'As our resident Senior CA and Chief Financial Advisor for NADA UNION LEDGER, review our current cash in hand, bank balance, and surplus position. Give me an audit health check and financial advice.'
  }
];

export const AIChatBot: React.FC<AIChatBotProps> = ({
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
  isOpen: propIsOpen,
  onOpenChange,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof open === 'function' ? open(isOpen) : open;
    setInternalIsOpen(nextVal);
    onOpenChange?.(nextVal);
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState<'chat' | 'work'>('chat');
  const [isThinkingActive, setIsThinkingActive] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Multi-session management & local storage persistence
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('ai_chat_sessions_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Migrate from old single-chat storage if exists
      const oldHistory = localStorage.getItem('ai_chat_history');
      if (oldHistory) {
        const oldMsgs = JSON.parse(oldHistory);
        if (Array.isArray(oldMsgs) && oldMsgs.length > 0) {
          const firstUserMsg = oldMsgs.find((m: any) => m.role === 'user')?.text || 'Saved Ledger Session';
          return [{
            id: 'session_' + Date.now(),
            title: firstUserMsg.slice(0, 32) + (firstUserMsg.length > 32 ? '...' : ''),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: oldMsgs
          }];
        }
      }
    } catch (e) {
      console.warn('Could not load chat sessions', e);
    }
    const initialId = 'session_' + Date.now();
    return [{
      id: initialId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    }];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('ai_current_session_id');
      if (savedId) return savedId;
    } catch (e) {
      console.warn(e);
    }
    return '';
  });

  // Ensure active session reference
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === currentSessionId) || sessions[0] || {
      id: 'session_fallback',
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
  }, [sessions, currentSessionId]);

  const messages = activeSession.messages;

  // Make sure currentSessionId is synced
  useEffect(() => {
    if (!currentSessionId && sessions.length > 0) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [currentSessionId, sessions]);

  // Persist sessions to local storage
  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_sessions_v2', JSON.stringify(sessions));
      if (activeSession && activeSession.id) {
        localStorage.setItem('ai_current_session_id', activeSession.id);
      }
    } catch (e) {
      console.warn('Could not persist chat sessions', e);
    }
  }, [sessions, activeSession]);

  // Unified message updater that updates the active session and preserves its title
  const setMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions(prevSessions => {
      const activeId = currentSessionId || (prevSessions[0]?.id ?? '');
      return prevSessions.map(session => {
        if (session.id === activeId) {
          const newMessages = typeof updater === 'function' ? updater(session.messages) : updater;
          
          let newTitle = session.title;
          if (newTitle === 'New Chat' || !newTitle) {
            const firstUser = newMessages.find(m => m.role === 'user')?.text;
            if (firstUser) {
              const clean = firstUser.replace(/Uploaded attachment: /i, '📎 ').trim();
              newTitle = clean.slice(0, 30) + (clean.length > 30 ? '...' : '');
            }
          }

          return {
            ...session,
            title: newTitle,
            updatedAt: Date.now(),
            messages: newMessages
          };
        }
        return session;
      });
    });
  };

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    base64: string;
  } | null>(null);
  const [recordingEntryId, setRecordingEntryId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // CA Long-Term Memory Bank & Directives State
  const [memories, setMemories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ai_ledger_memory_bank');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not load memory bank', e);
    }
    return [
      "All physical cash payments must have verified cash vouchers or physical receipts.",
      "Purchases of permanent equipment (speakers, furniture, sports gear) must be capitalized as Assets.",
      "Refreshments or food expenses exceeding ₹1,500 require committee approval voucher."
    ];
  });

  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [expandedThinkingMsgIds, setExpandedThinkingMsgIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem('ai_ledger_memory_bank', JSON.stringify(memories));
    } catch (e) {
      console.warn('Could not save memory bank', e);
    }
  }, [memories]);

  const toggleThinking = (msgId: string) => {
    setExpandedThinkingMsgIds(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleAddMemory = (ruleToAdd?: string) => {
    const text = (ruleToAdd || newMemoryInput).trim();
    if (!text) return;
    if (memories.includes(text)) {
      showToast('This directive is already stored in the Memory Bank', 'info');
      return;
    }
    setMemories(prev => [text, ...prev]);
    setNewMemoryInput('');
    showToast('Memorized directive in CA Memory Bank', 'info');
  };

  const handleDeleteMemory = (index: number) => {
    setMemories(prev => prev.filter((_, i) => i !== index));
    showToast('Removed directive from Memory Bank', 'info');
  };

  const handleResetDefaultMemories = () => {
    const defaults = [
      "All physical cash payments must have verified cash vouchers or physical receipts.",
      "Purchases of permanent equipment (speakers, furniture, sports gear) must be capitalized as Assets.",
      "Refreshments or food expenses exceeding ₹1,500 require committee approval voucher."
    ];
    setMemories(defaults);
    showToast('Reset Memory Bank to standard CA ledger directives', 'info');
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuMsgId(null);
      setIsHeaderMenuOpen(false);
    };
    if (activeMenuMsgId || isHeaderMenuOpen) {
      window.addEventListener('click', handleGlobalClick);
      return () => window.removeEventListener('click', handleGlobalClick);
    }
  }, [activeMenuMsgId, isHeaderMenuOpen]);

  // Focus edit textarea when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editingText.length, editingText.length);
    }
  }, [editingMessageId]);

  // Save messages to local storage
  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(messages.slice(-30)));
    } catch (e) {
      console.warn('Could not save chat history', e);
    }
  }, [messages]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Calculate current financial metrics for system prompt context
  const computeFinancialMetrics = () => {
    let cashBalance = 0;
    let bankBalance = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    // Find cash and bank accounts
    const cashAcc = accounts.find(a => a.name.toLowerCase().includes('cash') || a.id === '1');
    const bankAcc = accounts.find(a => a.name.toLowerCase().includes('bank') || a.id === '2');

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

    const totalDuesOutstanding = students.reduce((acc, s) => {
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
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showToast('File size must be under 8MB', 'err');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        base64: reader.result as string
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send message to server Gemini endpoint
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!query && !selectedFile) return;

    const userMessage: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: query || (selectedFile ? `Uploaded attachment: ${selectedFile.name}` : ''),
      timestamp: Date.now(),
      attachment: selectedFile || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    const currentAttachment = selectedFile;
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const financialMetrics = computeFinancialMetrics();

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: query,
          history: messages.map(m => ({
            role: m.role,
            text: m.text
          })),
          context: {
            accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type })),
            entriesSummary: {
              totalEntries: entries.length,
              latestEntries: entries.slice(-5).map(e => ({
                date: e.date,
                amount: e.amount,
                narration: e.narration
              }))
            },
            financialMetrics,
            orgInfo: {
              sheetName,
              treasurerName,
              academicYear
            },
            memories: memories
          },
          attachment: currentAttachment ? {
            name: currentAttachment.name,
            type: currentAttachment.type,
            base64: currentAttachment.base64
          } : undefined,
          thinkMode: isThinkingActive
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error (${response.status})`);
      }

      const data = await response.json();

      // If AI extracted a directive to memorize, store it permanently in the Memory Bank
      if (data.memoryToSave && typeof data.memoryToSave === 'string') {
        const savedRule = data.memoryToSave.trim();
        if (savedRule && !memories.includes(savedRule)) {
          setMemories(prev => [savedRule, ...prev]);
          showToast(`🧠 Memorized in Memory Bank: "${savedRule}"`, 'info');
        }
      }

      const modelMessage: ChatMessage = {
        id: 'msg_' + Date.now() + '_bot',
        role: 'model',
        text: data.reply || 'I analyzed your request, but could not formulate a response.',
        timestamp: Date.now(),
        suggestedEntry: data.hasSuggestedEntry && data.suggestedEntry ? data.suggestedEntry : undefined,
        followUpSuggestions: data.followUpSuggestions || [],
        thinkingProcess: data.thinkingProcess || undefined,
        memoryAction: data.memoryToSave ? { action: 'saved', rule: data.memoryToSave } : undefined
      };

      // Auto-expand Sharp CA Thinking trace if in Deep Think mode or on entry recommendation
      if (data.thinkingProcess && (isThinkingActive || data.hasSuggestedEntry)) {
        setExpandedThinkingMsgIds(prev => ({ ...prev, [modelMessage.id]: true }));
      }

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: 'msg_' + Date.now() + '_err',
        role: 'model',
        text: `**Gemini AI Notice:** Could not connect to the Gemini AI accounting service.\n\n*Error details:* ${err.message || 'Unknown network error'}\n\nPlease verify that your server has a valid \`GEMINI_API_KEY\` configured in Settings.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick record the suggested entry directly into the ledger
  const handleQuickRecordEntry = async (msgId: string, suggested: ChatMessage['suggestedEntry']) => {
    if (!suggested) return;
    setRecordingEntryId(msgId);

    try {
      // 1. Resolve Debit Account
      let debitAccId = suggested.debitAccountId?.trim() || '';
      let debitAcc = accounts.find(a => a.id === debitAccId);

      // Try matching by exact or lowercase name in active accounts
      if (!debitAcc && suggested.debitAccountName) {
        debitAcc = accounts.find(
          a => a.name.toLowerCase().trim() === suggested.debitAccountName?.toLowerCase().trim()
        );
        if (debitAcc) debitAccId = debitAcc.id;
      }

      // Check if debitAccId itself is a name string
      if (!debitAcc && debitAccId && !debitAccId.startsWith('acc_')) {
        debitAcc = accounts.find(
          a => a.name.toLowerCase().trim() === debitAccId.toLowerCase().trim()
        );
        if (debitAcc) debitAccId = debitAcc.id;
      }

      // Check DEFAULT_ACCOUNTS fallback
      if (!debitAcc) {
        const defMatch = DEFAULT_ACCOUNTS.find(
          a => a.id === debitAccId || a.name.toLowerCase().trim() === (suggested.debitAccountName || '').toLowerCase().trim()
        );
        if (defMatch) {
          const matchByName = accounts.find(a => a.name.toLowerCase().trim() === defMatch.name.toLowerCase().trim());
          if (matchByName) {
            debitAcc = matchByName;
            debitAccId = matchByName.id;
          } else if (onAddAccount) {
            const created = await onAddAccount({ name: defMatch.name, type: defMatch.type });
            if (created) {
              debitAccId = created;
              debitAcc = { id: created, name: defMatch.name, type: defMatch.type, isSystem: defMatch.isSystem };
            }
          }
        }
      }

      // If debit account doesn't exist yet, auto-create the hint-derived account in Chart of Accounts!
      if (!debitAcc && suggested.debitAccountName && onAddAccount) {
        try {
          const newAccName = suggested.debitAccountName.trim();
          const newAccType = (suggested.debitAccountType as any) || 'Expense';
          const createdId = await onAddAccount({
            name: newAccName,
            type: newAccType
          });
          if (createdId) {
            debitAccId = createdId;
            debitAcc = { id: createdId, name: newAccName, type: newAccType, isSystem: false };
          }
        } catch (accErr) {
          console.warn("Auto-create hint account warning:", accErr);
        }
      }

      // 2. Resolve Credit Account
      let creditAccId = suggested.creditAccountId?.trim() || '';
      let creditAcc = accounts.find(a => a.id === creditAccId);

      // Try matching by name in active accounts
      if (!creditAcc && suggested.creditAccountName) {
        creditAcc = accounts.find(
          a => a.name.toLowerCase().trim() === suggested.creditAccountName?.toLowerCase().trim()
        );
        if (creditAcc) creditAccId = creditAcc.id;
      }

      // Check if creditAccId itself is a name string
      if (!creditAcc && creditAccId && !creditAccId.startsWith('acc_')) {
        creditAcc = accounts.find(
          a => a.name.toLowerCase().trim() === creditAccId.toLowerCase().trim()
        );
        if (creditAcc) creditAccId = creditAcc.id;
      }

      // Check DEFAULT_ACCOUNTS fallback (e.g. '12' Donation Account)
      if (!creditAcc) {
        const defMatch = DEFAULT_ACCOUNTS.find(
          a => a.id === creditAccId || a.name.toLowerCase().trim() === (suggested.creditAccountName || '').toLowerCase().trim()
        );
        if (defMatch) {
          const matchByName = accounts.find(a => a.name.toLowerCase().trim() === defMatch.name.toLowerCase().trim());
          if (matchByName) {
            creditAcc = matchByName;
            creditAccId = matchByName.id;
          } else if (onAddAccount) {
            const created = await onAddAccount({ name: defMatch.name, type: defMatch.type });
            if (created) {
              creditAccId = created;
              creditAcc = { id: created, name: defMatch.name, type: defMatch.type, isSystem: defMatch.isSystem };
            }
          }
        }
      }

      // If credit account doesn't exist yet, auto-create the account in Chart of Accounts!
      if (!creditAcc && suggested.creditAccountName && onAddAccount) {
        try {
          const newAccName = suggested.creditAccountName.trim();
          const isIncome = newAccName.toLowerCase().includes('donation') || newAccName.toLowerCase().includes('income') || newAccName.toLowerCase().includes('fee') || newAccName.toLowerCase().includes('ticket') || newAccName.toLowerCase().includes('sponsor');
          const newAccType = (suggested.creditAccountType as any) || (isIncome ? 'Income' : 'Asset');
          const createdId = await onAddAccount({
            name: newAccName,
            type: newAccType
          });
          if (createdId) {
            creditAccId = createdId;
            creditAcc = { id: createdId, name: newAccName, type: newAccType, isSystem: false };
          }
        } catch (accErr) {
          console.warn("Auto-create credit account warning:", accErr);
        }
      }

      // If still missing, check cash or bank
      if (!creditAccId) {
        const cashAcc = accounts.find(a => a.name.toLowerCase().includes('cash') || a.id === '1');
        if (cashAcc) {
          creditAccId = cashAcc.id;
          creditAcc = cashAcc;
        }
      }

      if (!debitAccId) {
        showToast(`Please create or select an account for '${suggested.debitAccountName || 'Debit Account'}' in Chart of Accounts.`, 'err');
        return;
      }

      if (!creditAccId) {
        showToast(`Credit account could not be found. Please check Chart of Accounts.`, 'err');
        return;
      }

      const success = await onAddEntry({
        date: suggested.date || new Date().toISOString().split('T')[0],
        debitAccount: debitAccId,
        creditAccount: creditAccId,
        debitAccountType: debitAcc?.type || (suggested.debitAccountType as any) || 'Expense',
        creditAccountType: creditAcc?.type || (suggested.creditAccountType as any) || 'Asset',
        amount: Number(suggested.amount) || 0,
        narration: suggested.narration || 'Recorded via Gemini AI',
      });

      if (success) {
        // Mark message as recorded
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, recorded: true } : m));
        showToast('Transaction successfully recorded to the ledger!', 'success');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to record transaction', 'err');
    } finally {
      setRecordingEntryId(null);
    }
  };

  // Helper to deduce a suggested double entry from message text when explicit suggestedEntry was omitted or loaded from previous history
  const deriveSuggestedEntry = (text: string, accs: Account[]): ChatMessage['suggestedEntry'] | null => {
    if (!text) return null;

    // Amount match
    const amountMatch = text.match(/(?:₹|INR|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
                        text.match(/amount[:\s*]+(?:₹|INR|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
                        text.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\s*(?:rupees|inr|cash|from bank|paid|received|dues|fee|for|spent)/i) ||
                        text.match(/\b([1-9][0-9]{1,6}(?:\.[0-9]{1,2})?)\b/);

    const isFinancial = /(?:paid|received|expense|purchased|income|dues|fee|spent|transfer|contra|samosa|tea|mic|sound|equipment|rent|stationery|print|₹|INR)/i.test(text);

    if (!isFinancial && !amountMatch) return null;

    const rawAmt = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    if (isNaN(rawAmt) || rawAmt <= 0) return null;

    let debitAcc: Account | undefined;
    let creditAcc: Account | undefined;

    // Check markdown table: | Account | Debit (Dr) | Credit (Cr) |
    const tableRows = [...text.matchAll(/\|\s*\*\*?([^*|\n]+)\*\*?\s*\|\s*([^|\n]+)\|\s*([^|\n]+)\|/g)];
    for (const row of tableRows) {
      const accStr = row[1].trim();
      const drStr = row[2].trim();
      const crStr = row[3].trim();
      if (drStr && drStr !== '-' && drStr !== '–' && drStr !== '—') {
        const found = accs.find(a => a.name.toLowerCase().trim() === accStr.toLowerCase().trim());
        if (found) debitAcc = found;
      }
      if (crStr && crStr !== '-' && crStr !== '–' && crStr !== '—') {
        const found = accs.find(a => a.name.toLowerCase().trim() === accStr.toLowerCase().trim());
        if (found) creditAcc = found;
      }
    }

    if (!debitAcc) {
      debitAcc = accs.find(a => 
        (a.type === 'Expense' || a.type === 'Asset') && 
        new RegExp(`\\b${a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
      );
    }

    if (!creditAcc) {
      creditAcc = accs.find(a => 
        (a.id === '1' || a.id === '2' || a.type === 'Income') && 
        new RegExp(`\\b${a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
      );
    }

    // Fallbacks
    if (!debitAcc) {
      if (/tea|samosa|food|refreshment|snack|canteen|lunch|dinner/i.test(text)) {
        debitAcc = accs.find(a => a.id === '7' || a.name.toLowerCase().includes('food'));
      } else if (/mic|speaker|sound|equipment|hardware|projector/i.test(text)) {
        debitAcc = accs.find(a => a.id === '13' || a.name.toLowerCase().includes('equipment'));
      } else if (/print|stationery|book|paper|banner|poster/i.test(text)) {
        debitAcc = accs.find(a => a.id === '6' || a.name.toLowerCase().includes('stationery'));
      } else if (/rent|hall|auditorium|stage/i.test(text)) {
        debitAcc = accs.find(a => a.id === '9' || a.name.toLowerCase().includes('rent'));
      } else if (/due|membership|contribution/i.test(text) && /received/i.test(text)) {
        debitAcc = /gpay|google pay|bank|upi/i.test(text) 
          ? accs.find(a => a.id === '2') 
          : accs.find(a => a.id === '1');
        creditAcc = accs.find(a => a.id === '4' || a.name.toLowerCase().includes('dues'));
      } else {
        debitAcc = accs.find(a => a.type === 'Expense') || accs[0];
      }
    }

    if (!creditAcc) {
      if (/gpay|google pay|phonepe|paytm|upi|bank|cheque|neft|online|card/i.test(text)) {
        creditAcc = accs.find(a => a.id === '2' || a.name.toLowerCase().includes('bank'));
      } else if (/cash/i.test(text)) {
        creditAcc = accs.find(a => a.id === '1' || a.name.toLowerCase().includes('cash'));
      } else {
        creditAcc = accs.find(a => a.id === '1') || accs[0];
      }
    }

    const narrMatch = text.match(/\*\*Narration:\*\*\s*([^\n\r]+)/i) || 
                      text.match(/Narration:\s*([^\n\r]+)/i) ||
                      text.match(/"([^"]*Being[^"]*)"/i);
    const narration = narrMatch 
      ? narrMatch[1].replace(/^[“"']|[”"']$/g, '').trim() 
      : `Being transaction of ₹${rawAmt} recorded for ${debitAcc?.name || 'Union'}.`;

    return {
      debitAccountId: debitAcc?.id || '7',
      debitAccountName: debitAcc?.name || 'Food & Refreshments',
      debitAccountType: debitAcc?.type || 'Expense',
      creditAccountId: creditAcc?.id || '1',
      creditAccountName: creditAcc?.name || 'Cash',
      creditAccountType: creditAcc?.type || 'Asset',
      amount: rawAmt,
      narration: narration,
      date: new Date().toISOString().split('T')[0]
    };
  };

  const handleToggleCreditMode = (msgId: string, fallbackEntry?: NonNullable<ChatMessage['suggestedEntry']>) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const baseEntry = m.suggestedEntry || fallbackEntry;
      if (!baseEntry) return m;
      const isCurrentlyCash = baseEntry.creditAccountId === '1' || (baseEntry.creditAccountName || '').toLowerCase().includes('cash');
      const bankAcc = accounts.find(a => a.name.toLowerCase().includes('bank') || a.id === '2');
      const cashAcc = accounts.find(a => a.name.toLowerCase().includes('cash') || a.id === '1');
      
      return {
        ...m,
        suggestedEntry: {
          ...baseEntry,
          creditAccountId: isCurrentlyCash ? (bankAcc?.id || '2') : (cashAcc?.id || '1'),
          creditAccountName: isCurrentlyCash ? (bankAcc?.name || 'Union Bank Account') : (cashAcc?.name || 'Cash in Hand'),
        }
      };
    }));
  };

  const handleSelectDebitAccount = (msgId: string, accountId: string, fallbackEntry?: NonNullable<ChatMessage['suggestedEntry']>) => {
    const found = accounts.find(a => a.id === accountId);
    if (!found) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const baseEntry = m.suggestedEntry || fallbackEntry;
      if (!baseEntry) return m;
      return {
        ...m,
        suggestedEntry: {
          ...baseEntry,
          debitAccountId: found.id,
          debitAccountName: found.name,
          debitAccountType: found.type
        }
      };
    }));
  };

  const handleSelectCreditAccount = (msgId: string, accountId: string, fallbackEntry?: NonNullable<ChatMessage['suggestedEntry']>) => {
    const found = accounts.find(a => a.id === accountId);
    if (!found) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const baseEntry = m.suggestedEntry || fallbackEntry;
      if (!baseEntry) return m;
      return {
        ...m,
        suggestedEntry: {
          ...baseEntry,
          creditAccountId: found.id,
          creditAccountName: found.name,
          creditAccountType: found.type
        }
      };
    }));
  };

  const handleSetCreditToDonation = async (msgId: string, fallbackEntry?: NonNullable<ChatMessage['suggestedEntry']>) => {
    let donationAcc = accounts.find(a => a.name.toLowerCase().includes('donation') || a.id === '12');
    let donName = donationAcc ? donationAcc.name : 'Donation Account';
    let donId = donationAcc ? donationAcc.id : '12';

    if (!donationAcc && onAddAccount) {
      try {
        const createdId = await onAddAccount({
          name: 'Donation Account',
          type: 'Income'
        });
        if (createdId) {
          donId = createdId;
        }
      } catch (err) {
        console.warn('Could not auto-add donation account:', err);
      }
    }

    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const baseEntry = m.suggestedEntry || fallbackEntry;
      if (!baseEntry) return m;
      return {
        ...m,
        suggestedEntry: {
          ...baseEntry,
          creditAccountId: donId,
          creditAccountName: donName,
          creditAccountType: 'Income'
        }
      };
    }));
    showToast(`Credit Account updated to "${donName}"`, 'success');
  };

  const handleSwapDebitCredit = (msgId: string, fallbackEntry?: NonNullable<ChatMessage['suggestedEntry']>) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const baseEntry = m.suggestedEntry || fallbackEntry;
      if (!baseEntry) return m;
      const currentDrId = baseEntry.debitAccountId;
      const currentDrName = baseEntry.debitAccountName;
      const currentDrType = baseEntry.debitAccountType;

      const currentCrId = baseEntry.creditAccountId;
      const currentCrName = baseEntry.creditAccountName;
      const currentCrType = baseEntry.creditAccountType;

      return {
        ...m,
        suggestedEntry: {
          ...baseEntry,
          debitAccountId: currentCrId,
          debitAccountName: currentCrName,
          debitAccountType: currentCrType,
          creditAccountId: currentDrId,
          creditAccountName: currentDrName,
          creditAccountType: currentDrType,
        }
      };
    }));
    showToast('Debit and Credit accounts swapped', 'info');
  };

  const handleUpdateAmount = (msgId: string, newAmt: number, fallbackEntry?: NonNullable<ChatMessage['suggestedEntry']>) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const baseEntry = m.suggestedEntry || fallbackEntry;
      if (!baseEntry) return m;
      return {
        ...m,
        suggestedEntry: {
          ...baseEntry,
          amount: newAmt
        }
      };
    }));
  };

  const handleCreateSuggestedEntryForMessage = (msgId: string) => {
    setMessages(prev => {
      const targetIndex = prev.findIndex(m => m.id === msgId);
      if (targetIndex === -1) return prev;

      const prevMsg = targetIndex > 0 ? prev[targetIndex - 1] : null;
      const targetMsg = prev[targetIndex];
      const combined = `${prevMsg?.text || ''}\n${targetMsg.text || ''}`;

      const derived = deriveSuggestedEntry(combined, accounts);
      const defaultEntry: NonNullable<ChatMessage['suggestedEntry']> = derived || {
        debitAccountId: accounts.find(a => a.type === 'Expense')?.id || '7',
        debitAccountName: accounts.find(a => a.type === 'Expense')?.name || 'Food & Refreshments',
        debitAccountType: accounts.find(a => a.type === 'Expense')?.type || 'Expense',
        creditAccountId: accounts.find(a => a.id === '1' || a.name.toLowerCase().includes('cash'))?.id || '1',
        creditAccountName: accounts.find(a => a.id === '1' || a.name.toLowerCase().includes('cash'))?.name || 'Cash in Hand',
        creditAccountType: 'Asset',
        amount: 100,
        narration: `Being transaction recorded from AI chat`,
        date: new Date().toISOString().split('T')[0]
      };

      return prev.map((m, idx) => idx === targetIndex ? { ...m, suggestedEntry: defaultEntry } : m);
    });
    showToast('Prepared double-entry recommendation for ledger recording', 'info');
  };

  // Filter sessions for history search
  const filteredSessions = useMemo(() => {
    if (!searchHistory.trim()) return sessions;
    const q = searchHistory.toLowerCase().trim();
    return sessions.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.messages.some(m => m.text.toLowerCase().includes(q))
    );
  }, [sessions, searchHistory]);

  const handleNewChat = () => {
    if (activeSession && activeSession.messages.length === 0) {
      setIsHeaderMenuOpen(false);
      return;
    }
    const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newSession: ChatSession = {
      id: newSessionId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setEditingMessageId(null);
    setEditingText('');
    setActiveMenuMsgId(null);
    setIsHeaderMenuOpen(false);
    setSelectedFile(null);
    setInputText('');
    showToast('New chat started', 'info');
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsHeaderMenuOpen(false);
    setEditingMessageId(null);
    setEditingText('');
    setActiveMenuMsgId(null);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId);
      if (remaining.length === 0) {
        const freshId = 'session_' + Date.now();
        const freshSession: ChatSession = {
          id: freshId,
          title: 'New Chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: []
        };
        setCurrentSessionId(freshId);
        return [freshSession];
      }
      if (currentSessionId === sessionId) {
        setCurrentSessionId(remaining[0].id);
      }
      return remaining;
    });
    showToast('Chat deleted from history', 'info');
  };

  const handleClearHistory = () => {
    const freshId = 'session_' + Date.now();
    const freshSession: ChatSession = {
      id: freshId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    setSessions([freshSession]);
    setCurrentSessionId(freshId);
    localStorage.removeItem('ai_chat_history');
    setEditingMessageId(null);
    setEditingText('');
    setActiveMenuMsgId(null);
    setIsHeaderMenuOpen(false);
    setSelectedFile(null);
    setInputText('');
    showToast('All chat history cleared', 'info');
  };

  // Start editing a message
  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text);
    setActiveMenuMsgId(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  // Save edited message and optionally re-query AI
  const handleSaveEdit = async (msgId: string, reAskAI: boolean = false) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      showToast('Message cannot be empty', 'err');
      return;
    }

    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        return {
          ...m,
          text: trimmed,
          edited: true
        };
      }
      return m;
    }));

    setEditingMessageId(null);
    setEditingText('');
    showToast('Message updated', 'success');

    if (reAskAI) {
      handleSendMessage(trimmed);
    }
  };

  // Delete message
  const handleDeleteMessage = (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setActiveMenuMsgId(null);
    if (editingMessageId === msgId) {
      handleCancelEdit();
    }
    showToast('Message deleted', 'info');
  };

  // Copy message text to clipboard
  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
      showToast('Copied to clipboard', 'info');
    }).catch(() => {
      showToast('Failed to copy', 'err');
    });
    setActiveMenuMsgId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, msgId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(msgId, false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <>
      {/* Floating launcher button styled in Gemini theme */}
      <div className="fixed bottom-16 md:bottom-6 right-3 sm:right-4 md:right-6 z-50 flex items-center gap-2">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => {
                setIsOpen(true);
                setIsSidebarCollapsed(true);
              }}
              className="group relative w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center bg-gradient-to-tr from-[#131314] via-[#1e1f20] to-[#282a2c] hover:from-[#1e1f20] hover:to-[#333538] text-white rounded-2xl shadow-2xl shadow-indigo-950/60 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-blue-500/40 hover:border-indigo-400"
              title="Open Gemini AI"
              aria-label="Open Gemini AI"
            >
              <div className="relative flex items-center justify-center">
                <Sparkles size={24} className="text-blue-400 group-hover:text-indigo-300 group-hover:rotate-12 transition-all duration-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Gemini AI Layout Window with Left Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={`fixed z-50 bg-[#131314] text-white rounded-2xl shadow-2xl border border-zinc-800 flex overflow-hidden overflow-x-hidden ${
              isFullscreen
                ? 'inset-2 md:inset-4 w-[calc(100vw-1rem)] md:w-[calc(100vw-2rem)] h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)]'
                : 'bottom-16 md:bottom-6 right-2 sm:right-4 md:right-6 w-[calc(100vw-1rem)] sm:w-[94vw] md:w-[780px] lg:w-[840px] max-w-[calc(100vw-1rem)] h-[620px] max-h-[calc(100vh-5rem)]'
            }`}
          >
            {/* Left Sidebar */}
            <div
              className={`bg-[#1e1f20] border-r border-zinc-800/80 flex flex-col transition-all duration-300 z-30 shrink-0 ${
                isSidebarCollapsed 
                  ? 'w-0 overflow-hidden border-r-0 opacity-0 pointer-events-none' 
                  : 'w-[250px] sm:w-[260px] opacity-100'
              }`}
            >
              {/* Sidebar Top: Gemini AI Header + Search + Collapse Button */}
              <div className="p-3 pb-2 flex items-center justify-between text-zinc-300">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
                    <Sparkles size={16} className="text-blue-400" />
                    Gemini AI
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium ml-5.5 -mt-0.5">Google Gemini • CA Accountant</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsSearching(!isSearching)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="Search chats"
                  >
                    <Search size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="Close sidebar"
                  >
                    <PanelLeftClose size={16} />
                  </button>
                </div>
              </div>

              {/* New Chat Button */}
              <div className="p-3 pt-1">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="w-full py-2 px-3 bg-[#2f2f2f] hover:bg-[#383838] active:scale-98 text-white rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer group shadow-xs border border-zinc-700/50"
                >
                  <div className="flex items-center gap-2.5">
                    <SquarePen size={15} className="text-zinc-300 group-hover:text-white" />
                    <span className="font-medium text-[13px]">New consultation</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 font-mono">⌘N</span>
                </button>
              </div>

              {/* History Search if opened */}
              {isSearching && (
                <div className="px-3 pb-2 animate-in fade-in duration-150">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={searchHistory}
                      onChange={(e) => setSearchHistory(e.target.value)}
                      placeholder="Search consultations..."
                      autoFocus
                      className="w-full pl-7 pr-2.5 py-1.5 bg-[#171717] border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Feature Links (Receipt Scanner, Chart of Accounts, Ledger, Statements, Rules) */}
              <div className="px-2 py-1 space-y-0.5 border-b border-zinc-800/80 text-[12.5px] text-zinc-300">
                <div 
                  onClick={() => handleSendMessage('Please audit our recent expenses and verify if any bills, receipts, or voucher details are missing.')}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <div className="flex items-center gap-2.5">
                    <ImageIcon size={14} className="text-purple-400" />
                    <span>Receipt Scanner</span>
                  </div>
                  <span className="text-[9px] bg-purple-950/80 text-purple-300 border border-purple-800/50 font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">ACTIVE</span>
                </div>

                <div 
                  onClick={() => onNavigateTab?.('chart')}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <BookOpen size={14} className="text-zinc-400" />
                  <span>Chart of Accounts</span>
                </div>

                <div 
                  onClick={() => onNavigateTab?.('ledgers')}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <Folder size={14} className="text-zinc-400" />
                  <span>General Ledger</span>
                </div>

                <div 
                  onClick={() => onNavigateTab?.('trial')}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <Calendar size={14} className="text-zinc-400" />
                  <span>Trial Balance</span>
                </div>

                <div 
                  onClick={() => showToast('Gemini AI Double-Entry & CA Audit Engine active', 'info')}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <SlidersHorizontal size={14} className="text-zinc-400" />
                  <span>CA Rules Engine</span>
                </div>

                <div 
                  onClick={() => setIsMemoryModalOpen(true)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <div className="flex items-center gap-2.5">
                    <Brain size={14} className="text-indigo-400" />
                    <span>Memory Bank</span>
                  </div>
                  <span className="text-[9px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 font-bold px-1.5 py-0.5 rounded tracking-wide font-mono">
                    {memories.length} RULES
                  </span>
                </div>
              </div>

              {/* Recents Section Header */}
              <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-zinc-400 tracking-wider">
                Recents
              </div>

              {/* Old Chats to ChatGPT List */}
              <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-6 px-3 text-zinc-500 text-xs">
                    No old chats found
                  </div>
                ) : (
                  filteredSessions.map((s) => {
                    const isActive = s.id === activeSession?.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSession(s.id)}
                        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#2f2f2f] text-white font-medium'
                            : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-5">
                          <span className="truncate text-[12.5px] leading-snug">
                            {s.title || 'New chat'}
                          </span>
                        </div>

                        {/* Delete single chat icon on hover */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-700/60 rounded transition-all cursor-pointer shrink-0 absolute right-1.5 top-1.5"
                          title="Delete chat"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer: User profile / Clear history */}
              <div className="p-2.5 px-3 border-t border-zinc-800 bg-[#1d1d1d] flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {(treasurerName || 'T')[0].toUpperCase()}
                  </div>
                  <span className="truncate text-[11.5px] font-medium text-zinc-300 max-w-[120px]">
                    {treasurerName || 'Treasurer'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[11px] text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Clear all saved chats"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#171717] relative">
              {/* Top Bar with Center Capsule Mode Switcher */}
              <div className="p-3 px-4 flex items-center justify-between border-b border-zinc-800/80 bg-[#171717]/90 backdrop-blur-sm z-20">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Left Sidebar Open Trigger when collapsed */}
                  {isSidebarCollapsed && (
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed(false)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                      title="Open sidebar"
                    >
                      <PanelLeft size={18} />
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-100 truncate">
                      {activeSession?.title || 'Gemini AI'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isThinkingActive;
                        setIsThinkingActive(nextState);
                        showToast(nextState ? 'Deep Forensic CA Reasoning Mode enabled' : 'Turbo Instant AI Mode enabled (sudden responses)', 'info');
                      }}
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        isThinkingActive
                          ? 'bg-indigo-950/80 border-indigo-500/80 text-indigo-300 shadow-xs'
                          : 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300 shadow-xs'
                      }`}
                      title={isThinkingActive ? "Deep Think mode active (Forensic CA reasoning). Click to switch to Turbo Instant." : "Turbo Flash mode active (Sudden, sub-second responses). Click to switch to Deep Think."}
                    >
                      {isThinkingActive ? (
                        <>
                          <Brain size={12} className="text-indigo-400 animate-pulse" />
                          <span>Deep Think (CA)</span>
                        </>
                      ) : (
                        <>
                          <Zap size={11} className="text-emerald-400" />
                          <span>Turbo Flash (Instant)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Center Pill: Chat | CA Audit (Hidden per user request) */}
                <div className="hidden bg-[#212121] border border-zinc-800 p-0.5 rounded-full items-center shadow-inner text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTabMode('chat')}
                    className={`px-3.5 py-1 rounded-full font-medium transition-all cursor-pointer ${
                      activeTabMode === 'chat'
                        ? 'bg-[#2f2f2f] text-white shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTabMode('work');
                      handleSendMessage('Perform a complete audit on our active Union ledger, balances, and transaction consistency.');
                    }}
                    className={`px-3.5 py-1 rounded-full font-medium transition-all cursor-pointer flex items-center gap-1 ${
                      activeTabMode === 'work'
                        ? 'bg-[#2f2f2f] text-white shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sparkle size={11} className="text-blue-400" />
                    <span>Audit</span>
                  </button>
                </div>

                {/* Right Action Icons: Memory Bank, New chat, Fullscreen, Close */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsMemoryModalOpen(true)}
                    className="p-1.5 px-2 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1.5 border border-zinc-700/60"
                    title="Open CA Memory Bank (Memorized rules & preferences)"
                  >
                    <Brain size={13} className="text-indigo-400" />
                    <span className="hidden sm:inline font-medium text-[11px]">Memory Bank</span>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 font-bold px-1.5 py-0.2 rounded-full border border-indigo-800 font-mono">
                      {memories.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="New chat"
                  >
                    <SquarePen size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title={isFullscreen ? 'Exit fullscreen' : 'Maximize window'}
                  >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Chat Conversation Canvas */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6 w-full" style={{ overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center space-y-6 py-12 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-700/50 text-blue-300 text-xs font-semibold mb-1">
                        <Sparkles size={13} className="text-blue-400" />
                        <span>Senior CA & Chief Financial Advisor</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
                        <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                          Gemini AI
                        </span>
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                        Resident Senior Chartered Accountant (CA) for <strong>NADA UNION LEDGER</strong>. Instant double-entry journalizing, Golden Rules compliance, and capital asset verification.
                      </p>
                    </div>

                    {/* Starter Prompt Chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
                      {STARTER_PROMPTS.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(item.prompt)}
                          className="p-3 bg-[#212121] hover:bg-[#282828] border border-zinc-800 hover:border-zinc-700 text-left rounded-xl transition-all cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{item.icon}</span>
                            <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
                              {item.label}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-6 w-full">
                    {messages.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      const isEditing = editingMessageId === msg.id;

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3.5 group w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isUser && (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 border border-blue-400/50 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm" title="Gemini AI">
                              <Sparkles size={14} className="text-blue-100" />
                            </div>
                          )}

                          <div className={`flex flex-col space-y-1 w-full max-w-[85%] sm:max-w-[90%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                            {!isUser && (
                              <div className="flex items-center gap-1.5 px-0.5 mb-0.5">
                                <span className="font-bold text-xs text-blue-300 tracking-tight flex items-center gap-1">
                                  <span>Gemini AI</span>
                                </span>
                                <span className="hidden text-[9.5px] font-medium px-1.5 py-0.2 rounded bg-blue-950/70 border border-blue-800/50 text-blue-300 uppercase tracking-wider">
                                  Chartered Accountant
                                </span>
                              </div>
                            )}
                            {/* Message Bubble Container */}
                            <div
                              className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-[13px] leading-relaxed relative w-full overflow-hidden box-border ${
                                isUser
                                  ? 'bg-[#2f2f2f] text-white rounded-tr-xs'
                                  : 'bg-[#1e1e22] border border-zinc-800/90 text-zinc-200 rounded-2xl shadow-sm'
                              }`}
                              style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                            >
                              {/* Attachment preview */}
                              {msg.attachment && (
                                <div className="mb-2 p-2 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center gap-2 text-xs">
                                  <Paperclip size={13} className="text-zinc-400 shrink-0" />
                                  <span className="truncate font-medium text-zinc-200">{msg.attachment.name}</span>
                                </div>
                              )}

                              {/* Memorized Directive Notification Banner */}
                              {!isUser && msg.memoryAction && (
                                <div className="mb-2.5 p-2.5 px-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 flex items-center gap-2 text-[11.5px] text-emerald-300 shadow-xs">
                                  <BookmarkCheck size={15} className="text-emerald-400 shrink-0" />
                                  <span className="truncate">
                                    Memorized in CA Memory Bank: <strong className="text-white">"{msg.memoryAction.rule}"</strong>
                                  </span>
                                </div>
                              )}

                              {/* Sharp CA Forensic Thinking Process Accordion */}
                              {!isUser && msg.thinkingProcess && (
                                <div className="mb-3 rounded-xl border border-indigo-900/60 bg-gradient-to-r from-indigo-950/40 to-zinc-900/60 overflow-hidden shadow-xs">
                                  <button
                                    type="button"
                                    onClick={() => toggleThinking(msg.id)}
                                    className="w-full p-2 px-3 flex items-center justify-between text-xs text-indigo-300 hover:text-white hover:bg-indigo-900/30 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-1.5 font-medium text-[11px]">
                                      <Brain size={13} className="text-indigo-400" />
                                      <span>Sharp CA Forensic Reasoning</span>
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 uppercase font-bold tracking-wider">
                                        Deduction Trace
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10.5px] text-zinc-400">
                                      <span>{expandedThinkingMsgIds[msg.id] ? 'Hide' : 'Inspect Reasoning'}</span>
                                      {expandedThinkingMsgIds[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </div>
                                  </button>
                                  {expandedThinkingMsgIds[msg.id] && (
                                    <div className="p-3 text-[11.5px] text-zinc-300 leading-relaxed border-t border-indigo-900/50 bg-[#131317] whitespace-pre-line font-mono text-[11px]">
                                      {msg.thinkingProcess}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Message Text or Inline Editor */}
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    ref={editInputRef}
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    onKeyDown={(e) => handleEditKeyDown(e, msg.id)}
                                    className="w-full min-w-[240px] p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-500"
                                    rows={2}
                                  />
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={handleCancelEdit}
                                      className="px-2.5 py-1 text-zinc-400 hover:text-white text-xs cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(msg.id, false)}
                                      className="px-2.5 py-1 bg-white text-black font-semibold rounded-md text-xs cursor-pointer hover:bg-zinc-200"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (() => {
                                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                                const combinedText = prevMsg && prevMsg.role === 'user' ? `${prevMsg.text}\n${msg.text}` : msg.text;
                                const activeSuggestedEntry = msg.suggestedEntry || (!isUser ? deriveSuggestedEntry(combinedText, accounts) : null);

                                return (
                                  <>
                                    <div className="prose prose-invert prose-xs max-w-none break-words overflow-x-auto">
                                      <ReactMarkdown>
                                        {activeSuggestedEntry
                                          ? msg.text.replace(/### Suggested Journal Entry[\s\S]*?(?=(\*\*Narration|\*\*CA Accounting Rationale|\*\*Status|$))/i, '').trim()
                                          : msg.text}
                                      </ReactMarkdown>
                                    </div>

                                    {/* Double-Entry Recommendation Card (Exact Visual Layout from Image, responsive screen fit) */}
                                    {activeSuggestedEntry && (
                                      <div className="mt-3.5 p-3 sm:p-4 bg-[#17171a] rounded-2xl border border-zinc-800/95 shadow-xl space-y-3 text-xs text-zinc-200 w-full max-w-full overflow-hidden box-border">
                                        {/* Top Header Row */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 font-bold text-sm tracking-tight text-[#14b8a6]">
                                            <div className="w-5 h-5 rounded border border-teal-500/50 bg-teal-950/40 flex items-center justify-center text-teal-400 shrink-0">
                                              <span className="text-[11px] leading-none">💵</span>
                                            </div>
                                            <span>Double-Entry Recommendation</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handleSwapDebitCredit(msg.id, activeSuggestedEntry)}
                                              className="px-2.5 py-1 bg-[#222227] hover:bg-[#2c2c33] text-zinc-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/80 shadow-2xs"
                                              title="Swap Debit and Credit accounts"
                                            >
                                              <ArrowLeftRight size={12} />
                                              <span>Swap Dr/Cr</span>
                                            </button>
                                            <div className="flex items-center bg-[#25252b] px-3 py-1 rounded-full border border-zinc-700/90 shadow-xs gap-1">
                                              <span className="text-sm font-extrabold text-white">₹</span>
                                              <input
                                                type="number"
                                                min="0"
                                                value={activeSuggestedEntry.amount || ''}
                                                onChange={(e) => handleUpdateAmount(msg.id, parseFloat(e.target.value) || 0, activeSuggestedEntry)}
                                                className="w-16 sm:w-20 bg-transparent text-sm font-extrabold text-white focus:outline-none focus:ring-1 focus:ring-teal-500 rounded px-0.5"
                                                placeholder="0"
                                                title="Edit transaction amount"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* DEBIT (DR) Block */}
                                        <div className="p-3.5 bg-[#1c1c21] rounded-xl border border-zinc-800/90 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#f43f5e] font-bold tracking-wider uppercase">DEBIT (DR)</span>
                                            <span className="text-xs text-zinc-500">Account</span>
                                          </div>
                                          <div className="relative">
                                            <select
                                              value={
                                                activeSuggestedEntry.debitAccountId ||
                                                accounts.find(a => a.name.toLowerCase().trim() === activeSuggestedEntry?.debitAccountName?.toLowerCase().trim())?.id ||
                                                ''
                                              }
                                              onChange={(e) => handleSelectDebitAccount(msg.id, e.target.value, activeSuggestedEntry)}
                                              className="w-full bg-[#27272d] hover:bg-[#2c2c34] text-white font-bold text-[13.5px] rounded-lg px-3.5 py-2.5 pr-10 border border-zinc-700/80 focus:outline-none focus:border-teal-500 transition-colors cursor-pointer appearance-none"
                                            >
                                              {activeSuggestedEntry.debitAccountName && !accounts.some(a => a.id === activeSuggestedEntry?.debitAccountId || a.name === activeSuggestedEntry?.debitAccountName) && (
                                                <option value="">{activeSuggestedEntry.debitAccountName} ({activeSuggestedEntry.debitAccountType || 'Expense'})</option>
                                              )}
                                              {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id} className="bg-[#212126] text-white">
                                                  {acc.name} ({acc.type})
                                                </option>
                                              ))}
                                            </select>
                                            <ChevronDown size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none" />
                                          </div>
                                        </div>

                                        {/* CREDIT (CR) Block */}
                                        <div className="p-3.5 bg-[#1c1c21] rounded-xl border border-zinc-800/90 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#14b8a6] font-bold tracking-wider uppercase">CREDIT (CR)</span>
                                            <button
                                              type="button"
                                              onClick={() => handleToggleCreditMode(msg.id, activeSuggestedEntry)}
                                              className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer font-medium hover:underline transition-colors"
                                            >
                                              Cash/Bank
                                            </button>
                                          </div>
                                          <div className="relative">
                                            <select
                                              value={
                                                activeSuggestedEntry.creditAccountId ||
                                                accounts.find(a => a.name.toLowerCase().trim() === activeSuggestedEntry?.creditAccountName?.toLowerCase().trim())?.id ||
                                                ''
                                              }
                                              onChange={(e) => handleSelectCreditAccount(msg.id, e.target.value, activeSuggestedEntry)}
                                              className="w-full bg-[#27272d] hover:bg-[#2c2c34] text-white font-bold text-[13.5px] rounded-lg px-3.5 py-2.5 pr-10 border border-zinc-700/80 focus:outline-none focus:border-teal-500 transition-colors cursor-pointer appearance-none"
                                            >
                                              {activeSuggestedEntry.creditAccountName && !accounts.some(a => a.id === activeSuggestedEntry?.creditAccountId || a.name === activeSuggestedEntry?.creditAccountName) && (
                                                <option value="">{activeSuggestedEntry.creditAccountName} ({activeSuggestedEntry.creditAccountType || 'Asset'})</option>
                                              )}
                                              {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id} className="bg-[#212126] text-white">
                                                  {acc.name} ({acc.type})
                                                </option>
                                              ))}
                                            </select>
                                            <ChevronDown size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none" />
                                          </div>
                                        </div>

                                        {/* Quick Preset Buttons for Credit / Income */}
                                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                          <span className="text-xs text-zinc-400 font-medium">Quick Cr:</span>
                                          <button
                                            type="button"
                                            onClick={() => handleSetCreditToDonation(msg.id, activeSuggestedEntry)}
                                            className="px-3 py-1 bg-[#2e1065] hover:bg-[#3b0764] text-purple-200 border border-purple-600/80 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                          >
                                            <span>🎁</span>
                                            <span>Set Donation Account</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const cashAcc = accounts.find(a => a.name.toLowerCase().includes('cash') || a.id === '1');
                                              if (cashAcc) handleSelectCreditAccount(msg.id, cashAcc.id, activeSuggestedEntry);
                                            }}
                                            className="px-3 py-1 bg-[#222227] hover:bg-[#2a2a30] text-zinc-200 border border-zinc-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
                                          >
                                            <span>💵</span>
                                            <span>Cash</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const bankAcc = accounts.find(a => a.name.toLowerCase().includes('bank') || a.id === '2');
                                              if (bankAcc) handleSelectCreditAccount(msg.id, bankAcc.id, activeSuggestedEntry);
                                            }}
                                            className="px-3 py-1 bg-[#222227] hover:bg-[#2a2a30] text-zinc-200 border border-zinc-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
                                          >
                                            <span>💳</span>
                                            <span>Bank</span>
                                          </button>
                                        </div>

                                        {/* Narration Quote Box */}
                                        {activeSuggestedEntry.narration && (
                                          <div className="text-xs bg-[#18181d] p-3.5 rounded-xl text-zinc-200 italic font-medium border border-zinc-800/80 leading-relaxed">
                                            &quot;{activeSuggestedEntry.narration}&quot;
                                          </div>
                                        )}

                                        {/* 1-Click Record Entry Button */}
                                        <div className="pt-1">
                                          {msg.recorded ? (
                                            <div className="w-full py-2.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs">
                                              <CheckCircle2 size={16} className="text-emerald-400" />
                                              <span>Recorded to Ledger</span>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              disabled={recordingEntryId === msg.id}
                                              onClick={() => handleQuickRecordEntry(msg.id, activeSuggestedEntry)}
                                              className="w-full py-2.5 bg-white hover:bg-zinc-100 active:scale-[0.99] disabled:bg-zinc-600 text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                                            >
                                              {recordingEntryId === msg.id ? (
                                                <>
                                                  <RefreshCw size={15} className="animate-spin text-black" />
                                                  <span>Recording to Ledger...</span>
                                                </>
                                              ) : (
                                                <>
                                                  <PlusCircle size={17} className="text-black stroke-[2.5]" />
                                                  <span>Record to Ledger Now</span>
                                                </>
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Entry Record Option when card was not active */}
                                    {!isUser && !activeSuggestedEntry && !msg.recorded && (
                                      <div className="mt-3 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleCreateSuggestedEntryForMessage(msg.id)}
                                          className="w-full py-2.5 bg-white hover:bg-zinc-100 active:scale-[0.99] text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                                        >
                                          <PlusCircle size={17} className="text-black stroke-[2.5]" />
                                          <span>Record to Ledger Now</span>
                                        </button>
                                      </div>
                                    )}

                                    {/* Already recorded indicator */}
                                    {!isUser && !activeSuggestedEntry && msg.recorded && (
                                      <div className="mt-3 w-full py-2.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs">
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                        <span>Recorded to Ledger</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              {/* 1-Tap Follow-up / Clarification Chips */}
                              {!isUser && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && !isEditing && (
                                <div className="flex flex-wrap gap-1.5 pt-2">
                                  {msg.followUpSuggestions.map((suggestion, sIdx) => (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      disabled={isLoading}
                                      onClick={() => handleSendMessage(suggestion)}
                                      className="px-2.5 py-1 bg-[#252525] hover:bg-[#303030] active:scale-95 border border-zinc-700/80 hover:border-zinc-500 text-zinc-300 hover:text-white rounded-full text-[11px] font-medium transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                                    >
                                      <span>{suggestion}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Message actions (Copy, Edit, Delete, Record) */}
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                              <span>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg.id, msg.text)}
                                className="hover:text-zinc-300 cursor-pointer"
                                title="Copy"
                              >
                                {copiedMsgId === msg.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              </button>
                              {!isUser && !msg.recorded && (
                                <button
                                  type="button"
                                  onClick={() => handleCreateSuggestedEntryForMessage(msg.id)}
                                  className="hover:text-teal-400 cursor-pointer flex items-center gap-1 text-[10px]"
                                  title="Record to Ledger Now"
                                >
                                  <PlusCircle size={11} className="text-teal-400" />
                                  <span>Record</span>
                                </button>
                              )}
                              {isUser && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(msg)}
                                  className="hover:text-zinc-300 cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit3 size={11} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="hover:text-rose-400 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* AI Loading indicator */}
                {isLoading && (
                  <div className="max-w-3xl mx-auto flex items-center gap-2 text-zinc-400 text-xs">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                      <Sparkles size={14} className="animate-spin text-blue-400" />
                    </div>
                    <div className="p-2.5 px-4 bg-[#212121] border border-zinc-800 rounded-2xl text-zinc-300 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]"></span>
                      <span className="text-zinc-300 text-[11px] ml-1">
                        {isThinkingActive ? "🧠 Deep CA reasoning in progress..." : "⚡ Gemini Turbo • Preparing sudden response..."}
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Selected File Attachment Banner */}
              {selectedFile && (
                <div className="p-2 px-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-200">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip size={14} className="text-indigo-400 shrink-0" />
                    <span className="font-medium truncate max-w-[240px]">{selectedFile.name}</span>
                    <span className="text-[10px] text-zinc-500">
                      ({Math.round(selectedFile.size / 1024)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* ChatGPT Bottom Capsule Input Bar */}
              <div className="p-3 sm:p-4 bg-[#171717] z-20">
                <div className="max-w-3xl mx-auto relative bg-[#2f2f2f] rounded-2xl border border-zinc-700/60 p-2 sm:p-2.5 flex items-center gap-2 shadow-xl focus-within:border-zinc-500 transition-colors">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.txt,.csv,.json"
                    className="hidden"
                  />

                  {/* '+' Button to attach receipt */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded-full transition-colors cursor-pointer shrink-0"
                    title="Attach file, receipt or bill"
                  >
                    <Plus size={18} />
                  </button>

                  {/* Text Input area */}
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder=""
                    className="flex-1 max-h-28 py-1.5 px-2 text-xs sm:text-[13.5px] bg-transparent focus:outline-none resize-none text-white placeholder-zinc-400 leading-relaxed"
                  />

                  {/* Clear button when text is entered */}
                  {inputText && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputText('');
                        inputRef.current?.focus();
                      }}
                      className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded-full transition-colors cursor-pointer shrink-0"
                      title="Clear text area"
                    >
                      <X size={14} />
                    </button>
                  )}

                  {/* Turbo / Think mode toggle button */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isThinkingActive;
                      setIsThinkingActive(next);
                      showToast(next ? 'Deep Forensic CA Reasoning Mode enabled' : 'Turbo Instant AI Mode enabled (sudden responses)', 'info');
                    }}
                    className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isThinkingActive 
                        ? 'bg-indigo-600 text-white font-semibold shadow-xs' 
                        : 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/50 hover:bg-emerald-900/60'
                    }`}
                    title={isThinkingActive ? "Switch to Turbo Instant AI Mode" : "Switch to Deep Forensic CA Reasoning Mode"}
                  >
                    {isThinkingActive ? <Brain size={13} /> : <Zap size={13} />}
                    <span>{isThinkingActive ? "Deep Think" : "Turbo"}</span>
                  </button>

                  {/* Voice Mic Button */}
                  <button
                    type="button"
                    onClick={() => showToast('Voice input listening...', 'info')}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded-full transition-colors cursor-pointer shrink-0"
                    title="Voice input"
                  >
                    <Mic size={17} />
                  </button>

                  {/* Send Action Arrow Button */}
                  <button
                    type="button"
                    disabled={isLoading || (!inputText.trim() && !selectedFile)}
                    onClick={() => handleSendMessage()}
                    className="w-8 h-8 rounded-full bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-black flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm active:scale-95"
                    title="Send message"
                  >
                    <Send size={14} />
                  </button>
                </div>
                <div className="text-center mt-1.5 text-[10px] text-zinc-500">
                  Gemini AI can make mistakes. Verify important ledger transactions.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* CA Long-Term Memory Bank Modal */}
        {isMemoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-[#1e1f20] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#191a1b]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
                    <Brain size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      CA Long-Term Memory Bank
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono">
                        {memories.length} Active Rules
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Directives, vendor mappings & treasurer preferences retained across chats.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMemoryModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Add New Directive Input */}
              <div className="p-4 border-b border-zinc-800 bg-[#141516]/50">
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                  Teach Gemini AI a New Rule or Vendor Mapping
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMemoryInput}
                    onChange={(e) => setNewMemoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMemory();
                      }
                    }}
                    placeholder="e.g. Suresh Xerox purchases belong to Printing & Stationery..."
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddMemory()}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-sm flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Memorize</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="text-[10px] text-zinc-500 self-center mr-1">Quick Add:</span>
                  <button
                    type="button"
                    onClick={() => handleAddMemory("Transactions above ₹2,000 must use Bank Account (NEFT/UPI)")}
                    className="text-[10px] bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white px-2 py-0.5 rounded-full border border-zinc-700/60 transition-colors cursor-pointer"
                  >
                    + Bank for &gt;₹2,000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddMemory("Campus canteen purchases belong to Food & Refreshments account")}
                    className="text-[10px] bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white px-2 py-0.5 rounded-full border border-zinc-700/60 transition-colors cursor-pointer"
                  >
                    + Canteen = Refreshments
                  </button>
                </div>
              </div>

              {/* Active Memories List */}
              <div className="p-4 flex-1 overflow-y-auto space-y-2 text-xs">
                {memories.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 space-y-2">
                    <Bookmark size={24} className="mx-auto text-zinc-600" />
                    <p>No custom directives stored yet.</p>
                    <button
                      type="button"
                      onClick={handleResetDefaultMemories}
                      className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs cursor-pointer"
                    >
                      Load Standard CA Rules
                    </button>
                  </div>
                ) : (
                  memories.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800/80 flex items-start justify-between gap-3 group hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <BookmarkCheck size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-zinc-200 text-xs leading-relaxed break-words">{rule}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(idx)}
                        className="opacity-60 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer shrink-0"
                        title="Forget this directive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 px-4 border-t border-zinc-800 bg-[#191a1b] flex items-center justify-between text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={handleResetDefaultMemories}
                  className="text-zinc-400 hover:text-zinc-200 text-[11px] underline cursor-pointer"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={() => setIsMemoryModalOpen(false)}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
