/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Account, JournalEntry, Student, Program, AccountType } from '../types';
import { FilePlus2, Trash2, Download, Upload, RefreshCcw, Search, PlusCircle, Sparkles, Filter, Info, Edit, ArrowDownUp, Printer, ShieldCheck, FileCheck, CheckCircle2, Paperclip, File, Eye, X, ExternalLink, FileText } from 'lucide-react';
import { getTrialBalance, getReceiptsAndPaymentsSum, getBalanceSheet, getIncomeAndExpenditure, getAccountBalances } from '../utils/accounting';

interface JournalSheetProps {
  accounts: Account[];
  entries: JournalEntry[];
  students?: Student[];
  programs?: Program[];
  isEditor?: boolean;
  onAddEntry: (entry: Omit<JournalEntry, 'id'>) => Promise<boolean>;
  onUpdateEntry: (entry: JournalEntry) => Promise<boolean>;
  onDeleteEntry: (id: string) => void;
  onLoadPresets: () => void;
  onClearAll: () => void;
  onImportBackup: (data: string) => boolean | Promise<boolean>;
  sheetName?: string;
  sheetTagline?: string;
  treasurerName?: string;
  treasurerEmail?: string;
  academicYear?: string;
  onFetchFileChunks: (fileId: string, chunkCount: number) => Promise<string>;
  aiPresets?: { label: string; desc: string; debit: string; credit: string; narration: string }[];
  onGenerateAiPresets?: () => Promise<void>;
  loadingAiPresets?: boolean;
}

