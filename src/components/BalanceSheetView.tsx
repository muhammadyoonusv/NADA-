/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Account, JournalEntry } from '../types';
import { getBalanceSheet } from '../utils/accounting';
import { ShieldCheck, Printer, Scale } from 'lucide-react';

interface BalanceSheetViewProps {
  accounts: Account[];
  entries: JournalEntry[];
}

export function BalanceSheetView({ accounts, entries }: BalanceSheetViewProps) {
  const {
    assets,
    liabilities,
    unionFund,
    totalAssets,
    totalLiabilitiesAndFund,
  } = getBalanceSheet(accounts, entries);

  // Financial system balance check
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndFund) < 0.01;

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(num);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-150 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-950 flex items-center gap-2">
            <Scale size={20} className="text-emerald-600" />
            Class Union Balance Sheet Statement
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">As of {new Date().toISOString().split('T')[0]} (Automatically Computed)</p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm rounded-lg font-medium transition-all shadow-2xs"
        >
          <Printer size={14} />
          Print / Save PDF
        </button>
      </div>

      {/* Safety balance verification status banner */}
      {isBalanced && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
          <div>
            <span className="font-bold">Perfect Balance Sheet Integrity</span> — Total Assets are equal to Total Liabilities and Union Funds. Both sides total <span className="font-bold underline">{formatAmount(totalAssets)}</span>.
          </div>
        </div>
      )}

      {/* Structured Double-Column Balance Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border border-gray-200 rounded-xl overflow-hidden bg-slate-50">
        
        {/* COLUMN 1: ASSETS */}
        <div className="bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col justify-between">
          <div>
            <div className="p-3 bg-slate-100 border-b border-gray-150 text-xs font-bold text-slate-800 tracking-wider font-mono">
              ASSETS / ECONOMIC RESOURCES
            </div>

            <div className="p-3 divide-y divide-gray-100 space-y-2">
              <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-2">Current Liquid Assets</h5>
              {assets.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-xs italic">No Assets found.</div>
              ) : (
                assets.map((item, idx) => (
                  <div key={idx} className="py-2.5 px-3 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                    <span className="text-gray-700 font-serif font-semibold text-base">{item.name}</span>
                    <span className="font-mono font-bold text-slate-900">{formatAmount(item.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-gray-150 flex justify-between font-extrabold text-sm font-mono text-slate-900">
            <span>TOTAL ASSETS:</span>
            <span>{formatAmount(totalAssets)}</span>
          </div>
        </div>

        {/* COLUMN 2: LIABILITIES & UNION FUND */}
        <div className="bg-white flex flex-col justify-between">
          <div>
            <div className="p-3 bg-slate-100 border-b border-gray-150 text-xs font-bold text-slate-800 tracking-wider font-mono">
              LIABILITIES & ACCUMULATED FUND
            </div>

            <div className="p-3 divide-y divide-gray-105 space-y-2">
              {/* Union Equity/Fund breakdown */}
              <div>
                <h5 className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest pl-2 pb-1 bg-white">Accumulated Capital Fund</h5>
                <div className="py-2 px-3 space-y-1.5 text-xs text-slate-600 bg-indigo-50/50 rounded-lg border border-indigo-100">
                  <div className="flex justify-between">
                    <span>Opening Union Balance:</span>
                    <span className="font-mono font-semibold">{formatAmount(unionFund.opening)}</span>
                  </div>
                  {unionFund.surplus >= 0 ? (
                    <div className="flex justify-between">
                      <span className="text-emerald-700 font-semibold">+ Net Surplus from Income Period:</span>
                      <span className="font-mono font-semibold text-emerald-600">{formatAmount(unionFund.surplus)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-rose-700 font-semibold">- Net Deficit from Expenditures Period:</span>
                      <span className="font-mono font-semibold text-rose-600">{formatAmount(Math.abs(unionFund.surplus))}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-indigo-100 pt-1.5 text-sm font-bold text-indigo-900">
                    <span>Closing Union Capital Fund:</span>
                    <span className="font-mono">{formatAmount(unionFund.total)}</span>
                  </div>
                </div>
              </div>

              {/* Liabilities breakdown if any */}
              <div>
                <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-2 pt-2">Current Liabilities</h5>
                {liabilities.length === 0 ? (
                  <div className="py-2.5 px-3 text-xs text-gray-400 italic">No external payload liabilities.</div>
                ) : (
                  liabilities.map((item, idx) => (
                    <div key={idx} className="py-2 px-3 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-mono font-bold text-slate-900">{formatAmount(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-gray-150 flex justify-between font-extrabold text-sm font-mono text-slate-900">
            <span>TOTAL LIABILITIES & FUNDS:</span>
            <span>{formatAmount(totalLiabilitiesAndFund)}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl text-center text-xs text-gray-500 font-serif">
        Accounting Equation Balance: <span className="font-bold text-emerald-800">Assets = Liabilities + Owner (Union) Equity/Fund</span>.
        Our system automatically verifies this ledger balance continuously.
      </div>
    </div>
  );
}
