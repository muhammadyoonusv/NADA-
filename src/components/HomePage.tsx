/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Account, JournalEntry } from '../types';
import { getAccountBalances } from '../utils/accounting';
import { 
  Wallet, 
  Landmark, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  ArrowRight, 
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';

interface HomePageProps {
  accounts: Account[];
  entries: JournalEntry[];
  onNavigateToJournal: () => void;
  onNavigateToDues?: () => void;
}

export function HomePage({
  accounts,
  entries,
  onNavigateToJournal,
  onNavigateToDues,
}: HomePageProps) {
  const balances = getAccountBalances(accounts, entries);

  // Extract Cash and Bank balances
  const cashBal = balances['1']?.balance || 0;
  const bankBal = balances['2']?.balance || 0;

  // Sum up all income and expenses
  let totalIncome = 0;
  let totalExpense = 0;

  for (const acc of accounts) {
    const balData = balances[acc.id];
    if (acc.type === 'Income') {
      totalIncome += balData.balance;
    } else if (acc.type === 'Expense') {
      totalExpense += balData.balance;
    }
  }

  const netSurplus = totalIncome - totalExpense;

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(num);
  };

  // Dashboard metric cards
  const cards = [
    {
      title: 'Cash Balance',
      value: formatAmount(cashBal),
      icon: Wallet,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      iconColor: 'text-emerald-600 bg-white/90 shadow-2xs',
    },
    {
      title: 'Bank Balance',
      value: formatAmount(bankBal),
      icon: Landmark,
      color: 'bg-blue-50 text-blue-700 border-blue-100',
      iconColor: 'text-blue-600 bg-white/90 shadow-2xs',
    },
    {
      title: 'Total Income',
      value: formatAmount(totalIncome),
      icon: TrendingUp,
      color: 'bg-teal-50 text-teal-700 border-teal-100',
      iconColor: 'text-teal-600 bg-white/90 shadow-2xs',
    },
    {
      title: 'Total Payments',
      value: formatAmount(totalExpense),
      icon: TrendingDown,
      color: 'bg-rose-50 text-rose-700 border-rose-100',
      iconColor: 'text-rose-600 bg-white/90 shadow-2xs',
    },
    {
      title: 'Net Surplus',
      value: formatAmount(netSurplus),
      icon: DollarSign,
      color: netSurplus >= 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100',
      iconColor: netSurplus >= 0 ? 'text-indigo-600 bg-white/90 shadow-2xs' : 'text-amber-600 bg-white/90 shadow-2xs',
    },
  ];

  // All entries sorted chronologically (latest first)
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Stat Cards Section */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border ${card.color} transition-all hover:shadow-xs flex items-center justify-between`}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-75">{card.title}</p>
                <h3 className="text-lg sm:text-xl font-bold font-mono mt-1">{card.value}</h3>
              </div>
              <div className={`p-2.5 rounded-lg shrink-0 ${card.iconColor}`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Journal Entries Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Journal Transactions</h2>
              <p className="text-xs text-gray-400">{sortedEntries.length} recorded entries</p>
            </div>
          </div>
        </div>

        {sortedEntries.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <FileText className="mx-auto mb-2 text-gray-300" size={32} />
            <p className="font-semibold text-gray-700 text-sm">No journal entries recorded yet.</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Switch to the Journal tab to record union income, dues, payments, and bank transactions.
            </p>
            <button
              onClick={onNavigateToJournal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Sparkles size={14} />
              <span>Go to Journal Sheet</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-150 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Debit (Dr) Account</th>
                  <th className="p-3">Credit (Cr) Account</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {sortedEntries.map((entry, index) => {
                  const drAccName = accounts.find((a) => a.id === entry.debitAccount)?.name || 'Unknown Account';
                  const crAccName = accounts.find((a) => a.id === entry.creditAccount)?.name || 'Unknown Account';

                  return (
                    <tr key={entry.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-3 text-center bg-gray-50/50 font-mono text-xs text-gray-400 font-semibold border-r border-gray-100">
                        {index + 1}
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-700 whitespace-nowrap border-r border-gray-100">
                        {entry.date}
                      </td>
                      <td className="p-3 border-r border-gray-100">
                        {entry.isCompound ? (
                          <div className="space-y-1">
                            {entry.debits?.map((db, idx) => {
                              const name = accounts.find((a) => a.id === db.accountId)?.name || 'Unknown';
                              return (
                                <div key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[11px] font-semibold rounded flex items-center justify-between gap-1">
                                  <span className="truncate">{name}</span>
                                  <span className="text-[10px] font-mono shrink-0">₹{db.amount.toLocaleString('en-IN')}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="inline-flex items-center justify-between gap-2 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded">
                            <span>{drAccName}</span>
                            <span className="text-[9px] uppercase tracking-wider text-emerald-600 font-bold opacity-80">(Dr)</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-r border-gray-100">
                        {entry.isCompound ? (
                          <div className="space-y-1">
                            {entry.credits?.map((cr, idx) => {
                              const name = accounts.find((a) => a.id === cr.accountId)?.name || 'Unknown';
                              return (
                                <div key={idx} className="px-2 py-0.5 bg-rose-50 text-rose-800 text-[11px] font-semibold rounded flex items-center justify-between gap-1">
                                  <span className="truncate">{name}</span>
                                  <span className="text-[10px] font-mono shrink-0">₹{cr.amount.toLocaleString('en-IN')}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="inline-flex items-center justify-between gap-2 px-2 py-0.5 bg-rose-50 text-rose-800 text-xs font-semibold rounded">
                            <span>{crAccName}</span>
                            <span className="text-[9px] uppercase tracking-wider text-rose-600 font-bold opacity-80">(Cr)</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold font-mono text-blue-900 whitespace-nowrap">
                        ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
