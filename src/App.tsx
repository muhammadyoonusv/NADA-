/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Account, JournalEntry, Student, Program, AccountType } from './types';
import { DEFAULT_ACCOUNTS, DEFAULT_TRANSACTIONS } from './utils/accounting';
import { DashboardCards } from './components/DashboardCards';
import { JournalSheet } from './components/JournalSheet';
import { LedgerSection } from './components/LedgerSection';
import { TrialBalanceView } from './components/TrialBalanceView';
import { ReceiptsPaymentsView } from './components/ReceiptsPaymentsView';
import { BalanceSheetView } from './components/BalanceSheetView';
import { ChartOfAccounts } from './components/ChartOfAccounts';
import { IncomeExpenditureView } from './components/IncomeExpenditureView';
import { SettingsView } from './components/SettingsView';
import { StudentDuesView } from './components/StudentDuesView';
import { HomePage } from './components/HomePage';
import { NotificationCenter, AppNotification } from './components/NotificationCenter';
import { SidebarProfileFolder } from './components/SidebarProfileFolder';
import { ProfilePageView } from './components/ProfilePageView';
import { QuickTemplatesPageView } from './components/QuickTemplatesPageView';
import { PrivacySecurityView } from './components/PrivacySecurityView';
import { Users as UsersIcon } from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  getDoc,
  addDoc,
  query,
  orderBy,
  limit,
  updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from './firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import {
  Home, Menu,
  FileText,
  BookOpen,
  LayoutDashboard,
  Wallet,
  Scale,
  Settings,
  HelpCircle,
  FolderLock,
  Sparkles,
  RefreshCw,
  TrendingUp,
  User as UserIcon,
  Edit,
  Building,
  CloudLightning,
  List,
  AlertCircle,
  CheckCircle,
  Info,
  X,
  Shield,
  Award,
  Star,
  Heart,
  Zap,
  Building2,
  Briefcase,
  GraduationCap,
  Users,
  Image,
  Upload,
  MoreVertical,
  LogOut,
  ChevronDown,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

const DEFAULT_STUDENTS: Student[] = [];

