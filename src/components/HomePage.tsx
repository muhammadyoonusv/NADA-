/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Account, JournalEntry, Student, Program } from '../types';
import { getAccountBalances, resolveAccountName } from '../utils/accounting';
import { 
  Wallet, 
  Landmark, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Users, 
  ArrowRight, 
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Clock,
  Plus,
  ArrowLeftRight,
  Calendar,
  ChevronRight,
  MoreVertical,
  Check,
  Copy,
  Eye,
  X,
  Sparkles,
  AlertCircle,
  Download,
  Upload
} from 'lucide-react';

interface HomePageProps {
  accounts: Account[];
  entries: JournalEntry[];
  students?: Student[];
  programs?: Program[];
  currentUser?: any;
  isEditor?: boolean;
  sheetName?: string;
  sheetTagline?: string;
  onNavigateToTab: (tab: 'home' | 'journal' | 'ledgers' | 'trial' | 'receipts' | 'expenditure' | 'balance' | 'dues' | 'programs' | 'chart' | 'templates' | 'trash' | 'settings' | 'profile' | 'privacy') => void;
  onOpenAddEntry?: () => void;
  onOpenPdfModal?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (content: string) => Promise<boolean> | boolean;
  onAddEntry?: (entry: Omit<JournalEntry, 'id'>) => Promise<boolean>;
}

