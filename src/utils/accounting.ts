/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Account, JournalEntry, LedgerRow, AccountType } from '../types';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: '1', name: 'Cash', type: 'Asset', isSystem: true },
  { id: '2', name: 'Bank', type: 'Asset', isSystem: true },
  { id: '3', name: 'Union Fund (Accumulated)', type: 'Equity', isSystem: true },
  { id: '4', name: 'Membership Fees', type: 'Income', isSystem: false },
  { id: '5', name: 'Tour Sponsor Fees', type: 'Income', isSystem: false },
  { id: '6', name: 'Cultural Day Ticket Sales', type: 'Income', isSystem: false },
  { id: '7', name: 'Food & Refreshments', type: 'Expense', isSystem: false },
  { id: '8', name: 'Printing & Stationery', type: 'Expense', isSystem: false },
  { id: '9', name: 'Union Hall / Stage Rent', type: 'Expense', isSystem: false },
  { id: '10', name: 'Trophies & Banners', type: 'Expense', isSystem: false },
  { id: '11', name: 'Welfare Grant / Charity', type: 'Expense', isSystem: false },
];

export const DEFAULT_TRANSACTIONS: JournalEntry[] = [
  {
    id: 't1',
    date: '2026-06-01',
    debitAccount: '2', // Bank
    creditAccount: '4', // Membership Fees
    amount: 1000,
    narration: 'Annual class union membership fees from 50 class students.',
  },
  {
    id: 't2',
    date: '2026-06-02',
    debitAccount: '1', // Cash
    creditAccount: '2', // Bank
    amount: 150,
    narration: 'Withdrew cash from bank to establish daily operational funds.',
  },
  {
    id: 't3',
    date: '2026-06-02',
    debitAccount: '8', // Printing & Stationery
    creditAccount: '1', // Cash
    amount: 45,
    narration: 'Purchased printing papers and brochures for class campaign.',
  },
  {
    id: 't4',
    date: '2026-06-03',
    debitAccount: '9', // Rent
    creditAccount: '2', // Bank
    amount: 300,
    narration: 'Stage equipment setup and hall booking fee for union meet.',
  },
  {
    id: 't5',
    date: '2026-06-03',
    debitAccount: '2', // Bank
    creditAccount: '5', // Tour Sponsor Fees
    amount: 500,
    narration: 'Corporate sponsorship received for sports tournament.',
  },
  {
    id: 't6',
    date: '2026-06-04',
    debitAccount: '7', // Food & Refreshments
    creditAccount: '1', // Cash
    amount: 60,
    narration: 'Purchased snacks, juices, and tea for executive board meeting.',
  },
  {
    id: 't7',
    date: '2026-06-04',
    debitAccount: '10', // Trophies & Banners
    creditAccount: '2', // Bank
    amount: 200,
    narration: 'Purchased engraved metal trophies and champion banner.',
  },
];

/**
 * Calculates current ledger rows for a specific account.
 */