export default function App() {
  // Accounts and transactions states backed by live Firestore DB
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);

  // Custom Toast notification states for an elegant UX without iframe alert restrictions
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'err' | 'info' } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Auth & Access controls
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allowedEmails, setAllowedEmails] = useState<string[]>(['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com']);
  const [authLoading, setAuthLoading] = useState(true);

  // Helper: Access validation checker
  const isEditor = !!(currentUser && currentUser.email && (
    currentUser.email.toLowerCase() === 'klrmuhsin809@gmail.com' ||
    currentUser.email.toLowerCase() === 'yoonuschr@gmail.com' ||
    allowedEmails.some(e => e.trim().toLowerCase() === currentUser.email?.trim().toLowerCase())
  ));

  const showToast = (message: string, type: 'success' | 'err' | 'info' = 'info') => {
    setToast({ message, type });

    if (type === 'success' && currentUser && currentUser.email) {
      const email = currentUser.email.toLowerCase();
      if (!message.includes('authenticated')) {
        const userDisplayName = currentUser.displayName || email.split('@')[0];
        addDoc(collection(db, 'system_notifications'), {
          message: `${userDisplayName}: ${message}`,
          type: 'info',
          timestamp: Date.now(),
          user: email
        }).catch(console.warn);
      }
    }
  };

  useEffect(() => {
    if (!currentUser || (currentUser.email?.toLowerCase() !== 'klrmuhsin809@gmail.com' && currentUser.email?.toLowerCase() !== 'yoonuschr@gmail.com')) return;
    const q = query(collection(db, 'system_notifications'), orderBy('timestamp', 'desc'), limit(15));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (currentUser?.email && data.user === currentUser.email.toLowerCase()) return;
          
          setNotifications(prev => {
            if (prev.some(n => n.id === change.doc.id)) return prev;
            
            // Read seen/read logs from localStorage
            const readKey = `read_notifs_${currentUser.email?.toLowerCase() || 'global'}`;
            const readIdsStr = localStorage.getItem(readKey) || '[]';
            let readIds: string[] = [];
            try {
              readIds = JSON.parse(readIdsStr);
            } catch (e) {}
            const isRead = readIds.includes(change.doc.id);

            return [{
              id: change.doc.id,
              message: data.message,
              // Treat these external updates as 'info' or map from 'type'
              type: data.type === 'success' ? 'success' : 'info',
              timestamp: data.timestamp,
              read: isRead
            }, ...prev].sort((a, b) => b.timestamp - a.timestamp);
          });
        }
      });
    }, (error) => {
      console.warn("System Notifications listener error:", error);
    });
    return unsub;
  }, [currentUser]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [activeTab, setActiveTab] = useState<'home' | 'journal' | 'ledgers' | 'trial' | 'receipts' | 'expenditure' | 'balance' | 'chart' | 'dues' | 'settings' | 'profile' | 'templates' | 'privacy'>('home');
  const [isAppSidebarOpen, setIsAppSidebarOpen] = useState(false);
  const [isReportsMobileMenuOpen, setIsReportsMobileMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);

  const [activePresetTab, setActivePresetTab] = useState<'standard' | 'ai'>('standard');
  const [quickTemplateToApply, setQuickTemplateToApply] = useState<{template: any, timestamp: number} | null>(null);

  const standardPresets = [
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

  const handleApplyTemplate = (template: any) => {
    setQuickTemplateToApply({ template, timestamp: Date.now() });
    setActiveTab('journal');
    setIsAppSidebarOpen(false);
  };

  // Profile and sheet details state
  const [sheetName, setSheetName] = useState(() => localStorage.getItem('app_sheet_name') || 'Class Union Ledger');
  const [sheetTagline, setSheetTagline] = useState(() => localStorage.getItem('app_sheet_tagline') || 'Double-entry accounting, instant trials, cash summaries & Balance sheets');
  const [treasurerName, setTreasurerName] = useState(() => localStorage.getItem('app_treasurer_name') || 'Union Treasurer');
  const [treasurerEmail, setTreasurerEmail] = useState(() => localStorage.getItem('app_treasurer_email') || '');
  const [academicYear, setAcademicYear] = useState(() => localStorage.getItem('app_academic_year') || '2026 - 2027');
  const [logoIcon, setLogoIcon] = useState<string>(() => localStorage.getItem('app_logo_icon') || 'FolderLock');

  // Connection/Loading states
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // AI Templates state
  const [aiPresets, setAiPresets] = useState<{ label: string; desc: string; debit: string; credit: string; narration: string }[]>([]);
  const [loadingAiPresets, setLoadingAiPresets] = useState(false);

  // Auth Status Subscriber
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Fallback safety timeout in case Firestore network request fails/times out
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingAccounts(false);
      setLoadingEntries(false);
      setLoadingStudents(false);
      setLoadingMetadata(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Firestore Real-Time Synchronizers
  // 1. Subscribe to /accounts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), async (snapshot) => {
      const list: Account[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Account);
      });

      if (snapshot.empty) {
        if (isEditor) {
          // Init accounts with defaults if empty
          try {
            const batch = writeBatch(db);
            DEFAULT_ACCOUNTS.forEach((acc) => {
              batch.set(doc(db, 'accounts', acc.id), acc);
            });
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'accounts');
          }
        } else {
          setAccounts([]);
          setLoadingAccounts(false);
        }
      } else {
        setAccounts(list);
        setLoadingAccounts(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'accounts');
      setLoadingAccounts(false);
    });
    return unsub;
  }, [isEditor]);

  // 2. Subscribe to /entries
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'entries'), async (snapshot) => {
      const list: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as JournalEntry);
      });

      if (snapshot.empty && !loadingAccounts) {
        setEntries([]);
        setLoadingEntries(false);
      } else {
        list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        setEntries(list);
        setLoadingEntries(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'entries');
      setLoadingEntries(false);
    });
    return unsub;
  }, [loadingAccounts]);

  // 3. Subscribe to /metadata/config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'metadata', 'config'), async (docSnap) => {
      if (!docSnap.exists()) {
        if (isEditor) {
          try {
            await setDoc(doc(db, 'metadata', 'config'), {
              sheetName: sheetName || 'Class Union Ledger',
              sheetTagline: sheetTagline || 'Double-entry accounting, instant trials, cash summaries & Balance sheets',
              treasurerName: treasurerName || 'Union Treasurer',
              treasurerEmail: treasurerEmail || '',
              academicYear: academicYear || '2026 - 2027',
              allowedEmails: ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com']
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'metadata/config');
          }
        }
        setLoadingMetadata(false);
      } else {
        const data = docSnap.data();
        if (data.sheetName) {
          setSheetName(data.sheetName);
          localStorage.setItem('app_sheet_name', data.sheetName);
        }
        if (data.sheetTagline !== undefined) {
          setSheetTagline(data.sheetTagline);
          localStorage.setItem('app_sheet_tagline', data.sheetTagline);
        }
        if (data.treasurerName) {
          setTreasurerName(data.treasurerName);
          localStorage.setItem('app_treasurer_name', data.treasurerName);
        }
        if (data.treasurerEmail !== undefined) {
          setTreasurerEmail(data.treasurerEmail);
          localStorage.setItem('app_treasurer_email', data.treasurerEmail);
        }
        if (data.academicYear) {
          setAcademicYear(data.academicYear);
          localStorage.setItem('app_academic_year', data.academicYear);
        }
        if (data.logoIcon) {
          setLogoIcon(data.logoIcon);
          localStorage.setItem('app_logo_icon', data.logoIcon);
        } else {
          // Keep local cached logo/photo if cloud schema is 6-field without logoIcon
          const localLogo = localStorage.getItem('app_logo_icon');
          if (localLogo) setLogoIcon(localLogo);
        }
        if (Array.isArray(data.allowedEmails) && data.allowedEmails.length > 0) {
          setAllowedEmails(data.allowedEmails);
        }
        setLoadingMetadata(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'metadata/config');
      setLoadingMetadata(false);
    });
    return unsub;
  }, [isEditor]);

  // 4. Subscribe to /metadata/ai_presets
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'metadata', 'ai_presets'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.presets)) {
          setAiPresets(data.presets);
        }
      }
    }, (error) => {
      console.warn("AI presets sub error:", error);
    });
    return unsub;
  }, []);

  // 5. Subscribe to /students
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), async (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((docSnap) => {
        const studentObj = docSnap.data() as Student;
        if (studentObj && 'phone' in studentObj) {
          delete studentObj.phone;
        }
        list.push(studentObj);
      });

      if (snapshot.empty) {
        setStudents([]);
        setLoadingStudents(false);
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(list);
        setLoadingStudents(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'students');
    });
    return unsub;
  }, []);

  // 6. Subscribe to /programs
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'programs'), (snapshot) => {
      const list: Program[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Program);
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPrograms(list);
      setLoadingPrograms(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'programs');
    });
    return unsub;
  }, []);

  // Helper to chunk a file and write chunks to database
  const uploadFileChunks = async (file: { name: string; type: string; size: number; base64?: string }): Promise<{ id: string; name: string; type: string; size: number; chunkCount: number }> => {
    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const base64 = file.base64 || '';
    const chunkSize = 250000; // 250,000 characters chunk size (around ~180-250 KB)
    const numChunks = Math.ceil(base64.length / chunkSize);
    
    const promises = [];
    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, base64.length);
      const chunkContent = base64.slice(start, end);
      const chunkId = `${fileId}_${i}`;
      promises.push(
        setDoc(doc(db, 'file_chunks', chunkId), {
          fileId,
          chunkIndex: i,
          content: chunkContent,
        })
      );
    }
    await Promise.all(promises);
    
    return {
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      chunkCount: numChunks,
    };
  };

  // Helper to delete chunks of a file
  const deleteFileChunks = async (fileId: string, chunkCount: number) => {
    const promises = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkId = `${fileId}_${i}`;
      promises.push(deleteDoc(doc(db, 'file_chunks', chunkId)));
    }
    await Promise.all(promises).catch(err => console.error("Error deleting old chunks:", err));
  };

  // Helper to fetch file chunks from remote database
  const handleFetchFileChunks = async (fileId: string, chunkCount: number): Promise<string> => {
    try {
      const chunks: string[] = new Array(chunkCount);
      const promises = [];
      for (let i = 0; i < chunkCount; i++) {
        const chunkId = `${fileId}_${i}`;
        const idx = i;
        promises.push(
          (async () => {
            const snap = await getDoc(doc(db, 'file_chunks', chunkId));
            if (snap.exists()) {
              const data = snap.data();
              chunks[idx] = data?.content || '';
            } else {
              throw new Error(`Missing chunk ${idx}`);
            }
          })()
        );
      }
      await Promise.all(promises);
      return chunks.join('');
    } catch (err) {
      console.error("Error fetching file chunks:", err);
      throw err;
    }
  };

  // Database actions
  const handleAddEntry = async (newEntry: Omit<JournalEntry, 'id'>): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to add entries. Only authorized editors can alter ledger data.', 'err');
      return false;
    }

    // Instantly confirm success and return true so the form closes and clears immediately without any delay!
    showToast('The entry or attachment was successfully uploaded.', 'success');

    // Run the actual Firestore and attachment uploads completely in the background
    (async () => {
      try {
        const entryId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

        // Create initial metadata placeholders for new files to display they are uploading
        const filesToProcess = newEntry.files || [];
        const initialFiles = filesToProcess.map((file, idx) => {
          const tempId = (file as any).id || ('f_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 4));
          return {
            name: file.name || '',
            type: file.type || '',
            size: Number(file.size) || 0,
            id: tempId,
            chunkCount: (file as any).chunkCount || 0,
            status: 'uploading' as const,
          };
        });

        const entry: JournalEntry = {
          id: entryId,
          date: newEntry.date,
          debitAccount: newEntry.debitAccount,
          creditAccount: newEntry.creditAccount,
          debitAccountType: newEntry.debitAccountType,
          creditAccountType: newEntry.creditAccountType,
          amount: newEntry.amount,
          narration: newEntry.narration,
          isCompound: newEntry.isCompound,
          debits: newEntry.debits,
          credits: newEntry.credits,
        };

        if (initialFiles.length > 0) {
          entry.files = initialFiles;
        }

        // Save core metadata to Firestore (non-blocking)
        await setDoc(doc(db, 'entries', entryId), entry);

        // Perform chunk processing & uploading in background
        if (filesToProcess.length > 0) {
          const processedFiles = await Promise.all(
            filesToProcess.map(async (file, idx) => {
              const descriptor = initialFiles[idx];
              try {
                if (file.base64 && file.size > 500 * 1024) {
                  const meta = await uploadFileChunks(file);
                  return {
                    ...meta,
                    status: 'completed' as const,
                  };
                } else {
                  const cleanFile: any = {
                    name: file.name || '',
                    type: file.type || '',
                    size: Number(file.size) || 0,
                    id: descriptor.id,
                    status: 'completed' as const,
                  };
                  if (file.base64) cleanFile.base64 = file.base64;
                  return cleanFile;
                }
              } catch (err) {
                console.error("Background chunk upload failed:", err);
                return {
                  name: file.name || '',
                  type: file.type || '',
                  size: Number(file.size) || 0,
                  id: descriptor.id,
                  status: 'error' as const,
                };
              }
            })
          );

          // Update file structures containing base64 data
          await setDoc(doc(db, 'entries', entryId), {
            ...entry,
            files: processedFiles,
          });
        }
      } catch (error) {
        console.error("Background save failure:", error);
        const errMessage = error instanceof Error ? error.message : String(error);
        showToast('Error saving entry in the background: ' + errMessage, 'err');
        handleFirestoreError(error, OperationType.CREATE, 'entries');
      }
    })();

    return true;
  };

  const handleUpdateEntry = async (updated: JournalEntry): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to modify entries. Only authorized editors can alter ledger data.', 'err');
      return false;
    }

    // Instantly confirm success and return true so the form closes and clears immediately without any delay!
    showToast('The entry or attachment was successfully uploaded.', 'success');

    // Run the actual updates completely in the background
    (async () => {
      try {
        // Purge obsolete file chunks for files deleted in edit in parallel background
        const existingEntry = entries.find(e => e.id === updated.id);
        if (existingEntry && existingEntry.files) {
          const remainingIds = new Set((updated.files || []).map((f) => (f as any).id).filter(Boolean));
          const deletePromises = existingEntry.files
            .filter(f => (f as any).id && !remainingIds.has((f as any).id))
            .map(f => deleteFileChunks((f as any).id, (f as any).chunkCount || 1));
          Promise.all(deletePromises).catch(err => console.error("Error purging obsolete file chunks:", err));
        }

        // Setup file descriptors for the update
        const filesToProcess = updated.files || [];
        const initialFiles = filesToProcess.map((file, idx) => {
          // If file already exists and is not modified (no new upload required), keep it intact
          if ((file as any).id && !(file as any).base64) {
            return {
              name: file.name || '',
              type: file.type || '',
              size: Number(file.size) || 0,
              id: (file as any).id,
              chunkCount: (file as any).chunkCount || 0,
              status: (file as any).status || 'completed',
            };
          }
          
          // New file or modified file: set status to uploading
          const tempId = (file as any).id || ('f_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 4));
          return {
            name: file.name || '',
            type: file.type || '',
            size: Number(file.size) || 0,
            id: tempId,
            chunkCount: (file as any).chunkCount || 0,
            status: 'uploading' as const,
          };
        });

        const entry: JournalEntry = {
          id: updated.id,
          date: updated.date,
          debitAccount: updated.debitAccount,
          creditAccount: updated.creditAccount,
          debitAccountType: updated.debitAccountType,
          creditAccountType: updated.creditAccountType,
          amount: updated.amount,
          narration: updated.narration,
          isCompound: updated.isCompound,
          debits: updated.debits,
          credits: updated.credits,
        };

        if (initialFiles.length > 0) {
          entry.files = initialFiles;
        }

        // Save core metadata to Firestore in the background
        await setDoc(doc(db, 'entries', updated.id), entry);

        // Do new file uploads in the background
        const hasNewUploads = filesToProcess.some(f => f.base64);
        if (hasNewUploads) {
          const processedFiles = await Promise.all(
            filesToProcess.map(async (file, idx) => {
              const descriptor = initialFiles[idx];
              if (file.base64) {
                try {
                  if (file.size > 500 * 1024) {
                    const meta = await uploadFileChunks(file);
                    return {
                      ...meta,
                      status: 'completed' as const,
                    };
                  } else {
                    const cleanFile: any = {
                      name: file.name || '',
                      type: file.type || '',
                      size: Number(file.size) || 0,
                      id: descriptor.id,
                      status: 'completed' as const,
                    };
                    cleanFile.base64 = file.base64;
                    return cleanFile;
                  }
                } catch (err) {
                  console.error("Background chunk upload on update failed:", err);
                  return {
                    name: file.name || '',
                    type: file.type || '',
                    size: Number(file.size) || 0,
                    id: descriptor.id,
                    status: 'error' as const,
                  };
                }
              } else {
                // Keep already uploaded files
                const cleanRes: any = {
                  name: file.name || '',
                  type: file.type || '',
                  size: Number(file.size) || 0,
                };
                if ((file as any).id) cleanRes.id = (file as any).id;
                if ((file as any).chunkCount !== undefined) cleanRes.chunkCount = (file as any).chunkCount;
                if (file.base64) cleanRes.base64 = file.base64;
                return cleanRes;
              }
            })
          );

          await setDoc(doc(db, 'entries', updated.id), {
            ...entry,
            files: processedFiles,
          });
        }
      } catch (error) {
        console.error("Background update failure:", error);
        const errMessage = error instanceof Error ? error.message : String(error);
        showToast('Error updating entry in the background: ' + errMessage, 'err');
        handleFirestoreError(error, OperationType.UPDATE, 'entries/' + updated.id);
      }
    })();

    return true;
  };

  const handleGenerateAiPresets = async () => {
    if (!isEditor) {
      showToast('Access denied: Only whitelisted administrators can execute AI transaction template synthesis.', 'err');
      return;
    }
    setLoadingAiPresets(true);
    try {
      const response = await fetch('/api/gemini/analyze-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accounts,
          entries
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      if (data.templates && Array.isArray(data.templates)) {
        await setDoc(doc(db, 'metadata', 'ai_presets'), {
          presets: data.templates,
          updatedAt: new Date().toISOString()
        });
        showToast('AI analysis completed. Active ledger patterns have been identified, and the assistant helper has been updated.', 'success');
      } else {
        throw new Error('Invalid formatting returned from template algorithm.');
      }
    } catch (err: any) {
      console.error('Template analysis failed:', err);
      showToast(`The AI process failed: ${err.message || err}`, 'err');
    } finally {
      setLoadingAiPresets(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to delete entries. Only authorized editors can alter ledger data.', 'err');
      return;
    }
    try {
      // 1. Clean up file chunks associated with deleted entry in parallel
      const existingEntry = entries.find(e => e.id === id);
      if (existingEntry && existingEntry.files) {
        const deletePromises = existingEntry.files
          .filter(f => (f as any).id)
          .map(f => deleteFileChunks((f as any).id, (f as any).chunkCount || 1));
        await Promise.all(deletePromises).catch(err => console.error("Error purging files on delete:", err));
      }

      await deleteDoc(doc(db, 'entries', id));
      showToast('The journal entry was deleted successfully.', 'success');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      showToast('Error deleting entry: ' + errMessage, 'err');
      handleFirestoreError(error, OperationType.DELETE, 'entries/' + id);
    }
  };

  const handleAddAccount = async (newAccount: Omit<Account, 'id'>) => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to add accounts. Only authorized editors can alter ledger data.', 'err');
      return;
    }
    try {
      const accId = 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      const acc: Account = {
        ...newAccount,
        id: accId,
        isSystem: false,
      };
      await setDoc(doc(db, 'accounts', accId), acc);
      showToast('The account label was added successfully.', 'success');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      showToast('Error adding account label: ' + errMessage, 'err');
      handleFirestoreError(error, OperationType.CREATE, 'accounts');
    }
  };

  const handleEditAccount = async (id: string, updatedName: string, updatedType: AccountType) => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to edit accounts. Only authorized editors can alter ledger data.', 'err');
      return;
    }
    const targetAcc = accounts.find(a => a.id === id);
    if (targetAcc?.isSystem) {
      showToast('System reserved accounts cannot be modified.', 'err');
      return;
    }
    try {
      const accRef = doc(db, 'accounts', id);
      await updateDoc(accRef, { name: updatedName, type: updatedType });
      showToast('The account label and classification were updated successfully.', 'success');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      showToast('Error updating account: ' + errMessage, 'err');
      handleFirestoreError(error, OperationType.UPDATE, 'accounts/' + id);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to delete accounts. Only authorized editors can alter ledger data.', 'err');
      return;
    }
    const targetAcc = accounts.find(a => a.id === id);
    if (targetAcc?.isSystem) {
      showToast('System reserved accounts cannot be deleted.', 'err');
      return;
    }
    const hasReferences = entries.some((e) => e.debitAccount === id || e.creditAccount === id);
    if (hasReferences) {
      showToast('This account label cannot be deleted because existing journal entries are linked to it. Please delete or reassign those journal entries first.', 'err');
      return;
    }
    try {
      await deleteDoc(doc(db, 'accounts', id));
      showToast('The account label was deleted successfully.', 'success');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      showToast('Error deleting account: ' + errMessage, 'err');
      handleFirestoreError(error, OperationType.DELETE, 'accounts/' + id);
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);

  // Preset operations
  const onLoadPresets = async () => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to seed templates. Only authorized editors can alter ledger data.', 'err');
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      message: 'Load sample class union ledger data? This will overwrite your currently active sheet.',
      onConfirm: async () => {
        try {
          const accountsSnap = await getDocs(collection(db, 'accounts'));
          const entriesSnap = await getDocs(collection(db, 'entries'));
          
          const batch = writeBatch(db);
          accountsSnap.forEach(d => batch.delete(d.ref));
          entriesSnap.forEach(d => batch.delete(d.ref));
          
          DEFAULT_ACCOUNTS.forEach(acc => {
            batch.set(doc(db, 'accounts', acc.id), acc);
          });
          DEFAULT_TRANSACTIONS.forEach(entry => {
            batch.set(doc(db, 'entries', entry.id), entry);
          });
          
          await batch.commit();
          showToast('The sample template ledger data was loaded successfully.', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'presets');
        }
      }
    });
  };

  const onClearAll = async () => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to reset the ledger. Only authorized editors can alter ledger data.', 'err');
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      message: 'Reset to a blank union database? This will delete custom transactions and revert settings to default, but will securely EXCLUDE and preserve your Whitelisted Editors list.',
      onConfirm: async () => {
        try {
          const accountsSnap = await getDocs(collection(db, 'accounts'));
          const entriesSnap = await getDocs(collection(db, 'entries'));
          const studentsSnap = await getDocs(collection(db, 'students'));
          
          const batch = writeBatch(db);
          accountsSnap.forEach(d => batch.delete(d.ref));
          entriesSnap.forEach(d => batch.delete(d.ref));
          studentsSnap.forEach(d => batch.delete(d.ref));
          
          DEFAULT_ACCOUNTS.forEach(acc => {
            batch.set(doc(db, 'accounts', acc.id), acc);
          });

          DEFAULT_STUDENTS.forEach(stu => {
            batch.set(doc(db, 'students', stu.id), stu);
          });

          // Reset metadata to default but exclude whitelist editors explicitly
          batch.set(doc(db, 'metadata', 'config'), {
            sheetName: 'Class Union Ledger',
            sheetTagline: 'Double-entry accounting, instant trials, cash summaries & Balance sheets',
            treasurerName: 'Union Treasurer',
            treasurerEmail: '',
            academicYear: '2026 - 2027',
            allowedEmails: allowedEmails // Preserved Whitelist list editors
          });
          
          await batch.commit();
          showToast('The ledger database and settings were reset successfully (Whitelists preserved).', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'clear');
        }
      }
    });
  };

  // Import JSON backup
  const onImportBackup = async (rawContent: string): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to import files. Only authorized editors can alter ledger data.', 'err');
      return false;
    }
    try {
      const data = JSON.parse(rawContent);
      if (data && Array.isArray(data.accounts) && Array.isArray(data.entries)) {
        const ops: Array<{ ref: any; type: 'set' | 'delete'; data?: any }> = [];
        
        // Clear existing accounts & entries
        const accountsSnap = await getDocs(collection(db, 'accounts'));
        const entriesSnap = await getDocs(collection(db, 'entries'));
        accountsSnap.forEach(d => ops.push({ ref: d.ref, type: 'delete' }));
        entriesSnap.forEach(d => ops.push({ ref: d.ref, type: 'delete' }));

        // Queue sets for accounts & entries
        data.accounts.forEach((acc: Account) => {
          ops.push({ ref: doc(db, 'accounts', acc.id), type: 'set', data: acc });
        });
        data.entries.forEach((entry: JournalEntry) => {
          ops.push({ ref: doc(db, 'entries', entry.id), type: 'set', data: entry });
        });

        // Clear and queue sets for students (if present in backup)
        let hasStudents = false;
        if (data.students && Array.isArray(data.students)) {
          hasStudents = true;
          const studentsSnap = await getDocs(collection(db, 'students'));
          studentsSnap.forEach(d => ops.push({ ref: d.ref, type: 'delete' }));
          data.students.forEach((stu: Student) => {
            ops.push({ ref: doc(db, 'students', stu.id), type: 'set', data: stu });
          });
        }

        // Clear and queue sets for programs/campaigns (if present in backup)
        let hasPrograms = false;
        if (data.programs && Array.isArray(data.programs)) {
          hasPrograms = true;
          const programsSnap = await getDocs(collection(db, 'programs'));
          programsSnap.forEach(d => ops.push({ ref: d.ref, type: 'delete' }));
          data.programs.forEach((prog: Program) => {
            ops.push({ ref: doc(db, 'programs', prog.id), type: 'set', data: prog });
          });
        }

        // Execute operations in chunked batches (to respect Firestore limit of 500 per batch)
        let batch = writeBatch(db);
        let count = 0;
        for (const op of ops) {
          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
          if (op.type === 'delete') {
            batch.delete(op.ref);
          } else {
            batch.set(op.ref, op.data);
          }
          count++;
        }
        if (count > 0) {
          await batch.commit();
        }

        const messages = ['Ledger accounts & entries'];
        if (hasStudents) messages.push('student roster details');
        if (hasPrograms) messages.push('union campaign due folders');
        
        showToast(`The backup containing ${messages.join(', ')} was imported successfully.`, 'success');
        return true;
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to parse the backup file structure.', 'err');
    }
    return false;
  };

  const handleAddStudent = async (student: Student): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to add students. Only authorized editors can alter ledger data.', 'err');
      return false;
    }
    try {
      await setDoc(doc(db, 'students', student.id), student);
      showToast('Student was added successfully.', 'success');
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students/' + student.id);
      return false;
    }
  };

  const handleUpdateStudent = async (student: Student): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to update student details. Only authorized editors can alter ledger data.', 'err');
      return false;
    }
    try {
      await setDoc(doc(db, 'students', student.id), student);
      showToast('Student details updated successfully.', 'success');
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students/' + student.id);
      return false;
    }
  };

  const handleDeleteStudent = async (id: string): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to delete students. Only authorized editors can alter ledger data.', 'err');
      return false;
    }
    try {
      await deleteDoc(doc(db, 'students', id));
      showToast('Student was deleted successfully.', 'success');
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students/' + id);
      return false;
    }
  };

  const handleClearAllStudents = async (ids: string[]): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to clear students. Only authorized editors can alter ledger data.', 'err');
      return false;
    }
    if (ids.length === 0) return true;
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => {
        batch.delete(doc(db, 'students', id));
      });
      await batch.commit();
      showToast(`Cleared all ${ids.length} students successfully.`, 'success');
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students_clear_all');
      return false;
    }
  };

  const handleAddProgram = async (program: Program): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to create programs.', 'err');
      return false;
    }
    try {
      await setDoc(doc(db, 'programs', program.id), program);
      showToast(`Program folder "${program.name}" created successfully.`, 'success');
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'programs/' + program.id);
      return false;
    }
  };

  const handleUpdateProgram = async (program: Program): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to update programs.', 'err');
      return false;
    }
    try {
      await setDoc(doc(db, 'programs', program.id), program);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'programs/' + program.id);
      return false;
    }
  };

  const handleDeleteProgram = async (id: string): Promise<boolean> => {
    if (!isEditor) {
      showToast('Access denied: You do not have permission to delete programs.', 'err');
      return false;
    }
    try {
      await deleteDoc(doc(db, 'programs', id));
      showToast('Program folder deleted successfully.', 'success');
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'programs/' + id);
      return false;
    }
  };

  // Update cloud settings & profile configurations
  const handleSaveConfig = async (config: {
    sheetName: string;
    sheetTagline: string;
    treasurerName: string;
    treasurerEmail: string;
    academicYear: string;
    allowedEmails: string[];
    logoIcon: string;
  }) => {
    if (!isEditor) {
      showToast('Access denied: Only authorized editors can update settings.', 'err');
      throw new Error('Access denied: Only authorized editors can update settings.');
    }
    // Optimistic local state update for instant UI feedback
    setSheetName(config.sheetName);
    setSheetTagline(config.sheetTagline);
    setTreasurerName(config.treasurerName);
    setTreasurerEmail(config.treasurerEmail);
    setAcademicYear(config.academicYear);
    setLogoIcon(config.logoIcon);

    // Save locally immediately so custom photo/emblem and settings are never lost across reloads
    try {
      localStorage.setItem('app_sheet_name', config.sheetName);
      localStorage.setItem('app_sheet_tagline', config.sheetTagline);
      localStorage.setItem('app_treasurer_name', config.treasurerName);
      localStorage.setItem('app_treasurer_email', config.treasurerEmail);
      localStorage.setItem('app_academic_year', config.academicYear);
      if (config.logoIcon) {
        localStorage.setItem('app_logo_icon', config.logoIcon);
      }
    } catch (e) {
      console.warn('Local storage cache error:', e);
    }

    const finalAllowedEmails = config.allowedEmails && config.allowedEmails.length > 0
      ? config.allowedEmails
      : ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];

    // Standard 6-field payload (strictly compliant with original deployed Firestore rules requiring exactly 6 keys)
    const standard6Payload = {
      sheetName: (config.sheetName || 'Class Union Ledger').trim().slice(0, 200),
      sheetTagline: (config.sheetTagline || '').trim().slice(0, 500),
      treasurerName: (config.treasurerName || 'Union Treasurer').trim().slice(0, 200),
      treasurerEmail: (config.treasurerEmail || '').trim().slice(0, 200),
      academicYear: (config.academicYear || '2026 - 2027').trim().slice(0, 100),
      allowedEmails: finalAllowedEmails.slice(0, 100)
    };

    // Extended 7-field payload (including custom logo / emblem)
    const extended7Payload = {
      ...standard6Payload,
      logoIcon: config.logoIcon || 'FolderLock'
    };

    // Fire non-blocking asynchronous cloud save
    (async () => {
      try {
        await setDoc(doc(db, 'metadata', 'config'), extended7Payload);
      } catch (firstErr: any) {
        console.warn('Extended 7-field save failed. Retrying standard 6-field write...', firstErr);
        try {
          await setDoc(doc(db, 'metadata', 'config'), standard6Payload);
        } catch (secondErr: any) {
          console.error('Cloud write restriction:', secondErr);
        }
      }
    })();
  };

  // Instant save on click for Logo/Photo Emblem
  const handleQuickUpdateLogo = (newLogo: string) => {
    // 0ms instant UI update
    setLogoIcon(newLogo);
    try {
      localStorage.setItem('app_logo_icon', newLogo);
    } catch (e) {
      console.warn('Local storage error:', e);
    }

    // Non-blocking fire-and-forget background cloud sync
    if (isEditor) {
      const finalAllowedEmails = allowedEmails && allowedEmails.length > 0
        ? allowedEmails
        : ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];

      const standard6Payload = {
        sheetName: (sheetName || 'Class Union Ledger').trim().slice(0, 200),
        sheetTagline: (sheetTagline || '').trim().slice(0, 500),
        treasurerName: (treasurerName || 'Union Treasurer').trim().slice(0, 200),
        treasurerEmail: (treasurerEmail || '').trim().slice(0, 200),
        academicYear: (academicYear || '2026 - 2027').trim().slice(0, 100),
        allowedEmails: finalAllowedEmails.slice(0, 100)
      };

      const extended7Payload = {
        ...standard6Payload,
        logoIcon: newLogo || 'FolderLock'
      };

      (async () => {
        try {
          await setDoc(doc(db, 'metadata', 'config'), extended7Payload);
        } catch {
          try {
            await setDoc(doc(db, 'metadata', 'config'), standard6Payload);
          } catch (err) {
            console.warn('Background logo sync failed:', err);
          }
        }
      })();
    }
  };

  // Authentication Handlers
  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast('Successfully authenticated with Google.', 'success');
    } catch (err: any) {
      const isPopupClosed = 
        err.code === 'auth/popup-closed-by-user' ||
        err.message?.includes('popup-closed-by-user') ||
        err.code === 'auth/cancelled-popup-request' ||
        err.message?.includes('cancelled-popup-request');

      if (isPopupClosed) {
        console.warn('User closed the login popup or request cancelled.');
        return;
      }

      console.error('Sign-in error:', err);
      
      if (err.code === 'auth/unauthorized-domain') {
        showToast('Domain not authorized for OAuth. Please add your Netlify domain in Firebase Console -> Authentication -> Settings -> Authorized domains.', 'err');
        return;
      }
      
      showToast('Failed to sign in: ' + (err.code || err.message), 'err');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error(err);
    }
  };

  const isLoading = loadingAccounts || loadingEntries || loadingMetadata;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center font-sans animate-fade-in">
        <div className="max-w-md space-y-6 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg animate-pulse mb-2">
            <CloudLightning size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-2">
              Connecting Cloud Database
            </h2>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Synchronizing with Firestore Web Database to load your secure class ledger state. This ensures zero data loss upon page refresh.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono font-bold bg-slate-800/50 border border-slate-700/50 px-4 py-1.5 rounded-full select-none">
            <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>LIVE SYNC ACTIVE</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans transition-colors duration-250 pb-20 md:pb-0">
      {/* Top Banner header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 mr-2">
            <button
              onClick={() => setIsAppSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              title="Quick Templates Menu"
            >
              <Menu size={24} />
            </button>
            <div 
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md cursor-pointer hover:opacity-90 shrink-0 overflow-hidden" 
              onClick={() => setActiveTab('profile')} 
              title="Profile Button (Click to view and edit profile)"
            >
              {logoIcon.startsWith('data:image/') ? (
                <img src={logoIcon} alt="Logo" className="w-full h-full object-cover" />
              ) : logoIcon === 'Shield' ? (
                <Shield size={20} />
              ) : logoIcon === 'BookOpen' ? (
                <BookOpen size={20} />
              ) : logoIcon === 'Users' ? (
                <Users size={20} />
              ) : logoIcon === 'Award' ? (
                <Award size={20} />
              ) : logoIcon === 'Star' ? (
                <Star size={20} />
              ) : logoIcon === 'Heart' ? (
                <Heart size={20} />
              ) : logoIcon === 'Zap' ? (
                <Zap size={20} />
              ) : logoIcon === 'Building2' ? (
                <Building2 size={20} />
              ) : logoIcon === 'Scale' ? (
                <Scale size={20} />
              ) : logoIcon === 'Briefcase' ? (
                <Briefcase size={20} />
              ) : logoIcon === 'GraduationCap' ? (
                <GraduationCap size={20} />
              ) : (
                <FolderLock size={20} />
              )}
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-gray-900 sm:text-lg flex items-center gap-1.5 leading-none">
                <span>{sheetName}</span>
                <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md uppercase font-mono hidden sm:inline-block">
                  {academicYear}
                </span>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="p-1 hover:bg-slate-100 text-gray-400 hover:text-indigo-600 rounded cursor-pointer transition-colors"
                  title="Profile Button (Click to view and edit profile)"
                >
                  <Edit size={13} />
                </button>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium mt-1 truncate max-w-[150px] sm:max-w-xs">{sheetTagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {currentUser?.email && ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'].includes(currentUser.email.toLowerCase()) && (
              <NotificationCenter 
                notifications={notifications}
                onMarkAllAsRead={() => {
                  setNotifications(prev => {
                    const updated = prev.map(n => ({...n, read: true}));
                    const readKey = `read_notifs_${currentUser.email?.toLowerCase() || 'global'}`;
                    const readIds = updated.map(n => n.id);
                    localStorage.setItem(readKey, JSON.stringify(readIds));
                    return updated;
                  });
                }}
                onClearAll={() => {
                  setNotifications(prev => {
                    const currentIds = prev.map(n => n.id);
                    const readKey = `read_notifs_${currentUser.email?.toLowerCase() || 'global'}`;
                    const readIdsStr = localStorage.getItem(readKey) || '[]';
                    let readIds: string[] = [];
                    try {
                      readIds = JSON.parse(readIdsStr);
                    } catch (e) {}
                    const combined = Array.from(new Set([...readIds, ...currentIds]));
                    localStorage.setItem(readKey, JSON.stringify(combined));
                    return [];
                  });
                }}
                onMarkAsRead={(id) => {
                  setNotifications(prev => {
                    const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
                    const readKey = `read_notifs_${currentUser.email?.toLowerCase() || 'global'}`;
                    const readIdsStr = localStorage.getItem(readKey) || '[]';
                    let readIds: string[] = [];
                    try {
                      readIds = JSON.parse(readIdsStr);
                    } catch (e) {}
                    if (!readIds.includes(id)) {
                      readIds.push(id);
                    }
                    localStorage.setItem(readKey, JSON.stringify(readIds));
                    return updated;
                  });
                }}
              />
            )}

            {/* Google Authentication Control Badge (Quick status view) */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-gray-200 rounded-lg select-none px-2 py-1 text-xs">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || ''} 
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-gray-300" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] sm:text-xs flex items-center justify-center">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-left leading-none max-w-[120px]">
                  <p className="text-[10px] font-bold text-gray-800 truncate">{currentUser.displayName || 'Google Account'}</p>
                  <p className="text-[9px] text-gray-400 font-mono truncate">{currentUser.email}</p>
                </div>
                
                {/* Access Level Status indicator */}
                <span className={`text-[8px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isEditor 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold flex items-center gap-1' 
                    : 'bg-amber-50 border border-amber-200 text-amber-700 font-extrabold flex items-center gap-1'
                }`}>
                  <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isEditor ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                  {isEditor ? 'ADMIN' : 'READONLY'}
                </span>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-indigo-200 hover:border-indigo-300 text-indigo-600 text-[11px] sm:text-xs rounded-lg font-bold transition-all shadow-3xs cursor-pointer hover:scale-[1.01]"
                title="Authenticate to Gain Authorizations"
              >
                <div className="w-4 h-4 rounded-full bg-indigo-50 flex items-center justify-center">
                  <UserIcon size={11} className="text-indigo-600" />
                </div>
                <span>Sign In</span>
              </button>
            )}

            {/* Three-Dot Options Dropdown (Settings, Logout, and Guide) */}
            <div className="relative">
              <button
                id="top-three-dot-menu-button"
                onClick={() => setIsTopMenuOpen(!isTopMenuOpen)}
                title="More Options"
                aria-label="Options menu"
                aria-expanded={isTopMenuOpen}
                className={`inline-flex items-center justify-center p-2 rounded-lg border transition-all shadow-3xs cursor-pointer ${
                  isTopMenuOpen || activeTab === 'settings'
                    ? 'bg-slate-900 border-slate-900 text-white scale-[0.98]'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                }`}
              >
                <MoreVertical size={16} />
              </button>

              {isTopMenuOpen && (
                <>
                  {/* Backdrop dismiss overlay */}
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsTopMenuOpen(false)}
                  />
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-40 sm:w-44 bg-white rounded-xl shadow-xl border border-gray-150 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                    {/* User info snippet if logged in */}
                    {currentUser && (
                      <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
                        <p className="text-[11px] font-bold text-gray-800 truncate">
                          {currentUser.displayName || 'Google User'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono truncate">
                          {currentUser.email}
                        </p>
                      </div>
                    )}

                    {/* 1. Settings option */}
                    <button
                      id="menu-option-settings"
                      onClick={() => {
                        setActiveTab('settings');
                        setIsTopMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Settings size={15} className="text-slate-500 shrink-0" />
                      <span>Settings</span>
                    </button>

                    {/* 2. Guide option */}
                    <button
                      id="menu-option-guide"
                      onClick={() => {
                        setIsHelpOpen(!isHelpOpen);
                        setIsTopMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <HelpCircle size={15} className="text-blue-500 shrink-0" />
                      <span>Guide</span>
                    </button>

                    {/* 3. Logout / Sign in option */}
                    {currentUser ? (
                      <button
                        id="menu-option-logout"
                        onClick={() => {
                          setIsTopMenuOpen(false);
                          handleSignOut();
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-gray-100 mt-1 whitespace-nowrap"
                      >
                        <LogOut size={15} className="text-rose-500 shrink-0" />
                        <span>Logout</span>
                      </button>
                    ) : (
                      <button
                        id="menu-option-login"
                        onClick={() => {
                          setIsTopMenuOpen(false);
                          handleSignIn();
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-gray-100 mt-1 whitespace-nowrap"
                      >
                        <UserIcon size={15} className="text-indigo-500 shrink-0" />
                        <span>Sign In</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main app space */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Help Panel */}
        {isHelpOpen && (
          <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm animate-fade-in text-left space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
                <Sparkles size={20} className="text-blue-500 shrink-0" />
                Student Union Financial App Guide (Simply Explained)
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                A simple, jargon-free handbook to help you master every single feature of your Student Union ledger!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-gray-600 leading-relaxed">
              
              {/* Box 1 */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-mono">1</span>
                  Daily Ledger Entries
                </div>
                <p className="text-[11px]">
                  Think of this as your <strong>financial diary</strong>. Every time the Union receives or spends money, you write it down here.
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <p>• <strong className="text-indigo-600">Debit (Dr):</strong> Where the money is going <strong>TO</strong> (e.g., your Bank account or buying laptops).</p>
                  <p>• <strong className="text-emerald-600">Credit (Cr):</strong> Where the money came <strong>FROM</strong> (e.g., student dues or donations).</p>
                </div>
              </div>

              {/* Box 2 */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-mono">2</span>
                  Student Dues & Records
                </div>
                <p className="text-[11px]">
                  A smart digital <strong>attendance and payment checklist</strong> for all students.
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <p>• See a list of all students and their custom details.</p>
                  <p>• Instantly track who has paid and who still owes money.</p>
                  <p>• Register a new student in one click with automated balance math.</p>
                </div>
              </div>

              {/* Box 3 */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-mono">3</span>
                  Ledger Folders
                </div>
                <p className="text-[11px]">
                  Individual <strong>category filing cabinets</strong> (such as Bank, Cash, Office Expenses, or Sports Event).
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <p>• Groups all transactions of the same category in one clean file.</p>
                  <p>• Displays an interactive running balance timeline.</p>
                  <p>• Shows exactly how individual categories grew or shrank.</p>
                </div>
              </div>

              {/* Box 4 */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-mono">4</span>
                  Trial Balance Audit
                </div>
                <p className="text-[11px]">
                  Our automated <strong>balance scale helper</strong> to catch any human mistakes.
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <p>• Lists every category's incoming and outgoing balances.</p>
                  <p>• Checks if both sides match up perfectly.</p>
                  <p>• If the final difference is exactly <strong>zero</strong>, your book records are 100% flawless!</p>
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-gray-600 leading-relaxed pt-2">

              {/* Box 5 */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-mono">5</span>
                  Receipts & Payments
                </div>
                <p className="text-[11px]">
                  A clear, physical <strong>cash register check</strong>.
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <p>• Lists actual physical cash or bank deposits in one place.</p>
                  <p>• Tracks total actual money going in and out.</p>
                  <p>• The final bottom line shows your exact hand-held money.</p>
                </div>
              </div>

              {/* Box 6 */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-mono">6</span>
                  Income & Expenditure
                </div>
                <p className="text-[11px]">
                  Tells you if your Union is <strong>spending smart</strong> or overspending.
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <p>• Compares yearly income with your actual expenses.</p>
                  <p>• <strong>Surplus:</strong> You saved money for the future!</p>
                  <p>• <strong>Deficit:</strong> You spent more than you collected.</p>
                </div>
              </div>

              {/* Box 7 */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-mono">7</span>
                  Balance Sheet
                </div>
                <p className="text-[11px]">
                  The ultimate <strong>financial health checkup</strong>.
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <p>• Left Side (LHS) lists your Capital Reserve Funds.</p>
                  <p>• Right Side (RHS) lists everything you own (Bank, Cash, Equipment).</p>
                  <p>• Both sides match to prove your overall solvency.</p>
                </div>
              </div>

              {/* Box 8 */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-mono">8</span>
                  Visual Performance
                </div>
                <p className="text-[11px]">
                  Turns boring, dry tables and math into <strong>easy-to-read charts</strong>.
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <p>• Doughnut Charts show your exact expense percentages.</p>
                  <p>• Monthly Trends trace when you saved or spent the most.</p>
                  <p>• Easily identify outliers and plan future budgets.</p>
                </div>
              </div>

            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-[10px] text-gray-400 font-medium">
                💡 Every screen does the heavy math automatically in the background, keeping your union sheets flawless.
              </p>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-all border border-blue-200 cursor-pointer shadow-3xs"
              >
                Dismiss Guide
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Cards summary section (shown on ledger tabs; hidden on Home, Profile, Templates, Settings, and Privacy dedicated pages) */}
        {accounts.length > 0 && activeTab !== 'home' && activeTab !== 'profile' && activeTab !== 'templates' && activeTab !== 'settings' && activeTab !== 'privacy' && (
          <DashboardCards 
            accounts={accounts} 
            entries={entries} 
            onDuesClick={() => setActiveTab(activeTab === 'dues' ? 'journal' : 'dues')}
            activeTab={activeTab}
          />
        )}

        {/* Tabs navigation list (Desktop View Only - hidden on dedicated pages: profile, templates, settings, privacy) */}
        {activeTab !== 'profile' && activeTab !== 'templates' && activeTab !== 'settings' && activeTab !== 'privacy' && (
          <div className="hidden md:flex bg-white border border-gray-200 rounded-xl p-1.5 overflow-x-auto gap-1 shadow-3xs sticky top-16 sm:top-20 z-30 whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth">
            {[
              { id: 'home', label: 'Home', icon: Home, Menu, color: 'text-indigo-600' },
              { id: 'journal', label: 'Journal Spreadsheet', icon: FileText, color: 'text-indigo-600' },
              { id: 'ledgers', label: 'General Ledger', icon: BookOpen, color: 'text-blue-600' },
              { id: 'trial', label: 'Trial Balance', icon: Wallet, color: 'text-orange-500' },
              { id: 'receipts', label: 'Receipts & Payments', icon: RefreshCw, color: 'text-emerald-600' },
              { id: 'expenditure', label: 'Income & Expenditure', icon: TrendingUp, color: 'text-indigo-500' },
              { id: 'balance', label: 'Balance Sheet', icon: Scale, color: 'text-teal-600' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  title={`Select ${tab.label}`}
                  className={`flex-none inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs scale-[0.98]'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-white' : tab.color} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Dynamic Tab Pane Render */}
        <div className="transition-all duration-300">
          {activeTab === 'home' && (
            <HomePage
              accounts={accounts}
              entries={entries}
              onNavigateToJournal={() => setActiveTab('journal')}
              onNavigateToDues={() => setActiveTab('dues')}
            />
          )}

          {activeTab === 'journal' && (
            <JournalSheet
              accounts={accounts}
              entries={entries}
              students={students}
              programs={programs}
              isEditor={isEditor}
              onAddEntry={handleAddEntry}
              onUpdateEntry={handleUpdateEntry}
              onDeleteEntry={handleDeleteEntry}
              onLoadPresets={onLoadPresets}
              onClearAll={onClearAll}
              onImportBackup={onImportBackup}
              sheetName={sheetName}
              sheetTagline={sheetTagline}
              treasurerName={treasurerName}
              treasurerEmail={treasurerEmail}
              academicYear={academicYear}
              onFetchFileChunks={handleFetchFileChunks}
              aiPresets={aiPresets}
              onGenerateAiPresets={handleGenerateAiPresets}
              loadingAiPresets={loadingAiPresets}
              quickTemplateToApply={quickTemplateToApply}
            />
          )}

          {activeTab === 'dues' && (
            <StudentDuesView
              accounts={accounts}
              entries={entries}
              students={students}
              programs={programs}
              isEditor={isEditor}
              showToast={showToast}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onClearAllStudents={handleClearAllStudents}
              onAddEntry={handleAddEntry}
              onAddProgram={handleAddProgram}
              onUpdateProgram={handleUpdateProgram}
              onDeleteProgram={handleDeleteProgram}
            />
          )}

          {activeTab === 'ledgers' && (
            <LedgerSection
              accounts={accounts}
              entries={entries}
              sheetName={sheetName}
              sheetTagline={sheetTagline}
              treasurerName={treasurerName}
              treasurerEmail={treasurerEmail}
              academicYear={academicYear}
            />
          )}

          {activeTab === 'trial' && (
            <TrialBalanceView
              accounts={accounts}
              entries={entries}
            />
          )}

          {activeTab === 'receipts' && (
            <ReceiptsPaymentsView
              accounts={accounts}
              entries={entries}
            />
          )}

          {activeTab === 'expenditure' && (
            <IncomeExpenditureView
              accounts={accounts}
              entries={entries}
            />
          )}

          {activeTab === 'balance' && (
            <BalanceSheetView
              accounts={accounts}
              entries={entries}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              accounts={accounts}
              entries={entries}
              sheetName={sheetName}
              sheetTagline={sheetTagline}
              treasurerName={treasurerName}
              treasurerEmail={treasurerEmail}
              academicYear={academicYear}
              logoIcon={logoIcon}
              allowedEmails={allowedEmails}
              isEditor={isEditor}
              currentUser={currentUser}
              onSaveConfig={handleSaveConfig}
              onQuickUpdateLogo={handleQuickUpdateLogo}
              onNavigateHome={() => setActiveTab('home')}
              onLoadPresets={onLoadPresets}
              onClearAll={onClearAll}
              onImportBackup={onImportBackup}
              onAddAccount={handleAddAccount}
              onEditAccount={handleEditAccount}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeTab === 'profile' && (
            <ProfilePageView
              sheetName={sheetName}
              sheetTagline={sheetTagline}
              treasurerName={treasurerName}
              treasurerEmail={treasurerEmail}
              academicYear={academicYear}
              logoIcon={logoIcon}
              allowedEmails={allowedEmails}
              isEditor={isEditor}
              currentUser={currentUser}
              onQuickUpdateLogo={handleQuickUpdateLogo}
              onSaveConfig={handleSaveConfig}
              onNavigateHome={() => setActiveTab('home')}
              onOpenFullSettings={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'templates' && (
            <QuickTemplatesPageView
              standardPresets={standardPresets}
              aiPresets={aiPresets}
              activePresetTab={activePresetTab}
              setActivePresetTab={setActivePresetTab}
              loadingAiPresets={loadingAiPresets}
              isEditor={isEditor}
              onApplyTemplate={handleApplyTemplate}
              onGenerateAiPresets={handleGenerateAiPresets}
              onNavigateJournal={() => setActiveTab('journal')}
              onNavigateHome={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'privacy' && (
            <PrivacySecurityView
              currentUser={currentUser}
              isEditor={isEditor}
              allowedEmails={allowedEmails}
              treasurerName={treasurerName}
              treasurerEmail={treasurerEmail}
              academicYear={academicYear}
              totalEntries={entries.length}
              totalAccounts={accounts.length}
              onNavigateHome={() => setActiveTab('home')}
              onOpenProfile={() => setActiveTab('profile')}
              onOpenSettings={() => setActiveTab('settings')}
            />
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-gray-250 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-1.5 text-[11px] text-gray-400">
          <p className="font-semibold text-gray-500">{sheetName} © 2026</p>
          <p className="max-w-md mx-auto">
            Providing high fidelity, math-verified accounting controls for class treasurers. Keeps transaction logs secure locally, backup records downloadable as JSON or Microsoft Excel CSV sheets.
          </p>
        </div>
      </footer>

      {/* Confirmation Dialog Component */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertCircle size={20} className="text-rose-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Please Confirm</h3>
              </div>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                {confirmDialog.message}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Confirm Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Elegant Native Toast Notifications for a pristine iframe-safe UX */}
      {toast && (
        <div 
          className={`fixed bottom-20 sm:bottom-5 left-3 right-3 sm:left-auto sm:right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg sm:max-w-sm backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
            toast.type === 'success' 
              ? 'bg-emerald-550 border-emerald-200 bg-emerald-50 text-emerald-800' 
              : toast.type === 'err'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          {toast.type === 'success' && <CheckCircle size={16} className="text-emerald-600 shrink-0" />}
          {toast.type === 'err' && <AlertCircle size={16} className="text-rose-600 shrink-0" />}
          {toast.type === 'info' && <Info size={16} className="text-indigo-600 shrink-0" />}
          
          <div className="text-xs font-semibold leading-normal flex-1">
            {toast.message}
          </div>
          
          <button 
            onClick={() => setToast(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer transition-colors shrink-0"
            title="Dismiss notification"
          >
            <X size={12} className="opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* 📱 Premium Android Chrome Bottom Navigation Bar (Reachability First) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 py-1.5 px-2 flex justify-around items-center shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <button
          onClick={() => {
            setActiveTab('home');
            setIsReportsMobileMenuOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home' ? 'text-indigo-600 font-extrabold scale-95' : 'text-slate-400'
          }`}
        >
          <Home size={20} className={activeTab === 'home' ? 'text-indigo-600 animate-pulse' : 'text-slate-400'} />
          <span className="text-[10px] mt-1 font-sans">Home</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('journal');
            setIsReportsMobileMenuOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'journal' ? 'text-indigo-600 font-extrabold scale-95' : 'text-slate-400'
          }`}
        >
          <FileText size={20} className={activeTab === 'journal' ? 'text-indigo-600 animate-pulse' : 'text-slate-400'} />
          <span className="text-[10px] mt-1 font-sans">Journal</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('ledgers');
            setIsReportsMobileMenuOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'ledgers' ? 'text-indigo-600 font-extrabold scale-95' : 'text-slate-400'
          }`}
        >
          <BookOpen size={20} className={activeTab === 'ledgers' ? 'text-indigo-600 animate-pulse' : 'text-slate-400'} />
          <span className="text-[10px] mt-1 font-sans">Ledgers</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('dues');
            setIsReportsMobileMenuOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dues' ? 'text-indigo-600 font-extrabold scale-95' : 'text-slate-400'
          }`}
        >
          <UsersIcon size={20} className={activeTab === 'dues' ? 'text-indigo-600 animate-pulse' : 'text-slate-400'} />
          <span className="text-[10px] mt-1 font-sans">Student Dues</span>
        </button>

        <button
          onClick={() => setIsReportsMobileMenuOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            ['trial', 'receipts', 'expenditure', 'balance', 'chart'].includes(activeTab) && !isReportsMobileMenuOpen
              ? 'text-indigo-600 font-extrabold scale-95'
              : 'text-slate-400'
          }`}
        >
          <TrendingUp size={20} className={['trial', 'receipts', 'expenditure', 'balance', 'chart'].includes(activeTab) ? 'text-indigo-600' : 'text-slate-400'} />
          <span className="text-[10px] mt-1 font-sans">Statements</span>
        </button>
      </div>

      {/* 📊 Premium Mobile Sheets & Reports Choice Bottom Overlay Menu */}
      {isReportsMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-xs flex items-end animate-in fade-in duration-200">
          <div 
            className="w-full bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-20 duration-300 flex flex-col p-5 space-y-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Statements & Audits</h3>
                <p className="text-[10px] text-slate-400">Tap to instantly generate the target report sheet</p>
              </div>
              <button
                onClick={() => setIsReportsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-505 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { id: 'trial', label: 'Trial Balance Sheet', desc: 'Debits matching credits trial check', icon: Wallet, color: 'bg-orange-50 text-orange-600 border-orange-100' },
                { id: 'receipts', label: 'Receipts & Payments Account', desc: 'Summary of actual physical cash flow', icon: RefreshCw, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                { id: 'expenditure', label: 'Income & Expenditure', desc: 'Surplus or deficit operational check', icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                { id: 'balance', label: 'Class Balance Sheet', desc: 'Capital reserves vs outstanding assets', icon: Scale, color: 'bg-teal-50 text-teal-600 border-teal-100' },
              ].map((rep) => {
                const Icon = rep.icon;
                const isCurrent = activeTab === rep.id;
                return (
                  <button
                    key={rep.id}
                    onClick={() => {
                      setActiveTab(rep.id as any);
                      setIsReportsMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[52px] p-3 border rounded-xl flex items-center gap-3.5 text-left transition-all cursor-pointer ${
                      isCurrent 
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900 ring-2 ring-indigo-500/10' 
                        : 'border-slate-150 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${rep.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${isCurrent ? 'font-extrabold text-indigo-950' : 'font-bold text-slate-800'}`}>
                        {rep.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{rep.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar Overlay */}
      {isAppSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsAppSidebarOpen(false)}
          ></div>
          <div className="relative w-84 sm:w-96 max-w-[92vw] bg-white h-full shadow-2xl flex flex-col animate-slide-in-left">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <Menu className="text-gray-600" size={18} />
                <h3 className="font-bold text-gray-900 text-sm">App Menu</h3>
              </div>
              <button 
                onClick={() => setIsAppSidebarOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {/* Button 1: Profile (Opens dedicated Profile page) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs transition-all">
                <button
                  type="button"
                  id="profile-sidebar-button"
                  onClick={() => {
                    setActiveTab('profile');
                    setIsAppSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 text-left cursor-pointer transition-colors group ${
                    activeTab === 'profile'
                      ? 'bg-indigo-50 border-l-4 border-l-indigo-600 text-indigo-950'
                      : 'bg-slate-50/60 hover:bg-indigo-50/40 text-slate-800 hover:text-indigo-900'
                  }`}
                  title="Open Profile & Settings Page"
                >
                  <div className="flex items-center gap-2.5 font-bold text-xs">
                    <UserIcon size={16} className={activeTab === 'profile' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-indigo-600 transition-colors'} />
                    <span>Profile</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight 
                      size={16} 
                      className={`transition-colors ${
                        activeTab === 'profile' ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'
                      }`} 
                    />
                  </div>
                </button>
              </div>

              {/* Button 2: Quick Templates (Opens dedicated Quick Templates page) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs transition-all">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('templates');
                    setIsAppSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 text-left cursor-pointer transition-colors group ${
                    activeTab === 'templates'
                      ? 'bg-indigo-50 border-l-4 border-l-indigo-600 text-indigo-950'
                      : 'bg-slate-50/60 hover:bg-indigo-50/40 text-slate-800 hover:text-indigo-900'
                  }`}
                  title="Open Quick Templates Hub Page"
                >
                  <div className="flex items-center gap-2.5 font-bold text-xs">
                    <Sparkles size={16} className={activeTab === 'templates' ? 'text-indigo-600 animate-pulse' : 'text-indigo-500 group-hover:text-indigo-600 transition-colors animate-pulse'} />
                    <span>Quick Templates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight 
                      size={16} 
                      className={`transition-colors ${
                        activeTab === 'templates' ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'
                      }`} 
                    />
                  </div>
                </button>
              </div>

              {/* Button 3: Privacy & Security (Opens dedicated Privacy & Security page) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs transition-all">
                <button
                  type="button"
                  id="privacy-sidebar-button"
                  onClick={() => {
                    setActiveTab('privacy');
                    setIsAppSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 text-left cursor-pointer transition-colors group ${
                    activeTab === 'privacy'
                      ? 'bg-indigo-50 border-l-4 border-l-indigo-600 text-indigo-950'
                      : 'bg-slate-50/60 hover:bg-indigo-50/40 text-slate-800 hover:text-indigo-900'
                  }`}
                  title="Open Privacy & Security Page"
                >
                  <div className="flex items-center gap-2.5 font-bold text-xs">
                    <ShieldCheck size={16} className={activeTab === 'privacy' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-indigo-600 transition-colors'} />
                    <span>Privacy & Security</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight 
                      size={16} 
                      className={`transition-colors ${
                        activeTab === 'privacy' ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'
                      }`} 
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
