import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Paperclip, 
  Sparkles, 
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
  ArrowLeftRight
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
  onOpenChange?: (open: boolean) => void;
}

const STARTER_PROMPTS = [
  {
    icon: '🎉',
    label: 'Farewell party expenses',
    prompt: 'Yesterday we conducted a farewell party for senior students and spent 2,500 from cash on food and decorations. Which accounts should I debit and credit, and what is the proper narration?'
  },
  {
    icon: '☕',
    label: 'Bought refreshments for ₹450 cash',
    prompt: 'Bought tea and refreshment snacks for committee meeting for ₹450 cash. Please tell me debit account, credit account, and narration.'
  },
  {
    icon: '🎓',
    label: 'Collected union dues from students',
    prompt: 'Collected annual union dues of ₹3,000 from students directly into the union bank account. How should I record this in the ledger?'
  },
  {
    icon: '📊',
    label: 'What is our current cash & bank balance?',
    prompt: 'What is our current cash in hand and bank balance? Give me an overview of our financial health.'
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
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
            }
          },
          attachment: currentAttachment ? {
            name: currentAttachment.name,
            type: currentAttachment.type,
            base64: currentAttachment.base64
          } : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error (${response.status})`);
      }

      const data = await response.json();

      const modelMessage: ChatMessage = {
        id: 'msg_' + Date.now() + '_bot',
        role: 'model',
        text: data.reply || 'I analyzed your request, but could not formulate a response.',
        timestamp: Date.now(),
        suggestedEntry: data.hasSuggestedEntry && data.suggestedEntry ? data.suggestedEntry : undefined,
        followUpSuggestions: data.followUpSuggestions || []
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: 'msg_' + Date.now() + '_err',
        role: 'model',
        text: `**Assistant Notice:** Could not connect to AI service.\n\n*Error details:* ${err.message || 'Unknown network error'}\n\nPlease verify that your server has a valid \`GEMINI_API_KEY\` set in Settings.`,
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
    if (!isEditor) {
      showToast('Access denied: You need editor privileges to write to the ledger.', 'err');
      return;
    }

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
        narration: suggested.narration || 'Recorded via AI Assistant',
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

  const handleToggleCreditMode = (msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.suggestedEntry) return m;
      const isCurrentlyCash = m.suggestedEntry.creditAccountId === '1' || (m.suggestedEntry.creditAccountName || '').toLowerCase().includes('cash');
      const bankAcc = accounts.find(a => a.name.toLowerCase().includes('bank') || a.id === '2');
      const cashAcc = accounts.find(a => a.name.toLowerCase().includes('cash') || a.id === '1');
      
      return {
        ...m,
        suggestedEntry: {
          ...m.suggestedEntry,
          creditAccountId: isCurrentlyCash ? (bankAcc?.id || '2') : (cashAcc?.id || '1'),
          creditAccountName: isCurrentlyCash ? (bankAcc?.name || 'Union Bank Account') : (cashAcc?.name || 'Cash in Hand'),
        }
      };
    }));
  };

  const handleSelectDebitAccount = (msgId: string, accountId: string) => {
    const found = accounts.find(a => a.id === accountId);
    if (!found) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.suggestedEntry) return m;
      return {
        ...m,
        suggestedEntry: {
          ...m.suggestedEntry,
          debitAccountId: found.id,
          debitAccountName: found.name,
          debitAccountType: found.type
        }
      };
    }));
  };

  const handleSelectCreditAccount = (msgId: string, accountId: string) => {
    const found = accounts.find(a => a.id === accountId);
    if (!found) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.suggestedEntry) return m;
      return {
        ...m,
        suggestedEntry: {
          ...m.suggestedEntry,
          creditAccountId: found.id,
          creditAccountName: found.name,
          creditAccountType: found.type
        }
      };
    }));
  };

  const handleSetCreditToDonation = async (msgId: string) => {
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
      if (m.id !== msgId || !m.suggestedEntry) return m;
      return {
        ...m,
        suggestedEntry: {
          ...m.suggestedEntry,
          creditAccountId: donId,
          creditAccountName: donName,
          creditAccountType: 'Income'
        }
      };
    }));
    showToast(`Credit Account updated to "${donName}"`, 'success');
  };

  const handleSwapDebitCredit = (msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.suggestedEntry) return m;
      const currentDrId = m.suggestedEntry.debitAccountId;
      const currentDrName = m.suggestedEntry.debitAccountName;
      const currentDrType = m.suggestedEntry.debitAccountType;

      const currentCrId = m.suggestedEntry.creditAccountId;
      const currentCrName = m.suggestedEntry.creditAccountName;
      const currentCrType = m.suggestedEntry.creditAccountType;

      return {
        ...m,
        suggestedEntry: {
          ...m.suggestedEntry,
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
      {/* Floating launcher button styled in ChatGPT theme */}
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
              className="group relative w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center bg-zinc-900 hover:bg-black text-white rounded-2xl shadow-2xl shadow-black/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-zinc-700/80"
              title="Open NADA BOT Assistant"
              aria-label="Open NADA BOT Assistant"
            >
              <div className="relative flex items-center justify-center">
                <Sparkles size={24} className="text-white group-hover:rotate-12 transition-transform duration-300" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ChatGPT Layout Window with authentic Left Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={`fixed z-50 bg-[#171717] text-white rounded-2xl shadow-2xl border border-zinc-800 flex overflow-hidden ${
              isFullscreen
                ? 'inset-2 md:inset-4 w-[calc(100vw-1rem)] md:w-[calc(100vw-2rem)] h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)]'
                : 'bottom-16 md:bottom-6 right-2 sm:right-4 md:right-6 w-[calc(100vw-1rem)] sm:w-[94vw] md:w-[860px] lg:w-[940px] h-[640px] max-h-[calc(100vh-5rem)]'
            }`}
          >
            {/* Left Sidebar (ChatGPT-style) */}
            <div
              className={`bg-[#212121] border-r border-zinc-800/80 flex flex-col transition-all duration-300 z-30 shrink-0 ${
                isSidebarCollapsed 
                  ? 'w-0 overflow-hidden border-r-0 opacity-0 pointer-events-none' 
                  : 'w-[250px] sm:w-[260px] opacity-100'
              }`}
            >
              {/* Sidebar Top: NADA BOT Header + Search + Collapse Button */}
              <div className="p-3 pb-2 flex items-center justify-between text-zinc-300">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white tracking-tight flex items-center gap-1.5">
                    <Sparkles size={16} className="text-zinc-200" />
                    NADA BOT
                  </span>
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

              {/* New Chat Button (Prominent ChatGPT Style) */}
              <div className="p-3 pt-1">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="w-full py-2 px-3 bg-[#2f2f2f] hover:bg-[#383838] active:scale-98 text-white rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer group shadow-xs border border-zinc-700/50"
                >
                  <div className="flex items-center gap-2.5">
                    <SquarePen size={15} className="text-zinc-300 group-hover:text-white" />
                    <span className="font-medium text-[13px]">New chat</span>
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
                      placeholder="Search recent chats..."
                      autoFocus
                      className="w-full pl-7 pr-2.5 py-1.5 bg-[#171717] border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* ChatGPT Feature Links (Images, Library, Projects, Scheduled) */}
              <div className="px-2 py-1 space-y-0.5 border-b border-zinc-800/80 text-[12.5px] text-zinc-300">
                <div 
                  onClick={() => handleSendMessage('Generate an image receipt mockup for our expenses')}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <div className="flex items-center gap-2.5">
                    <ImageIcon size={14} className="text-zinc-400" />
                    <span>Images</span>
                  </div>
                  <span className="text-[9px] bg-zinc-700/70 text-zinc-300 font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">UPDATED</span>
                </div>

                <div 
                  onClick={() => onNavigateTab?.('reports')}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <BookOpen size={14} className="text-zinc-400" />
                  <span>Library</span>
                </div>

                <div 
                  onClick={() => onNavigateTab?.('ledger')}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <Folder size={14} className="text-zinc-400" />
                  <span>Projects</span>
                </div>

                <div 
                  onClick={() => onNavigateTab?.('calendar')}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <Calendar size={14} className="text-zinc-400" />
                  <span>Scheduled</span>
                </div>

                <div 
                  onClick={() => showToast('Double-Entry Co-Pilot plugins active', 'info')}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white"
                >
                  <SlidersHorizontal size={14} className="text-zinc-400" />
                  <span>Plugins</span>
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

                  <span className="font-semibold text-sm text-zinc-200 truncate hidden sm:inline">
                    {activeSession?.title || 'NADA BOT'}
                  </span>
                </div>

                {/* Center Pill: Chat | Work */}
                <div className="bg-[#212121] border border-zinc-800 p-0.5 rounded-full flex items-center shadow-inner text-xs">
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
                    onClick={() => setActiveTabMode('work')}
                    className={`px-3.5 py-1 rounded-full font-medium transition-all cursor-pointer flex items-center gap-1 ${
                      activeTabMode === 'work'
                        ? 'bg-[#2f2f2f] text-white shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sparkle size={11} className="text-indigo-400" />
                    <span>Work</span>
                  </button>
                </div>

                {/* Right Action Icons: New chat, Fullscreen, Close */}
                <div className="flex items-center gap-1">
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center space-y-6 py-12 animate-in fade-in duration-300">
                    {/* Centered Headline from Screenshot: "Where should we begin?" */}
                    <div className="space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        Where should we begin?
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                        Ask any accounting question, describe an expense to generate Debit/Credit entries, or upload a bill.
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
                  <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((msg) => {
                      const isUser = msg.role === 'user';
                      const isEditing = editingMessageId === msg.id;

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3.5 group ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isUser && (
                            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                              <Sparkles size={14} />
                            </div>
                          )}

                          <div className={`flex flex-col space-y-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                            {/* Message Bubble Container */}
                            <div
                              className={`p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed relative ${
                                isUser
                                  ? 'bg-[#2f2f2f] text-white rounded-tr-xs'
                                  : 'bg-transparent text-zinc-200 -ml-1'
                              }`}
                            >
                              {/* Attachment preview */}
                              {msg.attachment && (
                                <div className="mb-2 p-2 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center gap-2 text-xs">
                                  <Paperclip size={13} className="text-zinc-400 shrink-0" />
                                  <span className="truncate font-medium text-zinc-200">{msg.attachment.name}</span>
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
                              ) : (
                                <div className="prose prose-invert prose-xs max-w-none">
                                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                              )}

                              {/* Suggested Double-Entry Card */}
                              {msg.suggestedEntry && !isEditing && (
                                <div className="mt-3 p-3 bg-[#212121] rounded-xl border border-zinc-700 space-y-2 text-xs text-zinc-200">
                                  <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                                    <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                                      <Receipt size={14} />
                                      <span>Double-Entry Recommendation</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleSwapDebitCredit(msg.id)}
                                        className="p-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer border border-zinc-700/60"
                                        title="Swap Debit and Credit accounts"
                                      >
                                        <ArrowLeftRight size={11} />
                                        <span>Swap Dr/Cr</span>
                                      </button>
                                      <span className="text-[11px] font-bold text-white bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700/60">
                                        ₹{Number(msg.suggestedEntry.amount || 0).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
                                    {/* Debit Box */}
                                    <div className="p-2 bg-zinc-900/90 rounded-lg border border-zinc-800 flex flex-col justify-between">
                                      <div className="flex items-center justify-between pb-1">
                                        <span className="text-[10px] text-rose-400 font-semibold uppercase">Debit (Dr)</span>
                                        <span className="text-[9px] text-zinc-500 font-mono">Account</span>
                                      </div>
                                      <select
                                        value={
                                          msg.suggestedEntry.debitAccountId ||
                                          accounts.find(a => a.name.toLowerCase().trim() === msg.suggestedEntry?.debitAccountName?.toLowerCase().trim())?.id ||
                                          ''
                                        }
                                        onChange={(e) => handleSelectDebitAccount(msg.id, e.target.value)}
                                        className="w-full mt-0.5 py-1 px-1.5 bg-zinc-800 text-white font-medium text-xs rounded border border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer"
                                      >
                                        {msg.suggestedEntry.debitAccountName && !accounts.some(a => a.id === msg.suggestedEntry?.debitAccountId || a.name === msg.suggestedEntry?.debitAccountName) && (
                                          <option value="">{msg.suggestedEntry.debitAccountName} (Suggested)</option>
                                        )}
                                        {accounts.map(acc => (
                                          <option key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.type})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Credit Box */}
                                    <div className="p-2 bg-zinc-900/90 rounded-lg border border-zinc-800 flex flex-col justify-between">
                                      <div className="flex items-center justify-between pb-1">
                                        <span className="text-[10px] text-emerald-400 font-semibold uppercase">Credit (Cr)</span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleCreditMode(msg.id)}
                                            className="text-[9px] text-indigo-400 hover:underline cursor-pointer"
                                          >
                                            Cash/Bank
                                          </button>
                                        </div>
                                      </div>
                                      <select
                                        value={
                                          msg.suggestedEntry.creditAccountId ||
                                          accounts.find(a => a.name.toLowerCase().trim() === msg.suggestedEntry?.creditAccountName?.toLowerCase().trim())?.id ||
                                          ''
                                        }
                                        onChange={(e) => handleSelectCreditAccount(msg.id, e.target.value)}
                                        className="w-full mt-0.5 py-1 px-1.5 bg-zinc-800 text-white font-medium text-xs rounded border border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer"
                                      >
                                        {msg.suggestedEntry.creditAccountName && !accounts.some(a => a.id === msg.suggestedEntry?.creditAccountId || a.name === msg.suggestedEntry?.creditAccountName) && (
                                          <option value="">{msg.suggestedEntry.creditAccountName} (Suggested)</option>
                                        )}
                                        {accounts.map(acc => (
                                          <option key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.type})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Quick Preset Buttons for Credit / Income */}
                                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    <span className="text-[10px] text-zinc-500 font-medium">Quick Cr:</span>
                                    <button
                                      type="button"
                                      onClick={() => handleSetCreditToDonation(msg.id)}
                                      className="px-2 py-0.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                                    >
                                      🎁 Set Donation Account
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cashAcc = accounts.find(a => a.name.toLowerCase().includes('cash') || a.id === '1');
                                        if (cashAcc) handleSelectCreditAccount(msg.id, cashAcc.id);
                                      }}
                                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded text-[10px] transition-colors cursor-pointer"
                                    >
                                      💵 Cash
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const bankAcc = accounts.find(a => a.name.toLowerCase().includes('bank') || a.id === '2');
                                        if (bankAcc) handleSelectCreditAccount(msg.id, bankAcc.id);
                                      }}
                                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded text-[10px] transition-colors cursor-pointer"
                                    >
                                      💳 Bank
                                    </button>
                                  </div>

                                  {msg.suggestedEntry.narration && (
                                    <div className="text-[11px] bg-zinc-900/60 p-2 rounded-lg text-zinc-300 italic border border-zinc-800">
                                      &quot;{msg.suggestedEntry.narration}&quot;
                                    </div>
                                  )}

                                  {/* 1-Click Record Entry Button */}
                                  <div className="pt-1">
                                    {msg.recorded ? (
                                      <div className="w-full py-1.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                                        <CheckCircle2 size={14} className="text-emerald-400" />
                                        <span>Recorded to Ledger</span>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={recordingEntryId === msg.id}
                                        onClick={() => handleQuickRecordEntry(msg.id, msg.suggestedEntry)}
                                        className="w-full py-2 bg-white hover:bg-zinc-200 disabled:bg-zinc-600 text-black rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                      >
                                        {recordingEntryId === msg.id ? (
                                          <>
                                            <RefreshCw size={13} className="animate-spin" />
                                            <span>Recording to Ledger...</span>
                                          </>
                                        ) : (
                                          <>
                                            <PlusCircle size={14} />
                                            <span>Record to Ledger Now</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
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

                            {/* Message actions (Copy, Edit, Delete) */}
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
                      <Sparkles size={14} className="animate-spin" />
                    </div>
                    <div className="p-2.5 px-4 bg-[#212121] border border-zinc-800 rounded-2xl text-zinc-300 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.4s]"></span>
                      <span className="text-zinc-400 text-[11px] ml-1">Thinking & preparing response...</span>
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
                    placeholder="Ask anything..."
                    className="flex-1 max-h-28 py-1.5 px-2 text-xs sm:text-[13.5px] bg-transparent focus:outline-none resize-none text-white placeholder-zinc-400 leading-relaxed"
                  />

                  {/* Think mode toggle button */}
                  <button
                    type="button"
                    onClick={() => setIsThinkingActive(!isThinkingActive)}
                    className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isThinkingActive 
                        ? 'bg-zinc-100 text-black font-semibold' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-700/60'
                    }`}
                    title="Toggle Deep Thinking reasoning mode"
                  >
                    <Brain size={14} />
                    <span>Think</span>
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
                  Nada AI Double-Entry Co-Pilot can make mistakes. Verify important ledger transactions.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