export function getLedgerForAccount(
  accountId: string,
  accounts: Account[],
  entries: JournalEntry[]
): LedgerRow[] {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return [];

  // Sort entries by date and ID
  const sortedEntries = [...entries].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.id.localeCompare(b.id);
  });

  const ledgerRows: LedgerRow[] = [];
  let runningBalance = 0;

  for (const entry of sortedEntries) {
    if (entry.isCompound) {
      const dbSum = entry.debits?.filter((d) => d.accountId === accountId).reduce((s, d) => s + d.amount, 0) || 0;
      const crSum = entry.credits?.filter((c) => c.accountId === accountId).reduce((s, c) => s + c.amount, 0) || 0;

      if (dbSum > 0) {
        const dbItem = entry.debits?.find((d) => d.accountId === accountId);
        const legType = dbItem?.type || account.type;
        if (legType === 'Asset' || legType === 'Expense') {
          runningBalance += dbSum;
        } else {
          runningBalance -= dbSum;
        }
        const otherAccountIds = entry.credits?.map((c) => c.accountId) || [];
        const otherAccountsStr = otherAccountIds.map((id) => accounts.find((a) => a.id === id)?.name || id).join(', ');
        ledgerRows.push({
          date: entry.date,
          particulars: `To ${otherAccountsStr || 'Compound'} (Dr)`,
          type: 'Debit',
          amount: dbSum,
          balance: runningBalance,
          narration: entry.narration,
        });
      }

      if (crSum > 0) {
        const crItem = entry.credits?.find((c) => c.accountId === accountId);
        const legType = crItem?.type || account.type;
        if (legType === 'Asset' || legType === 'Expense') {
          runningBalance -= crSum;
        } else {
          runningBalance += crSum;
        }
        const otherAccountIds = entry.debits?.map((d) => d.accountId) || [];
        const otherAccountsStr = otherAccountIds.map((id) => accounts.find((a) => a.id === id)?.name || id).join(', ');
        ledgerRows.push({
          date: entry.date,
          particulars: `By ${otherAccountsStr || 'Compound'} (Cr)`,
          type: 'Credit',
          amount: crSum,
          balance: runningBalance,
          narration: entry.narration,
        });
      }
    } else {
      if (entry.debitAccount === accountId) {
        const legType = entry.debitAccountType || account.type;
        if (legType === 'Asset' || legType === 'Expense') {
          runningBalance += entry.amount;
        } else {
          runningBalance -= entry.amount;
        }
        const otherAccount = accounts.find((a) => a.id === entry.creditAccount)?.name || 'Unknown Account';
        ledgerRows.push({
          date: entry.date,
          particulars: `To ${otherAccount} (Dr)`,
          type: 'Debit',
          amount: entry.amount,
          balance: runningBalance,
          narration: entry.narration,
        });
      } else if (entry.creditAccount === accountId) {
        const legType = entry.creditAccountType || account.type;
        if (legType === 'Asset' || legType === 'Expense') {
          runningBalance -= entry.amount;
        } else {
          runningBalance += entry.amount;
        }
        const otherAccount = accounts.find((a) => a.id === entry.debitAccount)?.name || 'Unknown Account';
        ledgerRows.push({
          date: entry.date,
          particulars: `By ${otherAccount} (Cr)`,
          type: 'Credit',
          amount: entry.amount,
          balance: runningBalance,
          narration: entry.narration,
        });
      }
    }
  }

  return ledgerRows;
}

/**
 * Computes net balances for all accounts.
 */
export function getAccountBalances(
  accounts: Account[],
  entries: JournalEntry[]
): Record<string, { debit: number; credit: number; balance: number; side: 'Debit' | 'Credit' }> {
  const balances: Record<string, { debit: number; credit: number; balance: number; side: 'Debit' | 'Credit' }> = {};

  for (const acc of accounts) {
    balances[acc.id] = { debit: 0, credit: 0, balance: 0, side: 'Debit' };
  }

  for (const entry of entries) {
    if (entry.isCompound) {
      for (const d of entry.debits || []) {
        if (balances[d.accountId]) {
          balances[d.accountId].debit += d.amount;
        }
      }
      for (const c of entry.credits || []) {
        if (balances[c.accountId]) {
          balances[c.accountId].credit += c.amount;
        }
      }
    } else {
      if (balances[entry.debitAccount]) {
        balances[entry.debitAccount].debit += entry.amount;
      }
      if (balances[entry.creditAccount]) {
        balances[entry.creditAccount].credit += entry.amount;
      }
    }
  }

  for (const acc of accounts) {
    const data = balances[acc.id];
    let balance = 0;
    let side: 'Debit' | 'Credit' = 'Debit';

    if (acc.type === 'Asset' || acc.type === 'Expense') {
      balance = data.debit - data.credit;
      side = 'Debit';
    } else {
      balance = data.credit - data.debit;
      side = 'Credit';
    }

    balances[acc.id] = {
      debit: data.debit,
      credit: data.credit,
      balance,
      side,
    };
  }

  return balances;
}

/**
 * Interface representing a trial balance report line item
 */
export interface TrialBalanceItem {
  id: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
}

/**
 * Computes Trial Balance
 */
export function getTrialBalance(
  accounts: Account[],
  entries: JournalEntry[]
): { items: TrialBalanceItem[]; totalDebit: number; totalCredit: number } {
  const balances = getAccountBalances(accounts, entries);
  const items: TrialBalanceItem[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const acc of accounts) {
    const balData = balances[acc.id];
    if (balData.balance === 0 && balData.debit === 0 && balData.credit === 0) {
      continue; // Skip zero balance accounts to keep it clean, but let's include if they had transactions
    }

    let debitValue = 0;
    let creditValue = 0;

    if (balData.side === 'Debit') {
      if (balData.balance >= 0) {
        debitValue = balData.balance;
      } else {
        creditValue = Math.abs(balData.balance);
      }
    } else {
      if (balData.balance >= 0) {
        creditValue = balData.balance;
      } else {
        debitValue = Math.abs(balData.balance);
      }
    }

    totalDebit += debitValue;
    totalCredit += creditValue;

    items.push({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      debit: debitValue,
      credit: creditValue,
    });
  }

  return { items, totalDebit, totalCredit };
}