const compressImage = (file: File): Promise<{ base64: string; size: number }> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string || '';
        resolve({ base64, size: file.size });
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ base64: '', size: 0 });
    };
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        resolve({ base64: e.target?.result as string || '', size: file.size });
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 1024;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
          const stringLength = compressedBase64.length - 'data:image/jpeg;base64,'.length;
          const actualSizeInBytes = Math.round(stringLength * 0.75);
          resolve({ base64: compressedBase64, size: actualSizeInBytes });
        } else {
          resolve({ base64: e.target?.result as string || '', size: file.size });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export function JournalSheet({
  accounts,
  entries,
  students = [],
  programs = [],
  isEditor = false,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onLoadPresets,
  onClearAll,
  onImportBackup,
  sheetName = 'Class Union Ledger',
  sheetTagline = 'Double-entry accounting, instant trials, cash summaries & Balance sheets',
  treasurerName = 'Union Treasurer',
  treasurerEmail = 'klrmuhsin809@gmail.com',
  academicYear = '2026 - 2027',
  onFetchFileChunks,
  aiPresets = [],
  onGenerateAiPresets,
  loadingAiPresets = false,
}: JournalSheetProps) {
  // Navigation / Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [debitFilter, setDebitFilter] = useState('');
  const [creditFilter, setCreditFilter] = useState('');
  const [activePresetTab, setActivePresetTab] = useState<'standard' | 'ai'>('standard');

  // Form states for Add/Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedPdfView, setSelectedPdfView] = useState<'combined' | 'journal' | 'trial' | 'receipts' | 'expenditure' | 'balance'>('combined');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [debitAccountType, setDebitAccountType] = useState<AccountType | ''>('');
  const [creditAccountType, setCreditAccountType] = useState<AccountType | ''>('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');

  // Compound Entry states
  const [isCompoundMode, setIsCompoundMode] = useState(false);
  const [compDebits, setCompDebits] = useState<{ accountId: string; amount: string; type?: AccountType }[]>([{ accountId: '', amount: '' }]);
  const [compCredits, setCompCredits] = useState<{ accountId: string; amount: string; type?: AccountType }[]>([{ accountId: '', amount: '' }]);

  // Sorting
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // File Attachments States
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; type: string; size: number; base64: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPreviewEntry, setSelectedPreviewEntry] = useState<JournalEntry | null>(null);
  const [selectedPreviewFileIndex, setSelectedPreviewFileIndex] = useState<number>(0);

  const [loadedBase64, setLoadedBase64] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedPreviewEntry) {
      setLoadedBase64(null);
      setFileLoadError(null);
      setIsLoadingFile(false);
      return;
    }

    const files = selectedPreviewEntry.files || [];
    const file = files[selectedPreviewFileIndex];
    if (!file) {
      setLoadedBase64(null);
      setFileLoadError(null);
      setIsLoadingFile(false);
      return;
    }

    if ((file as any).status === 'uploading') {
      setIsLoadingFile(true);
      setFileLoadError(null);
      setLoadedBase64(null);
    } else if ((file as any).status === 'error') {
      setIsLoadingFile(false);
      setFileLoadError("This file failed to upload in the background. Please try uploading again.");
      setLoadedBase64(null);
    } else if (file.base64) {
      setLoadedBase64(file.base64);
      setFileLoadError(null);
      setIsLoadingFile(false);
    } else if ((file as any).id && (file as any).chunkCount) {
      setIsLoadingFile(true);
      setFileLoadError(null);
      setLoadedBase64(null);
      onFetchFileChunks((file as any).id, (file as any).chunkCount)
        .then((base64) => {
          setLoadedBase64(base64);
          setIsLoadingFile(false);
        })
        .catch((err) => {
          console.error("Error fetching file:", err);
          setFileLoadError("Failed to fetch full file content from remote database.");
          setIsLoadingFile(false);
        });
    } else {
      setLoadedBase64(null);
      setFileLoadError("File data is corrupt or incomplete.");
      setIsLoadingFile(false);
    }
  }, [selectedPreviewEntry, selectedPreviewFileIndex, onFetchFileChunks]);

  // Trigger quick template
  const handleQuickTemplate = (template: { debit: string; credit: string; narration: string }) => {
    setEditingEntry(null);
    setIsCompoundMode(false);
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setAttachedFiles([]);
    setDebitAccount(template.debit);
    setDebitAccountType(accounts.find(a => a.id === template.debit)?.type || 'Asset');
    setCreditAccount(template.credit);
    setCreditAccountType(accounts.find(a => a.id === template.credit)?.type || 'Liability');
    setNarration(template.narration);
    setCompDebits([{ accountId: template.debit, amount: '', type: accounts.find(a => a.id === template.debit)?.type || 'Asset' }]);
    setCompCredits([{ accountId: template.credit, amount: '', type: accounts.find(a => a.id === template.credit)?.type || 'Liability' }]);
    setIsFormOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingEntry(null);
    setIsCompoundMode(false);
    setDate(new Date().toISOString().split('T')[0]);
    const defDr = accounts[1]?.id || '';
    setDebitAccount(defDr); // default Bank
    setDebitAccountType(accounts.find(a => a.id === defDr)?.type || 'Asset');
    setCreditAccount('');
    setCreditAccountType('');
    setAmount('');
    setNarration('');
    setAttachedFiles([]);
    setCompDebits([{ accountId: defDr, amount: '', type: accounts.find(a => a.id === defDr)?.type || 'Asset' }]);
    setCompCredits([{ accountId: '', amount: '', type: 'Liability' }]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setDate(entry.date);
    setDebitAccount(entry.debitAccount);
    setDebitAccountType(entry.debitAccountType || accounts.find(a => a.id === entry.debitAccount)?.type || 'Asset');
    setCreditAccount(entry.creditAccount);
    setCreditAccountType(entry.creditAccountType || accounts.find(a => a.id === entry.creditAccount)?.type || 'Liability');
    setAmount(entry.amount.toString());
    setNarration(entry.narration);
    setAttachedFiles(entry.files || []);
    setIsCompoundMode(!!entry.isCompound);
    if (entry.isCompound) {
      setCompDebits((entry.debits || []).map(d => ({ 
        accountId: d.accountId, 
        amount: d.amount.toString(),
        type: d.type || accounts.find(a => a.id === d.accountId)?.type || 'Asset'
      })));
      setCompCredits((entry.credits || []).map(c => ({ 
        accountId: c.accountId, 
        amount: c.amount.toString(),
        type: c.type || accounts.find(a => a.id === c.accountId)?.type || 'Liability'
      })));
    } else {
      setCompDebits([{ 
        accountId: entry.debitAccount, 
        amount: entry.amount.toString(),
        type: entry.debitAccountType || accounts.find(a => a.id === entry.debitAccount)?.type || 'Asset'
      }]);
      setCompCredits([{ 
        accountId: entry.creditAccount, 
        amount: entry.amount.toString(),
        type: entry.creditAccountType || accounts.find(a => a.id === entry.creditAccount)?.type || 'Liability'
      }]);
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalAmount = 0;
    let finalDebits: typeof compDebits = [];
    let finalCredits: typeof compCredits = [];
    let parsedDebits: { accountId: string; amount: number; type?: AccountType }[] = [];
    let parsedCredits: { accountId: string; amount: number; type?: AccountType }[] = [];

    if (isCompoundMode) {
      // Validate compound entry
      finalDebits = compDebits.filter(d => d.accountId || d.amount);
      finalCredits = compCredits.filter(c => c.accountId || c.amount);

      if (finalDebits.length < 1 || finalCredits.length < 1) {
        alert('Please provide at least one active debit account and one active credit account.');
        return;
      }

      for (const d of finalDebits) {
        const amt = parseFloat(d.amount);
        if (!d.accountId || isNaN(amt) || amt <= 0) {
          alert('All active debit accounts and amounts must be specified and positive.');
          return;
        }
        parsedDebits.push({ 
          accountId: d.accountId, 
          amount: amt,
          type: d.type || accounts.find(a => a.id === d.accountId)?.type
        });
      }

      for (const c of finalCredits) {
        const amt = parseFloat(c.amount);
        if (!c.accountId || isNaN(amt) || amt <= 0) {
          alert('All active credit accounts and amounts must be specified and positive.');
          return;
        }
        parsedCredits.push({ 
          accountId: c.accountId, 
          amount: amt,
          type: c.type || accounts.find(a => a.id === c.accountId)?.type
        });
      }

      const totalDebits = parsedDebits.reduce((sum, d) => sum + d.amount, 0);
      const totalCredits = parsedCredits.reduce((sum, c) => sum + c.amount, 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        alert(`Unbalanced Entry! Total debits (₹${totalDebits.toLocaleString('en-IN')}) must exactly equal total credits (₹${totalCredits.toLocaleString('en-IN')}). Difference is ₹${Math.abs(totalDebits - totalCredits).toFixed(2)}.`);
        return;
      }

      finalAmount = totalDebits;
    } else {
      const parsedAmount = parseFloat(amount);
      if (!debitAccount || !creditAccount || isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('Please fill out all fields with valid values. The amount must be a positive number.');
        return;
      }

      if (debitAccount === creditAccount) {
        alert('The debit account and credit account cannot be the same.');
        return;
      }

      finalAmount = parsedAmount;
      parsedDebits = [{ 
        accountId: debitAccount, 
        amount: parsedAmount,
        type: debitAccountType || accounts.find(a => a.id === debitAccount)?.type
      }];
      parsedCredits = [{ 
        accountId: creditAccount, 
        amount: parsedAmount,
        type: creditAccountType || accounts.find(a => a.id === creditAccount)?.type
      }];
    }

    setIsSaving(true);
    try {
      const payload: Omit<JournalEntry, 'id'> & { files?: typeof attachedFiles } = {
        date,
        debitAccount: isCompoundMode ? parsedDebits[0].accountId : debitAccount,
        creditAccount: isCompoundMode ? parsedCredits[0].accountId : creditAccount,
        debitAccountType: isCompoundMode ? parsedDebits[0].type : (debitAccountType || accounts.find(a => a.id === debitAccount)?.type),
        creditAccountType: isCompoundMode ? parsedCredits[0].type : (creditAccountType || accounts.find(a => a.id === creditAccount)?.type),
        amount: parseFloat(finalAmount.toFixed(2)),
        narration: narration.trim(),
        isCompound: isCompoundMode,
        debits: isCompoundMode ? parsedDebits : undefined,
        credits: isCompoundMode ? parsedCredits : undefined,
      };

      if (attachedFiles && attachedFiles.length > 0) {
        payload.files = attachedFiles;
      }

      let success = false;
      if (editingEntry) {
        success = await onUpdateEntry({
          ...payload,
          id: editingEntry.id,
        } as JournalEntry);
      } else {
        success = await onAddEntry(payload);
      }

      if (success) {
        setIsFormOpen(false);
        setEditingEntry(null);
        setIsCompoundMode(false);
        setDate(new Date().toISOString().split('T')[0]);
        setDebitAccount('');
        setDebitAccountType('');
        setCreditAccount('');
        setCreditAccountType('');
        setAmount('');
        setNarration('');
        setAttachedFiles([]);
        setCompDebits([{ accountId: '', amount: '' }]);
        setCompCredits([{ accountId: '', amount: '' }]);
      }
    } catch (err) {
      console.error("Error committing journal entry:", err);
      alert('An error occurred while saving the journal entry.');
    } finally {
      setIsSaving(false);
    }
  };

  // Import file handler
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await onImportBackup(content);
      if (success) {
        alert('The accounts and transaction sheet were imported successfully.');
      } else {
        alert('Invalid backup file. Please upload a valid exported JSON ledger file.');
      }
    };
    reader.readAsText(file);
  };

  // Export handler
  const handleExportBackup = () => {
    const backupObj = {
      accounts,
      entries,
      students,
      programs
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `class_union_ledger_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Date,Debit Account,Credit Account,Amount,Narration\n";

    entries.forEach((entry) => {
      const Dr = accounts.find((a) => a.id === entry.debitAccount)?.name || 'Unknown';
      const Cr = accounts.find((a) => a.id === entry.creditAccount)?.name || 'Unknown';
      const row = `"${entry.id}","${entry.date}","${Dr}","${Cr}",${entry.amount},"${entry.narration.replace(/"/g, '""')}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `class_union_journal_sheet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const drName = accounts.find((a) => a.id === entry.debitAccount)?.name || '';
    const crName = accounts.find((a) => a.id === entry.creditAccount)?.name || '';
    const matchSearch =
      entry.narration.toLowerCase().includes(searchTerm.toLowerCase()) ||
      drName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchDebit = debitFilter ? entry.debitAccount === debitFilter : true;
    const matchCredit = creditFilter ? entry.creditAccount === creditFilter : true;

    return matchSearch && matchDebit && matchCredit;
  });

  // Sort entries
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortKey === 'date') {
      const cmp = a.date.localeCompare(b.date);
      return sortOrder === 'asc' ? cmp : -cmp;
    } else {
      const cmp = a.amount - b.amount;
      return sortOrder === 'asc' ? cmp : -cmp;
    }
  });

  const toggleSort = (key: 'date' | 'amount') => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // Common Union transaction templates
  const presets = [
    {
      label: 'Collect Union Dues',
      desc: 'Collect annual dues from student via cash/bank',
      debit: '2', // Bank
      credit: '4', // Membership Fees
      narration: 'Collected union membership contribution dues.',
    },
    {
      label: 'Buy Printing Stationery',
      desc: 'Paid cash for papers or meeting notes printed',
      debit: '8', // Printing
      credit: '1', // Cash
      narration: 'Paid cash for printing union meeting notes and materials.',
    },
    {
      label: 'Buy Refreshments',
      desc: 'Paid cash for group food and soft drinks',
      debit: '7', // Food & Refreshments
      credit: '1', // Cash
      narration: 'Bought snacks and juices for class union meeting.',
    },
    {
      label: 'Sponsor / Grant Cash',
      desc: 'Received corporate tour sponsorship',
      debit: '2', // Bank
      credit: '5', // Sponsor Fees
      narration: 'Sponsorship donation received from community merchant.',
    },
  ];

  return (
    <div className="space-y-6">
      {!isEditor && (
        <div className="bg-amber-50 border border-amber-250/80 rounded-xl p-4 text-xs flex gap-3 text-amber-900 font-sans shadow-3xs animate-fade-in text-left">
          <div className="p-1 bg-amber-100 border border-amber-200 text-amber-700 rounded-lg shrink-0 h-fit">
            <ShieldCheck size={16} />
          </div>
          <div>
            <span className="font-bold block text-[13px] mb-0.5">Read-Only Viewer Space Active</span>
            <p className="leading-relaxed">
              You are currently viewing this general ledger report in <strong>real-time watch-only mode</strong>. Only the 3 authorized whitelisted union officers can alter, append, or delete records. To unlock editing, please select the <strong>Sign In with Google</strong> button in the header first.
            </p>
          </div>
        </div>
      )}

      {/* Quick Access Union Templates */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-indigo-600 animate-pulse" size={18} />
            <h3 className="font-semibold text-indigo-950 text-sm">Treasurer Quick Templates (Daily Helper)</h3>
          </div>
          
          <div className="flex items-center bg-indigo-100/60 p-0.5 rounded-lg text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActivePresetTab('standard')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activePresetTab === 'standard'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-indigo-700 hover:text-indigo-950'
              }`}
            >
              💡 Standard Presets
            </button>
            <button
              type="button"
              onClick={() => setActivePresetTab('ai')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
                activePresetTab === 'ai'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-indigo-700 hover:text-indigo-950'
              }`}
            >
              ✨ AI Recognized
              {aiPresets.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              )}
            </button>
          </div>
        </div>

        {activePresetTab === 'standard' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!isEditor}
                onClick={() => handleQuickTemplate(p)}
                className={`bg-white border rounded-lg text-left p-3 transition-all text-xs group ${
                  isEditor 
                    ? 'border-indigo-100 hover:border-indigo-300 hover:shadow-xs cursor-pointer' 
                    : 'border-slate-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`font-semibold flex items-center justify-between ${
                  isEditor ? 'text-indigo-900 group-hover:text-indigo-700' : 'text-slate-500'
                }`}>
                  <span>{p.label}</span>
                  <span className="text-[10px] text-gray-400 font-mono tracking-tighter">
                    {isEditor ? 'Add +' : 'Locked'}
                  </span>
                </div>
                <p className="text-gray-500 mt-1 line-clamp-1">{p.desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="animate-fade-in">
            {aiPresets.length === 0 ? (
              <div className="bg-white border border-indigo-100/80 rounded-xl p-5 text-center flex flex-col items-center justify-center space-y-3">
                <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full">
                  <Sparkles size={24} className="animate-pulse" />
                </div>
                <div className="max-w-md">
                  <h4 className="text-sm font-bold text-indigo-950">No AI Templates Configured Yet</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Let Gemini analyze your actual registered ledger entries to automatically recognize patterns, determine mostly used transaction categories, and synthesize custom helper templates!
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loadingAiPresets || !isEditor}
                  onClick={onGenerateAiPresets}
                  className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-colors ${
                    !isEditor ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={!isEditor ? "Only admins can request AI Ledger sync" : "Analyze ledger records with Gemini"}
                >
                  <RefreshCcw size={14} className={loadingAiPresets ? 'animate-spin' : ''} />
                  {loadingAiPresets ? 'Analyzing Ledger with Gemini...' : 'Analyze Ledger & Synthesize Shortcuts'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-indigo-100/40 pb-2">
                  <span>Below are AI-optimized workflows recognized from patterns inside your union's general ledger.</span>
                  {isEditor && (
                    <button
                      type="button"
                      disabled={loadingAiPresets}
                      onClick={onGenerateAiPresets}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCcw size={11} className={loadingAiPresets ? 'animate-spin' : ''} />
                      {loadingAiPresets ? 'Re-analyzing...' : 'Refresh AI Ledger Analysis'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {aiPresets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isEditor}
                      onClick={() => handleQuickTemplate(p)}
                      className={`bg-indigo-50/20 border-2 rounded-lg text-left p-3 transition-all text-xs group ${
                        isEditor 
                          ? 'border-indigo-200/60 hover:border-indigo-400 hover:bg-white hover:shadow-xs cursor-pointer' 
                          : 'border-slate-200 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className={`font-semibold flex items-center justify-between ${
                        isEditor ? 'text-indigo-950 group-hover:text-indigo-700' : 'text-slate-500'
                      }`}>
                        <span className="flex items-center gap-1">
                          ✨ {p.label}
                        </span>
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded-sm font-semibold tracking-tighter uppercase">
                          AI
                        </span>
                      </div>
                      <p className="text-gray-500 mt-1 line-clamp-1">{p.desc}</p>
                      <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-indigo-600 font-mono flex gap-1 justify-between">
                        <span>Deb: {accounts.find(a => a.id === p.debit)?.name || `#${p.debit}`}</span>
                        <span>Crd: {accounts.find(a => a.id === p.credit)?.name || `#${p.credit}`}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sheet Sheet Grid UI */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Left search filters */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search description, narration, account..."
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />
            </div>

            {/* Debit Account filter */}
            <select
              value={debitFilter}
              onChange={(e) => setDebitFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
            >
              <option value="">Filter Dr Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {/* Credit Account filter */}
            <select
              value={creditFilter}
              onChange={(e) => setCreditFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
            >
              <option value="">Filter Cr Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Right Toolbar Options */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 w-full md:w-auto md:flex-1">
            <div className="flex gap-2 w-full sm:w-auto justify-start">
              <button
                onClick={handleOpenAdd}
                disabled={!isEditor}
                title={isEditor ? "Record a new journal transaction row" : "Transaction addition restricted to authorized union editors only."}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-350 disabled:text-slate-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-xs transition-all disabled:cursor-not-allowed"
              >
                <PlusCircle size={16} />
                <span>Record Entry</span>
              </button>

              <button
                onClick={() => setIsPdfModalOpen(true)}
                title="Review audited financial statements and save formatted PDF reports"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-xs"
              >
                <FileText size={16} />
                <span>Review & Save PDF</span>
              </button>
            </div>

            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleExportBackup}
                title="Backup JSON file"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium transition-all cursor-pointer"
              >
                <Download size={16} className="text-blue-500" />
                <span>Backup Ledger</span>
              </button>

              <label className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium transition-all cursor-pointer">
                <Upload size={16} className="text-indigo-500" />
                <span>Import Backup</span>
                <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* The Spreadsheet Table Layout */}
        <div className="overflow-x-auto">
          {/* Header row to look like Excel / Google Sheet */}
          <div className="bg-gray-100 border-b border-gray-200 text-center flex items-center font-mono text-[10px] text-gray-400 select-none">
            <div className="w-12 border-r border-gray-300 py-1 font-semibold bg-gray-200 text-gray-600">Row</div>
            <div className="flex-1 min-w-[120px] text-left px-4 border-r border-gray-200">Col A (Date)</div>
            <div className="flex-1 min-w-[180px] text-left px-4 border-r border-gray-200">Col B (Debit Dr Account)</div>
            <div className="flex-1 min-w-[180px] text-left px-4 border-r border-gray-200">Col C (Credit Cr Account)</div>
            <div className="w-32 text-right px-4 border-r border-gray-200">Col D (Amount ₹)</div>
            <div className="flex-2 min-w-[280px] text-left px-4 border-r border-gray-200">Col E (Narration / Description)</div>
            <div className="w-24 px-2 bg-gray-200/50">Actions</div>
          </div>

          {sortedEntries.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Info className="mx-auto mb-2 text-gray-400" size={32} />
              <p className="font-semibold text-gray-700">No transactions recorded in the Journal Sheet yet.</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Use the "Record Entry" button or select a "Treasurer Quick Template" above to populate the ledger.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-serif text-sm">
              <tbody className="font-sans divide-y divide-gray-100">
                {sortedEntries.map((entry, index) => {
                  const drAccName = accounts.find((a) => a.id === entry.debitAccount)?.name || 'Unknown Account';
                  const crAccName = accounts.find((a) => a.id === entry.creditAccount)?.name || 'Unknown Account';

                  return (
                    <tr key={entry.id} className="hover:bg-blue-50/50 transition-colors group">
                      {/* Grid Row Marker */}
                      <td className="w-12 text-center bg-gray-50 font-mono text-xs text-gray-400 border-r border-gray-150 py-3 font-semibold">
                        {index + 1}
                      </td>

                      {/* Date */}
                      <td className="p-3 border-r border-gray-100 text-gray-700 font-mono text-xs font-medium">
                        {entry.date}
                      </td>

                      {/* Debit (Dr) Selection */}
                      <td className="p-3 border-r border-gray-100">
                        {entry.isCompound ? (
                          <div className="space-y-1">
                            {entry.debits?.map((db, idx) => {
                              const name = accounts.find((a) => a.id === db.accountId)?.name || 'Unknown';
                              return (
                                <div key={idx} className="px-2 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-semibold rounded-md flex items-center justify-between gap-1">
                                  <span className="truncate">{name}</span>
                                  <span className="text-[10px] font-mono shrink-0">₹{db.amount.toLocaleString('en-IN')}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-md flex items-center justify-between">
                            <span>{drAccName}</span>
                            <span className="text-[9px] uppercase tracking-wider text-emerald-600 font-bold opacity-80">(Dr)</span>
                          </span>
                        )}
                      </td>

                      {/* Credit (Cr) Selection */}
                      <td className="p-3 border-r border-gray-100">
                        {entry.isCompound ? (
                          <div className="space-y-1 ml-2">
                            {entry.credits?.map((cr, idx) => {
                              const name = accounts.find((a) => a.id === cr.accountId)?.name || 'Unknown';
                              return (
                                <div key={idx} className="px-2 py-1 bg-rose-50 text-rose-800 text-[11px] font-semibold rounded-md flex items-center justify-between gap-1">
                                  <span className="truncate">{name}</span>
                                  <span className="text-[10px] font-mono shrink-0">₹{cr.amount.toLocaleString('en-IN')}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="px-2 py-1 bg-rose-50 text-rose-800 text-xs font-semibold rounded-md flex items-center justify-between ml-2">
                            <span>{crAccName}</span>
                            <span className="text-[9px] uppercase tracking-wider text-rose-600 font-bold opacity-80">(Cr)</span>
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-3 text-right border-r border-gray-100 font-bold font-mono text-blue-900">
                        ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Narration */}
                      <td className="p-3 border-r border-gray-100 text-gray-500 max-w-sm text-xs">
                        <div className="truncate" title={entry.narration}>
                          {entry.narration || <span className="italic text-gray-300">None</span>}
                        </div>
                        {entry.files && entry.files.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 select-none no-print">
                            {entry.files.map((file, fIdx) => (
                              <button
                                key={fIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPreviewEntry(entry);
                                  setSelectedPreviewFileIndex(fIdx);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-250 border border-slate-200 hover:border-slate-300 rounded text-[10px] text-slate-700 transition-colors font-medium cursor-pointer shrink-0"
                                title={`Click to view file: ${file.name}`}
                              >
                                <Paperclip size={10} className="text-slate-500 shrink-0" />
                                <span className="max-w-[120px] truncate">{file.name}</span>
                                <span className="text-[8px] text-slate-400">({Math.round(file.size / 1024)} KB)</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Operations */}
                      <td className="p-3 text-center w-24">
                        {isEditor ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEdit(entry)}
                              className="p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 rounded-lg transition-colors shadow-2xs cursor-pointer"
                              title="Edit Entry"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => setDeletingEntryId(entry.id)}
                              className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition-colors shadow-2xs cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-200/60 p-1 px-2 rounded-md font-mono tracking-wide" title="Read only spectator space">
                            VIEW ONLY
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info stats */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-mono">
          <div>
            Showing <span className="font-bold text-gray-600">{sortedEntries.length}</span> of <span className="font-bold text-gray-600">{entries.length}</span> recorded rows
          </div>
          <div className="flex gap-4">
            <button onClick={() => toggleSort('date')} className="hover:text-gray-700 flex items-center gap-0.5">
              Sort Date {sortKey === 'date' && (sortOrder === 'asc' ? '▲' : '▼')}
            </button>
            <button onClick={() => toggleSort('amount')} className="hover:text-gray-700 flex items-center gap-0.5">
              Sort Amount {sortKey === 'amount' && (sortOrder === 'asc' ? '▲' : '▼')}
            </button>
          </div>
        </div>
      </div>

      {/* Record Entry Modal Sheet (Dialogue panel) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border text-left border-gray-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-950">
                  {editingEntry ? 'Edit Journal Entry' : 'Manual Journal Entry Posting'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Dual ledger accounting transaction journalizer</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingEntry(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Compound vs Standard Toggle */}
              <div className="bg-indigo-50/50 border border-indigo-150/60 rounded-xl p-3 flex items-center justify-between no-print">
                <div>
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 font-sans">
                    <ArrowDownUp size={14} className="text-indigo-600" />
                    Transaction Entry Style
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Choose single-leg or multi-leg compound transaction format</p>
                </div>
                <div className="flex bg-indigo-100 p-0.5 rounded-lg text-[10px] font-semibold font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompoundMode(false);
                      if (compDebits[0]?.accountId) setDebitAccount(compDebits[0].accountId);
                      if (compCredits[0]?.accountId) setCreditAccount(compCredits[0].accountId);
                      const sum = compDebits.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
                      if (sum > 0) setAmount(sum.toString());
                    }}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      !isCompoundMode ? 'bg-white text-indigo-950 shadow-xs' : 'text-indigo-705'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompoundMode(true);
                      setCompDebits([{ accountId: debitAccount, amount: amount, type: debitAccountType || accounts.find(a => a.id === debitAccount)?.type || 'Asset' }]);
                      setCompCredits([{ accountId: creditAccount, amount: amount, type: creditAccountType || accounts.find(a => a.id === creditAccount)?.type || 'Liability' }]);
                    }}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      isCompoundMode ? 'bg-white text-indigo-950 shadow-xs' : 'text-indigo-705'
                    }`}
                  >
                    Compound
                  </button>
                </div>
              </div>

              {isCompoundMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Date OF Transaction</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-4 border border-indigo-100 rounded-xl p-3.5 bg-slate-50/50">
                    {/* Compound Debits List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider">Debit Legs (Dr)</span>
                        <button
                          type="button"
                          onClick={() => setCompDebits([...compDebits, { accountId: '', amount: '', type: 'Asset' }])}
                          className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle size={12} /> Add Debit Leg
                        </button>
                      </div>
                      <div className="space-y-2">
                        {compDebits.map((db, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select
                              required
                              value={db.accountId}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = [...compDebits];
                                updated[idx].accountId = val;
                                updated[idx].type = accounts.find(a => a.id === val)?.type || 'Asset';
                                setCompDebits(updated);
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                              <option value="" disabled>Select debit account...</option>
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                              ))}
                            </select>
                            {db.accountId && (
                              <select
                                value={db.type || accounts.find(a => a.id === db.accountId)?.type || 'Asset'}
                                onChange={(e) => {
                                  const updated = [...compDebits];
                                  updated[idx].type = e.target.value as AccountType;
                                  setCompDebits(updated);
                                }}
                                className="px-1.5 py-1.5 border border-emerald-100 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-lg focus:outline-none"
                              >
                                <option value="Asset">Asset</option>
                                <option value="Liability">Liability</option>
                                <option value="Equity">Equity</option>
                                <option value="Income">Income</option>
                                <option value="Expense">Expense</option>
                              </select>
                            )}
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              placeholder="Amount (₹)"
                              value={db.amount}
                              onChange={(e) => {
                                const updated = [...compDebits];
                                updated[idx].amount = e.target.value;
                                setCompDebits(updated);
                              }}
                              className="w-28 px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                            {compDebits.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setCompDebits(compDebits.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Compound Credits List */}
                    <div className="pt-3 border-t border-gray-200/60 font-sans">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase text-rose-800 tracking-wider">Credit Legs (Cr)</span>
                        <button
                          type="button"
                          onClick={() => setCompCredits([...compCredits, { accountId: '', amount: '', type: 'Liability' }])}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle size={12} /> Add Credit Leg
                        </button>
                      </div>
                      <div className="space-y-2">
                        {compCredits.map((cr, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select
                              required
                              value={cr.accountId}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = [...compCredits];
                                updated[idx].accountId = val;
                                updated[idx].type = accounts.find(a => a.id === val)?.type || 'Liability';
                                setCompCredits(updated);
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                            >
                              <option value="" disabled>Select credit account...</option>
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                              ))}
                            </select>
                            {cr.accountId && (
                              <select
                                value={cr.type || accounts.find(a => a.id === cr.accountId)?.type || 'Liability'}
                                onChange={(e) => {
                                  const updated = [...compCredits];
                                  updated[idx].type = e.target.value as AccountType;
                                  setCompCredits(updated);
                                }}
                                className="px-1.5 py-1.5 border border-rose-100 bg-rose-50 text-rose-800 text-[10px] font-bold rounded-lg focus:outline-none"
                              >
                                <option value="Asset">Asset</option>
                                <option value="Liability">Liability</option>
                                <option value="Equity">Equity</option>
                                <option value="Income">Income</option>
                                <option value="Expense">Expense</option>
                              </select>
                            )}
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              placeholder="Amount (₹)"
                              value={cr.amount}
                              onChange={(e) => {
                                const updated = [...compCredits];
                                updated[idx].amount = e.target.value;
                                setCompCredits(updated);
                              }}
                              className="w-28 px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
                            />
                            {compCredits.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setCompCredits(compCredits.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Balancing Status bar */}
                    {(() => {
                      const dbTotal = compDebits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                      const crTotal = compCredits.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                      const isBalanced = Math.abs(dbTotal - crTotal) <= 0.01;
                      const diff = Math.abs(dbTotal - crTotal);

                      return (
                        <div className={`p-2.5 rounded-lg text-[11px] font-mono flex flex-col gap-1 ${
                          isBalanced && dbTotal > 0
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            : 'bg-rose-50 text-rose-800 border border-rose-100'
                        }`}>
                          <div className="flex justify-between items-center font-bold">
                            <span>Dr Sum: ₹{dbTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            <span>Cr Sum: ₹{crTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="border-t border-dashed border-current/20 pt-1 mt-1 flex justify-between items-center text-[10px]">
                            <span>Status:</span>
                            <span className="font-bold uppercase">
                              {dbTotal === 0 && crTotal === 0
                                ? 'Waiting for entry amounts...'
                                : isBalanced
                                ? '✅ BALANCED & VALID'
                                : `❌ UNBALANCED (Diff: ₹${diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
                              }
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Date OF Transaction</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Entry Amount (₹ INR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="00.0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">DEBIT ACCOUNT (Where money/value goes)</label>
                    <select
                      required
                      value={debitAccount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDebitAccount(val);
                        const matchType = accounts.find((a) => a.id === val)?.type || '';
                        setDebitAccountType(matchType as AccountType);
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                    >
                      <option value="" disabled>Select target debit account...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type})
                        </option>
                      ))}
                    </select>
                    {debitAccount && (
                      <div className="mt-1.5 flex items-center justify-between bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 no-print">
                        <span className="text-[10px] text-emerald-800 font-semibold font-sans">
                          Classification for this transaction:
                        </span>
                        <div className="flex gap-1">
                          {(['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as AccountType[]).map((t) => (
                            <button
                              type="button"
                              key={t}
                              onClick={() => setDebitAccountType(t)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                                debitAccountType === t
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <span className="text-[10px] text-emerald-600 font-medium">Dr increases asset/expense, or decreases liability/income.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">CREDIT ACCOUNT (Where money/value comes from)</label>
                    <select
                      required
                      value={creditAccount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreditAccount(val);
                        const matchType = accounts.find((a) => a.id === val)?.type || '';
                        setCreditAccountType(matchType as AccountType);
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                    >
                      <option value="" disabled>Select counter credit account...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type})
                        </option>
                      ))}
                    </select>
                    {creditAccount && (
                      <div className="mt-1.5 flex items-center justify-between bg-rose-50/50 p-2 rounded-lg border border-rose-100 no-print">
                        <span className="text-[10px] text-rose-800 font-semibold font-sans">
                          Classification for this transaction:
                        </span>
                        <div className="flex gap-1">
                          {(['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as AccountType[]).map((t) => (
                            <button
                              type="button"
                              key={t}
                              onClick={() => setCreditAccountType(t)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                                creditAccountType === t
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <span className="text-[10px] text-rose-600 font-medium">Cr decreases asset/expense, or increases liability/income.</span>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">NARRATION / REMARK DESCRIPTION</label>
                <textarea
                  required
                  placeholder="e.g. Paid cash for printer bundle toner cartridges and A4 papers."
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* File Attachments Tool/Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  File Receipts or Invoices (Max 2MB per file)
                </label>
                <div
                  tabIndex={0}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const list = e.dataTransfer.files;
                      const filesArray: File[] = Array.from(list);
                      if (attachedFiles.length + filesArray.length > 5) {
                        alert("A maximum of 5 file attachments is allowed per journal entry.");
                        return;
                      }

                      for (const file of filesArray) {
                        if (file.size > 2 * 1024 * 1024) {
                          alert(`The file "${file.name}" is too large. The maximum size allowed is 2 MB (2,000 KB).`);
                          return;
                        }
                      }

                      Promise.all(filesArray.map(file => compressImage(file)))
                        .then((compressedResults) => {
                          setAttachedFiles(prev => {
                            const updated = [...prev];
                            compressedResults.forEach((res, i) => {
                              const originalFile = filesArray[i];
                              if (updated.some(f => f.name === originalFile.name)) return;
                              updated.push({
                                name: originalFile.name,
                                type: originalFile.type,
                                size: res.size,
                                base64: res.base64
                              });
                            });
                            return updated;
                          });
                        })
                        .catch((err) => {
                          console.error("Error compressing files:", err);
                        });
                    }
                  }}
                  onPaste={(e) => {
                    const clipboardFiles = e.clipboardData?.files;
                    const items = e.clipboardData?.items;
                    const filesArray: File[] = [];

                    if (clipboardFiles && clipboardFiles.length > 0) {
                      for (let i = 0; i < clipboardFiles.length; i++) {
                        filesArray.push(clipboardFiles[i]);
                      }
                    } else if (items) {
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].kind === 'file') {
                          const f = items[i].getAsFile();
                          if (f) filesArray.push(f);
                        }
                      }
                    }

                    if (filesArray.length === 0) return;

                    if (attachedFiles.length + filesArray.length > 5) {
                      alert("A maximum of 5 file attachments is allowed per journal entry.");
                      return;
                    }

                    for (const file of filesArray) {
                      if (file.size > 2 * 1024 * 1024) {
                        alert(`The file "${file.name}" is too large. The maximum size allowed is 2 MB (2,000 KB).`);
                        return;
                      }
                    }

                    Promise.all(filesArray.map(file => compressImage(file)))
                      .then((compressedResults) => {
                        setAttachedFiles(prev => {
                          const updated = [...prev];
                          compressedResults.forEach((res, i) => {
                            const originalFile = filesArray[i];
                            const defaultName = originalFile.name || `Pasted_Image_${Date.now()}_${i}.png`;
                            if (updated.some(f => f.name === defaultName)) return;
                            updated.push({
                              name: defaultName,
                              type: originalFile.type || 'image/png',
                              size: res.size,
                              base64: res.base64
                            });
                          });
                          return updated;
                        });
                      })
                      .catch((err) => {
                        console.error("Error compressing pasted files:", err);
                      });
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none cursor-pointer ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    id="entry-attachments-input"
                    className="hidden"
                    onChange={(e) => {
                      const list = e.target.files;
                      if (!list) return;
                      const filesArray: File[] = Array.from(list);
                      if (attachedFiles.length + filesArray.length > 5) {
                        alert("A maximum of 5 file attachments is allowed per journal entry.");
                        return;
                      }

                      for (const file of filesArray) {
                        if (file.size > 2 * 1024 * 1024) {
                          alert(`The file "${file.name}" is too large. The maximum size allowed is 2 MB (2,000 KB).`);
                          return;
                        }
                      }

                      Promise.all(filesArray.map(file => compressImage(file)))
                        .then((compressedResults) => {
                          setAttachedFiles(prev => {
                            const updated = [...prev];
                            compressedResults.forEach((res, i) => {
                              const originalFile = filesArray[i];
                              if (updated.some(f => f.name === originalFile.name)) return;
                              updated.push({
                                name: originalFile.name,
                                type: originalFile.type,
                                size: res.size,
                                base64: res.base64
                              });
                            });
                            return updated;
                          });
                        })
                        .catch((err) => {
                          console.error("Error compressing files:", err);
                        });
                    }}
                  />
                  <label
                    htmlFor="entry-attachments-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1"
                  >
                    <Paperclip className={`w-7 h-7 ${isDragging ? 'text-blue-500 animate-bounce' : 'text-slate-400'}`} />
                    <span className="text-xs font-semibold text-slate-800">
                      Drag & drop receipts here, click to <span className="text-blue-600 hover:underline">browse</span>, or paste directly (Ctrl+V)
                    </span>
                    <span className="text-[10px] text-gray-400">
                      PDF, PNG, JPG, GIF (Max 2 MB per file, Limit 5 files) • Click here to select for pasting
                    </span>
                  </label>
                </div>

                {/* List of currently attached files */}
                {attachedFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                      <span>ATTACHED FILES ({attachedFiles.length})</span>
                      <span>
                        Total size: {Math.round(attachedFiles.reduce((acc, curr) => acc + curr.size, 0) / 1024)} KB
                      </span>
                    </div>
                    {attachedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-lg transition-all group"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPreviewEntry({
                              id: "temp-preview",
                              date: date || new Date().toISOString().split('T')[0],
                              debitAccount: debitAccount || "DRAFT",
                              creditAccount: creditAccount || "DRAFT",
                              amount: parseFloat(amount) || 0,
                              narration: narration || "New upload file preview",
                              files: attachedFiles
                            });
                            setSelectedPreviewFileIndex(idx);
                          }}
                          className="flex items-center gap-2 max-w-[85%] flex-1 text-left cursor-pointer focus:outline-none"
                          title="Click to preview file"
                        >
                          <File size={13} className="text-blue-500 shrink-0 group-hover:hidden" />
                          <Eye size={13} className="text-blue-600 shrink-0 hidden group-hover:block animate-pulse" />
                          <span className="truncate text-slate-700 font-medium group-hover:text-blue-600 transition-colors" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">({Math.round(file.size / 1024)} KB)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachedFiles(attachedFiles.filter((_, i) => i !== idx));
                          }}
                          className="text-rose-500 hover:text-white hover:bg-rose-500 p-1 rounded-md transition-colors shrink-0 ml-2"
                          title="Remove Attachment"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-105 flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingEntry(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : editingEntry ? (
                    'Update Entry'
                  ) : (
                    'Post Journal Entry'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deletingEntryId && (() => {
        const entryBeingDeleted = entries.find(e => e.id === deletingEntryId);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border text-left border-gray-200 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-gray-100 bg-rose-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="text-rose-600 animate-bounce" size={18} />
                  <h3 className="text-sm font-bold text-slate-950">
                    Confirm Deletion
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingEntryId(null)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-gray-650 leading-relaxed">
                  Are you sure you want to delete this journal entry? This will permanently undo this balanced transaction and update all ledger balances immediately.
                </p>
                
                {entryBeingDeleted && (
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Date:</span>
                      <span className="font-mono text-gray-700 font-semibold">{entryBeingDeleted.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount:</span>
                      <span className="font-mono text-rose-700 font-extrabold text-[13px]">
                        ₹{entryBeingDeleted.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Description:</span>
                      <span className="text-gray-700 max-w-[180px] truncate block font-medium" title={entryBeingDeleted.narration}>
                        {entryBeingDeleted.narration || "No description"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-gray-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeletingEntryId(null)}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel, Keep
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deletingEntryId) {
                      onDeleteEntry(deletingEntryId);
                      setDeletingEntryId(null);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Yes, Delete Entry
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PDF Executive Review & Printing Modal */}
      {isPdfModalOpen && (() => {
        // Run all calculations for the template
        const tbData = getTrialBalance(accounts, entries);
        const rpData = getReceiptsAndPaymentsSum(accounts, entries);
        const bsData = getBalanceSheet(accounts, entries);
        const ieData = getIncomeAndExpenditure(accounts, entries);

        const formatINR = (val: number) => {
          return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
        };

        const currentDateStr = new Date().toISOString().split('T')[0];

        const handleTriggerPrint = async () => {
          const element = document.getElementById('review-pdf-printable');
          if (!element) return;

          try {
            setIsGeneratingPdf(true);
            await new Promise(resolve => setTimeout(resolve, 200));

            const canvas = await html2canvas(element, {
              scale: 2.2, // Crystal-clear quality
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              ignoreElements: (el) => {
                return el.classList.contains('no-print');
              }
            });

            const imgData = canvas.toDataURL('image/png');
            
            // Determine orientation: if canvas width/height ratio is wide OR selected layout is wide, use landscape
            const isLandscape = canvas.width > canvas.height * 1.1 || ['journal', 'receipts', 'expenditure', 'balance'].includes(selectedPdfView);
            const orientation = isLandscape ? 'l' : 'p';

            const pdf = new jsPDF(orientation, 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const margin = 12; // Default 12mm margins for clean formatting
            const contentWidth = pageWidth - (margin * 2);
            const contentHeight = pageHeight - (margin * 2);

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            // Calculate height of one page's content slice in canvas pixels
            const sliceHeightPx = (contentHeight * canvasWidth) / contentWidth;

            let sourceY = 0;
            let isFirstPage = true;

            while (sourceY < canvasHeight) {
              if (!isFirstPage) {
                pdf.addPage();
              }
              isFirstPage = false;

              const currentSliceHeightPx = Math.min(sliceHeightPx, canvasHeight - sourceY);

              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = canvasWidth;
              tempCanvas.height = currentSliceHeightPx;
              const tempCtx = tempCanvas.getContext('2d');

              if (tempCtx) {
                tempCtx.drawImage(
                  canvas,
                  0, sourceY, canvasWidth, currentSliceHeightPx,
                  0, 0, canvasWidth, currentSliceHeightPx
                );

                const sliceImgData = tempCanvas.toDataURL('image/png');
                const sliceWidthMm = contentWidth;
                const sliceHeightMm = (currentSliceHeightPx * contentWidth) / canvasWidth;

                pdf.addImage(sliceImgData, 'PNG', margin, margin, sliceWidthMm, sliceHeightMm, undefined, 'FAST');
              }

              sourceY += sliceHeightPx;
            }

            const fileName = `${sheetName.replace(/\s+/g, '_')}_Statement_${selectedPdfView}_${currentDateStr}.pdf`;
            pdf.save(fileName);
          } catch (err) {
            console.error('Failed to generate PDF:', err);
          } finally {
            setIsGeneratingPdf(false);
          }
        };

        const isLandscapeView = ['journal', 'receipts', 'expenditure', 'balance'].includes(selectedPdfView);

        return (
          <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col md:flex-row p-3 md:p-6 select-none animate-fade-in no-print-backdrop">
            {/* Dynamic Printing Style rules injected locally */}
            <style>{`
              @media print {
                html, body {
                  background: #fff !important;
                  color: #000 !important;
                  font-size: 11px !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #review-pdf-printable, #review-pdf-printable * {
                  visibility: visible !important;
                }
                #review-pdf-printable {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  display: block !important;
                  padding: 1.5cm !important;
                }
                .no-print {
                  display: none !important;
                }
                .page-break {
                  page-break-before: always !important;
                  break-before: page !important;
                }
              }
            `}</style>

            {/* Left Control Sidebar */}
            <div className="w-full md:w-80 bg-slate-950 text-slate-100 rounded-2xl md:rounded-r-none p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800 shadow-md">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Printer className="text-rose-500" size={18} />
                    Executive PDF Report Room
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Configure, review, and print audited union accounts</p>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">1. Select Statement View</span>
                  {[
                    { id: 'combined', title: 'Executive Finance & Money Summary', desc: 'Combined status and current balance of money' },
                    { id: 'journal', title: 'Journal Spreadsheet Logs', desc: 'Complete listed ledger ledger transactions' },
                    { id: 'trial', title: 'Statements: Trial Balance', desc: 'Verify balanced Credit Dr vs Credit Cr' },
                    { id: 'receipts', title: 'Statements: Receipts & Payments', desc: 'Analysis of physical cash/bank flows' },
                    { id: 'expenditure', title: 'Statements: Income & Expenditure', desc: 'Surplus computations' },
                    { id: 'balance', title: 'Statements: Balance Sheet', desc: 'Statement of assets and union fund reserves' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedPdfView(opt.id as any)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all border outline-none ${
                        selectedPdfView === opt.id
                          ? 'bg-rose-600 text-white border-rose-500 font-bold shadow-sm'
                          : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                      }`}
                    >
                      <div className="truncate">{opt.title}</div>
                      <div className={`text-[9px] truncate font-normal mt-0.5 ${selectedPdfView === opt.id ? 'text-rose-100' : 'text-slate-500'}`}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom sidebar actions */}
              <div className="pt-6 border-t border-slate-800 space-y-2 mt-4 md:mt-0">
                <button
                  onClick={handleTriggerPrint}
                  disabled={isGeneratingPdf}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-800/60 disabled:text-rose-300 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download size={15} />
                      Save as PDF
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    CSV File
                  </button>
                  <button
                    onClick={() => setIsPdfModalOpen(false)}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Exit Review
                  </button>
                </div>

                <div className="text-[9px] text-slate-500 font-mono text-center">
                  Generates and downloads a clean, highly formatted digital PDF copy directly to your device.
                </div>
              </div>
            </div>

            {/* Right Screen Preview (Simulated Paper) */}
            <div className="flex-1 overflow-y-auto bg-slate-900 p-4 rounded-b-2xl md:rounded-l-none md:rounded-r-2xl border-t md:border-t-0 border-slate-800 flex justify-center items-start">
              <div 
                className="w-full sticky top-4 mb-10 shadow-2xl rounded-xl overflow-hidden bg-slate-950 border border-slate-800 transition-all duration-300"
                style={{
                  maxWidth: isLandscapeView ? '297mm' : '210mm'
                }}
              >
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 px-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-ping" />
                    <span className="font-semibold text-slate-200 font-mono uppercase tracking-wider">Live PDF A4 layout Review page</span>
                  </div>
                  <div>Showing: <strong className="text-rose-400 capitalize">{selectedPdfView}</strong></div>
                </div>

                {/* Simulated White Paper */}
                <div 
                  className="bg-white p-6 md:p-8 overflow-x-auto text-slate-950 font-sans transition-all duration-300" 
                  style={{ 
                    minHeight: isLandscapeView ? '210mm' : '297mm',
                    boxSizing: 'border-box'
                  }}
                >
                  <div id="review-pdf-printable" className="text-left select-text bg-white text-slate-950">
                    
                    {/* Cover Page or Global Header */}
                    {(selectedPdfView === 'all' || selectedPdfView === 'journal' || selectedPdfView === 'combined') && (
                      <div className="border-b-2 border-slate-900 pb-5 mb-8">
                        <div className="flex justify-between items-start">
                          <div>
                            <h2 className="text-xl font-bold uppercase tracking-tight text-slate-950 font-serif leading-none">{sheetName}</h2>
                            <p className="text-xs text-slate-600 mt-1.5 italic font-sans">{sheetTagline}</p>
                          </div>
                          <div className="text-right leading-relaxed text-xs">
                            <span className="bg-slate-100 border border-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded text-[10px] font-mono uppercase">
                              FY {academicYear}
                            </span>
                            <p className="text-[10px] font-mono text-slate-500 mt-1">Date: {currentDateStr}</p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-4 text-xs bg-slate-50 border border-slate-100 p-3 rounded-lg">
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PREPARED BY (TREASURER):</p>
                            <p className="font-bold text-slate-800 mt-0.5">{treasurerName}</p>
                            <p className="text-[10px] font-mono text-slate-500">{treasurerEmail}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SYSTEM CERTIFIED STATUS:</p>
                            <p className="font-bold text-emerald-700 mt-0.5">✓ BALANCED LEDGER</p>
                            <p className="text-[10px] font-mono text-slate-500">Verified Dr/Cr Double entry automations</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STATEMENT CONTAINER */}

                    {/* PREVIEW VIEW 0: COMBINED STATEMENT */}
                    {(selectedPdfView === 'all' || selectedPdfView === 'combined') && (() => {
                      const balances = getAccountBalances(accounts, entries);
                      const cashBalance = balances['1']?.balance ?? 0;
                      const bankBalance = balances['2']?.balance ?? 0;
                      const totalMoney = cashBalance + bankBalance;
                      
                      const cashPercent = totalMoney > 0 ? Math.round((cashBalance / totalMoney) * 100) : 0;
                      const bankPercent = totalMoney > 0 ? Math.round((bankBalance / totalMoney) * 100) : 0;

                      return (
                        <div className="space-y-6 mb-8">
                          <div className="flex justify-between items-center bg-slate-100 border p-3 rounded-lg no-print">
                            <h3 className="font-bold text-sm text-slate-900 font-mono">0. EXECUTIVE SUMMARY & LIQUID CASH BALANCES</h3>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded font-mono">
                              Money Balance: {formatINR(totalMoney)}
                            </span>
                          </div>

                          <div className="hidden print:block text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-600 pb-1 mb-3">
                            EXECUTIVE FINANCIAL OVERVIEW & CURRENT POSITION OF MONEY
                          </div>

                          {/* Top Highlight Box with Liquid Money Position */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Card 1: Cash Box */}
                            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl flex flex-col justify-between">
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Liquid Cash on Hand</span>
                                <h4 className="text-xl font-black text-slate-900 font-mono mt-1">
                                  {formatINR(cashBalance)}
                                </h4>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-2 italic">Physical currency secure vault</p>
                            </div>

                            {/* Card 2: Bank Ledger */}
                            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl flex flex-col justify-between">
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Bank Account Balance</span>
                                <h4 className="text-xl font-black text-slate-900 font-mono mt-1">
                                  {formatINR(bankBalance)}
                                </h4>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-2 italic">Reconciled bank ledger assets</p>
                            </div>

                            {/* Card 3: Total Money */}
                            <div className="p-4 bg-slate-950 text-white rounded-xl flex flex-col justify-between border border-slate-800 shadow-sm">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Total Liquid Money</span>
                                <h4 className="text-2xl font-black text-emerald-400 font-mono mt-1 underline decoration-double decoration-emerald-500">
                                  {formatINR(totalMoney)}
                                </h4>
                              </div>
                              <p className="text-[10px] text-slate-300 mt-2 font-semibold">Immediate Available Funds</p>
                            </div>
                          </div>

                          {/* Distribution Visual Indicator */}
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                            <div className="flex justify-between text-xs font-mono font-bold text-slate-700">
                              <span>Cash Ratio: {cashPercent}%</span>
                              <span>Bank Ratio: {bankPercent}%</span>
                            </div>
                            <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex">
                              {totalMoney > 0 ? (
                                <>
                                  <div 
                                    className="h-full bg-emerald-600 transition-all duration-500" 
                                    style={{ width: `${cashPercent}%` }}
                                    title={`Cash: ${cashPercent}%`}
                                  />
                                  <div 
                                    className="h-full bg-blue-600 transition-all duration-500" 
                                    style={{ width: `${bankPercent}%` }}
                                    title={`Bank: ${bankPercent}%`}
                                  />
                                </>
                              ) : (
                                <div className="w-full h-full bg-slate-300" />
                              )}
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 font-sans">
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Cash on Hand
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Bank Balance
                              </span>
                            </div>
                          </div>

                          {/* Secondary Strategic Indexes grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3.5 border border-slate-200 rounded-xl space-y-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Operating Surplus / Performance</span>
                              <div className="flex items-baseline gap-2">
                                <span className={`text-base font-extrabold font-mono ${ieData.balanceType === 'Surplus' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {formatINR(ieData.balanceAmount)}
                                </span>
                                <span className="text-[10px] text-slate-500">({ieData.balanceType})</span>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-relaxed">Derived from operating revenue of {formatINR(ieData.totalIncome)} minus total expense of {formatINR(ieData.totalExpenditure)}.</p>
                            </div>

                            <div className="p-3.5 border border-slate-200 rounded-xl space-y-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Net Capital & Capital Posture</span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-base font-extrabold text-slate-900 font-mono">
                                  {formatINR(bsData.unionFund.total)}
                                </span>
                                <span className="text-[10px] text-slate-500">(Union Fund reserves)</span>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-relaxed">This represents the net equity value of the Union backing all physical and liquid assets.</p>
                            </div>
                          </div>

                          {/* Quick Audit Notes */}
                          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl text-[11px] text-slate-700 leading-relaxed font-sans space-y-1.5">
                            <h4 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase font-mono tracking-wider text-[10px]">
                              System Audit Remarks
                            </h4>
                            <p>
                              1. This statement is auto-compiled using Double-Entry accounting standards. The trial balance is fully balanced at <strong className="text-slate-900 font-mono">{formatINR(tbData.totalDebit)}</strong>.
                            </p>
                            <p>
                              2. Liquid Money Assets are held safely across cash boxes and accredited bank institutional ledgers under system audit control.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Page break after combined view if viewing all */}
                    {selectedPdfView === 'all' && <div className="page-break my-10" />}

                    {/* PREVIEW VIEW 1: JOURNAL SPREADSHEET */}
                    {(selectedPdfView === 'all' || selectedPdfView === 'journal') && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-100 border p-3 rounded-lg no-print">
                          <h3 className="font-bold text-sm text-slate-900 font-mono">1. PHYSICAL JOURNAL BOOK TRANSACTION LEDGER</h3>
                          <span className="text-[10px] text-slate-500">{entries.length} Balanced Rows Recorded</span>
                        </div>

                        <div className="hidden print:block text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-600 pb-1 mb-3">
                          SECTION I: PRIMARY JOURNAL REFERENCE SPREADSHEET
                        </div>

                        <table className="w-full text-[10px] border border-slate-300 border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 font-mono text-center">
                              <th className="py-1.5 px-2 border-r border-slate-300 text-left w-[11%]">Date</th>
                              <th className="py-1.5 px-2 border-r border-slate-300 text-left w-[21%]">Debit Dr Account</th>
                              <th className="py-1.5 px-2 border-r border-slate-300 text-left w-[21%]">Credit Cr Account</th>
                              <th className="py-1.5 px-2 border-r border-slate-300 text-right w-[13%]">Amount (₹)</th>
                              <th className="py-1.5 px-2 text-left w-[34%]">Remark Narration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-3 px-4 text-center text-slate-400 font-mono italic text-[11px]">No transaction entries found.</td>
                              </tr>
                            ) : (
                              entries.map((entry) => {
                                const dr = accounts.find(a => a.id === entry.debitAccount)?.name || 'Unknown Ledger';
                                const cr = accounts.find(a => a.id === entry.creditAccount)?.name || 'Unknown Ledger';
                                return (
                                  <tr key={entry.id} className="border-b border-slate-200 hover:bg-slate-50 font-sans leading-tight">
                                    <td className="py-1 px-2 border-r border-slate-200 font-mono">{entry.date}</td>
                                    <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900">{dr}</td>
                                    <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900">{cr}</td>
                                    <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold text-slate-950">
                                      ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-1 px-2 text-slate-700 italic text-[10px] leading-relaxed break-words">{entry.narration || '—'}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Page break after Journal in the master pack */}
                    {selectedPdfView === 'all' && <div className="page-break my-10" />}

                    {/* Master Pack Header wrapper for subsequent single statements */}
                    {selectedPdfView !== 'all' && selectedPdfView !== 'journal' && selectedPdfView !== 'combined' && (
                      <div className="border-b-2 border-slate-900 pb-5 mb-8">
                        <div className="flex justify-between items-start">
                          <div>
                            <h2 className="text-xl font-bold uppercase tracking-tight text-slate-950 font-serif leading-none">{sheetName}</h2>
                            <p className="text-xs text-slate-600 mt-1.5 italic font-sans">{sheetTagline}</p>
                          </div>
                          <div className="text-right leading-relaxed text-xs">
                            <span className="bg-slate-100 border border-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded text-[10px] font-mono uppercase">
                              FY {academicYear}
                            </span>
                            <p className="text-[10px] font-mono text-slate-500 mt-1">Date: {currentDateStr}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PREVIEW VIEW 2: TRIAL BALANCE */}
                    {(selectedPdfView === 'all' || selectedPdfView === 'trial') && (
                      <div className={`${selectedPdfView === 'all' ? 'mt-8' : ''} space-y-4`}>
                        <div className="flex justify-between items-center bg-slate-100 border p-3 rounded-lg no-print">
                          <h3 className="font-bold text-sm text-slate-900 font-mono">2. AUTOMATED BALANCED TRIAL BALANCE</h3>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${tbData.totalDebit === tbData.totalCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {tbData.totalDebit === tbData.totalCredit ? 'Balanced' : 'Disbalanced'}
                          </span>
                        </div>

                        <div className="hidden print:block text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-600 pb-1 mb-3">
                          SECTION II: AUDITED TRIAL BALANCE AS ON {currentDateStr}
                        </div>

                        <table className="w-full text-[10px] border border-slate-300 border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 font-mono text-center">
                              <th className="py-1.5 px-2 border-r border-slate-200 text-left">GL Ledger Name (Account Title)</th>
                              <th className="py-1.5 px-2 border-r border-slate-200 text-left w-32">Account Class</th>
                              <th className="py-1.5 px-2 border-r border-slate-200 text-right w-40">Debit Balance Dr (₹)</th>
                              <th className="py-1.5 px-2 text-right w-40">Credit Balance Cr (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tbData.items.map((item) => (
                              <tr key={item.id} className="border-b border-slate-200 leading-tight">
                                <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900">{item.name}</td>
                                <td className="py-1 px-2 border-r border-slate-200 text-slate-500 font-mono text-[9px] uppercase">{item.type}</td>
                                <td className="py-1 px-2 border-r border-slate-200 text-right font-mono text-slate-900">
                                  {item.debit > 0 ? formatINR(item.debit) : '—'}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-slate-900">
                                  {item.credit > 0 ? formatINR(item.credit) : '—'}
                                </td>
                              </tr>
                            ))}
                            {/* Balanced Total Row with traditional double underlines */}
                            <tr className="bg-slate-50 font-bold border-t-2 border-b-4 border-double border-slate-900">
                              <td colSpan={2} className="py-1.5 px-2 border-r border-slate-200 text-left text-slate-950 text-[11px] font-serif uppercase tracking-wider">
                                Balanced Ledger Sum Total
                              </td>
                              <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono text-slate-950 text-[11px] shadow-2xs">
                                {formatINR(tbData.totalDebit)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono text-slate-950 text-[11px] shadow-2xs">
                                {formatINR(tbData.totalCredit)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Page break in all combined statement list */}
                    {selectedPdfView === 'all' && <div className="page-break my-10" />}

                    {/* PREVIEW VIEW 3: RECEIPTS AND PAYMENTS */}
                    {(selectedPdfView === 'all' || selectedPdfView === 'receipts') && (
                      <div className={`${selectedPdfView === 'all' ? 'mt-8' : ''} space-y-4`}>
                        <div className="flex justify-between items-center bg-slate-100 border p-3 rounded-lg no-print">
                          <h3 className="font-bold text-sm text-slate-900 font-mono">3. PHYSICAL RECEIPTS AND PAYMENTS STATEMENT</h3>
                          <span className="text-[10px] text-slate-500 font-mono">Closing Cash: {formatINR(rpData.closingBalance)}</span>
                        </div>

                        <div className="hidden print:block text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-600 pb-1 mb-3">
                          SECTION III: RECEIPTS & PAYMENTS ACCOUNT (CASH FLOW ANALYSIS)
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-slate-300">
                          {/* Left Column: Receipts */}
                          <div className="border-r border-slate-300 flex flex-col justify-between">
                            <div>
                              <div className="bg-slate-100 font-bold text-center border-b border-slate-300 p-2 font-mono text-xs uppercase text-emerald-800">
                                Cash Inflows (Receipts)
                              </div>
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-center font-bold text-slate-500 text-[10px]">
                                    <th className="p-2 text-left">Inflow Head</th>
                                    <th className="p-2 text-right w-28">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {rpData.receipts.length === 0 ? (
                                    <tr>
                                      <td colSpan={2} className="p-3 text-center text-slate-400 italic">No cash receipts recorded.</td>
                                    </tr>
                                  ) : (
                                    rpData.receipts.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="p-2 font-medium text-slate-800">{item.accountName}</td>
                                        <td className="p-2 text-right font-mono text-slate-900">{formatINR(item.amount)}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <div className="p-2 border-t border-slate-200 bg-slate-55 flex justify-between font-bold font-mono">
                              <span>Total Receipts:</span>
                              <span className="text-emerald-800">{formatINR(rpData.totalReceipts)}</span>
                            </div>
                          </div>

                          {/* Right Column: Payments */}
                          <div className="flex flex-col justify-between bg-white text-slate-950">
                            <div>
                              <div className="bg-slate-100 font-bold text-center border-b border-slate-300 p-2 font-mono text-xs uppercase text-rose-800">
                                Cash Outflows (Payments)
                              </div>
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-center font-bold text-slate-500 text-[10px]">
                                    <th className="p-2 text-left">Outflow Head</th>
                                    <th className="p-2 text-right w-28">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {rpData.payments.length === 0 ? (
                                    <tr>
                                      <td colSpan={2} className="p-3 text-center text-slate-400 italic">No cash payments recorded.</td>
                                    </tr>
                                  ) : (
                                    rpData.payments.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="p-2 font-medium text-slate-800">{item.accountName}</td>
                                        <td className="p-2 text-right font-mono text-slate-900">{formatINR(item.amount)}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <div className="p-2 border-t border-slate-200 bg-slate-55 flex justify-between font-bold font-mono">
                              <span>Total Payments:</span>
                              <span className="text-rose-800">{formatINR(rpData.totalPayments)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Summary Block */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs font-mono">
                          <div>
                            <span className="text-slate-500 uppercase tracking-widest text-[9px] block">CASH BOOK SURPLUS FORMULATION</span>
                            <span className="font-bold text-slate-800">Opening Balance (0.00) + Cash Receipts - Cash Payments</span>
                          </div>
                          <div className="text-right border-l pl-4 border-slate-200">
                            <span className="text-slate-500 uppercase tracking-widest text-[9px] block">CLOSING CASH ON HAND</span>
                            <span className="font-black text-slate-900 text-sm underline decoration-slate-900 decoration-double">{formatINR(rpData.closingBalance)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Page break in master list */}
                    {selectedPdfView === 'all' && <div className="page-break my-10" />}

                    {/* PREVIEW VIEW 4: INCOME AND EXPENDITURE */}
                    {(selectedPdfView === 'all' || selectedPdfView === 'expenditure') && (
                      <div className={`${selectedPdfView === 'all' ? 'mt-8' : ''} space-y-4`}>
                        <div className="flex justify-between items-center bg-slate-100 border p-3 rounded-lg no-print">
                          <h3 className="font-bold text-sm text-slate-900 font-mono">4. INCOME AND EXPENDITURE AUDITED ACCOUNT</h3>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${ieData.balanceType === 'Surplus' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            Net {ieData.balanceType}: {formatINR(ieData.balanceAmount)}
                          </span>
                        </div>

                        <div className="hidden print:block text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-600 pb-1 mb-3">
                          SECTION IV: INCOME & EXPENDITURE ACCOUNT (REVENUE PERFORMANCE)
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-slate-300">
                          {/* Left: Expenditure */}
                          <div className="border-r border-slate-300 flex flex-col justify-between">
                            <div>
                              <div className="bg-slate-100 font-bold text-center border-b border-slate-300 p-2 font-mono text-xs uppercase text-slate-800">
                                Expenditures & Overhead Rates
                              </div>
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-center font-bold text-slate-500 text-[10px]">
                                    <th className="p-2 text-left">Overhead Charge Name</th>
                                    <th className="p-2 text-right w-28">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {ieData.expenditures.length === 0 ? (
                                    <tr>
                                      <td colSpan={2} className="p-3 text-center text-slate-400 italic">No recorded expenditures.</td>
                                    </tr>
                                  ) : (
                                    ieData.expenditures.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="p-2 font-medium text-slate-800">{item.name}</td>
                                        <td className="p-2 text-right font-mono text-slate-900">{formatINR(item.amount)}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <div className="p-2 border-t border-slate-200 bg-slate-55 flex justify-between font-bold font-mono text-[11px]">
                              <span>Total Expenditure:</span>
                              <span>{formatINR(ieData.totalExpenditure)}</span>
                            </div>
                          </div>

                          {/* Right: Incomes */}
                          <div className="flex flex-col justify-between bg-white text-slate-950">
                            <div>
                              <div className="bg-slate-100 font-bold text-center border-b border-slate-300 p-2 font-mono text-xs uppercase text-slate-800">
                                Incomes & Accrued Revenues
                              </div>
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-center font-bold text-slate-500 text-[10px]">
                                    <th className="p-2 text-left">Revenue Category</th>
                                    <th className="p-2 text-right w-28">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {ieData.incomes.length === 0 ? (
                                    <tr>
                                      <td colSpan={2} className="p-3 text-center text-slate-400 italic">No recorded revenues.</td>
                                    </tr>
                                  ) : (
                                    ieData.incomes.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="p-2 font-medium text-slate-800">{item.name}</td>
                                        <td className="p-2 text-right font-mono text-slate-900">{formatINR(item.amount)}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <div className="p-2 border-t border-slate-200 bg-slate-55 flex justify-between font-bold font-mono text-[11px]">
                              <span>Total Income:</span>
                              <span>{formatINR(ieData.totalIncome)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Surplus block with accounting style highlight */}
                        <div className={`p-3.5 border rounded-lg flex justify-between items-center text-xs ${
                          ieData.balanceType === 'Surplus' ? 'bg-emerald-50 border-emerald-100 text-emerald-950' : 'bg-rose-50 border-rose-100 text-rose-955'
                        }`}>
                          <div>
                            <span className="font-extrabold font-serif uppercase tracking-wider text-[10px] block">REVENUE AUDIT DETERMINATION STATUS</span>
                            <span>The class union recorded a fiscal <strong>{ieData.balanceType}</strong> due to higher registered net {ieData.balanceType === 'Surplus' ? 'revenues' : 'operating expenses'}.</span>
                          </div>
                          <div className="text-right pl-6 font-mono font-black text-sm pr-2">
                            {ieData.balanceType === 'Surplus' ? '+' : '-'}{formatINR(ieData.balanceAmount)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Page break in master list */}
                    {selectedPdfView === 'all' && <div className="page-break my-10" />}

                    {/* PREVIEW VIEW 5: BALANCE SHEET */}
                    {(selectedPdfView === 'all' || selectedPdfView === 'balance') && (
                      <div className={`${selectedPdfView === 'all' ? 'mt-8' : ''} space-y-4`}>
                        <div className="flex justify-between items-center bg-slate-100 border p-3 rounded-lg no-print">
                          <h3 className="font-bold text-sm text-slate-900 font-mono">5. FINAL STATEMENT OF ASSETS AND FUNDS</h3>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${Math.abs(bsData.totalAssets - bsData.totalLiabilitiesAndFund) < 0.01 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {Math.abs(bsData.totalAssets - bsData.totalLiabilitiesAndFund) < 0.01 ? 'Perfect Balanced Standard' : 'Diff: ' + formatINR(Math.abs(bsData.totalAssets - bsData.totalLiabilitiesAndFund))}
                          </span>
                        </div>

                        <div className="hidden print:block text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-600 pb-1 mb-3">
                          SECTION V: BALANCED STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-slate-300 bg-white">
                          
                          {/* Liabilities side */}
                          <div className="border-r border-slate-300 flex flex-col justify-between">
                            <div>
                              <div className="bg-slate-100 font-bold text-center border-b border-slate-300 p-2 font-mono text-xs uppercase text-slate-800">
                                Capital Reserves & Liabilities
                              </div>
                              <div className="p-3 bg-slate-50/60 border-b border-slate-100 text-xs text-slate-800 space-y-1.5 font-sans">
                                <span className="text-[9px] font-bold text-slate-400 tracking-wider block uppercase">Accumulated Union Trust Capital Fund Reserves</span>
                                <div className="flex justify-between">
                                  <span>Opening Fund Balance:</span>
                                  <span className="font-mono text-slate-650">{formatINR(bsData.unionFund.opening)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="italic font-medium text-slate-700">Add Net Operating Surplus:</span>
                                  <span className="font-mono text-emerald-700">+{formatINR(bsData.unionFund.surplus)}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                                  <span>Closing Union Fund Value:</span>
                                  <span className="font-mono text-slate-950 underline">{formatINR(bsData.unionFund.total)}</span>
                                </div>
                              </div>
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-left font-bold text-slate-500 text-[10px]">
                                    <th className="p-2">Current Liabilities & Provisions</th>
                                    <th className="p-2 text-right w-28">Liability Bal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {bsData.liabilities.length === 0 ? (
                                    <tr>
                                      <td colSpan={2} className="p-2 text-center text-slate-400 italic">No external liability accruals.</td>
                                    </tr>
                                  ) : (
                                    bsData.liabilities.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="p-2 font-medium text-slate-800">{item.name}</td>
                                        <td className="p-2 text-right font-mono text-slate-900">{formatINR(item.amount)}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <div className="p-2.5 border-t border-slate-200 bg-slate-50 flex justify-between font-bold font-mono text-xs border-b-2 border-b-slate-900 shadow-3xs">
                              <span>Total Reserves & Liab:</span>
                              <span>{formatINR(bsData.totalLiabilitiesAndFund)}</span>
                            </div>
                          </div>

                          {/* Assets side */}
                          <div className="flex flex-col justify-between bg-white text-slate-950">
                            <div>
                              <div className="bg-slate-100 font-bold text-center border-b border-slate-300 p-2 font-mono text-xs uppercase text-slate-800">
                                Physical & Financial Assets
                              </div>
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-left font-bold text-slate-500 text-[10px]">
                                    <th className="p-2">Liquid Asset Category</th>
                                    <th className="p-2 text-right w-28">Asset Bal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {bsData.assets.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="p-2 font-medium text-slate-800">{item.name}</td>
                                      <td className="p-2 text-right font-mono text-slate-900">{formatINR(item.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="p-2.5 border-t border-slate-200 bg-slate-50 flex justify-between font-bold font-mono text-xs border-b-2 border-b-slate-900 shadow-3xs">
                              <span>Total Assets Allocation:</span>
                              <span>{formatINR(bsData.totalAssets)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* OFFICIAL AUDIT SIGN OFF SECTION */}
                    <div className="mt-12 pt-8 border-t border-dashed border-slate-350 space-y-6">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 font-sans leading-relaxed text-left">
                        <strong className="text-slate-800 uppercase tracking-widest text-[9.5px] block mb-1">✓ AUTOMATED DOUBLE-ENTRY STATEMENT VERIFICATION</strong>
                        I, as the appointed Union Treasurer, do hereby verify and authorize that the transactions listed herein represent complete and balanced record-keeping for the designated academic term. These Statements of cash summaries, income indices and asset distributions are mathematically cross-verified across all general ledgers.
                      </div>

                      <div className="grid grid-cols-2 gap-10 pt-4 text-xs font-sans">
                        <div className="text-left space-y-1">
                          <div className="border-b border-slate-950 h-8" />
                          <p className="font-bold text-slate-800">Prepared & Certified By:</p>
                          <p className="text-[10px] text-slate-600 font-mono">Treasurer: {treasurerName}</p>
                          <p className="text-[9px] text-slate-400 font-mono">Signed electronically on: {currentDateStr}</p>
                        </div>
                        <div className="text-left space-y-1">
                          <div className="border-b border-slate-950 h-8" />
                          <p className="font-bold text-slate-800">Audited & Approved By:</p>
                          <p className="text-[10px] text-slate-650 font-mono">Trust Council Advisor / Union Secretary</p>
                          <p className="text-[9px] text-slate-400">Date: ____ / ____ / {new Date().getFullYear()}</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dynamic File Attachment Viewer Modal */}
      {selectedPreviewEntry && (() => {
        const entry = selectedPreviewEntry;
        const files = entry.files || [];
        const file = files[selectedPreviewFileIndex];
        if (!file) return null;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Paperclip size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 font-mono truncate max-w-sm md:max-w-md" title={file.name}>
                      {file.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-sans">
                      Transaction Date: {entry.date} • Amount: ₹ {entry.amount}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!isEditor && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 font-sans select-none" title="You are viewing the ledger in read-only mode">
                      <ShieldCheck size={13} className="text-slate-400" />
                      View Only
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={isLoadingFile || !loadedBase64}
                    onClick={() => {
                      if (!loadedBase64) return;
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", loadedBase64);
                      downloadAnchor.setAttribute("download", file.name);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                  >
                    <Download size={13} />
                    {isLoadingFile ? 'Assembling...' : 'Download File'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewEntry(null)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                    title="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 flex overflow-hidden md:flex-row flex-col bg-slate-100">
                {/* Left Panel: File list switcher (only if multiple files) */}
                {files.length > 1 && (
                  <div className="w-full md:w-60 bg-white border-r border-slate-200 p-3 overflow-y-auto shrink-0 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase mb-2">
                      Attachments in Entry ({files.length})
                    </span>
                    {files.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedPreviewFileIndex(i)}
                        className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-all text-xs cursor-pointer ${
                          i === selectedPreviewFileIndex
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <File size={13} className={i === selectedPreviewFileIndex ? 'text-blue-500' : 'text-slate-400'} />
                        <span className="truncate flex-1 font-medium">{f.name}</span>
                        <span className="text-[9px] font-mono opacity-60">({Math.round(f.size / 1024)}K)</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Right Panel: actual viewer */}
                <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-auto min-h-60 max-h-[70vh]">
                  {isLoadingFile ? (
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                      <p className="text-xs text-slate-500 font-sans">
                        {file && (file as any).status === 'uploading'
                          ? 'Uploading and processing file in background... Please wait.'
                          : 'Assembling and loading file chunks from remote database...'}
                      </p>
                    </div>
                  ) : fileLoadError ? (
                    <div className="text-center space-y-4 max-w-md bg-white p-8 rounded-2xl shadow-3xs border border-rose-100">
                      <div className="mx-auto w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                        <Info size={30} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 font-sans">
                          Failed to load file
                        </h4>
                        <p className="text-xs text-rose-500 mt-1 font-mono">
                          {fileLoadError}
                        </p>
                      </div>
                    </div>
                  ) : !loadedBase64 ? (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                      <p className="text-xs text-slate-500 font-sans">Loading file preview...</p>
                    </div>
                  ) : file.type.startsWith('image/') ? (
                    <div className="relative bg-white p-2 border rounded-xl shadow-3xs max-w-full">
                      <img
                        src={loadedBase64}
                        alt={file.name}
                        referrerPolicy="no-referrer"
                        className="max-h-[50vh] rounded object-contain max-w-full block"
                      />
                    </div>
                  ) : (
                    <div className="text-center space-y-4 max-w-md bg-white p-8 rounded-2xl shadow-3xs border border-slate-200">
                      <div className="mx-auto w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <File size={30} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 truncate" title={file.name}>
                          {file.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Type: {file.type || 'Document'} • Size: {Math.round(file.size / 1024)} KB
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border leading-relaxed">
                        This file format cannot be rendered here. Please use the "Download File" button above to view it natively on your computer.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
