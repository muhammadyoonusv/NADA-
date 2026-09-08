/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

export interface Account {
  id: string; // unique ID
  name: string;
  type: AccountType;
  isSystem?: boolean; // Cannot delete Cash, Bank, Union Fund
}

export interface JournalEntry {
  id: string;
  date: string;
  debitAccount: string; // Account ID
  creditAccount: string; // Account ID
  debitAccountType?: AccountType; // Captured type at transaction time
  creditAccountType?: AccountType; // Captured type at transaction time
  amount: number;
  narration: string;
  files?: Array<{
    name: string;
    type: string;
    size: number;
    base64?: string;
    id?: string;
    chunkCount?: number;
  }>;
  isCompound?: boolean;
  debits?: Array<{ accountId: string; amount: number; type?: AccountType }>;
  credits?: Array<{ accountId: string; amount: number; type?: AccountType }>;
}

export interface LedgerRow {
  date: string;
  particulars: string;
  type: 'Debit' | 'Credit';
  amount: number;
  balance: number;
  narration?: string;
}

export interface Student {
  id: string; // unique identifier (e.g. Roll No / ID)
  name: string;
  className?: string; // e.g. "Year 1 Science", "B.Com"
  phone?: string;
  totalDue: number;
  amountPaid: number;
  status: 'Paid' | 'Partial' | 'Pending';
  remarks?: string;
  lastPaymentDate?: string;
}

export interface StudentDuesItem {
  amountPaid: number;
  totalDue: number;
  status: 'Paid' | 'Partial' | 'Pending';
  remarks?: string;
  lastPaymentDate?: string;
}

export interface Program {
  id: string;
  name: string;
  defaultAmount: number;
  date: string;
  remarks?: string;
  studentDues: { [studentId: string]: StudentDuesItem };
  excludedStudentIds?: string[];
  createdAt?: string;
}