/**
 * Represents item in Receipts and Payments report
 */
export interface CashFlowItem {
  accountName: string;
  amount: number;
}

/**
 * Computes the Receipts and Payments account summary.
 * Cash (1) and Bank (2) are considered cash-book accounts.
 */
export function getReceiptsAndPaymentsSum(
  accounts: Account[],
  entries: JournalEntry[]
): {
  receipts: CashFlowItem[];
  payments: CashFlowItem[];
  totalReceipts: number;
  totalPayments: number;
  openingBalance: number;
  closingBalance: number;
} {
  const receiptsMap: Record<string, number> = {};
  const paymentsMap: Record<string, number> = {};

  const cashBankIds = ['1', '2']; // 1 = Cash, 2 = Bank

  // Total cash & bank transaction flows
  for (const entry of entries) {
    if (entry.isCompound) {
      const debitsCashBank = (entry.debits || []).filter(d => cashBankIds.includes(d.accountId));
      const creditsCashBank = (entry.credits || []).filter(c => cashBankIds.includes(c.accountId));
      const isDebited = debitsCashBank.length > 0;
      const isCredited = creditsCashBank.length > 0;

      if (isDebited) {
        const totalDrCashBank = debitsCashBank.reduce((sum, d) => sum + d.amount, 0);
        const nonCbCredits = (entry.credits || []).filter(c => !cashBankIds.includes(c.accountId));
        const nonCbTotal = nonCbCredits.reduce((sum, c) => sum + c.amount, 0);
        if (nonCbTotal > 0) {
          for (const c of nonCbCredits) {
            const creditsName = accounts.find((a) => a.id === c.accountId)?.name || 'Union Inflows';
            const proportionAmount = (c.amount / nonCbTotal) * totalDrCashBank;
            receiptsMap[creditsName] = (receiptsMap[creditsName] || 0) + proportionAmount;
          }
        } else {
          for (const c of entry.credits || []) {
            const creditsName = accounts.find((a) => a.id === c.accountId)?.name || 'Union Inflows';
            receiptsMap[creditsName] = (receiptsMap[creditsName] || 0) + c.amount;
          }
        }
      }
      
      if (isCredited) {
        const totalCrCashBank = creditsCashBank.reduce((sum, c) => sum + c.amount, 0);
        const nonCbDebits = (entry.debits || []).filter(d => !cashBankIds.includes(d.accountId));
        const nonCbTotal = nonCbDebits.reduce((sum, d) => sum + d.amount, 0);
        if (nonCbTotal > 0) {
          for (const d of nonCbDebits) {
            const debitsName = accounts.find((a) => a.id === d.accountId)?.name || 'Union Outflows';
            const proportionAmount = (d.amount / nonCbTotal) * totalCrCashBank;
            paymentsMap[debitsName] = (paymentsMap[debitsName] || 0) + proportionAmount;
          }
        } else {
          for (const d of entry.debits || []) {
            const debitsName = accounts.find((a) => a.id === d.accountId)?.name || 'Union Outflows';
            paymentsMap[debitsName] = (paymentsMap[debitsName] || 0) + d.amount;
          }
        }
      }
    } else {
      const isDebited = cashBankIds.includes(entry.debitAccount);
      const isCredited = cashBankIds.includes(entry.creditAccount);

      if (isDebited && isCredited) {
        continue;
      }

      if (isDebited) {
        const creditsName = accounts.find((a) => a.id === entry.creditAccount)?.name || 'Union Inflows';
        receiptsMap[creditsName] = (receiptsMap[creditsName] || 0) + entry.amount;
      } else if (isCredited) {
        const debitsName = accounts.find((a) => a.id === entry.debitAccount)?.name || 'Union Outflows';
        paymentsMap[debitsName] = (paymentsMap[debitsName] || 0) + entry.amount;
      }
    }
  }

  const receipts = Object.entries(receiptsMap).map(([accountName, amount]) => ({
    accountName,
    amount,
  }));

  const payments = Object.entries(paymentsMap).map(([accountName, amount]) => ({
    accountName,
    amount,
  }));

  const totalReceipts = receipts.reduce((sum, item) => sum + item.amount, 0);
  const totalPayments = payments.reduce((sum, item) => sum + item.amount, 0);

  // Since we don't have hardcoded opening balances in ledger entries, let's treat any
  // 'Union Fund (Accumulated)' credits as opening balances of Cash/Bank if they were the contra or manually configured.
  // Actually, we can assume a clean slate opening balance = 0, or calculate let the user configure it.
  // For standard Union accounting, we can calculate:
  const openingBalance = 0; // Or treat it as user-provided
  const closingBalance = openingBalance + totalReceipts - totalPayments;

  return {
    receipts,
    payments,
    totalReceipts,
    totalPayments,
    openingBalance,
    closingBalance,
  };
}

