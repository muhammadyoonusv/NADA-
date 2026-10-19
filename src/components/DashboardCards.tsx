/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Account, JournalEntry } from '../types';
import { getAccountBalances } from '../utils/accounting';
import { Wallet, Landmark, TrendingUp, TrendingDown, Coins, Users } from 'lucide-react';

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
    if (balData) {
      if (acc.type === 'Income') {
        totalIncome += balData.balance;
      } else if (acc.type === 'Expense') {
        totalExpense += balData.balance;
      }
    }
  }

  const netSurplus = totalIncome - totalExpense;

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const cards = [
    {
      title: 'Cash Balance',
      value: formatAmount(cashBal),
      raw: cashBal,
      icon: Wallet,
      color: 'bg-[#E8F8F5] text-[#047857] border-[#C7F0E7]',
      iconContainer: 'bg-[#C1F2E8] text-[#00A884]',
    },
    {
      title: 'Bank Balance',
      value: formatAmount(bankBal),
      raw: bankBal,
      icon: Landmark,
      color: 'bg-[#EBF5FF] text-[#1D4ED8] border-[#CCE4FF]',
      iconContainer: 'bg-[#D6EAFF] text-[#1E70EB]',
    },
    {
      title: 'Total Income',
      value: formatAmount(totalIncome),
      raw: totalIncome,
      icon: TrendingUp,
      color: 'bg-[#EEFBF4] text-[#15803D] border-[#D1F5E1]',
      iconContainer: 'bg-[#D5F7E4] text-[#16A34A]',
    },
    {
      title: 'Total Payments',
      value: `- ${formatAmount(totalExpense)}`,
      raw: totalExpense,
      icon: TrendingDown,
      color: 'bg-[#FFF1F2] text-[#BE123C] border-[#FFE0E3]',
      iconContainer: 'bg-[#FFE2E6] text-[#E11D48]',
    },
    {
      title: 'Net Union Surplus',
      value: formatAmount(netSurplus),
      raw: netSurplus,
      icon: Coins,
      color: 'bg-[#F5F1FF] text-[#6D28D9] border-[#E4D9FF]',
      iconContainer: 'bg-[#E8DEFF] text-[#7C3AED]',
    },
  ];

  if (onDuesClick) {
    cards.push({
      title: 'Student Union Dues',
      value: 'View Roster',
      raw: 0,
      icon: Users,
      color: activeTab === 'dues'
        ? 'bg-[#7C3AED] text-white border-[#6D28D9] shadow-xs'
        : 'bg-[#FFF7ED] text-[#C2410C] border-[#FFEDD5] hover:bg-[#FFEDD5]/80 transition-colors',
      iconContainer: activeTab === 'dues' ? 'bg-white/20 text-white' : 'bg-[#FFE4C4] text-[#EA580C]',
      onClick: onDuesClick,
    } as any);
  }

  const isCompact = activeTab !== 'home' && activeTab !== undefined;
  
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-2 ${onDuesClick ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5'} gap-2.5 sm:gap-4 ${isCompact ? 'mb-3' : 'mb-4 sm:mb-6'}`}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isClickable = 'onClick' in card;
        
        if (isClickable) {
          return (
            <button
              key={idx}
              id={`dashboard-card-${idx}`}
              onClick={(card as any).onClick}
              className={`${isCompact ? 'p-3' : 'p-4'} rounded-2xl border ${card.color} transition-all ${idx === 5 ? 'hidden md:flex' : 'flex'} items-center justify-between text-left cursor-pointer hover:shadow-xs active:scale-[0.98]`}
              type="button"
            >
              <div>
                <p className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} font-bold uppercase tracking-wider opacity-85`}>{card.title}</p>
                {card.value && <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-extrabold font-mono mt-0.5 tracking-tight`}>{card.value}</h3>}
              </div>
              <div className={`${isCompact ? 'p-1.5' : 'p-2'} rounded-xl shadow-3xs ${card.iconContainer}`}>
                <Icon size={isCompact ? 16 : 20} />
              </div>
            </button>
          );
        }

        return (
          <div
            key={idx}
            id={`dashboard-card-${idx}`}
            className={`${isCompact ? 'p-3' : 'p-4'} rounded-2xl border ${card.color} transition-all hover:shadow-xs flex items-center justify-between`}
          >
            <div>
              <p className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} font-bold uppercase tracking-wider opacity-85`}>{card.title}</p>
              {card.value && <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-extrabold font-mono mt-0.5 tracking-tight`}>{card.value}</h3>}
            </div>
            <div className={`${isCompact ? 'p-1.5' : 'p-2'} rounded-xl shadow-3xs ${card.iconContainer}`}>
              <Icon size={isCompact ? 16 : 20} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
