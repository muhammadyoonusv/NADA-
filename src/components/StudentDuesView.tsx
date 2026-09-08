/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Account, JournalEntry, Student, Program, StudentDuesItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  PlusCircle, 
  Sparkles, 
  Filter, 
  Trash2, 
  Edit, 
  CreditCard, 
  TrendingUp, 
  UserPlus, 
  Plus,
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  BookOpen, 
  DollarSign, 
  Check, 
  ShieldCheck, 
  HelpCircle,
  Folder,
  FolderPlus,
  ArrowLeft,
  LayoutGrid,
  ClipboardList,
  Save,
  CheckSquare,
  Square,
  RefreshCw,
  Sliders,
  ChevronRight,
  Info
} from 'lucide-react';

interface StudentDuesViewProps {
  accounts: Account[];
  entries: JournalEntry[];
  students: Student[];
  programs: Program[];
  isEditor: boolean;
  showToast?: (message: string, type?: 'success' | 'err' | 'info') => void;
  onAddStudent: (student: Student) => Promise<boolean>;
  onUpdateStudent: (student: Student) => Promise<boolean>;
  onDeleteStudent: (id: string) => Promise<boolean>;
  onClearAllStudents?: (ids: string[]) => Promise<boolean>;
  onAddEntry: (entry: Omit<JournalEntry, 'id'>) => Promise<boolean>;
  onAddProgram: (program: Program) => Promise<boolean>;
  onUpdateProgram: (program: Program) => Promise<boolean>;
  onDeleteProgram: (id: string) => Promise<boolean>;
}

const MASTER_80_QURAN_STUDENTS = [
  "Aditya K. S.", "Aiswarya Lakshmi", "Albin Joseph", "Amal Krishna", "Anagha S. Kumar",
  "Anandhu Rajesh", "Anjali Nair", "Arjun Prasad", "Aswin Ramesh", "Athira Chandran",
  "Devika Nair", "Gautham Krishna", "Hariprasad V.", "Kiran Thomas", "Meenakshi R.",
  "Midhun Mohan", "Nandana S.", "Nihal Ahmed", "Pranav K.", "Rahul Krishnan",
  "Rhea Kurian", "Rohan Mathew", "Sandeep Nair", "Siddharth K.", "Sneha Raj",
  "Surya Kiran", "Varun Dev", "Zainab Fatima", "Afsal Hussain", "Abhishek Pillai",
  "Sandra Rose", "Thejus Nair", "Rithika S.", "Fadil Rahman", "Mohammed Shafi"
];