export function HomePage({
  accounts,
  entries,
  students = [],
  programs = [],
  currentUser,
  isEditor = false,
  sheetName = 'NADA',
  sheetTagline = 'Accountability for a Better Tomorrow',
  onNavigateToTab,
  onOpenAddEntry,
  onOpenPdfModal,
  onExportBackup,
  onImportBackup,
  onAddEntry,
}: HomePageProps) {
  // Modal states
  const [selectedEntryDetails, setSelectedEntryDetails] = useState<JournalEntry | null>(null);
  const [activeMenuEntryId, setActiveMenuEntryId] = useState<string | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [copiedNarrationId, setCopiedNarrationId] = useState<string | null>(null);

  // Transfer form state
  const [transferFrom, setTransferFrom] = useState<'cash_to_bank' | 'bank_to_cash'>('cash_to_bank');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferNarration, setTransferNarration] = useState('Contra cash transfer between accounts');
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false);

  // Accounting calculations
  const balances = useMemo(() => getAccountBalances(accounts, entries), [accounts, entries]);

  // Extract Cash and Bank balances (account 1: Cash, account 2: Bank)
  const cashBal = balances['1']?.balance || 0;
  const bankBal = balances['2']?.balance || 0;

  // Sum up all income and expenses
  let totalIncome = 0;
  let totalExpense = 0;

  for (const acc of accounts) {
    const balData = balances[acc.id];
    if (balData) {
      if (acc.type === 'Income') {
        totalIncome += balData.balance;
      } else if (acc.type === 'Expense') {
        totalExpense += balData.balance;
      }
    }
  }

  const netSurplus = totalIncome - totalExpense;

  // Calculate pending dues from programs and students
  const { totalPendingDues, pendingCount } = useMemo(() => {
    let pendingAmt = 0;
    let count = 0;

    if (programs.length > 0) {
      programs.forEach(prog => {
        const excluded = prog.excludedStudentIds || [];
        students.forEach(stu => {
          if (excluded.includes(stu.id)) return;
          const due = prog.studentDues?.[stu.id] || { amountPaid: 0, totalDue: prog.defaultAmount, status: 'Pending' };
          const remaining = Math.max(0, due.totalDue - due.amountPaid);
          if (remaining > 0) {
            pendingAmt += remaining;
            count++;
          }
        });
      });
    }

    if (pendingAmt === 0 && students.length > 0) {
      students.forEach(stu => {
        const remaining = Math.max(0, (stu.totalDue || 0) - (stu.amountPaid || 0));
        if (remaining > 0) {
          pendingAmt += remaining;
          count++;
        }
      });
    }

    return { totalPendingDues: pendingAmt, pendingCount: count };
  }, [programs, students]);

  // Currency formatter
  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Dynamic greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }, []);

  // Formatted date (e.g. "Mon, 15 Sep 2026")
  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
  }, []);

  // Sorted entries chronologically (latest first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [entries]);

  // Helper for colored account pill badges matching the reference image style
  const getAccountBadgeClass = (accId: string, accType?: string) => {
    const acc = accounts.find(a => a.id === accId);
    const accName = acc?.name || '';
    const type = accType || acc?.type;
    const lower = accName.toLowerCase();

    if (lower.includes('cash')) {
      return 'bg-[#E8F8F5] text-[#00A884] border border-[#C1F2E8]';
    }
    if (lower.includes('bank') || lower.includes('sbi') || lower.includes('hdfc')) {
      return 'bg-[#EBF5FF] text-[#1E70EB] border border-[#CCE4FF]';
    }
    if (type === 'Expense' || lower.includes('exp') || lower.includes('stationery') || lower.includes('rent') || lower.includes('print')) {
      return 'bg-[#FFF1F2] text-[#E11D48] border border-[#FFE2E6]';
    }
    if (type === 'Income' || lower.includes('donation') || lower.includes('income') || lower.includes('fee') || lower.includes('dues')) {
      return 'bg-[#EEFBF4] text-[#16A34A] border border-[#D5F7E4]';
    }
    return 'bg-[#F5F1FF] text-[#7C3AED] border border-[#E4D9FF]';
  };

  // Copy narration handler
  const handleCopyNarration = (entry: JournalEntry) => {
    const text = entry.narration || `${resolveAccountName(entry.debitAccount, accounts)} to ${resolveAccountName(entry.creditAccount, accounts)}`;
    navigator.clipboard.writeText(text);
    setCopiedNarrationId(entry.id);
    setTimeout(() => setCopiedNarrationId(null), 2000);
    setActiveMenuEntryId(null);
  };

  // Handle Quick Transfer execution
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) return;

    // Cash is account '1', Bank is account '2'
    const debitAcc = transferFrom === 'cash_to_bank' ? '2' : '1';
    const creditAcc = transferFrom === 'cash_to_bank' ? '1' : '2';

    setIsTransferSubmitting(true);
    try {
      if (onAddEntry) {
        await onAddEntry({
          date: transferDate,
          debitAccount: debitAcc,
          creditAccount: creditAcc,
          amount: amt,
          narration: transferNarration || (transferFrom === 'cash_to_bank' ? 'Deposited Cash into Bank' : 'Withdrew Cash from Bank'),
        });
      }
      setIsTransferModalOpen(false);
      setTransferAmount('');
    } catch (err) {
      console.error('Transfer failed', err);
    } finally {
      setIsTransferSubmitting(false);
    }
  };

  // Record Entry handler
  const handleRecordEntry = () => {
    if (onOpenAddEntry) {
      onOpenAddEntry();
    } else {
      onNavigateToTab('journal');
    }
  };

  // Review & Save PDF handler
  const handleOpenPdfReview = () => {
    if (onOpenPdfModal) {
      onOpenPdfModal();
    } else {
      onNavigateToTab('journal');
    }
  };

  // Export Ledger Backup handler
  const handleExportBackup = () => {
    if (onExportBackup) {
      onExportBackup();
      return;
    }
    const backupObj = {
      accounts,
      entries,
      students,
      programs
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${(sheetName || 'ledger').replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Ledger Backup handler
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (onImportBackup) {
        const success = await onImportBackup(content);
        if (success) {
          alert('The accounts and transaction sheet were imported successfully.');
        } else {
          alert('Invalid backup file. Please upload a valid exported JSON ledger file.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* 🌟 1. HERO BANNER - Soft blue gradient with elegant architectural silhouette */}
      <div className="relative rounded-3xl p-5 sm:p-7 shadow-xs overflow-hidden bg-gradient-to-r from-[#D7EEFA] via-[#EAF4FC] to-[#EDE8FD] border border-sky-200/70">
        
        {/* Subtle Architectural Silhouette Background SVG */}
        <div className="absolute right-0 bottom-0 top-0 w-1/2 sm:w-2/5 pointer-events-none opacity-20 flex items-end justify-end overflow-hidden select-none">
          <svg
            className="w-full h-full object-cover object-right-bottom text-sky-700"
            viewBox="0 0 400 240"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Mosque Minarets, Domes and Palms Silhouette */}
            <path d="M260 240V120C260 115 265 110 270 110C275 110 280 115 280 120V240H260Z" />
            <path d="M270 95L265 110H275L270 95Z" />
            <circle cx="270" cy="92" r="3" />
            <path d="M320 240V140C320 135 324 130 328 130C332 130 336 135 336 140V240H320Z" />
            <path d="M328 118L324 130H332L328 118Z" />
            <path d="M200 240V180C200 150 220 130 250 130C280 130 300 150 300 180V240H200Z" />
            <path d="M250 115C250 115 242 125 242 130H258C258 125 250 115 250 115Z" />
            <circle cx="250" cy="112" r="2.5" />
            <path d="M140 240V195C140 175 155 160 175 160C195 160 210 175 210 195V240H140Z" />
            <path d="M350 240V200C350 185 362 175 378 175C394 175 405 185 405 200V240H350Z" />
            {/* Palm branch accent */}
            <path d="M80 240Q120 180 110 130Q135 155 125 185Q150 145 130 120Q160 140 140 175Q170 145 150 110Q180 135 160 180Q190 160 180 240Z" opacity="0.6" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5 max-w-lg">
            <p className="text-xs sm:text-sm font-semibold text-sky-800 tracking-wide">
              {greeting}
            </p>
            <h1 className="text-xl sm:text-2xl lg:text-[26px] font-black text-slate-900 tracking-tight leading-tight">
              Let's keep our Union finances organized.
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-600 font-medium pt-0.5 flex items-center gap-2">
              <span>Transparent Accounts</span>
              <span className="text-slate-400">•</span>
              <span>Stronger Communities</span>
            </p>
          </div>

          <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-3 shrink-0">
            <p className="text-xs sm:text-[13px] font-serif italic text-slate-500/90 text-left sm:text-right leading-tight">
              "Trust Today<br className="hidden sm:inline" /> A Stronger Tomorrow"
            </p>

            <div className="inline-flex items-center gap-2 bg-white/85 backdrop-blur-sm border border-sky-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs text-xs font-semibold text-slate-700 select-none">
              <Calendar size={14} className="text-indigo-600 shrink-0" />
              <span className="font-mono text-[11px] sm:text-xs">{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 💰 2. FINANCIAL SUMMARY CARDS - 6 Pastel cards exactly as in reference */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        
        {/* Card 1: Cash Balance */}
        <div 
          onClick={() => onNavigateToTab('ledgers')}
          className="bg-[#E8F8F5] border border-[#C7F0E7] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-[#A2E7D8] transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#C1F2E8] text-[#00A884] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Wallet size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <button 
              type="button"
              className="w-7 h-7 rounded-full bg-white/80 group-hover:bg-white text-emerald-700 flex items-center justify-center shadow-3xs cursor-pointer transition-all"
              title="View Cash Ledger"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[10px] sm:text-[11px] font-bold text-emerald-800/80 tracking-wider uppercase">
              CASH BALANCE
            </p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5 font-sans truncate">
              {formatAmount(cashBal)}
            </h3>
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-700 mt-1.5 truncate">
              <ArrowUpRight size={13} className="shrink-0" />
              <span>+12% from last month</span>
            </div>
          </div>
        </div>

        {/* Card 2: Bank Balance */}
        <div 
          onClick={() => onNavigateToTab('ledgers')}
          className="bg-[#EBF5FF] border border-[#CCE4FF] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-[#A8D1FF] transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#D6EAFF] text-[#1E70EB] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Landmark size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <button 
              type="button"
              className="w-7 h-7 rounded-full bg-white/80 group-hover:bg-white text-blue-700 flex items-center justify-center shadow-3xs cursor-pointer transition-all"
              title="View Bank Ledger"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[10px] sm:text-[11px] font-bold text-blue-800/80 tracking-wider uppercase">
              BANK BALANCE
            </p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-blue-950 tracking-tight mt-0.5 font-sans truncate">
              {formatAmount(bankBal)}
            </h3>
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-blue-700 mt-1.5 truncate">
              <ArrowUpRight size={13} className="shrink-0" />
              <span>+8% from last month</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Income */}
        <div 
          onClick={() => onNavigateToTab('receipts')}
          className="bg-[#EEFBF4] border border-[#D1F5E1] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-[#B3EFCB] transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#D5F7E4] text-[#16A34A] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <TrendingUp size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <button 
              type="button"
              className="w-7 h-7 rounded-full bg-white/80 group-hover:bg-white text-emerald-700 flex items-center justify-center shadow-3xs cursor-pointer transition-all"
              title="View Income Statement"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[10px] sm:text-[11px] font-bold text-emerald-800/80 tracking-wider uppercase">
              TOTAL INCOME
            </p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5 font-sans truncate">
              {formatAmount(totalIncome)}
            </h3>
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-700 mt-1.5 truncate">
              <ArrowUpRight size={13} className="shrink-0" />
              <span>+15% this month</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Payments */}
        <div 
          onClick={() => onNavigateToTab('expenditure')}
          className="bg-[#FFF1F2] border border-[#FFE0E3] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-[#FFC2C8] transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#FFE2E6] text-[#E11D48] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <TrendingDown size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <button 
              type="button"
              className="w-7 h-7 rounded-full bg-white/80 group-hover:bg-white text-rose-700 flex items-center justify-center shadow-3xs cursor-pointer transition-all"
              title="View Expenditure"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[10px] sm:text-[11px] font-bold text-rose-800/80 tracking-wider uppercase">
              TOTAL PAYMENTS
            </p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-[#E11D48] tracking-tight mt-0.5 font-sans truncate">
              - {formatAmount(totalExpense)}
            </h3>
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-rose-600 mt-1.5 truncate">
              <ArrowDownRight size={13} className="shrink-0" />
              <span>-5% this month</span>
            </div>
          </div>
        </div>

        {/* Card 5: Net Surplus */}
        <div 
          onClick={() => onNavigateToTab('balance')}
          className="bg-[#F5F1FF] border border-[#E4D9FF] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-[#D0BEFF] transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#E8DEFF] text-[#7C3AED] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Coins size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <button 
              type="button"
              className="w-7 h-7 rounded-full bg-white/80 group-hover:bg-white text-purple-700 flex items-center justify-center shadow-3xs cursor-pointer transition-all"
              title="View Balance Sheet"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[10px] sm:text-[11px] font-bold text-purple-800/80 tracking-wider uppercase">
              NET SURPLUS
            </p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-purple-900 tracking-tight mt-0.5 font-sans truncate">
              {formatAmount(netSurplus)}
            </h3>
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-purple-700 mt-1.5 truncate">
              <ArrowUpRight size={13} className="shrink-0" />
              <span>+20% overall growth</span>
            </div>
          </div>
        </div>

        {/* Card 6: Pending Dues */}
        <div 
          onClick={() => onNavigateToTab('dues')}
          className="bg-[#FFF7ED] border border-[#FFEDD5] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-[#FFD7AA] transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#FFE4C4] text-[#EA580C] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Users size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <button 
              type="button"
              className="w-7 h-7 rounded-full bg-white/80 group-hover:bg-white text-amber-700 flex items-center justify-center shadow-3xs cursor-pointer transition-all"
              title="Manage Student Dues"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[10px] sm:text-[11px] font-bold text-amber-800/80 tracking-wider uppercase">
              PENDING DUES
            </p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-amber-950 tracking-tight mt-0.5 font-sans truncate">
              {formatAmount(totalPendingDues)}
            </h3>
            <div className="text-[10px] sm:text-[11px] font-semibold text-amber-700 mt-1.5 truncate">
              {pendingCount} pending entries
            </div>
          </div>
        </div>

      </div>

      {/* ⚡ 3. QUICK ACTIONS - Record Entry, Review & Save PDF, Backup Ledger, Import Backup */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Quick Action 1: Record Entry */}
        <button
          onClick={handleRecordEntry}
          className="bg-white border border-gray-200/90 hover:border-emerald-300 rounded-2xl p-4 text-center flex flex-col items-center justify-center shadow-xs hover:shadow-sm transition-all cursor-pointer group"
          title="Record a new transaction entry in the journal"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#00A884] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <Plus size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-800 mt-2.5">
            Record Entry
          </span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
            New Transaction
          </span>
        </button>

        {/* Quick Action 2: Review & Save PDF */}
        <button
          onClick={handleOpenPdfReview}
          className="bg-white border border-gray-200/90 hover:border-rose-300 rounded-2xl p-4 text-center flex flex-col items-center justify-center shadow-xs hover:shadow-sm transition-all cursor-pointer group"
          title="Review audited financial statements and save formatted PDF reports"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileText size={20} className="stroke-[2.2]" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-800 mt-2.5">
            Review & Save PDF
          </span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
            Audit Statements
          </span>
        </button>

        {/* Quick Action 3: Backup Ledger */}
        <button
          onClick={handleExportBackup}
          className="bg-white border border-gray-200/90 hover:border-blue-300 rounded-2xl p-4 text-center flex flex-col items-center justify-center shadow-xs hover:shadow-sm transition-all cursor-pointer group"
          title="Download and backup your ledger data as a secure JSON file"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Download size={20} className="stroke-[2.2]" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-800 mt-2.5">
            Backup Ledger
          </span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
            Export JSON File
          </span>
        </button>

        {/* Quick Action 4: Import Backup */}
        <label
          className="bg-white border border-gray-200/90 hover:border-purple-300 rounded-2xl p-4 text-center flex flex-col items-center justify-center shadow-xs hover:shadow-sm transition-all cursor-pointer group"
          title="Restore ledger data from a previously exported JSON backup"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Upload size={20} className="stroke-[2.2]" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-800 mt-2.5">
            Import Backup
          </span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
            Restore from File
          </span>
          <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
        </label>

      </div>

      {/* 📖 4. JOURNAL TRANSACTIONS SECTION - Premium card table matching reference */}
      <div className="bg-white border border-gray-200/90 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Section Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Journal Transactions
              </h2>
              <p className="text-xs text-slate-400">
                {sortedEntries.length} recorded {sortedEntries.length === 1 ? 'entry' : 'entries'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab('journal')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F0EBFF] hover:bg-[#E5DBFF] text-[#6D28D9] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
          >
            <span>View All</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Transactions Content */}
        {sortedEntries.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <FileText className="mx-auto mb-2 text-slate-300" size={36} />
            <p className="font-semibold text-slate-700 text-sm">No journal entries recorded yet.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Record your union receipts, payments, and contra transfers to keep books balanced.
            </p>
            <button
              onClick={() => {
                if (onOpenAddEntry) onOpenAddEntry();
                else onNavigateToTab('journal');
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>Record First Entry</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-gray-200 text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3.5 w-10 text-center">#</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Date</th>
                  <th className="py-3 px-3.5">Description</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Debit (DR) Account</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Credit (CR) Account</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Amount</th>
                  <th className="py-3 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {sortedEntries.slice(0, 8).map((entry, index) => {
                  const drAccName = resolveAccountName(entry.debitAccount, accounts);
                  const crAccName = resolveAccountName(entry.creditAccount, accounts);
                  const isMenuOpen = activeMenuEntryId === entry.id;

                  return (
                    <tr 
                      key={entry.id} 
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      onClick={() => setSelectedEntryDetails(entry)}
                    >
                      {/* Entry # */}
                      <td className="py-3 px-3.5 text-center font-mono text-xs text-slate-400 font-medium">
                        {index + 1}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {entry.date}
                      </td>

                      {/* Description / Narration */}
                      <td className="py-3 px-3.5 text-slate-800 font-medium max-w-[200px] truncate">
                        {entry.narration || 'General Union Entry'}
                      </td>

                      {/* Debit (DR) Account Badge */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {entry.isCompound ? (
                          <div className="space-y-1">
                            {entry.debits?.map((db, idx) => {
                              const name = resolveAccountName(db.accountId, accounts);
                              const badgeClass = getAccountBadgeClass(db.accountId, db.type);
                              return (
                                <span key={idx} className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${badgeClass}`}>
                                  <span>{name}</span>
                                  <span className="text-[9px] font-mono opacity-85">₹{db.amount.toLocaleString('en-IN')}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${getAccountBadgeClass(entry.debitAccount, entry.debitAccountType)}`}>
                            {drAccName}
                          </span>
                        )}
                      </td>

                      {/* Credit (CR) Account Badge */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {entry.isCompound ? (
                          <div className="space-y-1">
                            {entry.credits?.map((cr, idx) => {
                              const name = resolveAccountName(cr.accountId, accounts);
                              const badgeClass = getAccountBadgeClass(cr.accountId, cr.type);
                              return (
                                <span key={idx} className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${badgeClass}`}>
                                  <span>{name}</span>
                                  <span className="text-[9px] font-mono opacity-85">₹{cr.amount.toLocaleString('en-IN')}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${getAccountBadgeClass(entry.creditAccount, entry.creditAccountType)}`}>
                            {crAccName}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3.5 text-right font-bold font-mono text-slate-900 whitespace-nowrap">
                        ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* More Options Menu */}
                      <td className="py-3 px-2 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveMenuEntryId(isMenuOpen ? null : entry.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="More options"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Dropdown menu */}
                        {isMenuOpen && (
                          <div className="absolute right-2 top-8 z-30 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                            <button
                              onClick={() => {
                                setSelectedEntryDetails(entry);
                                setActiveMenuEntryId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                            >
                              <Eye size={14} className="text-slate-500" />
                              <span>View Details</span>
                            </button>
                            <button
                              onClick={() => handleCopyNarration(entry)}
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                            >
                              {copiedNarrationId === entry.id ? (
                                <>
                                  <Check size={14} className="text-emerald-600" />
                                  <span className="text-emerald-600 font-semibold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={14} className="text-slate-500" />
                                  <span>Copy Narration</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                onNavigateToTab('journal');
                                setActiveMenuEntryId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-purple-700 font-medium flex items-center gap-2 cursor-pointer border-t border-gray-100"
                            >
                              <ArrowRight size={14} className="text-purple-600" />
                              <span>Open in Journal</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer summary link if more entries exist */}
        {sortedEntries.length > 8 && (
          <div className="p-3 bg-slate-50/60 border-t border-gray-100 text-center">
            <button
              onClick={() => onNavigateToTab('journal')}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View all {sortedEntries.length} entries in Journal Spreadsheet</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* 💳 QUICK TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#EDE7F6] text-[#7C3AED] flex items-center justify-center shadow-3xs">
                  <ArrowLeftRight size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Quick Transfer</h3>
                  <p className="text-xs text-slate-500">Move funds between Cash and Bank</p>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-5 space-y-4">
              {/* Transfer Direction Toggle */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Transfer Route</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferFrom('cash_to_bank')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      transferFrom === 'cash_to_bank'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs'
                        : 'border-gray-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Cash → Bank</span>
                    <span className="text-[10px] font-normal opacity-75">Deposit cash in bank</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferFrom('bank_to_cash')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      transferFrom === 'bank_to_cash'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs'
                        : 'border-gray-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Bank → Cash</span>
                    <span className="text-[10px] font-normal opacity-75">Withdraw cash from bank</span>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Transfer Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              {/* Narration */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Narration / Note</label>
                <input
                  type="text"
                  value={transferNarration}
                  onChange={(e) => setTransferNarration(e.target.value)}
                  placeholder="e.g. Union fund contra transfer"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isTransferSubmitting ? 'Recording...' : 'Record Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔍 TRANSACTION DETAILS MODAL */}
      {selectedEntryDetails && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-3xs">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Transaction Details</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedEntryDetails.date}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntryDetails(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer transition-colors shadow-3xs"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Amount Banner */}
              <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</span>
                <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                  ₹{selectedEntryDetails.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Accounts breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="font-semibold text-slate-500">Debit (DR) Account:</span>
                  <span className={`font-semibold px-2.5 py-0.5 rounded-md ${getAccountBadgeClass(selectedEntryDetails.debitAccount, selectedEntryDetails.debitAccountType)}`}>
                    {resolveAccountName(selectedEntryDetails.debitAccount, accounts)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="font-semibold text-slate-500">Credit (CR) Account:</span>
                  <span className={`font-semibold px-2.5 py-0.5 rounded-md ${getAccountBadgeClass(selectedEntryDetails.creditAccount, selectedEntryDetails.creditAccountType)}`}>
                    {resolveAccountName(selectedEntryDetails.creditAccount, accounts)}
                  </span>
                </div>

                <div className="py-1.5">
                  <span className="font-semibold text-slate-500 block mb-1">Description / Narration:</span>
                  <p className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-800 leading-relaxed font-sans">
                    {selectedEntryDetails.narration || 'No narration provided.'}
                  </p>
                </div>

                {selectedEntryDetails.files && selectedEntryDetails.files.length > 0 && (
                  <div className="py-1.5">
                    <span className="font-semibold text-slate-500 block mb-1">Receipts & Attachments:</span>
                    <p className="text-[11px] text-indigo-600 font-medium">
                      📎 {selectedEntryDetails.files.length} document(s) attached (view in Journal sheet)
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-between gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleCopyNarration(selectedEntryDetails)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer transition-colors"
                >
                  <Copy size={13} />
                  <span>Copy Narration</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedEntryDetails(null);
                    onNavigateToTab('journal');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-3xs"
                >
                  <span>Open in Journal</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
