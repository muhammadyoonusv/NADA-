/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Account, JournalEntry } from '../types';
import { getAccountBalances } from '../utils/accounting';
import { Wallet, Landmark, TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';

interface DashboardCardsProps {
  accounts: Account[];
  entries: JournalEntry[];
  onDuesClick?: () => void;
  activeTab?: string;
}

export function DashboardCards({ accounts, entries, onDuesClick, activeTab }: DashboardCardsProps) {
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

  const cards = [
    {
      title: 'Cash Balance',
      value: formatAmount(cashBal),
      raw: cashBal,
      icon: Wallet,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      iconColor: 'text-emerald-500',
    },
    {
      title: 'Bank Balance',
      value: formatAmount(bankBal),
      raw: bankBal,
      icon: Landmark,
      color: 'bg-blue-50 text-blue-700 border-blue-100',
      iconColor: 'text-blue-500',
    },
    {
      title: 'Total Income',
      value: formatAmount(totalIncome),
      raw: totalIncome,
      icon: TrendingUp,
      color: 'bg-teal-50 text-teal-700 border-teal-100',
      iconColor: 'text-teal-500',
    },
    {
      title: 'Total Payments',
      value: formatAmount(totalExpense),
      raw: totalExpense,
      icon: TrendingDown,
      color: 'bg-rose-50 text-rose-700 border-rose-100',
      iconColor: 'text-rose-500',
    },
    {
      title: 'Net Union Surplus',
      value: formatAmount(netSurplus),
      raw: netSurplus,
      icon: DollarSign,
      color: netSurplus >= 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100',
      iconColor: netSurplus >= 0 ? 'text-indigo-500' : 'text-amber-500',
    },
  ];

  if (onDuesClick) {
    cards.push({
      title: 'Student Union Dues',
      value: '',
      raw: 0,
      icon: Users,
      color: activeTab === 'dues'
        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md font-bold'
        : 'bg-indigo-50 text-indigo-700 border-indigo-150 hover:bg-indigo-100 hover:shadow-md cursor-pointer duration-200 transition-all font-bold',
      iconColor: activeTab === 'dues' ? 'text-indigo-200' : 'text-indigo-600',
      onClick: onDuesClick,
    } as any);
  }

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-2 ${onDuesClick ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5'} gap-2 sm:gap-4 mb-4 sm:mb-6`}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isClickable = 'onClick' in card;
        
        if (isClickable) {
          return (
            <button
              key={idx}
              id={`dashboard-card-${idx}`}
              onClick={(card as any).onClick}
              className={`p-4 rounded-xl border ${card.color} transition-all flex items-center justify-between text-left cursor-pointer hover:scale-[1.02] active:scale-[0.98]`}
              type="button"
            >
              <div>
                <p className={`text-xs ${idx === 5 ? 'font-bold' : 'font-semibold'} uppercase tracking-wider opacity-75`}>{card.title}</p>
                {card.value && <h3 className="text-xl font-bold font-mono mt-1">{card.value}</h3>}
              </div>
              <div className={`p-2.5 rounded-lg bg-white/80 shadow-xs ${card.iconColor}`}>
                <Icon size={20} />
              </div>
            </button>
          );
        }

        return (
          <div
            key={idx}
            id={`dashboard-card-${idx}`}
            className={`p-4 rounded-xl border ${card.color} transition-all hover:shadow-sm flex items-center justify-between`}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-75">{card.title}</p>
              {card.value && <h3 className="text-xl font-bold font-mono mt-1">{card.value}</h3>}
            </div>
            <div className={`p-2.5 rounded-lg bg-white/80 shadow-xs ${card.iconColor}`}>
              <Icon size={20} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