export function StudentDuesView({
  accounts,
  entries,
  students,
  programs = [],
  isEditor,
  showToast,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onClearAllStudents,
  onAddEntry,
  onAddProgram,
  onUpdateProgram,
  onDeleteProgram
}: StudentDuesViewProps) {
  // Navigation & Directory state
  const [activeView, setActiveView] = useState<'folders' | 'program_details' | 'roster'>(isEditor ? 'folders' : 'roster');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Hard enforce visitor to master roster-only lookup when not authorized editor
  useEffect(() => {
    if (!isEditor) {
      setActiveView('roster');
      setSelectedProgramId(null);
    }
  }, [isEditor]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Pending'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'paid' | 'remaining'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isBulkEnterOpen, setIsBulkEnterOpen] = useState(false);
  const [isRosterImportOpen, setIsRosterImportOpen] = useState(false);
  const [payingStudentId, setPayingStudentId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [isBulkRemoveConfirmOpen, setIsBulkRemoveConfirmOpen] = useState(false);
  const [isRestoreAllConfirmOpen, setIsRestoreAllConfirmOpen] = useState(false);

  // Loading indicator for batch generation
  const [isGeneratingRoster, setIsGeneratingRoster] = useState(false);

  // Form states: Program
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramAmt, setNewProgramAmt] = useState('500');
  const [newProgramDesc, setNewProgramDesc] = useState('');
  const [newProgramDate, setNewProgramDate] = useState(new Date().toISOString().split('T')[0]);

  // Form states: Master Student Roster
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('QURAN DEPARTMENT');
  const [studentRemarks, setStudentRemarks] = useState('');

  // Form states: Program payment collection
  const [payAmount, setPayAmount] = useState('0');
  const [payRemarks, setPayRemarks] = useState('');
  const [payPostJournal, setPayPostJournal] = useState(true);
  const [payDebitAcc, setPayDebitAcc] = useState('');
  const [payCreditAcc, setPayCreditAcc] = useState('');

  // Compound payment states
  const [payIsCompound, setPayIsCompound] = useState(false);
  const [payCompDebits, setPayCompDebits] = useState<{ accountId: string; amount: string }[]>([{ accountId: '', amount: '' }]);
  const [payCompCredits, setPayCompCredits] = useState<{ accountId: string; amount: string }[]>([{ accountId: '', amount: '' }]);

  // Form states: Bulk Program Dues Inputs
  const [bulkMode, setBulkMode] = useState<'grid' | 'paste'>('grid');
  const [bulkGridDues, setBulkGridDues] = useState<{ [studentId: string]: { paid: string; due: string; remarks: string } }>({});
  const [bulkPasteInput, setBulkPasteInput] = useState('');
  const [bulkPasteFeedback, setBulkPasteFeedback] = useState<string | null>(null);
  const [bulkPostJournal, setBulkPostJournal] = useState(true);
  const [bulkDebitAcc, setBulkDebitAcc] = useState('');
  const [bulkCreditAcc, setBulkCreditAcc] = useState('');
  const [bulkTargetAmount, setBulkTargetAmount] = useState<string>('');

  // Compound bulk states
  const [bulkIsCompound, setBulkIsCompound] = useState(false);
  const [bulkCompDebits, setBulkCompDebits] = useState<{ accountId: string; amount: string }[]>([{ accountId: '', amount: '' }]);
  const [bulkCompCredits, setBulkCompCredits] = useState<{ accountId: string; amount: string }[]>([{ accountId: '', amount: '' }]);

  // Bulk Student Creation input
  const [bulkStudentInput, setBulkStudentInput] = useState('');
  const [isBulkStudentImporting, setIsBulkStudentImporting] = useState(false);

  // Bulk and Excluded members management states
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // Active Selected Program Reference
  const activeProgram = useMemo(() => {
    return programs.find(p => p.id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  // Reset bulk selections on view, campaign, text search or status filter changes
  useEffect(() => {
    setSelectedStudentIds([]);
  }, [selectedProgramId, searchTerm, statusFilter, activeView]);

  // Filter master/program students to Quran Department
  const quranStudentsList = useMemo(() => {
    // Standardize order - arrange in ascending order of roll number / ID
    return [...students].sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, ''), 10);
      const numB = parseInt(b.id.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }, [students]);

  // Accounts classifications
  const assetAccounts = useMemo(() => accounts.filter(a => a.type === 'Asset'), [accounts]);
  const incomeAccounts = useMemo(() => accounts.filter(a => a.type === 'Income' || a.type === 'Equity'), [accounts]);

  // Group all accounts for complete flexible chart-of-accounts selection (for custom debtors/creditors, etc.)
  const groupedAccounts = useMemo(() => {
    const groups: { [key: string]: Account[] } = {
      'Asset': [],
      'Liability': [],
      'Equity': [],
      'Income': [],
      'Expense': []
    };
    accounts.forEach(a => {
      if (groups[a.type]) {
        groups[a.type].push(a);
      } else {
        groups[a.type] = groups[a.type] || [];
        groups[a.type].push(a);
      }
    });
    return Object.entries(groups).filter(([_, items]) => items.length > 0) as [string, Account[]][];
  }, [accounts]);

  // Students who are inside the selected program/folder (not excluded)
  const folderStudents = useMemo(() => {
    if (!activeProgram) return [];
    const excludedIds = activeProgram.excludedStudentIds || [];
    return quranStudentsList.filter(stu => !excludedIds.includes(stu.id));
  }, [activeProgram, quranStudentsList]);

  // Auto-populate ledger accounts fallbacks dynamically when lists load
  useEffect(() => {
    if (isBulkEnterOpen) {
      const defaultDebit = assetAccounts.find(a => a.name.toLowerCase().includes('bank'))?.id || assetAccounts[0]?.id || '';
      const defaultCredit = incomeAccounts.find(a => a.name.toLowerCase().includes('fee') || a.name.toLowerCase().includes('dues') || a.name.toLowerCase().includes('receipt'))?.id || incomeAccounts[0]?.id || '';

      if (!bulkDebitAcc && defaultDebit) setBulkDebitAcc(defaultDebit);
      if (!bulkCreditAcc && defaultCredit) setBulkCreditAcc(defaultCredit);

      setBulkCompDebits([{ accountId: bulkDebitAcc || defaultDebit, amount: '' }]);
      setBulkCompCredits([{ accountId: bulkCreditAcc || defaultCredit, amount: '' }]);
    }
  }, [isBulkEnterOpen, assetAccounts, incomeAccounts, bulkDebitAcc, bulkCreditAcc]);

  useEffect(() => {
    if (payingStudentId) {
      const defaultDebit = assetAccounts.find(a => a.name.toLowerCase().includes('bank'))?.id || assetAccounts[0]?.id || '';
      const defaultCredit = incomeAccounts.find(a => a.name.toLowerCase().includes('fee') || a.name.toLowerCase().includes('dues') || a.name.toLowerCase().includes('receipt'))?.id || incomeAccounts[0]?.id || '';

      if (!payDebitAcc && defaultDebit) setPayDebitAcc(defaultDebit);
      if (!payCreditAcc && defaultCredit) setPayCreditAcc(defaultCredit);

      setPayCompDebits([{ accountId: payDebitAcc || defaultDebit, amount: payAmount || '' }]);
      setPayCompCredits([{ accountId: payCreditAcc || defaultCredit, amount: payAmount || '' }]);
    }
  }, [payingStudentId, assetAccounts, incomeAccounts, payDebitAcc, payCreditAcc, payAmount]);

  // Calculate comprehensive stats for folders
  const folderStats = useMemo(() => {
    const stats: { [progId: string]: { totalRaised: number; totalPending: number; paidCount: number; rate: number } } = {};
    programs.forEach(prog => {
      let raised = 0;
      let target = 0;
      let paid = 0;
      const excludedIds = prog.excludedStudentIds || [];
      quranStudentsList.forEach(stu => {
        if (excludedIds.includes(stu.id)) return;
        const item = prog.studentDues[stu.id] || { amountPaid: 0, totalDue: prog.defaultAmount, status: 'Pending' };
        raised += item.amountPaid;
        target += item.totalDue;
        if (item.status === 'Paid') paid++;
      });
      const rate = target > 0 ? Math.round((raised / target) * 100) : 0;
      stats[prog.id] = {
        totalRaised: raised,
        totalPending: Math.max(0, target - raised),
        paidCount: paid,
        rate
      };
    });
    return stats;
  }, [programs, quranStudentsList]);

  // Selected program statistics
  const currentProgramStats = useMemo(() => {
    if (!activeProgram) return { raised: 0, pending: 0, paid: 0, partial: 0, unpaid: 0, target: 0, rate: 0 };
    let raised = 0;
    let target = 0;
    let paid = 0;
    let partial = 0;
    let unpaid = 0;
    const excludedIds = activeProgram.excludedStudentIds || [];

    quranStudentsList.forEach(stu => {
      if (excludedIds.includes(stu.id)) return;
      const item = activeProgram.studentDues[stu.id] || { amountPaid: 0, totalDue: activeProgram.defaultAmount, status: 'Pending' };
      raised += item.amountPaid;
      target += item.totalDue;
      if (item.status === 'Paid') paid++;
      else if (item.status === 'Partial') partial++;
      else unpaid++;
    });

    const rate = target > 0 ? Math.round((raised / target) * 105) : 0; // Wait, actually standard calculation had round((raised / target) * 100)
    const exactRate = target > 0 ? Math.round((raised / target) * 100) : 0;
    return {
      raised,
      pending: Math.max(0, target - raised),
      paid,
      partial,
      unpaid,
      target,
      rate: exactRate
    };
  }, [activeProgram, quranStudentsList]);

  // Active selected program rows (retrieved dynamically matching roster)
  const currentProgramRows = useMemo(() => {
    if (!activeProgram) return [];
    const excludedIds = activeProgram.excludedStudentIds || [];
    return quranStudentsList
      .filter(stu => !excludedIds.includes(stu.id))
      .map(stu => {
        const dues = activeProgram.studentDues[stu.id] || {
          amountPaid: 0,
          totalDue: activeProgram.defaultAmount,
          status: 'Pending',
          remarks: ''
        };
        return {
          student: stu,
          dues
        };
      });
  }, [activeProgram, quranStudentsList]);

  // Filter & Sort table items
  const filteredRows = useMemo(() => {
    if (activeView === 'roster') {
      return quranStudentsList.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || s.status === statusFilter;
        return matchSearch && matchStatus;
      });
    }

    if (!activeProgram) return [];
    return currentProgramRows
      .filter(row => {
        const matchSearch = 
          row.student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          row.student.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (row.dues.remarks || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchStatus = statusFilter === 'All' || row.dues.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        let valA: any = a.student.name;
        let valB: any = b.student.name;

        if (sortBy === 'id') {
          valA = a.student.id;
          valB = b.student.id;
        } else if (sortBy === 'paid') {
          valA = a.dues.amountPaid;
          valB = b.dues.amountPaid;
        } else if (sortBy === 'remaining') {
          valA = Math.max(0, a.dues.totalDue - a.dues.amountPaid);
          valB = Math.max(0, b.dues.totalDue - b.dues.amountPaid);
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
        }
      });
  }, [activeView, activeProgram, quranStudentsList, currentProgramRows, searchTerm, statusFilter, sortBy, sortOrder]);

  const requestSort = (field: 'name' | 'id' | 'paid' | 'remaining') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Helper to trigger payment collection modal
  const handleSelectPayStudent = (stuId: string, duesItem: StudentDuesItem) => {
    if (!activeProgram) return;
    setPayingStudentId(stuId);
    const balance = Math.max(0, duesItem.totalDue - duesItem.amountPaid);
    setPayAmount(balance.toString());
    
    const bankOrCash = assetAccounts.find(a => a.name.toLowerCase().includes('bank')) || assetAccounts[0];
    const feesAcc = incomeAccounts.find(a => a.name.toLowerCase().includes('fee') || a.name.toLowerCase().includes('dues') || a.name.toLowerCase().includes('receipt')) || incomeAccounts[0];
    
    setPayDebitAcc(bankOrCash?.id || '');
    setPayCreditAcc(feesAcc?.id || '');
    
    // Find name
    const sName = quranStudentsList.find(s => s.id === stuId)?.name || 'Student';
    setPayRemarks(`${activeProgram.name} drive payment from ${sName} (${stuId})`);
  };

  // Create standard Quran students automatically loop
  const handleAutoGenerateRoster = async () => {
    setIsGeneratingRoster(true);
    let successCount = 0;
    try {
      for (let i = 0; i < MASTER_80_QURAN_STUDENTS.length; i++) {
        const studentName = MASTER_80_QURAN_STUDENTS[i];
        const studentRoll = `QURAN-${101 + i}`;
        
        // Skip duplicate IDs
        if (students.some(s => s.id === studentRoll)) continue;

        const newStu: Student = {
          id: studentRoll,
          name: studentName,
          className: 'QURAN DEPARTMENT',
          totalDue: 500, // global placeholder
          amountPaid: 0,
          status: 'Pending',
          remarks: 'Quran Department Active Roster'
        };
        
        const ok = await onAddStudent(newStu);
        if (ok) successCount++;
      }
      setIsRosterImportOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingRoster(false);
    }
  };

  // Bulk Import Students from pasted Spreadsheet or Text rows
  const handleBulkImportStudents = async () => {
    if (!bulkStudentInput.trim()) {
      alert("Please enter or paste student names first.");
      return;
    }

    setIsBulkStudentImporting(true);
    let successCount = 0;
    let skipCount = 0;

    try {
      const lines = bulkStudentInput.split('\n');
      let currentMaxNum = 100;
      students.forEach(s => {
        const match = s.id.match(/^QURAN-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > currentMaxNum) currentMaxNum = num;
        }
      });

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let id = '';
        let name = '';
        let className = 'QURAN DEPARTMENT';
        let remarks: string | undefined = 'Bulk Imported Student';

        // Check if tab-delimited, comma-delimited, or semicolon-delimited
        let parts: string[] = [];
        if (line.includes('\t')) {
          parts = line.split('\t');
        } else if (line.includes(',')) {
          parts = line.split(',');
        } else if (line.includes(';')) {
          parts = line.split(';');
        }

        if (parts.length >= 2) {
          const p0 = parts[0].trim();
          const p1 = parts[1].trim();

          // Check if p0 feels like an alphanumeric ID/Roll (no space, optional letters, trailing numbers)
          const isIdLike = /^[A-Z0-9-]{3,15}$/i.test(p0) || (p0.length <= 12 && isNaN(Number(p0)) && !p0.includes(' '));
          
          if (isIdLike) {
            id = p0;
            name = p1;
            if (parts.length >= 3) className = parts[2].trim() || className;
            if (parts.length >= 4) remarks = parts[3].trim() || undefined;
          } else {
            name = p0;
            className = p1;
            if (parts.length >= 3) remarks = parts[2].trim() || undefined;
          }
        } else {
          // Just a single string or name
          name = line;
        }

        if (!name) continue;

        // Auto-generate stable sequential ID if not explicitly parsed/provided
        if (!id) {
          currentMaxNum++;
          id = `QURAN-${currentMaxNum}`;
        }

        // De-duplicate Roll IDs on the fly
        if (students.some(s => s.id.toUpperCase() === id.toUpperCase())) {
          skipCount++;
          continue;
        }

        const newStu: Student = {
          id: id.toUpperCase(),
          name,
          className,
          totalDue: 0,
          amountPaid: 0,
          status: 'Pending',
          remarks
        };

        const ok = await onAddStudent(newStu);
        if (ok) {
          successCount++;
        } else {
          skipCount++;
        }
      }

      alert(`Success: Bulk-created ${successCount} students. (Skipped/Duplicate: ${skipCount})`);
      setBulkStudentInput('');
      setIsRosterImportOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error: An error occurred while creating students.");
    } finally {
      setIsBulkStudentImporting(false);
    }
  };

  // Delete all students sequentially or via batch, without modal warning for a sudden instantaneous action
  const handleClearAllStudents = async () => {
    if (quranStudentsList.length === 0) {
      if (showToast) {
        showToast("No students to clear!", "info");
      } else {
        alert("No students to clear!");
      }
      return;
    }

    setIsBulkStudentImporting(true);
    let successCount = 0;
    try {
      if (onClearAllStudents) {
        const studentIds = quranStudentsList.map(s => s.id);
        const ok = await onClearAllStudents(studentIds);
        if (ok) {
          successCount = studentIds.length;
        }
      } else {
        // Fallback
        for (const s of [...quranStudentsList]) {
          const ok = await onDeleteStudent(s.id);
          if (ok) successCount++;
        }
        if (showToast) {
          showToast(`Cleared ${successCount} students successfully.`, "success");
        } else {
          alert(`Cleared ${successCount} students successfully.`);
        }
      }
    } catch (err) {
      console.error(err);
      if (showToast) {
        showToast("Error occurred while clearing students.", "err");
      } else {
        alert("Error occurred while clearing students.");
      }
    } finally {
      setIsBulkStudentImporting(false);
    }
  };

  // Submit Master Student Form
  const handleSubmitMasterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !studentName.trim()) return;

    const cleanStu: Student = {
      id: studentId.trim(),
      name: studentName.trim(),
      className: studentClass.trim() || 'QURAN DEPARTMENT',
      totalDue: 0,
      amountPaid: 0,
      status: 'Pending',
      remarks: studentRemarks.trim() || undefined
    };

    let ok = false;
    if (editingStudent) {
      // Re-use current values
      ok = await onUpdateStudent({
        ...editingStudent,
        name: cleanStu.name,
        className: cleanStu.className,
        remarks: cleanStu.remarks
      });
    } else {
      ok = await onAddStudent(cleanStu);
    }

    if (ok) {
      setIsAddStudentOpen(false);
      setEditingStudent(null);
    }
  };

  // Submit Program creation
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgramName.trim()) return;

    const standardAmt = parseFloat(newProgramAmt) || 0;
    const progId = `PROG-${Date.now().toString().slice(-6)}`;

    // Initialize all existing students with default target dues for this program
    const duesMap: { [studentId: string]: StudentDuesItem } = {};
    quranStudentsList.forEach(stu => {
      duesMap[stu.id] = {
        amountPaid: 0,
        totalDue: standardAmt,
        status: 'Pending',
        remarks: ''
      };
    });

    const newProg: Program = {
      id: progId,
      name: newProgramName.trim(),
      defaultAmount: standardAmt,
      date: newProgramDate,
      remarks: newProgramDesc.trim() || undefined,
      studentDues: duesMap,
      createdAt: new Date().toISOString()
    };

    const ok = await onAddProgram(newProg);
    if (ok) {
      setNewProgramName('');
      setNewProgramDesc('');
      setIsAddProgramOpen(false);
      setSelectedProgramId(progId);
      setActiveView('program_details');
    }
  };

  // Record single student collection pay
  const handleRecordProgramPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram || !payingStudentId) return;

    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) return;

    const currentDues = activeProgram.studentDues[payingStudentId] || {
      amountPaid: 0,
      totalDue: activeProgram.defaultAmount,
      status: 'Pending',
      remarks: ''
    };

    const newPaid = currentDues.amountPaid + amt;
    let newStatus: 'Paid' | 'Partial' | 'Pending' = 'Pending';
    if (newPaid >= currentDues.totalDue) newStatus = 'Paid';
    else if (newPaid > 0) newStatus = 'Partial';

    // 1. Post double-entry if verified
    if (payPostJournal) {
      const studentName = quranStudentsList.find(s => s.id === payingStudentId)?.name || 'Student';
      const defaultNarration = `Fee collection from ${studentName} for program: ${activeProgram.name}`;

      if (payIsCompound) {
        // Validate compound entries
        const activeDebits = payCompDebits.filter(d => d.accountId || d.amount);
        const activeCredits = payCompCredits.filter(c => c.accountId || c.amount);

        if (activeDebits.length < 1 || activeCredits.length < 1) {
          alert("Please provide at least one active debit and credit account leg.");
          return;
        }

        const parsedDebits: { accountId: string; amount: number }[] = [];
        const parsedCredits: { accountId: string; amount: number }[] = [];

        for (const d of activeDebits) {
          const val = parseFloat(d.amount);
          if (!d.accountId || isNaN(val) || val <= 0) {
            alert("All active debit accounts and positive numerical amounts must be set.");
            return;
          }
          parsedDebits.push({ accountId: d.accountId, amount: val });
        }

        for (const c of activeCredits) {
          const val = parseFloat(c.amount);
          if (!c.accountId || isNaN(val) || val <= 0) {
            alert("All active credit accounts and positive numerical amounts must be set.");
            return;
          }
          parsedCredits.push({ accountId: c.accountId, amount: val });
        }

        const sumDebits = parsedDebits.reduce((sum, d) => sum + d.amount, 0);
        const sumCredits = parsedCredits.reduce((sum, c) => sum + c.amount, 0);

        if (Math.abs(sumDebits - sumCredits) > 0.01) {
          alert(`Unbalanced Entry! Total debits (₹${sumDebits.toLocaleString()}) must exactly equal total credits (₹${sumCredits.toLocaleString()}). Difference: ₹${Math.abs(sumDebits - sumCredits).toFixed(2)}.`);
          return;
        }

        if (Math.abs(sumDebits - amt) > 0.01) {
          alert(`Total compound entry legs sum (₹${sumDebits.toLocaleString()}) must exactly equal the payment receipt amount (₹${amt.toLocaleString()}). Correct individual item amounts.`);
          return;
        }

        const ok = await onAddEntry({
          date: new Date().toISOString().split('T')[0],
          debitAccount: parsedDebits[0].accountId,
          creditAccount: parsedCredits[0].accountId,
          amount: parseFloat(sumDebits.toFixed(2)),
          narration: payRemarks.trim() ? payRemarks : defaultNarration,
          isCompound: true,
          debits: parsedDebits,
          credits: parsedCredits,
        });
        if (!ok) return; // Halt if double-entry failed
      } else {
        if (!payDebitAcc || !payCreditAcc) {
          alert("Please select both Debit and Credit accounts for auto-recording ledger entries.");
          return;
        }
        const ok = await onAddEntry({
          date: new Date().toISOString().split('T')[0],
          debitAccount: payDebitAcc,
          creditAccount: payCreditAcc,
          amount: amt,
          narration: payRemarks.trim() ? payRemarks : defaultNarration
        });
        if (!ok) return; // Halt if double-entry failed
      }
    }

    // 2. Update Program student dues map
    const updatedDues = {
      ...activeProgram.studentDues,
      [payingStudentId]: {
        ...currentDues,
        amountPaid: newPaid,
        status: newStatus,
        lastPaymentDate: new Date().toISOString().split('T')[0],
        remarks: currentDues.remarks ? `${currentDues.remarks} | Recived ₹${amt}` : `Recived ₹${amt} on ${new Date().toLocaleDateString()}`
      }
    };

    const ok = await onUpdateProgram({
      ...activeProgram,
      studentDues: updatedDues
    });

    if (ok) {
      setPayingStudentId(null);
    }
  };

  // Initialize spreadsheet grid editor
  const handleOpenBulkEditor = () => {
    if (!activeProgram) return;
    const initialGrid: typeof bulkGridDues = {};
    folderStudents.forEach(stu => {
      const rec = activeProgram.studentDues[stu.id] || {
        amountPaid: 0,
        totalDue: activeProgram.defaultAmount,
        status: 'Pending',
        remarks: ''
      };
      initialGrid[stu.id] = {
        paid: '0', // Start at 0 for new incremental given amounts
        due: rec.totalDue.toString(),
        remarks: '' // Start clean for new remarks
      };
    });
    setBulkGridDues(initialGrid);
    setBulkPasteInput('');
    setBulkPasteFeedback(null);

    // Initialize accounts with default smart fallbacks representing Bank/Cash and Fees/Dues
    const bankOrCash = assetAccounts.find(a => a.name.toLowerCase().includes('bank')) || assetAccounts[0];
    const feesAcc = incomeAccounts.find(a => a.name.toLowerCase().includes('fee') || a.name.toLowerCase().includes('dues') || a.name.toLowerCase().includes('receipt')) || incomeAccounts[0];
    setBulkDebitAcc(bankOrCash?.id || '');
    setBulkCreditAcc(feesAcc?.id || '');
    setBulkPostJournal(true);
    setBulkTargetAmount(activeProgram?.defaultAmount.toString() || '500');

    setIsBulkEnterOpen(true);
  };

  // Apply Changes from Grid Spreadsheet Editor
  const handleSaveBulkGrid = async () => {
    if (!activeProgram) return;

    if (bulkPostJournal && (!bulkDebitAcc || !bulkCreditAcc)) {
      alert("Please select both Debit and Credit accounts for auto-recording ledger entries.");
      return;
    }

    const updatedDues: { [studentId: string]: StudentDuesItem } = { ...activeProgram.studentDues };
    const entriesToPost: { studentId: string; studentName: string; amount: number; remarks: string }[] = [];

    folderStudents.forEach(stu => {
      const rec = activeProgram.studentDues[stu.id] || {
        amountPaid: 0,
        totalDue: activeProgram.defaultAmount,
        status: 'Pending',
        remarks: ''
      };

      const grid = bulkGridDues[stu.id] || { paid: '0', due: activeProgram.defaultAmount.toString(), remarks: '' };
      const newlyPaidVal = parseFloat(grid.paid) || 0;
      const dueNum = parseFloat(grid.due) || 0;

      const originalPaid = rec.amountPaid || 0;
      const newTotalPaid = originalPaid + newlyPaidVal;

      let status: 'Paid' | 'Partial' | 'Pending' = 'Pending';
      if (newTotalPaid >= dueNum && dueNum > 0) status = 'Paid';
      else if (newTotalPaid > 0) status = 'Partial';

      const lastPaymentDate = newlyPaidVal > 0 
        ? new Date().toISOString().split('T')[0] 
        : (rec.lastPaymentDate || undefined);

      // Merge remarks smartly
      let mergedRemarks = grid.remarks.trim() ? grid.remarks : (rec.remarks || undefined);
      if (newlyPaidVal > 0) {
        const textToAppend = `Received ₹${newlyPaidVal} via bulk spreadsheet on ${new Date().toLocaleDateString()}`;
        mergedRemarks = grid.remarks.trim()
          ? (grid.remarks.includes('Received') ? grid.remarks : `${grid.remarks} | ${textToAppend}`)
          : (rec.remarks ? `${rec.remarks} | ${textToAppend}` : textToAppend);

        entriesToPost.push({
          studentId: stu.id,
          studentName: stu.name,
          amount: newlyPaidVal,
          remarks: mergedRemarks
        });
      }

      updatedDues[stu.id] = {
        amountPaid: newTotalPaid,
        totalDue: dueNum,
        remarks: mergedRemarks,
        status,
        lastPaymentDate
      };
    });

    // 1. Post double-entry journals synchronously as a single aggregated bulk amount
    if (bulkPostJournal && entriesToPost.length > 0) {
      const totalBulkAmount = entriesToPost.reduce((sum, item) => sum + item.amount, 0);
      const studentDetails = entriesToPost.map(item => `${item.studentName} (${item.studentId}): ₹${item.amount}`).join(', ');
      const rawNarration = `Bulk Drive Collection for ${activeProgram.name} (${entriesToPost.length} students): ${studentDetails}`;
      const finalNarration = rawNarration.length > 450 ? rawNarration.slice(0, 447) + '...' : rawNarration;

      if (bulkIsCompound) {
        const activeDebits = bulkCompDebits.filter(d => d.accountId || d.amount);
        const activeCredits = bulkCompCredits.filter(c => c.accountId || c.amount);

        if (activeDebits.length < 1 || activeCredits.length < 1) {
          alert("Please provide at least one active debit and credit account leg for the compound transaction.");
          return;
        }

        const parsedDebits: { accountId: string; amount: number }[] = [];
        const parsedCredits: { accountId: string; amount: number }[] = [];

        for (const d of activeDebits) {
          const val = parseFloat(d.amount);
          if (!d.accountId || isNaN(val) || val <= 0) {
            alert("All active debit accounts and positive numerical amounts must be set.");
            return;
          }
          parsedDebits.push({ accountId: d.accountId, amount: val });
        }

        for (const c of activeCredits) {
          const val = parseFloat(c.amount);
          if (!c.accountId || isNaN(val) || val <= 0) {
            alert("All active credit accounts and positive numerical amounts must be set.");
            return;
          }
          parsedCredits.push({ accountId: c.accountId, amount: val });
        }

        const sumDebits = parsedDebits.reduce((sum, d) => sum + d.amount, 0);
        const sumCredits = parsedCredits.reduce((sum, c) => sum + c.amount, 0);

        if (Math.abs(sumDebits - sumCredits) > 0.01) {
          alert(`Unbalanced Entry! Total debits (₹${sumDebits.toLocaleString()}) must exactly equal total credits (₹${sumCredits.toLocaleString()}). Difference: ₹${Math.abs(sumDebits - sumCredits).toFixed(2)}.`);
          return;
        }

        if (Math.abs(sumDebits - totalBulkAmount) > 0.01) {
          alert(`Total compound entry legs sum (₹${sumDebits.toLocaleString()}) must exactly equal total collected student dues (₹${totalBulkAmount.toLocaleString()}). Adjust individual leg amounts to balance.`);
          return;
        }

        const ok = await onAddEntry({
          date: new Date().toISOString().split('T')[0],
          debitAccount: parsedDebits[0].accountId,
          creditAccount: parsedCredits[0].accountId,
          amount: parseFloat(sumDebits.toFixed(2)),
          narration: finalNarration,
          isCompound: true,
          debits: parsedDebits,
          credits: parsedCredits,
        });
        if (!ok) {
          alert(`Halted: Failed to save consolidated bulk journal entry. Please retry.`);
          return;
        }
      } else {
        const ok = await onAddEntry({
          date: new Date().toISOString().split('T')[0],
          debitAccount: bulkDebitAcc,
          creditAccount: bulkCreditAcc,
          amount: parseFloat(totalBulkAmount.toFixed(2)),
          narration: finalNarration
        });
        if (!ok) {
          alert(`Halted: Failed to save consolidated bulk journal entry. Please retry.`);
          return;
        }
      }
    }

    // 2. Save the updated campaign grid
    const ok = await onUpdateProgram({
      ...activeProgram,
      studentDues: updatedDues
    });

    if (ok) {
      setIsBulkEnterOpen(false);
    }
  };

  // Whatsapp/Excel Text Paste Parser
  const handleParsePasteBulk = () => {
    if (!activeProgram) return;
    
    // Clear previous feedback
    setBulkPasteFeedback(null);
    
    const lines = bulkPasteInput.split('\n').map(l => l.trim()).filter(Boolean);
    const updatedGrid = { ...bulkGridDues };
    let parsedCount = 0;
    let failedCount = 0;

    lines.forEach(line => {
      // Formats: 
      // 1. RollNo, GivenAmount, DuesTarget, Remarks
      // 2. Name, GivenAmount
      // 3. RollNo: GivenAmount
      let nameOrId = '';
      let givenVal = '';
      let targetVal = '';
      let remarksVal = '';

      if (line.includes(',') || line.includes('\t')) {
        const parts = line.split(/[,\t]+/);
        nameOrId = parts[0]?.trim() || '';
        givenVal = parts[1]?.trim() || '';
        targetVal = parts[2]?.trim() || '';
        remarksVal = parts[3]?.trim() || '';
      } else if (line.includes(':')) {
        const parts = line.split(':');
        nameOrId = parts[0]?.trim() || '';
        givenVal = parts[1]?.trim() || '';
      } else {
        // Try parsing space-based
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const lastElement = parts[parts.length - 1];
          if (/^\d+$/.test(lastElement)) {
            givenVal = lastElement;
            nameOrId = parts.slice(0, -1).join(' ');
          }
        }
      }

      const cleanNameOrId = nameOrId.toLowerCase();
      if (!cleanNameOrId || !givenVal) {
        failedCount++;
        return;
      }

      // Try finding the student using exact ID first, then fuzzy name
      const foundStu = folderStudents.find(s => 
        s.id.toLowerCase() === cleanNameOrId || 
        s.name.toLowerCase() === cleanNameOrId ||
        s.name.toLowerCase().includes(cleanNameOrId)
      );

      if (foundStu) {
        updatedGrid[foundStu.id] = {
          ...updatedGrid[foundStu.id],
          paid: givenVal,
          due: targetVal ? targetVal : (updatedGrid[foundStu.id]?.due || activeProgram.defaultAmount.toString()),
          remarks: remarksVal ? remarksVal : (updatedGrid[foundStu.id]?.remarks || 'Parsed from bulk paste update')
        };
        parsedCount++;
      } else {
        failedCount++;
      }
    });

    setBulkGridDues(updatedGrid);
    setBulkPasteFeedback(`Successfully matched and updated ${parsedCount} students in grid sheet! (${failedCount} lines unrecognized or skipped)`);
    setBulkMode('grid'); // Switch back to grid to review the parsed amounts!
  };

  // Confirm delete program
  const handleConfirmDeleteProgram = async () => {
    if (!deletingProgramId) return;
    const ok = await onDeleteProgram(deletingProgramId);
    if (ok) {
      setDeletingProgramId(null);
      setSelectedProgramId(null);
      setActiveView('folders');
    }
  };

  // Remove individual student from current program (exclusion from folder)
  const handleRemoveStudentFromProgram = async (studentId: string) => {
    setRemovingStudentId(studentId);
  };

  const handleConfirmRemoveStudentFromProgram = async () => {
    if (!activeProgram || !removingStudentId) return;
    const curExcluded = activeProgram.excludedStudentIds || [];
    if (!curExcluded.includes(removingStudentId)) {
      const updatedProg = {
        ...activeProgram,
        excludedStudentIds: [...curExcluded, removingStudentId]
      };
      const ok = await onUpdateProgram(updatedProg);
      if (ok && showToast) {
        showToast("Member successfully removed from this campaign folder", "success");
      }
    }
    setRemovingStudentId(null);
  };

  // Bulk remove selected students from current program
  const handleBulkRemoveStudentsFromProgram = async () => {
    if (!activeProgram || selectedStudentIds.length === 0) return;
    setIsBulkRemoveConfirmOpen(true);
  };

  const handleConfirmBulkRemoveStudentsFromProgram = async () => {
    if (!activeProgram || selectedStudentIds.length === 0) return;
    const curExcluded = activeProgram.excludedStudentIds || [];
    const newExcluded = Array.from(new Set([...curExcluded, ...selectedStudentIds]));
    
    const updatedProg = {
      ...activeProgram,
      excludedStudentIds: newExcluded
    };
    const ok = await onUpdateProgram(updatedProg);
    if (ok) {
      setSelectedStudentIds([]);
      if (showToast) {
        showToast(`Successfully removed ${newExcluded.length - curExcluded.length} members from this campaign folder`, "success");
      }
    }
    setIsBulkRemoveConfirmOpen(false);
  };

  // Restore individual student back to current program
  const handleRestoreStudentToProgram = async (studentId: string) => {
    if (!activeProgram) return;
    const curExcluded = activeProgram.excludedStudentIds || [];
    const updatedProg = {
      ...activeProgram,
      excludedStudentIds: curExcluded.filter(id => id !== studentId)
    };
    const ok = await onUpdateProgram(updatedProg);
    if (ok && showToast) {
      showToast("Member restored to campaign folder successfully", "success");
    }
  };

  // Restore all excluded students back to current program
  const handleRestoreAllStudentsToProgram = async () => {
    if (!activeProgram) return;
    setIsRestoreAllConfirmOpen(true);
  };

  const handleConfirmRestoreAllStudentsToProgram = async () => {
    if (!activeProgram) return;
    const updatedProg = {
      ...activeProgram,
      excludedStudentIds: []
    };
    const ok = await onUpdateProgram(updatedProg);
    if (ok) {
      setIsRestoreModalOpen(false);
      if (showToast) {
        showToast("All members successfully restored to this campaign folder", "success");
      }
    }
    setIsRestoreAllConfirmOpen(false);
  };

  // Confirm delete master student
  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudentId) return;
    const ok = await onDeleteStudent(deletingStudentId);
    if (ok) {
      setDeletingStudentId(null);
    }
  };

  // Open edit master student
  const handleOpenEditMaster = (stu: Student) => {
    setEditingStudent(stu);
    setStudentId(stu.id);
    setStudentName(stu.name);
    setStudentClass(stu.className || 'QURAN DEPARTMENT');
    setStudentRemarks(stu.remarks || '');
    setIsAddStudentOpen(true);
  };

  // Quick preset actions for grid
  const applyPresetToGrid = (action: 'all-paid' | 'all-due-zero' | 'all-due-default' | 'all-due-custom', customVal?: string) => {
    const updatedGrid = { ...bulkGridDues };
    folderStudents.forEach(stu => {
      const current = updatedGrid[stu.id] || { paid: '0', due: activeProgram?.defaultAmount.toString() || '500', remarks: '' };
      if (action === 'all-paid') {
        updatedGrid[stu.id] = { ...current, paid: current.due };
      } else if (action === 'all-due-zero') {
        updatedGrid[stu.id] = { ...current, paid: '0' };
      } else if (action === 'all-due-default') {
        updatedGrid[stu.id] = { ...current, due: activeProgram?.defaultAmount.toString() || '500' };
      } else if (action === 'all-due-custom') {
        updatedGrid[stu.id] = { ...current, due: customVal || activeProgram?.defaultAmount.toString() || '500' };
      }
    });
    setBulkGridDues(updatedGrid);
  };

  return (
    <div className="space-y-6">
      
      {/* 🚀 Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="text-left">
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded">
            Student Division Ledger Sheets
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Users className="text-indigo-600 animate-pulse" size={24} />
            Class Program Contribution Drives
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isEditor
              ? "Manage student union contributions using customized drive folders. Maintain standard class rosters with distinct balance targets and double-entry syncs."
              : "View student union profiles and enrolled member registers."}
          </p>
        </div>

        {/* Global Toolbar and Folder Buttons - Only visible to editors */}
        <div className="grid grid-cols-2 gap-2 w-full md:flex md:flex-wrap md:items-center md:gap-2 md:w-auto">
          {isEditor && activeView !== 'folders' && (
            <button
              onClick={() => {
                setActiveView('folders');
                setSelectedProgramId(null);
              }}
              className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Folders</span>
            </button>
          )}

          {isEditor && activeView !== 'roster' && (
            <button
              onClick={() => {
                setActiveView('roster');
                setSelectedProgramId(null);
                setSearchTerm('');
              }}
              className="w-full justify-center inline-flex items-center gap-1.5 px-3.5 py-3 bg-slate-50 border border-gray-200 text-slate-600 hover:bg-slate-100 hover:text-slate-950 text-xs font-bold rounded-xl transition-all shadow-3xs cursor-pointer"
            >
              <ClipboardList size={13} className="text-slate-500" />
              <span>Manage Roster ({quranStudentsList.length})</span>
            </button>
          )}

          {isEditor && (
            <button
              onClick={() => {
                setEditingStudent(null);
                setStudentId(`ROLL-${101 + quranStudentsList.length}`);
                setStudentName('');
                setStudentClass('CLASS UNION');
                setStudentRemarks('');
                setIsAddStudentOpen(true);
              }}
              className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-slate-800 text-xs font-bold rounded-xl shadow-3xs transition-all cursor-pointer"
            >
              <UserPlus size={13} className="text-indigo-600" />
              <span>Enroll Student</span>
            </button>
          )}

          {isEditor && (
            <button
              onClick={() => setIsAddProgramOpen(true)}
              className="w-full justify-center inline-flex items-center gap-1.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-xs transition-colors cursor-pointer"
            >
              <FolderPlus size={13} />
              <span>New Drive Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* ⚠️ Empty Roster State */}
      {quranStudentsList.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-xl mx-auto my-6 space-y-4 shadow-3xs">
          <div className="p-3 bg-white border border-gray-150 rounded-2xl shadow-3xs text-slate-400">
            <Users size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-800">No Students Enrolled</h3>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              Your master registry is completely empty. You can now bulk enter your custom student list or enroll them sequentially.
            </p>
          </div>
          <button
            onClick={() => setIsRosterImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={13} />
            Bulk Enter Students
          </button>
        </div>
      )}

      {/* ======================= VIEW 1: DIRECTORY FOLDERS ======================= */}
      {activeView === 'folders' && isEditor && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-mono">
              📁 Active Drives Program Folders ({programs.length})
            </h3>
          </div>

          {programs.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-250 p-16 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
              <Folder className="mx-auto text-slate-200 animate-pulse" size={56} />
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-slate-800">No Program Folders Configured</h4>
                <p className="text-xs text-slate-400">
                  You do not have any sub-programs driving union dues yet. Add folder campaigns like Excursion, Ramadan Feast, or Annual day to separate dues metrics.
                </p>
              </div>
              <button
                onClick={() => setIsAddProgramOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                <FolderPlus size={13} />
                Create First Program Folder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
              {programs.map(prog => {
                const stat = folderStats[prog.id] || { totalRaised: 0, totalPending: 0, paidCount: 0, rate: 0 };
                return (
                  <motion.div
                    key={prog.id}
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-between hover:border-indigo-200 hover:shadow-xs transition-all relative overflow-hidden cursor-pointer"
                    onClick={() => {
                      setSelectedProgramId(prog.id);
                      setActiveView('program_details');
                    }}
                  >
                    {/* Top block */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                          <Folder size={20} className="fill-indigo-100" />
                        </div>
                        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-105">
                          ₹{prog.defaultAmount} / member
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600">
                          {prog.name}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono">
                          📅 Organized Date: {prog.date}
                        </p>
                        {prog.remarks && (
                          <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                            {prog.remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Lower stat metrics */}
                    <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="block text-gray-400 font-mono uppercase text-[9px] font-bold">Total Collected</span>
                          <span className="font-mono text-slate-900 font-bold">₹{stat.totalRaised.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-gray-400 font-mono uppercase text-[9px] font-bold">Outstandings</span>
                          <span className="font-mono text-rose-600 font-bold">₹{stat.totalPending.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-indigo-600 font-bold">{stat.paidCount} of {quranStudentsList.length} Settled</span>
                          <span className="text-slate-900 font-bold font-mono">{stat.rate}% Cleared</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${stat.rate}%` }} 
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end text-[10px] text-indigo-600 font-extrabold pt-1">
                        <span>Slide Open Sheet</span>
                        <ChevronRight size={10} className="mt-0.5" />
                      </div>
                    </div>

                    {/* Danger delete bucket */}
                    {isEditor && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProgramId(prog.id);
                        }}
                        className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-md transition-colors"
                        title="Delete program folder"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================= VIEW 2: MASTER ROSTER DIRECTORY ======================= */}
      {activeView === 'roster' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-150 p-5 rounded-2xl text-left flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-1.5">
                {isEditor ? <Sliders size={16} /> : <Users size={16} />}
                {isEditor ? "Student Roster Directory Control" : "Master Student Registry"}
              </h3>
              <p className="text-xs text-indigo-805 leading-relaxed">
                {isEditor
                  ? "Configure primary students and contact rolls for the Class Union. Additions or deletions automatically configure entries throughout existing drives folders!"
                  : "View and search students enrolled in the Class Union."}
              </p>
            </div>
            {isEditor && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearAllStudents}
                  disabled={isBulkStudentImporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-lg cursor-pointer shadow-xs hover:shadow-sm transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  Clear All Students
                </button>
                <button
                  onClick={() => setIsRosterImportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs hover:shadow-sm"
                >
                  <Plus size={12} />
                  Bulk Enter Students
                </button>
                <button
                  onClick={() => {
                    setActiveView('folders');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Back to Folders
                </button>
              </div>
            )}
          </div>

          {/* Roster Controls Search */}
          <div className="bg-white p-4 border border-gray-200 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="relative w-full md:max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search master students roll ID, full name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-slate-800 placeholder-gray-400 bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              Showing {filteredRows.length} of {quranStudentsList.length} roster profiles
            </span>
          </div>

          {/* Roster Table (Desktop View) */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-3xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 font-mono text-[10px] text-slate-505 font-bold uppercase">
                  <th className="p-4">Roll No / ID</th>
                  <th className="p-4">Student Name</th>
                  <th className="p-4">Particular Notes</th>
                  {isEditor && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-105">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={isEditor ? 4 : 3} className="p-12 text-slate-400 text-center">
                      <Users size={20} className="mx-auto mb-2 text-slate-300" />
                      <p>No master student records match query.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(stu => (
                    <tr key={stu.id} className="hover:bg-slate-50/50 leading-relaxed font-medium text-slate-600">
                      <td className="p-4 font-bold font-mono text-slate-900 uppercase">{stu.id}</td>
                      <td className="p-4 text-slate-900 font-semibold">{stu.name}</td>
                      <td className="p-4 text-slate-400 text-[11px]">{stu.remarks || <span className="italic text-gray-200">No remarks</span>}</td>
                      {isEditor && (
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditMaster(stu)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-md transition-colors"
                              title="Edit profile"
                            >
                              <Edit size={11} />
                            </button>
                            <button
                              onClick={() => setDeletingStudentId(stu.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 rounded-md transition-colors"
                              title="Delete profile"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Roster Cards (Mobile View) */}
          <div className="block md:hidden space-y-3">
            {filteredRows.length === 0 ? (
              <div className="bg-white p-8 text-center border border-gray-200 rounded-2xl text-slate-400">
                <Users size={20} className="mx-auto mb-2 text-slate-300" />
                <p>No master student records match query.</p>
              </div>
            ) : (
              filteredRows.map(stu => (
                <div key={stu.id} className="bg-white border border-gray-200 p-4 rounded-xl space-y-3 shadow-3xs">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-bold font-mono text-slate-400 block uppercase">{stu.id}</span>
                      <span className="font-bold text-slate-900 text-sm">{stu.name}</span>
                    </div>
                  </div>

                  {stu.remarks && (
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg">
                      {stu.remarks}
                    </div>
                  )}

                  {isEditor && (
                    <div className="flex gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMaster(stu)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 border border-indigo-200 hover:border-indigo-600 bg-indigo-50 hover:bg-indigo-600 text-indigo-750 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Edit size={12} /> Edit Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingStudentId(stu.id)}
                        className="px-3.5 py-2.5 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 bg-rose-50 hover:bg-rose-600 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                        title="Delete profile"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================= VIEW 3: PROGRAM SPECIFIC DUES ======================= */}
      {activeView === 'program_details' && activeProgram && (
        <div className="space-y-6 text-left">
          
          {/* Active Campaign Header Card */}
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="space-y-2 relative z-10">
              <button
                onClick={() => {
                  setActiveView('folders');
                  setSelectedProgramId(null);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:text-white bg-white/10 px-3 py-1.5 rounded-full transition-colors mb-2"
              >
                <ArrowLeft size={10} /> Back to Folders Directory
              </button>
              
              <div className="flex items-center gap-2">
                <Folder className="text-indigo-400 fill-indigo-950" size={20} />
                <h3 className="text-xl font-extrabold tracking-tight">{activeProgram.name}</h3>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300 font-mono text-[11px]">
                <span>📅 Organized On: {activeProgram.date}</span>
                <span>•</span>
                <span>🏷️ Target: ₹{activeProgram.defaultAmount} per member</span>
              </div>

              {activeProgram.remarks && (
                <p className="text-xs text-slate-400 max-w-xl italic pt-1 border-t border-white/5 mt-2">
                  ℹ️ {activeProgram.remarks}
                </p>
              )}
            </div>

            {/* Quick action buttons for active program details */}
            <div className="flex items-center gap-2 relative z-10 shrink-0">
              {isEditor && activeProgram.excludedStudentIds && activeProgram.excludedStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsRestoreModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  title="Restore students you removed from this campaign folder"
                >
                  <RefreshCw size={13} className="text-indigo-400" />
                  Restore Excluded ({activeProgram.excludedStudentIds.length})
                </button>
              )}
              {isEditor && (
                <button
                  onClick={handleOpenBulkEditor}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer hover:shadow-md"
                >
                  <FileSpreadsheet size={13} />
                  ⚡ Bulk Enter Dues
                </button>
              )}
              {isEditor && (
                <button
                  onClick={() => setDeletingProgramId(activeProgram.id)}
                  className="p-2.5 bg-white/10 hover:bg-rose-600 hover:text-white text-slate-300 rounded-xl transition-colors cursor-pointer"
                  title="Purge Program Folder"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Real-time stats panels for active program */}
          {isEditor && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center justify-between shadow-3xs hover:shadow-xs transition-shadow">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Drives Collected</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 font-mono">₹{currentProgramStats.raised.toLocaleString('en-IN')}</h3>
                  <span className="text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-0.5 mt-0.5">
                    <CheckCircle2 size={10} />
                    {currentProgramStats.rate}% collected
                  </span>
                </div>
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center justify-between shadow-3xs hover:shadow-xs transition-shadow">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Pending Balance</p>
                  <h3 className="text-2xl font-extrabold text-rose-600 font-mono">₹{currentProgramStats.pending.toLocaleString('en-IN')}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">From total ₹{currentProgramStats.target} schedule</p>
                </div>
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <DollarSign size={16} />
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center justify-between shadow-3xs hover:shadow-xs transition-shadow">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono font-mono">Fully Paid Members</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 font-mono">{currentProgramStats.paid} <span className="text-xs text-slate-400">/ {quranStudentsList.length}</span></h3>
                  <p className="text-[10px] text-slate-400 font-mono">Cleared entire individual dues</p>
                </div>
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center justify-between shadow-3xs hover:shadow-xs transition-shadow">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono font-mono">Partially Paid / Unpaid</p>
                  <h3 className="text-2xl font-extrabold text-amber-600 font-mono">{currentProgramStats.partial} <span className="text-slate-400 text-xs">Partial</span> / {currentProgramStats.unpaid} <span className="text-slate-400 text-xs">Unpaid</span></h3>
                  <p className="text-[10px] text-slate-405 font-medium flex items-center gap-0.5">
                    <AlertCircle size={10} className="text-amber-500" /> Need collection followups
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <Sliders size={16} />
                </div>
              </div>

            </div>
          )}

          {/* Directory Navigation Controls / Search */}
          <div className="bg-white p-4 border border-gray-200 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-3">
            
            <div className="relative w-full md:max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search student ledger rows by name, ID roll, remarks notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-slate-800 placeholder-gray-400 bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-400 font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <div className="flex items-center gap-1 border border-gray-200 bg-gray-50 rounded-xl px-2.5 py-1 text-slate-505 font-bold">
                <Filter size={11} />
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer pr-1 border-none font-bold"
                >
                  <option value="All">All Dues Status</option>
                  <option value="Paid">Fully Paid</option>
                  <option value="Partial">Partially Paid</option>
                  <option value="Pending">Unpaid / Pending</option>
                </select>
              </div>
            </div>

          </div>

          {/* Bulk management warning/action bar */}
          {isEditor && selectedStudentIds.length > 0 && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 shadow-3xs animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold text-rose-900">Campaign Management Selection Active</h4>
                  <p className="text-[10px] text-rose-700">You have checked {selectedStudentIds.length} members to bulk exclude/remove from {activeProgram?.name || 'this campaign'}.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-705 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-3xs"
                >
                  Cancel Selection
                </button>
                <button
                  type="button"
                  onClick={handleBulkRemoveStudentsFromProgram}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-3xs cursor-pointer"
                >
                  <Trash2 size={12} />
                  Bulk Delete/Remove Exclude ({selectedStudentIds.length})
                </button>
              </div>
            </div>
          )}

          {/* Interactive Dues Table (Desktop View) */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-3xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 font-mono text-[10px] text-slate-505 font-bold uppercase select-none">
                    {isEditor && (
                      <th className="p-4 w-11 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = filteredRows.length > 0 && filteredRows.every(row => selectedStudentIds.includes(row.student.id));
                            if (allSelected) {
                              setSelectedStudentIds([]);
                            } else {
                              setSelectedStudentIds(filteredRows.map(row => row.student.id));
                            }
                          }}
                          className="text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none flex items-center justify-center mx-auto"
                          title="Select / Deselect all visible student rows"
                        >
                          {filteredRows.length > 0 && filteredRows.every(row => selectedStudentIds.includes(row.student.id)) ? (
                            <CheckSquare size={14} className="text-indigo-600" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => requestSort('id')}>
                      Roll No / ID {sortBy === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => requestSort('name')}>
                      Member Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 text-right" onClick={() => requestSort('paid')}>
                      Drive Given (Dr) {sortBy === 'paid' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-2 text-center">Collection Progress</th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 text-right" onClick={() => requestSort('remaining')}>
                      Outstanding Balance {sortBy === 'remaining' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4">Paid Date / Tracking Remarks</th>
                    {isEditor && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={isEditor ? 9 : 7} className="p-12 text-slate-400 text-center">
                        <Users size={20} className="mx-auto mb-2 text-slate-300" />
                        <p>No student payments found matching your filter selection.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const balance = Math.max(0, row.dues.totalDue - row.dues.amountPaid);
                      const pct = row.dues.totalDue > 0 ? Math.min(100, Math.round((row.dues.amountPaid / row.dues.totalDue) * 100)) : 0;
                      const isSelected = selectedStudentIds.includes(row.student.id);
                      
                      return (
                        <tr 
                          key={row.student.id} 
                          className={`leading-relaxed font-semibold text-slate-600 transition-colors ${
                            isSelected 
                              ? 'bg-rose-50/20 hover:bg-rose-50/35 border-l-2 border-l-rose-500' 
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          {isEditor && (
                            <td className="p-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentIds(prev => 
                                    isSelected ? prev.filter(id => id !== row.student.id) : [...prev, row.student.id]
                                  );
                                }}
                                className="text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none flex items-center justify-center mx-auto"
                              >
                                {isSelected ? (
                                  <CheckSquare size={14} className="text-indigo-600" />
                                ) : (
                                  <Square size={14} />
                                )}
                              </button>
                            </td>
                          )}

                          {/* ID */}
                          <td className="p-4 font-bold font-mono text-slate-900 uppercase">
                            {row.student.id}
                          </td>

                          {/* Name */}
                          <td className="p-4 text-slate-900 font-bold">
                            <div>
                              <span>{row.student.name}</span>
                            </div>
                          </td>

                          {/* Paid quantity */}
                          <td className="p-4 text-right text-slate-950 font-mono font-bold">
                            ₹{row.dues.amountPaid.toLocaleString('en-IN')}
                          </td>

                          {/* Progress bar */}
                          <td className="p-2 text-center">
                            <div className="flex flex-col items-center gap-1 max-w-[100px] mx-auto text-[9px] font-mono">
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    row.dues.status === 'Paid' ? 'bg-emerald-500' :
                                    row.dues.status === 'Partial' ? 'bg-amber-500' :
                                    'bg-slate-200'
                                  }`} 
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-slate-405 font-bold font-mono">{pct}% given</span>
                            </div>
                          </td>

                          {/* Balance remaining */}
                          <td className={`p-4 text-right font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {balance > 0 ? `₹${balance.toLocaleString('en-IN')}` : '₹0 (Settled)'}
                          </td>

                          {/* Badge */}
                          <td className="p-2 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                              row.dues.status === 'Paid' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                                : row.dues.status === 'Partial' 
                                ? 'bg-amber-50 text-amber-700 border-amber-150' 
                                : 'bg-rose-50 text-rose-700 border-rose-150'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${
                                row.dues.status === 'Paid' ? 'bg-emerald-500 shadow-emerald-400' :
                                row.dues.status === 'Partial' ? 'bg-amber-500 shadow-amber-400' :
                                'bg-rose-500 shadow-rose-400'
                              }`} />
                              {row.dues.status}
                            </span>
                          </td>

                          {/* Remarks */}
                          <td className="p-4 max-w-xs text-slate-400 text-[11px] truncate" title={row.dues.remarks}>
                            {row.dues.lastPaymentDate && (
                              <span className="block text-[10px] font-mono font-bold text-slate-705">📅 Last pay: {row.dues.lastPaymentDate}</span>
                            )}
                            {row.dues.remarks || <span className="text-gray-200 italic">No notes</span>}
                          </td>

                          {/* Pay & deletion actions */}
                          {isEditor && (
                            <td className="p-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                {balance > 0 ? (
                                  <button
                                    onClick={() => handleSelectPayStudent(row.student.id, row.dues)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-md text-[10px] font-extrabold cursor-pointer transition-all shadow-3xs"
                                  >
                                    <CreditCard size={10} /> Record Pay
                                  </button>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-100/50 rounded-md flex items-center gap-0.5 flex-row">
                                    <Check size={11} /> Settled
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStudentFromProgram(row.student.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 hover:border-rose-300 rounded-md transition-colors cursor-pointer shadow-3xs"
                                  title="Remove student from this campaign folder"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          )}

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Dues Cards (Mobile View) */}
          <div className="block md:hidden space-y-3">
            {filteredRows.length === 0 ? (
              <div className="bg-white p-8 text-center border border-gray-200 rounded-2xl text-slate-400 shadow-3xs">
                <Users size={20} className="mx-auto mb-2 text-slate-300" />
                <p>No student payments found matching your filter selection.</p>
              </div>
            ) : (
              filteredRows.map((row) => {
                const balance = Math.max(0, row.dues.totalDue - row.dues.amountPaid);
                const pct = row.dues.totalDue > 0 ? Math.min(100, Math.round((row.dues.amountPaid / row.dues.totalDue) * 100)) : 0;
                const isSelected = selectedStudentIds.includes(row.student.id);
                
                return (
                  <div 
                    key={row.student.id} 
                    className={`bg-white border p-4 rounded-xl space-y-3 shadow-3xs transition-colors ${
                      isSelected 
                        ? 'border-rose-300 bg-rose-50/10' 
                        : 'border-gray-200'
                    }`}
                  >
                    {/* Header: ID, Name, Badge, Select checkbox */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isEditor && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentIds(prev => 
                                isSelected ? prev.filter(id => id !== row.student.id) : [...prev, row.student.id]
                              );
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none flex items-center justify-center"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-indigo-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        )}
                        <div>
                          <span className="text-[10px] font-bold font-mono text-slate-400 block uppercase">{row.student.id}</span>
                          <span className="font-bold text-slate-900 text-sm leading-snug block">{row.student.name}</span>
                        </div>
                      </div>
                      
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full border shrink-0 ${
                        row.dues.status === 'Paid' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                          : row.dues.status === 'Partial' 
                          ? 'bg-amber-50 text-amber-700 border-amber-150' 
                          : 'bg-rose-50 text-rose-700 border-rose-150'
                      }`}>
                        {row.dues.status}
                      </span>
                    </div>

                    {/* Financial stats row */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Given (Dr)</span>
                        <span className="font-mono font-extrabold text-slate-950 text-sm">₹{row.dues.amountPaid.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Remaining (Cr)</span>
                        <span className={`font-mono font-extrabold text-sm ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ₹{balance.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Progress slider */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            row.dues.status === 'Paid' ? 'bg-emerald-500' :
                            row.dues.status === 'Partial' ? 'bg-amber-500' :
                            'bg-slate-200'
                          }`} 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-slate-400 font-bold">
                        <span>{pct}% Collected</span>
                        <span>Target: ₹{row.dues.totalDue.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Remarks and metadata */}
                    {(row.dues.lastPaymentDate || row.dues.remarks) && (
                      <div className="text-[10px] border-t border-slate-100 pt-2 text-slate-400 leading-normal space-y-0.5">
                        {row.dues.lastPaymentDate && (
                          <div>📅 Last pay: <span className="font-bold text-slate-705">{row.dues.lastPaymentDate}</span></div>
                        )}
                        {row.dues.remarks && (
                          <div className="italic text-slate-500">“{row.dues.remarks}”</div>
                        )}
                      </div>
                    )}

                    {/* Actions panel */}
                    {isEditor && (
                      <div className="flex gap-2 pt-1 border-t border-slate-100">
                        {balance > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleSelectPayStudent(row.student.id, row.dues)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold cursor-pointer transition-all shadow-3xs"
                          >
                            <CreditCard size={12} /> Record Pay
                          </button>
                        ) : (
                          <div className="flex-1 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-emerald-150">
                            <Check size={12} /> Balance Settled
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveStudentFromProgram(row.student.id)}
                          className="px-3 py-2.5 text-slate-405 hover:text-rose-605 hover:bg-rose-50 border border-slate-205 hover:border-rose-205 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                          title="Remove student from this campaign folder"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Double entry automation helper reference */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-col md:flex-row gap-4 text-xs select-none">
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <HelpCircle size={16} />
            </div>
            <div className="space-y-1 text-indigo-800">
              <h4 className="font-bold uppercase tracking-wider text-[10px]">How program dues affect general union double-entry journals:</h4>
              <p className="leading-relaxed">
                When you click <strong>Record Pay</strong> inside a folder campaign, you can automatically submit balanced journal entries into the central books. Toggling the auto-post checkout posts a debit increase in Cash/Bank and a matching credit in Union Dues Income synchronously under a custom auditable narration naming the member!
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ======================= MODAL A: CREATE NEW PROGRAM ======================= */}
      <AnimatePresence>
        {isAddProgramOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderPlus className="text-indigo-600" size={18} />
                  <h3 className="text-sm font-extrabold text-slate-800">Create Program Folder Drive</h3>
                </div>
                <button onClick={() => setIsAddProgramOpen(false)} className="p-1 hover:bg-gray-150 rounded-lg text-slate-400">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateProgram} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1">Program / Folder Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramadan Fest Contribution, Annual Tour"
                    value={newProgramName}
                    onChange={(e) => setNewProgramName(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white text-slate-900 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1">Standard target (₹) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newProgramAmt}
                      onChange={(e) => setNewProgramAmt(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white text-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1">Drive Date *</label>
                    <input
                      type="date"
                      required
                      value={newProgramDate}
                      onChange={(e) => setNewProgramDate(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white text-slate-900 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1">Drive Description / Particular notes</label>
                  <textarea
                    placeholder="Particular aims for collections, scopes and deadlines..."
                    rows={3}
                    value={newProgramDesc}
                    onChange={(e) => setNewProgramDesc(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white text-slate-900 font-medium resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddProgramOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-205 rounded-xl text-slate-705 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    Create and Initialize drive
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= MODAL B: MASTER ROSTER EDIT/CREATE STUDENT ======================= */}
      <AnimatePresence>
        {isAddStudentOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="text-indigo-600" size={18} />
                  <h3 className="text-sm font-extrabold text-slate-800">
                    {editingStudent ? 'Modify Student Directory Record' : 'Enroll New Quran Class Member'}
                  </h3>
                </div>
                <button onClick={() => setIsAddStudentOpen(false)} className="p-1 hover:bg-gray-150 rounded-lg text-slate-400">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitMasterStudent} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-wider font-mono mb-1">Roll No / ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. QURAN-101"
                    disabled={!!editingStudent}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full p-2 bg-gray-50 text-xs border border-gray-205 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white text-slate-900 font-bold uppercase disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1">Complete Student Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jaseel Rahman V.P"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full p-2 bg-gray-50 text-xs border border-gray-205 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1">Roster Notes / Remarks</label>
                  <textarea
                    placeholder="Particular remarks regarding student (e.g. ward leader, scholarship candidate)..."
                    rows={2}
                    value={studentRemarks}
                    onChange={(e) => setStudentRemarks(e.target.value)}
                    className="w-full p-2 bg-gray-50 text-xs border border-gray-205 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white text-slate-900 font-medium resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddStudentOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    {editingStudent ? 'Apply Updates' : 'Add Student'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= MODAL C: SPREADSHEET MATRIX BULK dues ENTERING ======================= */}
      <AnimatePresence>
        {isBulkEnterOpen && activeProgram && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.98, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 15 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left"
            >
              
              {/* Header */}
              <div className="p-5 border-b border-gray-150 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="text-emerald-600" size={20} />
                    <h3 className="text-sm font-bold text-slate-800">
                      ⚡ Quick Spreadsheet Matrix Bulk Entry: <span className="text-emerald-705 font-extrabold">{activeProgram.name}</span>
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Directly type given collections and dues targets for the <span className="font-extrabold text-emerald-800">{folderStudents.length} campaign folder students</span>. Tab or click into boxes, change numbers, and hit apply to write updates instantly to Firestore.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBulkMode('grid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold leading-relaxed cursor-pointer ${
                      bulkMode === 'grid' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Guided Spreadsheet Grid
                  </button>
                  <button
                    onClick={() => setBulkMode('paste')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold leading-relaxed cursor-pointer ${
                      bulkMode === 'paste' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Quick-Paste Parser
                  </button>
                  <button onClick={() => setIsBulkEnterOpen(false)} className="p-1 hover:bg-gray-200 rounded-lg text-slate-400">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Grid presets bar */}
              {bulkMode === 'grid' && (
                <div className="bg-emerald-50/50 border-b border-emerald-101 px-6 py-3 flex flex-wrap justify-between items-center gap-3 shrink-0 text-left">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-900">
                    <Info size={12} className="text-emerald-600" />
                    <span>Speed Actions Toolbar:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyPresetToGrid('all-paid')}
                      className="px-2.5 py-1 text-[10px] bg-emerald-600 text-white rounded-md font-bold cursor-pointer hover:bg-emerald-700"
                    >
                      Clear Dues (Set All Given = Target Dues)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetToGrid('all-due-zero')}
                      className="px-2.5 py-1 text-[10px] bg-slate-200 hover:bg-slate-250 text-slate-700 rounded-md font-bold cursor-pointer"
                    >
                      Reset Given Amounts (Set All Given = 0)
                    </button>
                    <div className="flex items-center gap-1.5 border border-emerald-100 bg-white px-2 py-0.5 rounded-lg shadow-3xs">
                      <span className="text-[10px] font-bold text-slate-500">Set All Targets:</span>
                      <input
                        type="number"
                        min="0"
                        value={bulkTargetAmount}
                        onChange={(e) => setBulkTargetAmount(e.target.value)}
                        className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-[10px] font-bold text-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder={activeProgram.defaultAmount.toString()}
                      />
                      <button
                        type="button"
                        onClick={() => applyPresetToGrid('all-due-custom', bulkTargetAmount)}
                        className="px-2 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold cursor-pointer transition-colors"
                        title="Bulk set all student target amounts"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Content panels */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50/30">
                {bulkPasteFeedback && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-150 text-emerald-850 font-bold rounded-xl text-xs">
                    💡 {bulkPasteFeedback}
                  </div>
                )}

                {/* Mode Grid: Editable spreadsheet-like roster list */}
                {bulkMode === 'grid' && (
                  <>
                    {/* Desktop View */}
                    <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs table-fixed">
                        <thead className="sticky top-0 bg-slate-50 border-b border-gray-200 shadow-3xs z-10 font-mono text-[10px] text-slate-505 font-bold uppercase">
                          <tr>
                            <th className="p-3 w-[110px]">Roll No</th>
                            <th className="p-3 w-[190px]">Student Name</th>
                            <th className="p-3 w-[140px] text-right">Given Amount (₹)</th>
                            <th className="p-3 w-[140px] text-right">Total Due Target (₹)</th>
                            <th className="p-3">Remarks Notes for Drive</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-105">
                          {folderStudents.map((stu, idx) => {
                            const state = bulkGridDues[stu.id] || { paid: '0', due: activeProgram.defaultAmount.toString(), remarks: '' };
                            
                            return (
                              <tr key={stu.id} className="hover:bg-slate-50/50 leading-none">
                                <td className="p-2 font-mono font-bold text-slate-900 text-left uppercase truncate">{stu.id}</td>
                                <td className="p-2 text-slate-900 font-bold truncate text-left">{stu.name}</td>
                                
                                {/* Given paid input */}
                                <td className="p-1">
                                  <input
                                    type="number"
                                    min={0}
                                    value={state.paid}
                                    onChange={(e) => {
                                      setBulkGridDues(prev => ({
                                        ...prev,
                                        [stu.id]: { ...state, paid: e.target.value }
                                      }));
                                    }}
                                    className="w-full p-2 bg-gray-50 border border-transparent hover:border-gray-300 focus:bg-white focus:border-indigo-400 font-mono font-bold text-xs text-right text-indigo-700 outline-none rounded-lg"
                                  />
                                </td>

                                {/* Due Target target dues */}
                                <td className="p-1">
                                  <input
                                    type="number"
                                    min={0}
                                    value={state.due}
                                    onChange={(e) => {
                                      setBulkGridDues(prev => ({
                                        ...prev,
                                        [stu.id]: { ...state, due: e.target.value }
                                      }));
                                    }}
                                    className="w-full p-2 bg-gray-50 border border-transparent hover:border-gray-300 focus:bg-white focus:border-indigo-400 font-mono font-bold text-xs text-right text-slate-800 outline-none rounded-lg"
                                  />
                                </td>

                                {/* Remarks notes */}
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={state.remarks}
                                    placeholder="e.g. Collected cash receipt, Paid GPay"
                                    onChange={(e) => {
                                      setBulkGridDues(prev => ({
                                        ...prev,
                                        [stu.id]: { ...state, remarks: e.target.value }
                                      }));
                                    }}
                                    className="w-full p-2 bg-gray-50 border border-transparent hover:border-gray-300 focus:bg-white focus:border-indigo-400 text-xs text-slate-700 outline-none rounded-lg"
                                  />
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View */}
                    <div className="block md:hidden space-y-3">
                      {folderStudents.map((stu, idx) => {
                        const state = bulkGridDues[stu.id] || { paid: '0', due: activeProgram.defaultAmount.toString(), remarks: '' };
                        return (
                          <div key={stu.id} className="bg-white border border-gray-200 p-4 rounded-xl space-y-3.5 shadow-3xs text-left">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{stu.id}</span>
                              <span className="font-extrabold text-slate-900 text-xs truncate max-w-[200px]">{stu.name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-extrabold mb-1">Given Amount (₹)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={state.paid}
                                  onChange={(e) => {
                                    setBulkGridDues(prev => ({
                                      ...prev,
                                      [stu.id]: { ...state, paid: e.target.value }
                                    }));
                                  }}
                                  className="w-full p-2.5 bg-gray-50 border border-gray-200 font-mono font-bold text-xs text-indigo-700 outline-none rounded-lg focus:bg-white focus:border-indigo-400"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-extrabold mb-1">Target Due (₹)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={state.due}
                                  onChange={(e) => {
                                    setBulkGridDues(prev => ({
                                      ...prev,
                                      [stu.id]: { ...state, due: e.target.value }
                                    }));
                                  }}
                                  className="w-full p-2.5 bg-gray-50 border border-gray-200 font-mono font-bold text-xs text-slate-800 outline-none rounded-lg focus:bg-white focus:border-indigo-400"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-extrabold mb-1">Tracking Remarks</label>
                              <input
                                type="text"
                                value={state.remarks}
                                placeholder="e.g. Collected cash receipt, Paid GPay"
                                onChange={(e) => {
                                  setBulkGridDues(prev => ({
                                    ...prev,
                                    [stu.id]: { ...state, remarks: e.target.value }
                                  }));
                                }}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 text-xs text-slate-700 outline-none rounded-lg focus:bg-white focus:border-indigo-400 font-semibold"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Mode Paste: Raw text parsing block */}
                {bulkMode === 'paste' && (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-2xl text-xs text-indigo-900 space-y-2 leading-relaxed">
                      <h4 className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Sparkles size={12} />
                        How to Paste Whatsapp/Excel Columns inside Drive campaign:
                      </h4>
                      <p>
                        Paste student collection lists in rows. The parser automatically looks up student ID rolls or names (using fuzzy searching matching) and updates the matching grid spreadsheet.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 font-mono text-[10px] bg-indigo-100/40 p-3 rounded-xl border border-indigo-150">
                        <div>
                          <p className="font-bold underline text-indigo-950">Option 1: Comma/Tab Separated</p>
                          <p>RollNo, DuesPaid, TargetDue, Remarks</p>
                          <p className="text-slate-500 italic mt-1 leading-relaxed">
                            QURAN-101, 250, 500, Paid GPay<br />
                            Yoonus Chr, 500, 500, Cash
                          </p>
                        </div>
                        <div>
                          <p className="font-bold underline text-indigo-950">Option 2: Name & Number Separator</p>
                          <p>Student_Name Given_Amount</p>
                          <p className="text-slate-500 italic mt-1 leading-relaxed">
                            Aisha Jabeen 300<br />
                            Bilal Rabah 500
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                        Copy-paste Roster collections (One per line)
                      </label>
                      <textarea
                        required
                        placeholder="QURAN-101, 500, 500, Paid GPay&#10;Fasel Rahman, 200, 500, Installment 1&#10;Aisha Jabeen 500&#10;Muhammad Shafi: 300"
                        rows={11}
                        value={bulkPasteInput}
                        onChange={(e) => setBulkPasteInput(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-250 hover:bg-white focus:bg-white focus:ring-1 focus:ring-indigo-400 font-mono text-xs text-slate-905 outline-none rounded-2xl resize-none leading-relaxed shadow-3xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleParsePasteBulk}
                      disabled={!bulkPasteInput.trim()}
                      className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-705 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Analyze & Parse Paste Lines into Spreadsheet Grid
                    </button>
                  </div>
                )}

              </div>

              {/* Footer actions with auto-journal integration */}
              <div className="p-5 border-t border-gray-150 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
                <div className="flex flex-col gap-2 w-full md:w-auto text-left">
                  {/* Automatic Journal Sync Options */}
                  <div className="flex flex-col gap-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl w-full">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={bulkPostJournal}
                          onChange={(e) => setBulkPostJournal(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Auto-post incremental payments to General Ledger</span>
                      </label>

                      {bulkPostJournal && (
                        <div className="flex bg-indigo-100 p-0.5 rounded-lg text-[9px] font-semibold font-mono justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setBulkIsCompound(false);
                              if (bulkCompDebits[0]?.accountId) setBulkDebitAcc(bulkCompDebits[0].accountId);
                              if (bulkCompCredits[0]?.accountId) setBulkCreditAcc(bulkCompCredits[0].accountId);
                            }}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              !bulkIsCompound ? 'bg-white text-indigo-950 shadow-xs' : 'text-indigo-700'
                            }`}
                          >
                            Standard
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBulkIsCompound(true);
                              const currentGridTotal = (Object.values(bulkGridDues) as any[]).reduce((sum: number, item: any) => sum + (parseFloat(item.paid) || 0), 0);
                              setBulkCompDebits([{ accountId: bulkDebitAcc, amount: currentGridTotal ? currentGridTotal.toString() : '' }]);
                              setBulkCompCredits([{ accountId: bulkCreditAcc, amount: currentGridTotal ? currentGridTotal.toString() : '' }]);
                            }}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              bulkIsCompound ? 'bg-white text-indigo-950 shadow-xs' : 'text-indigo-700'
                            }`}
                          >
                            Compound
                          </button>
                        </div>
                      )}
                    </div>

                    {bulkPostJournal && (
                      <div className="mt-2 pt-2 border-t border-indigo-100/50">
                        {bulkIsCompound ? (
                          <div className="space-y-3.5 text-[10px] font-mono leading-none">
                            <div className="grid grid-cols-2 gap-4 text-left">
                              {/* Debits */}
                              <div className="space-y-1.5 align-left">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">Debit Legs (Dr)</span>
                                  <button
                                    type="button"
                                    onClick={() => setBulkCompDebits([...bulkCompDebits, { accountId: '', amount: '' }])}
                                    className="text-[9px] text-emerald-600 font-bold hover:underline"
                                  >
                                    + Debit
                                  </button>
                                </div>
                                {bulkCompDebits.map((db, idx) => (
                                  <div key={idx} className="flex gap-1 items-center">
                                    <select
                                      required
                                      value={db.accountId}
                                      onChange={(e) => {
                                        const updated = [...bulkCompDebits];
                                        updated[idx].accountId = e.target.value;
                                        setBulkCompDebits(updated);
                                      }}
                                      className="flex-1 p-1 border border-indigo-150 rounded bg-white text-[9px]"
                                    >
                                      <option value="">Select Debit Account...</option>
                                      {groupedAccounts.map(([groupName, items]) => (
                                        <optgroup key={groupName} label={groupName} className="font-bold text-gray-700">
                                          {items.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="Amt"
                                      required
                                      value={db.amount}
                                      onChange={(e) => {
                                        const updated = [...bulkCompDebits];
                                        updated[idx].amount = e.target.value;
                                        setBulkCompDebits(updated);
                                      }}
                                      className="w-14 p-1 border border-indigo-150 rounded bg-white text-[9px] font-mono"
                                    />
                                    {bulkCompDebits.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setBulkCompDebits(bulkCompDebits.filter((_, i) => i !== idx))}
                                        className="text-rose-500 hover:text-rose-700 font-bold"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Credits */}
                              <div className="space-y-1.5 align-left">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">Credit Legs (Cr)</span>
                                  <button
                                    type="button"
                                    onClick={() => setBulkCompCredits([...bulkCompCredits, { accountId: '', amount: '' }])}
                                    className="text-[9px] text-rose-600 font-bold hover:underline"
                                  >
                                    + Credit
                                  </button>
                                </div>
                                {bulkCompCredits.map((cr, idx) => (
                                  <div key={idx} className="flex gap-1 items-center">
                                    <select
                                      required
                                      value={cr.accountId}
                                      onChange={(e) => {
                                        const updated = [...bulkCompCredits];
                                        updated[idx].accountId = e.target.value;
                                        setBulkCompCredits(updated);
                                      }}
                                      className="flex-1 p-1 border border-indigo-150 rounded bg-white text-[9px]"
                                    >
                                      <option value="">Select Credit Account...</option>
                                      {groupedAccounts.map(([groupName, items]) => (
                                        <optgroup key={groupName} label={groupName} className="font-bold text-gray-700">
                                          {items.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="Amt"
                                      required
                                      value={cr.amount}
                                      onChange={(e) => {
                                        const updated = [...bulkCompCredits];
                                        updated[idx].amount = e.target.value;
                                        setBulkCompCredits(updated);
                                      }}
                                      className="w-14 p-1 border border-indigo-150 rounded bg-white text-[9px] font-mono"
                                    />
                                    {bulkCompCredits.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setBulkCompCredits(bulkCompCredits.filter((_, i) => i !== idx))}
                                        className="text-rose-500 hover:text-rose-700 font-bold"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Balancing Checker */}
                            {(() => {
                              const dbTotal = bulkCompDebits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                              const crTotal = bulkCompCredits.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                              const isBalanced = Math.abs(dbTotal - crTotal) <= 0.01;

                              // Calculate current spreadsheet total
                              const gridTotal = (Object.values(bulkGridDues) as any[]).reduce((sum: number, item: any) => sum + (parseFloat(item.paid) || 0), 0);
                              const matchesGrid = Math.abs(dbTotal - gridTotal) <= 0.01;

                              return (
                                <div className={`p-2 rounded text-[9px] font-mono leading-tight flex justify-between items-center text-left ${
                                  isBalanced && matchesGrid ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                                }`}>
                                  <div>
                                    <span className="font-bold">Dr: ₹{dbTotal.toFixed(2)} | Cr: ₹{crTotal.toFixed(2)}</span>
                                    <span className="ml-2 opacity-75">(Campaign total: ₹{gridTotal.toFixed(2)})</span>
                                  </div>
                                  <div className="font-bold">
                                    {!isBalanced ? `Unbalanced! (Diff: ₹${Math.abs(dbTotal - crTotal).toFixed(2)})` : !matchesGrid ? 'Mismatches Campaign Sum' : 'Balanced & Valid'}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] font-mono">
                            <select
                              required={bulkPostJournal}
                              value={bulkDebitAcc}
                              onChange={(e) => setBulkDebitAcc(e.target.value)}
                              className="p-1 px-1.5 border border-gray-300 rounded bg-white text-[11px] font-mono outline-none focus:border-indigo-400 font-bold text-slate-800"
                            >
                              <option value="">Dr - Select Debit Account...</option>
                              {groupedAccounts.map(([groupName, items]) => (
                                <optgroup key={groupName} label={groupName} className="font-bold text-gray-700">
                                  {items.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <span className="text-gray-400 font-bold">⇄</span>
                            <select
                              required={bulkPostJournal}
                              value={bulkCreditAcc}
                              onChange={(e) => setBulkCreditAcc(e.target.value)}
                              className="p-1 px-1.5 border border-gray-300 rounded bg-white text-[11px] font-mono outline-none focus:border-indigo-400 font-bold text-slate-800"
                            >
                              <option value="">Cr - Select Credit Account...</option>
                              {groupedAccounts.map(([groupName, items]) => (
                                <optgroup key={groupName} label={groupName} className="font-bold text-gray-700">
                                  {items.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Informational tip */}
                  <span className="text-[10px] font-medium text-slate-400">
                    💡 The total given amount across all students is dynamically recorded directly to the general ledger.
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsBulkEnterOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBulkGrid}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer hover:shadow-md"
                    title="Record pay and save database"
                  >
                    <CreditCard size={12} />
                    Record Pay
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= MODAL D: RECORD FEE PAYMENT COLLECTOR ======================= */}
      <AnimatePresence>
        {payingStudentId && activeProgram && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-155 bg-emerald-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-800">
                  <CreditCard className="text-emerald-750" size={18} />
                  <h3 className="text-xs font-bold">
                    Record Pay: {quranStudentsList.find(s => s.id === payingStudentId)?.name || 'Student'}
                  </h3>
                </div>
                <button onClick={() => setPayingStudentId(null)} className="p-1 hover:bg-emerald-100/50 rounded-lg text-slate-400">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleRecordProgramPay} className="p-6 space-y-4 text-left">
                
                {/* Existing Dues Indicator */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-[11px] font-mono text-slate-505 font-bold">
                  <div>
                    <span className="block text-gray-400 font-sans font-bold text-[9px] uppercase tracking-wider">Scheduled Target Dues</span>
                    <span className="text-xs text-slate-850 font-mono">₹{activeProgram.studentDues[payingStudentId]?.totalDue || activeProgram.defaultAmount}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-sans font-bold text-[9px] uppercase tracking-wider">Paid So Far</span>
                    <span className="text-xs text-slate-950 font-mono">₹{activeProgram.studentDues[payingStudentId]?.amountPaid || 0}</span>
                  </div>
                </div>

                {/* Amount Paid */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1">Receipt collection amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={
                      Math.max(0, (activeProgram.studentDues[payingStudentId]?.totalDue || activeProgram.defaultAmount) - (activeProgram.studentDues[payingStudentId]?.amountPaid || 0))
                    }
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 font-mono font-bold text-slate-900 border border-gray-205 focus:bg-white focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 text-lg outline-none rounded-xl"
                  />
                  <p className="text-[10px] text-emerald-600 font-mono font-bold mt-1">
                    Outstanding balance: ₹{Math.max(0, (activeProgram.studentDues[payingStudentId]?.totalDue || activeProgram.defaultAmount) - (activeProgram.studentDues[payingStudentId]?.amountPaid || 0))}
                  </p>
                </div>

                {/* Pay Remarks */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1">Narration Particular note</label>
                  <input
                    type="text"
                    required
                    value={payRemarks}
                    onChange={(e) => setPayRemarks(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 text-xs text-slate-900 font-bold rounded-xl"
                  />
                </div>

                {/* Automatically Post Double Entry */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl space-y-3.5 font-sans">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payPostJournal}
                      onChange={(e) => setPayPostJournal(e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                        Post as Balanced Journal Entry
                        <ShieldCheck size={13} className="text-indigo-600" />
                      </span>
                      <span className="block text-[10px] text-slate-450 leading-relaxed mt-0.5">
                        Post balanced general ledger receipt synchronously in central union ledger books.
                      </span>
                    </div>
                  </label>

                  {payPostJournal && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3.5 pt-3 border-t border-indigo-100"
                    >
                      {/* Entry format toggle */}
                      <div className="flex bg-indigo-100 p-0.5 rounded-lg text-[10px] font-semibold font-mono justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setPayIsCompound(false);
                            if (payCompDebits[0]?.accountId) setPayDebitAcc(payCompDebits[0].accountId);
                            if (payCompCredits[0]?.accountId) setPayCreditAcc(payCompCredits[0].accountId);
                          }}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            !payIsCompound ? 'bg-white text-indigo-950 shadow-xs' : 'text-indigo-700'
                          }`}
                        >
                          Standard
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPayIsCompound(true);
                            setPayCompDebits([{ accountId: payDebitAcc, amount: payAmount }]);
                            setPayCompCredits([{ accountId: payCreditAcc, amount: payAmount }]);
                          }}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            payIsCompound ? 'bg-white text-indigo-950 shadow-xs' : 'text-indigo-700'
                          }`}
                        >
                          Compound
                        </button>
                      </div>

                      {payIsCompound ? (
                        <div className="space-y-3.5 text-[10px] font-mono leading-none">
                          {/* Debits */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-450 uppercase tracking-wider text-[9px]">Debit Legs (Dr)</span>
                              <button
                                type="button"
                                onClick={() => setPayCompDebits([...payCompDebits, { accountId: '', amount: '' }])}
                                className="text-[10px] text-emerald-600 font-bold hover:underline"
                              >
                                + Add Debit
                              </button>
                            </div>
                            {payCompDebits.map((db, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <select
                                  required
                                  value={db.accountId}
                                  onChange={(e) => {
                                    const updated = [...payCompDebits];
                                    updated[idx].accountId = e.target.value;
                                    setPayCompDebits(updated);
                                  }}
                                  className="flex-1 p-1 px-1.5 border border-indigo-150 rounded bg-white text-[10px]"
                                >
                                  <option value="">Select Debit Account...</option>
                                  {groupedAccounts.map(([groupName, items]) => (
                                    <optgroup key={groupName} label={groupName} className="font-bold text-gray-700">
                                      {items.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Amt"
                                  required
                                  value={db.amount}
                                  onChange={(e) => {
                                    const updated = [...payCompDebits];
                                    updated[idx].amount = e.target.value;
                                    setPayCompDebits(updated);
                                  }}
                                  className="w-16 p-1 border border-indigo-150 rounded bg-white text-[10px] font-mono"
                                />
                                {payCompDebits.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setPayCompDebits(payCompDebits.filter((_, i) => i !== idx))}
                                    className="text-rose-500 hover:text-rose-700 font-bold"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Credits */}
                          <div className="space-y-1.5 pt-2 border-t border-indigo-50">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-450 uppercase tracking-wider text-[9px]">Credit Legs (Cr)</span>
                              <button
                                type="button"
                                onClick={() => setPayCompCredits([...payCompCredits, { accountId: '', amount: '' }])}
                                className="text-[10px] text-rose-600 font-bold hover:underline"
                              >
                                + Add Credit
                              </button>
                            </div>
                            {payCompCredits.map((cr, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <select
                                  required
                                  value={cr.accountId}
                                  onChange={(e) => {
                                    const updated = [...payCompCredits];
                                    updated[idx].accountId = e.target.value;
                                    setPayCompCredits(updated);
                                  }}
                                  className="flex-1 p-1 px-1.5 border border-indigo-150 rounded bg-white text-[10px]"
                                >
                                  <option value="">Select Credit Account...</option>
                                  {groupedAccounts.map(([groupName, items]) => (
                                    <optgroup key={groupName} label={groupName} className="font-bold text-gray-700">
                                      {items.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Amt"
                                  required
                                  value={cr.amount}
                                  onChange={(e) => {
                                    const updated = [...payCompCredits];
                                    updated[idx].amount = e.target.value;
                                    setPayCompCredits(updated);
                                  }}
                                  className="w-16 p-1 border border-indigo-150 rounded bg-white text-[10px] font-mono"
                                />
                                {payCompCredits.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setPayCompCredits(payCompCredits.filter((_, i) => i !== idx))}
                                    className="text-rose-500 hover:text-rose-700 font-bold"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Balancing Checker */}
                          {(() => {
                            const dbTotal = payCompDebits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                            const crTotal = payCompCredits.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                            const isBalanced = Math.abs(dbTotal - crTotal) <= 0.01;
                            const matchesAmount = Math.abs(dbTotal - (parseFloat(payAmount) || 0)) <= 0.01;

                            return (
                              <div className={`p-2 rounded text-[9px] font-mono leading-tight space-y-1 ${
                                isBalanced && matchesAmount ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                              }`}>
                                <div className="flex justify-between font-bold">
                                  <span>Dr total: ₹{dbTotal.toFixed(2)}</span>
                                  <span>Cr total: ₹{crTotal.toFixed(2)}</span>
                                </div>
                                <div className="text-[8px] opacity-80">
                                  {!isBalanced ? `Status: Unbalanced (Diff: ₹${Math.abs(dbTotal - crTotal).toFixed(2)})` : !matchesAmount ? `Status: Sum (₹${dbTotal.toFixed(2)}) must equal Receipt Amount (₹${parseFloat(payAmount).toFixed(2)})` : 'Status: Balanced & Valid'}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-[10px] font-mono leading-none">
                          <div className="space-y-1">
                            <span className="font-bold text-slate-450 uppercase tracking-wider text-[9px]">Debit Account (Dr)</span>
                            <select
                              required
                              value={payDebitAcc}
                              onChange={(e) => setPayDebitAcc(e.target.value)}
                              className="w-full p-1.5 border border-indigo-150 rounded bg-white text-[10px] font-bold text-slate-800"
                            >
                              <option value="">Select Debit Account...</option>
                              {groupedAccounts.map(([groupName, items]) => (
                                <optgroup key={groupName} label={groupName} className="font-bold text-gray-700">
                                  {items.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="font-bold text-slate-450 uppercase tracking-wider text-[9px]">Credit Account (Cr)</span>
                            <select
                              required
                              value={payCreditAcc}
                              onChange={(e) => setPayCreditAcc(e.target.value)}
                              className="w-full p-1.5 border border-indigo-150 rounded bg-white text-[10px] font-bold text-slate-800"
                            >
                              <option value="">Select Credit Account...</option>
                              {groupedAccounts.map(([groupName, items]) => (
                                <optgroup key={groupName} label={groupName} className="font-bold text-gray-700">
                                  {items.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayingStudentId(null)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-205 rounded-xl text-slate-705 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Post & Record Pay
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= MODAL E: BULK ENTER STUDENTS ======================= */}
      <AnimatePresence>
        {isRosterImportOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-mono font-bold">CSV / EXCEL</span>
                  <h3 className="text-sm font-extrabold text-slate-800">Bulk Enter / Clean-Import Students</h3>
                </div>
                <button onClick={() => setIsRosterImportOpen(false)} className="p-1 hover:bg-gray-150 rounded-lg text-slate-400">
                  <X size={16} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-650 leading-relaxed">
                  Enter student details below (one student per line). You can copy-paste columns directly from Excel/Google Sheets, or paste a simple list of names:
                </p>

                {/* Example Help Badges */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono p-3 bg-slate-50 rounded-xl border border-gray-150 leading-normal text-slate-600">
                  <div>
                    <span className="font-bold text-slate-800 block mb-0.5">Format A (Plain Names List):</span>
                    Ameen Abdul<br />
                    Fatima Begum<br />
                    <span className="text-gray-400 italic">IDs auto-generated sequentially</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block mb-0.5">Format B (Spreadsheet pasted):</span>
                    Q-104 , Zainab K , Quran B , Active leader<br />
                    Q-105 , Ibrahim S , Quran A , Scholarship<br />
                    <span className="text-gray-400 italic">(ID, Name, Class, Remarks)</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Pasted Spreadsheet Rows:</label>
                  <textarea
                    rows={8}
                    value={bulkStudentInput}
                    onChange={(e) => setBulkStudentInput(e.target.value)}
                    placeholder="Copy-paste student list or paste column rows here..."
                    className="w-full text-xs font-mono p-3 border border-gray-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-205 focus:shadow-xs placeholder-slate-400"
                  />
                </div>

                {/* Intelligent Sequential Helper Warning */}
                <div className="flex items-start gap-2 p-3 border border-indigo-100 bg-indigo-50/40 rounded-xl">
                  <Info size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-indigo-900 leading-normal">
                    <strong>Auto ID Sequence:</strong> Absent explicit ID codes, names automatically assign available series codes (e.g. <code>QURAN-101</code>, etc.) based on your current master register count.
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRosterImportOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-205 rounded-xl text-slate-700 text-xs font-bold shadow-3xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImportStudents}
                    disabled={isBulkStudentImporting}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-750 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer hover:shadow-xs disabled:opacity-50"
                  >
                    {isBulkStudentImporting ? (
                      <>
                        <RefreshCw size={12} className="animate-spin text-white" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Save size={12} />
                        Import Students
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= MODAL F: CONFIRM DELETE STUDENT ======================= */}
      <AnimatePresence>
        {deletingStudentId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-rose-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="text-rose-600" size={18} />
                  <h3 className="text-sm font-extrabold text-slate-800">Delete Member Profile</h3>
                </div>
                <button onClick={() => setDeletingStudentId(null)} className="p-1 hover:bg-rose-100/50 rounded-lg text-slate-450">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-left">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to permanently delete student **{deletingStudentId}**? Removing them from the master roster will also purge their records and contribution items throughout all drive campaign folders drives!
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingStudentId(null)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-205 rounded-xl text-slate-705 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteStudent}
                    className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= MODAL G: CONFIRM DELETE PROGRAM ======================= */}
      <AnimatePresence>
        {deletingProgramId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-rose-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="text-rose-600" size={18} />
                  <h3 className="text-sm font-extrabold text-slate-800">Purge Campaign Folder Drive</h3>
                </div>
                <button onClick={() => setDeletingProgramId(null)} className="p-1 hover:bg-rose-100/50 rounded-lg text-slate-450">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-left">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to permanently delete the program drive folder **{(programs.find(p => p.id === deletingProgramId))?.name || 'this program'}**? This will completely wipe all member dues targets and collections statistics for this drive from Firestore. This action is irreversible!
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingProgramId(null)}
                    className="flex-1 px-4 py-2 bg-slate-105 hover:bg-slate-205 rounded-xl text-slate-705 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteProgram}
                    className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Confirm Delete Program
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ======================= MODAL H: RESTORE EXCLUDED MEMBERS ======================= */}
      <AnimatePresence>
        {isRestoreModalOpen && activeProgram && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-indigo-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="text-indigo-600" size={16} />
                  <h3 className="text-sm font-extrabold text-slate-850">Manage Excluded Members</h3>
                </div>
                <button onClick={() => setIsRestoreModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-left">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Below are students excluded from the active campaign <strong>{activeProgram.name}</strong>. Restoring them will bring back their record profiles and balance ledger items.
                </p>

                <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
                  {(!activeProgram.excludedStudentIds || activeProgram.excludedStudentIds.length === 0) ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No excluded members found in this campaign.
                    </div>
                  ) : (
                    activeProgram.excludedStudentIds.map(studentId => {
                      const studentObj = quranStudentsList.find(s => s.id === studentId);
                      return (
                        <div key={studentId} className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                          <div>
                            <span className="text-xs font-bold font-mono text-slate-800 uppercase block">{studentId}</span>
                            <span className="text-xs text-slate-600 font-semibold">{studentObj?.name || 'Unknown Student'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestoreStudentToProgram(studentId)}
                            className="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-650 text-indigo-600 rounded-lg border border-indigo-100 cursor-pointer transition-all hover:shadow-[0_0_0_2px_rgba(99,102,241,0.2)]"
                          >
                            Restore Member
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsRestoreModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                  {activeProgram.excludedStudentIds && activeProgram.excludedStudentIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRestoreAllStudentsToProgram}
                      className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Restore All ({activeProgram.excludedStudentIds.length})
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ======================= MODAL I: CONFIRM REMOVE MEMBER FROM CAMPAIGN ======================= */}
      <AnimatePresence>
        {removingStudentId && activeProgram && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-rose-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="text-rose-600" size={16} />
                  <h3 className="text-sm font-extrabold text-slate-850">Remove Member From Active Folder</h3>
                </div>
                <button onClick={() => setRemovingStudentId(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-left">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to remove student <strong>{removingStudentId}</strong> ({quranStudentsList.find(s => s.id === removingStudentId)?.name || 'Unknown Student'}) from the active campaign <strong>{activeProgram.name}</strong>? This will hide their dues and given balance statistics from this specific campaign folder structure.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRemovingStudentId(null)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRemoveStudentFromProgram}
                    className="flex-1 px-4 py-2 bg-rose-650 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Confirm Remove
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ======================= MODAL J: CONFIRM BULK REMOVE FROM CAMPAIGN ======================= */}
      <AnimatePresence>
        {isBulkRemoveConfirmOpen && activeProgram && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-rose-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="text-rose-600" size={16} />
                  <h3 className="text-sm font-extrabold text-slate-850">Bulk Exclude Selection</h3>
                </div>
                <button onClick={() => setIsBulkRemoveConfirmOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-left">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to exclude and remove all <strong>{selectedStudentIds.length}</strong> selected members from the campaign folder <strong>{activeProgram.name}</strong>?
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkRemoveConfirmOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBulkRemoveStudentsFromProgram}
                    className="flex-1 px-4 py-2 bg-rose-650 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Confirm Exclude ({selectedStudentIds.length})
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ======================= MODAL K: CONFIRM RESTORE ALL TO CAMPAIGN ======================= */}
      <AnimatePresence>
        {isRestoreAllConfirmOpen && activeProgram && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-gray-100 bg-emerald-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="text-emerald-600" size={16} />
                  <h3 className="text-sm font-extrabold text-slate-850">Restore All Excluded Members</h3>
                </div>
                <button onClick={() => setIsRestoreAllConfirmOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-left">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to restore all excluded members back into the active campaign <strong>{activeProgram.name}</strong>? This will make their dues profiles active on the collection spreadsheet again.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRestoreAllConfirmOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRestoreAllStudentsToProgram}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Confirm Restore All
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



    </div>
  );
}
