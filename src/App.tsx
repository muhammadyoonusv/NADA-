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
import { NotificationCenter, AppNotification } from './components/NotificationCenter';
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
  X
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

  const [activeTab, setActiveTab] = useState<'journal' | 'ledgers' | 'trial' | 'receipts' | 'expenditure' | 'balance' | 'chart' | 'dues' | 'settings'>('journal');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Profile and sheet details state
  const [sheetName, setSheetName] = useState('Class Union Ledger');
  const [sheetTagline, setSheetTagline] = useState('Double-entry accounting, instant trials, cash summaries & Balance sheets');
  const [treasurerName, setTreasurerName] = useState('Union Treasurer');
  const [treasurerEmail, setTreasurerEmail] = useState('');
  const [academicYear, setAcademicYear] = useState('2026 - 2027');

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
              sheetName: 'Class Union Ledger',
              sheetTagline: 'Double-entry accounting, instant trials, cash summaries & Balance sheets',
              treasurerName: 'Union Treasurer',
              treasurerEmail: '',
              academicYear: '2026 - 2027',
              allowedEmails: ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com']
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'metadata/config');
          }
        } else {
          setSheetName('Class Union Ledger');
          setSheetTagline('Double-entry accounting, instant trials, cash summaries & Balance sheets');
          setTreasurerName('Union Treasurer');
          setTreasurerEmail('');
          setAcademicYear('2026 - 2027');
          setAllowedEmails(['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com']);
          setLoadingMetadata(false);
        }
      } else {
        const data = docSnap.data();
        setSheetName(data.sheetName || 'Class Union Ledger');
        setSheetTagline(data.sheetTagline || 'Double-entry accounting, instant trials, cash summaries & Balance sheets');
        setTreasurerName(data.treasurerName || 'Union Treasurer');
        setTreasurerEmail(data.treasurerEmail || '');
        setAcademicYear(data.academicYear || '2026 - 2027');
        setAllowedEmails([
          'klrmuhsin809@gmail.com',
          'yoonuschr@gmail.com'
        ]);
        setLoadingMetadata(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'metadata/config');
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
  }) => {
    if (!isEditor) {
      showToast('Access denied: Only authorized editors can update settings.', 'err');
      return;
    }
    try {
      await setDoc(doc(db, 'metadata', 'config'), {
        sheetName: config.sheetName,
        sheetTagline: config.sheetTagline,
        treasurerName: config.treasurerName,
        treasurerEmail: config.treasurerEmail,
        academicYear: config.academicYear,
        allowedEmails: [
          'klrmuhsin809@gmail.com',
          'yoonuschr@gmail.com'
        ]
      });
      showToast('Settings and profile configurations were saved successfully.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'metadata/config');
    }
  };

  // Authentication Handlers
  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast('Successfully authenticated with Google.', 'success');
    } catch (err: any) {
      console.error('Sign-in error:', err);
      // Suppress alert for user-cancelled popups
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.message?.includes('popup-closed-by-user') ||
        err.code === 'auth/cancelled-popup-request' ||
        err.message?.includes('cancelled-popup-request')
      ) {
        console.log('User closed the login popup or request cancelled.');
        return;
      }
      
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans transition-colors duration-250">
      {/* Top Banner header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 mr-[33px] pb-[6px] pt-[7px] mb-[1px]">
            <div 
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md cursor-pointer hover:opacity-90" 
              onClick={() => setActiveTab('settings')} 
              title="Edit Profile & Settings"
            >
              <FolderLock size={20} />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-gray-900 sm:text-lg flex items-center gap-1.5 leading-none">
                <span>{sheetName}</span>
                <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md uppercase font-mono hidden sm:inline-block">
                  {academicYear}
                </span>
                <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-2 py-0.5 rounded-md uppercase font-mono">
                  v3
                </span>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="p-1 hover:bg-slate-100 text-gray-400 hover:text-indigo-600 rounded cursor-pointer transition-colors"
                  title="Edit Sheet Title & Profile"
                >
                  <Edit size={13} />
                </button>
              </h1>
              <p className="text-[11px] text-gray-400 font-medium mt-1">{sheetTagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Google Authentication Control Badge */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-lg select-none -mr-[103px] -ml-[7px] pr-[9px] pt-[10px] pb-[15px] pl-[1px] text-[18px]">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || ''} 
                    className="w-6 h-6 rounded-full border border-gray-300" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left leading-none max-w-[150px]">
                  <p className="text-[10px] font-bold text-gray-800 truncate">{currentUser.displayName || 'Google Account'}</p>
                  <p className="text-[9px] text-gray-400 font-mono truncate">{currentUser.email}</p>
                </div>
                
                {/* Access Level Status indicator */}
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isEditor 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold flex items-center gap-1' 
                    : 'bg-amber-50 border border-amber-200 text-amber-700 font-extrabold flex items-center gap-1'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isEditor ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                  {isEditor ? 'ADMIN' : 'READONLY'}
                </span>

                <button
                  onClick={handleSignOut}
                  className="uppercase tracking-wider text-rose-600 hover:text-rose-800 font-bold border-l border-gray-200 pl-2 transition-colors cursor-pointer text-[10px] -ml-[7px] leading-[29.5px]"
                  title="Sign Out Google Account"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-indigo-200 hover:border-indigo-300 text-indigo-600 text-xs rounded-lg font-bold transition-all shadow-3xs cursor-pointer cursor-pointers hover:scale-[1.01]"
                title="Authenticate to Gain Authorizations"
              >
                <div className="w-4 h-4 rounded-full bg-indigo-50 flex items-center justify-center">
                  <UserIcon size={11} className="text-indigo-600" />
                </div>
                <span>Sign In with Google</span>
              </button>
            )}

            <button
              onClick={() => setIsHelpOpen(!isHelpOpen)}
              className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs rounded-lg font-semibold transition-all shadow-3xs cursor-pointer -mr-[8px] ml-[95px] pb-[11px] pr-[1px] pt-[7px]"
            >
              <HelpCircle size={14} className="text-gray-400 animate-pulse" />
              Treasurer's Accounting Guide
            </button>

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

            {/* Application Settings (moved to the absolute top of the app) */}
            <button
              onClick={() => setActiveTab(activeTab === 'settings' ? 'journal' : 'settings')}
              title={activeTab === 'settings' ? "Close Settings" : "App Settings & Profile"}
              className={`inline-flex items-center justify-center p-2 rounded-lg border transition-all shadow-3xs cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-slate-900 border-slate-900 text-white scale-[0.98]'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings size={14} className={activeTab === 'settings' ? 'text-white' : 'text-slate-500'} />
            </button>
          </div>
        </div>
      </header>

      {/* Main app space */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Help Panel */}
        {isHelpOpen && (
          <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm animate-fade-in text-left">
            <h3 className="font-extrabold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-blue-500" />
              Accounting 101 for Union Treasurers & Secretaries
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 text-xs text-gray-600 leading-relaxed">
              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 text-sm">Double-Entry Ledger Integrity</h4>
                <p>
                  Every financial transaction must balance. In our automated union sheets, you select a <strong>Debit Dr</strong> account (destination of funds) and a <strong>Credit Cr</strong> account (source of funds).
                </p>
                <p>
                  For example: Collecting Fees boosts the <strong>Bank</strong> (Debit Asset) and represents <strong>Membership Fees</strong> (Credit Income).
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 text-sm">The 4 Core Financial Automated Statements</h4>
                <p>
                  • <strong>General Ledger:</strong> Individual listing of transaction items tied to specific names, showing details and running asset/liability balance curves.
                </p>
                <p>
                  • <strong>Trial Balance:</strong> Master audit checking if all Debit balances match Credit balances. If this balances, the union transaction accounting is flawless.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 text-sm">How Cash Summary & Balance Sheets sync</h4>
                <p>
                  The **Receipts & Payments Account** summarizes physical inflows & outflows. Its closing balance is your immediate Cash on Hand.
                </p>
                <p>
                  The **Balance Sheet** organizes Capital Fund reserves on LHS, keeping check of overall financial solvency. The net cash is matched directly to your asset ledger.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="mt-5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors border border-blue-150"
            >
              Dismiss Guide
            </button>
          </div>
        )}

        {/* Dashboard Cards summary section */}
        {accounts.length > 0 && (
          <DashboardCards 
            accounts={accounts} 
            entries={entries} 
            onDuesClick={() => setActiveTab(activeTab === 'dues' ? 'journal' : 'dues')}
            activeTab={activeTab}
          />
        )}

        {/* Tabs navigation list */}
        <div className="bg-white border border-gray-200 rounded-xl p-1.5 flex flex-wrap gap-1 shadow-3xs sticky top-20 z-30">
          {[
            { id: 'journal', label: 'Journal Spreadsheet', icon: FileText, color: 'text-indigo-600' },
            { id: 'ledgers', label: 'General Ledger', icon: BookOpen, color: 'text-blue-600' },
            { id: 'trial', label: 'Trial Balance', icon: Wallet, color: 'text-orange-500' },
            { id: 'receipts', label: 'Receipts & Payments', icon: RefreshCw, color: 'text-emerald-600' },
            { id: 'expenditure', label: 'Income & Expenditure', icon: TrendingUp, color: 'text-indigo-500' },
            { id: 'balance', label: 'Balance Sheet', icon: Scale, color: 'text-teal-600' },
            { id: 'chart', label: 'Chart of Accounts', icon: List, color: 'text-blue-500' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(isActive ? 'journal' : (tab.id as any))}
                title={isActive ? `Go to Journal Spreadsheet` : `Select ${tab.label}`}
                className={`flex-1 min-w-[150px] inline-flex items-center gap-2 justify-center py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

        {/* Dynamic Tab Pane Render */}
        <div className="transition-all duration-300">
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

          {activeTab === 'chart' && (
            <ChartOfAccounts
              accounts={accounts}
              isEditor={isEditor}
              onAddAccount={handleAddAccount}
              onEditAccount={handleEditAccount}
              onDeleteAccount={handleDeleteAccount}
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
              allowedEmails={allowedEmails}
              isEditor={isEditor}
              currentUser={currentUser}
              onSaveConfig={handleSaveConfig}
              onLoadPresets={onLoadPresets}
              onClearAll={onClearAll}
              onImportBackup={onImportBackup}
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
          className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
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
    </div>
  );
}