/**
 * Computes Balance Sheet
 * Note: Union Surplus = Total Income - Total Expenses.
 * Total Assets = Current cash on hand + other assets.
 * Let's structure a clean financial Balance Sheet.
 */
export function getBalanceSheet(
  accounts: Account[],
  entries: JournalEntry[]
): {
  assets: { name: string; amount: number }[];
  liabilities: { name: string; amount: number }[];
  unionFund: { opening: number; surplus: number; total: number };
  totalAssets: number;
  totalLiabilitiesAndFund: number;
} {
  const balances = getAccountBalances(accounts, entries);

  const assetsList: { name: string; amount: number }[] = [];
  const liabilitiesList: { name: string; amount: number }[] = [];

  let accumulatedFundOpening = 0;

  // Let's compute actual Income & Expenses
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const acc of accounts) {
    const details = balances[acc.id];
    if (acc.type === 'Asset') {
      assetsList.push({ name: acc.name, amount: details.balance });
    } else if (acc.type === 'Liability') {
      liabilitiesList.push({ name: acc.name, amount: details.balance });
    } else if (acc.type === 'Equity') {
      if (acc.id === '3') {
        accumulatedFundOpening = details.balance;
      } else {
        liabilitiesList.push({ name: acc.name, amount: details.balance });
      }
    } else if (acc.type === 'Income') {
      totalIncome += details.balance;
    } else if (acc.type === 'Expense') {
      totalExpenses += details.balance;
    }
  }

  const surplus = totalIncome - totalExpenses;
  const totalFund = accumulatedFundOpening + surplus;

  const totalAssets = assetsList.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilitiesAndFund = liabilitiesList.reduce((sum, item) => sum + item.amount, 0) + totalFund;

  return {
    assets: assetsList,
    liabilities: liabilitiesList,
    unionFund: {
      opening: accumulatedFundOpening,
      surplus,
      total: totalFund,
    },
    totalAssets,
    totalLiabilitiesAndFund,
  };
}

/**
 * Computes Income and Expenditure Account statement for the NPO.
 */
export function getIncomeAndExpenditure(
  accounts: Account[],
  entries: JournalEntry[]
): {
  incomes: { name: string; amount: number }[];
  expenditures: { name: string; amount: number }[];
  totalIncome: number;
  totalExpenditure: number;
  balanceType: 'Surplus' | 'Deficit';
  balanceAmount: number;
} {
  const balances = getAccountBalances(accounts, entries);
  const incomes: { name: string; amount: number }[] = [];
  const expenditures: { name: string; amount: number }[] = [];

  let totalIncome = 0;
  let totalExpenditure = 0;

  for (const acc of accounts) {
    const details = balances[acc.id];
    if (acc.type === 'Income') {
      if (details.balance !== 0 || details.debit > 0 || details.credit > 0) {
        incomes.push({ name: acc.name, amount: details.balance });
        totalIncome += details.balance;
      }
    } else if (acc.type === 'Expense') {
      if (details.balance !== 0 || details.debit > 0 || details.credit > 0) {
        expenditures.push({ name: acc.name, amount: details.balance });
        totalExpenditure += details.balance;
      }
    }
  }

  const diff = totalIncome - totalExpenditure;
  const balanceType = diff >= 0 ? 'Surplus' : 'Deficit';
  const balanceAmount = Math.abs(diff);

  return {
    incomes,
    expenditures,
    totalIncome,
    totalExpenditure,
    balanceType,
    balanceAmount,
  };
}
