/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Account, JournalEntry } from '../types';
import { getLedgerForAccount, getAccountBalances } from '../utils/accounting';
import { Download, BookOpen, Calendar, CreditCard, Coins, Landmark, ArrowRight, TrendingUp, TrendingDown, BookCheck, Printer, X } from 'lucide-react';

interface LedgerSectionProps {
  accounts: Account[];
  entries: JournalEntry[];
  sheetName?: string;
  sheetTagline?: string;
  treasurerName?: string;
  treasurerEmail?: string;
  academicYear?: string;
}

export function LedgerSection({ 
  accounts, 
  entries,
  sheetName = "Class Union Ledger Office",
  sheetTagline = "Continuous double-entry ledger postings mapped automatically from transactions",
  treasurerName = "Authorized Treasurer",
  treasurerEmail = "",
  academicYear = "2026"
}: LedgerSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<'lobby' | 'all'>('lobby');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '1');
  const [printAccount, setPrintAccount] = useState<Account | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const ledgerRows = getLedgerForAccount(selectedAccountId, accounts, entries);
  const accountBalances = getAccountBalances(accounts, entries);
  const balInfo = accountBalances[selectedAccountId];

  // Dynamically identify core liquid cash and bank accounts
  const cashAccount = accounts.find((a) => a.name.toLowerCase() === 'cash') || 
                      accounts.find((a) => a.name.toLowerCase().includes('cash')) || 
                      accounts[0];
                      
  const bankAccount = accounts.find((a) => a.name.toLowerCase() === 'bank') || 
                      accounts.find((a) => a.name.toLowerCase().includes('bank')) || 
                      accounts[1] || 
                      accounts[0];

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(num);
  };

  // Export Specific Ledger CSV Helper
  const exportLedgerCSV = (acc: Account, rows: any[]) => {
    if (!acc) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `LEDGER ACCOUNT: ${acc.name} (${acc.type})\n`;
    csvContent += "Date,Particulars,Debit,Credit,Running Balance\n";

    rows.forEach((row) => {
      const dr = row.type === 'Debit' ? row.amount : '';
      const cr = row.type === 'Credit' ? row.amount : '';
      const csvRow = `"${row.date}","${row.particulars.replace(/"/g, '""')}","${dr}","${cr}","${row.balance}"`;
      csvContent += csvRow + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `General_Ledger_${acc.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Dual accounts balances of interest
  const cashBalance = cashAccount ? (accountBalances[cashAccount.id]?.balance || 0) : 0;
  const bankBalance = bankAccount ? (accountBalances[bankAccount.id]?.balance || 0) : 0;
  const totalLiquidity = cashBalance + bankBalance;

  const cashRows = cashAccount ? getLedgerForAccount(cashAccount.id, accounts, entries) : [];
  const bankRows = bankAccount ? getLedgerForAccount(bankAccount.id, accounts, entries) : [];

  return (
    <div className="space-y-6">
      {/* Subtab Navigation bar for the Ledger lobby */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <BookOpen className="text-blue-600" size={24} />
          <div>
            <h3 className="font-bold text-gray-950 flex items-center gap-1.5 leading-none">
              General Ledger Office
            </h3>
            <p className="text-xs text-gray-400 mt-1">Continuous double-entry ledger postings mapped automatically from transactions</p>
          </div>
        </div>

        {/* Tab Selection buttons */}
        <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium">
          <button
            onClick={() => setActiveSubTab('lobby')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === 'lobby'
                ? 'bg-white text-blue-950 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-950 hover:bg-gray-50/50'
            }`}
          >
            <Coins size={14} className="text-amber-500" />
            Cash & Bank Lobby
          </button>
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === 'all'
                ? 'bg-white text-blue-950 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-950 hover:bg-gray-50/50'
            }`}
          >
            <BookCheck size={14} className="text-blue-500" />
            Individual Accounts
          </button>
        </div>
      </div>

      {activeSubTab === 'lobby' ? (
        <div className="space-y-6">
          {/* Liquidity Highlighting KPI widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
            <div className="p-4 border border-amber-100 bg-amber-50/15 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest font-mono">Cash Ledger Balance</p>
                <p className="text-2xl font-black font-mono mt-1 text-amber-950">{formatAmount(cashBalance)}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
                <Coins size={22} />
              </div>
            </div>

            <div className="p-4 border border-blue-100 bg-blue-50/15 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest font-mono">Bank Ledger Balance</p>
                <p className="text-2xl font-black font-mono mt-1 text-blue-950">{formatAmount(bankBalance)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                <Landmark size={22} />
              </div>
            </div>

            <div className="p-4 border border-emerald-100 bg-emerald-50/20 rounded-xl flex items-center justify-between md:col-span-1">
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono font-sans">Total Liquid Treasury Pooled</p>
                <p className="text-2xl font-black font-mono mt-1 text-emerald-950">{formatAmount(totalLiquidity)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold font-mono text-[11px] border border-emerald-100">
                LOBBY RES
              </div>
            </div>
          </div>

          {/* DUAL LOBBY LEDGERS: Cash Ledger Book and Bank Ledger Book side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* COLUMN 1: CASH ACCOUNT LEDGER */}
            <div className="bg-white border border-amber-200 rounded-xl shadow-3xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-150 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                    <Coins size={15} className="text-amber-600 animate-pulse" />
                    Cash Ledger Account
                  </h4>
                  <button
                    onClick={() => setPrintAccount(cashAccount)}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-amber-300 shadow-3xs hover:shadow-2xs transition-all font-mono"
                    title="Print Cash Ledger / Save PDF"
                  >
                    <Printer size={12} className="text-amber-600" />
                    Print Ledger / PDF
                  </button>
                </div>

                <div className="p-4 bg-gradient-to-r from-amber-50/10 to-transparent border-b border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Activity (Posts: {cashRows.length})</span>
                  <div className="flex gap-4 font-mono text-[11px]">
                    <span className="text-emerald-700">Dr: {formatAmount(accountBalances[cashAccount.id]?.debit || 0)}</span>
                    <span className="text-rose-700">Cr: {formatAmount(accountBalances[cashAccount.id]?.credit || 0)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-amber-50/20 text-amber-900 font-mono font-semibold select-none border-b border-gray-200 text-[10px]">
                        <th className="p-2.5 w-24">Date</th>
                        <th className="p-2.5">Particulars / Counter</th>
                        <th className="p-2.5 text-right w-16">Dr</th>
                        <th className="p-2.5 text-right w-16">Cr</th>
                        <th className="p-2.5 text-right w-24">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {cashRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-gray-400 italic">
                            No cash transactions journalized.
                          </td>
                        </tr>
                      ) : (
                        cashRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/5 transition-colors">
                            <td className="p-2.5 font-mono text-gray-400 whitespace-nowrap">{row.date}</td>
                            <td className="p-2.5 font-medium text-gray-700 truncate max-w-[130px]" title={row.particulars}>
                              {row.particulars}
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-emerald-600">
                              {row.type === 'Debit' ? formatAmount(row.amount) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-rose-500">
                              {row.type === 'Credit' ? formatAmount(row.amount) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-gray-900">
                              {formatAmount(row.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-amber-50/20 border-t border-amber-100 flex items-center justify-between">
                <span className="text-[10px] text-amber-800 font-medium italic">Cash physical register balance synced</span>
                <button
                  onClick={() => {
                    setSelectedAccountId(cashAccount.id);
                    setActiveSubTab('all');
                  }}
                  className="inline-flex items-center gap-0.5 text-xs text-amber-700 hover:text-amber-950 font-bold transition-all"
                >
                  Inspect ledger fully
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* COLUMN 2: BANK ACCOUNT LEDGER */}
            <div className="bg-white border border-blue-200 rounded-xl shadow-3xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-4 py-3 bg-blue-50/60 border-b border-blue-150 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-blue-950 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                    <Landmark size={15} className="text-blue-600 animate-pulse" />
                    Bank Ledger Account
                  </h4>
                  <button
                    onClick={() => setPrintAccount(bankAccount)}
                    className="text-[11px] font-bold text-blue-800 hover:text-blue-950 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-blue-300 shadow-3xs hover:shadow-2xs transition-all font-mono"
                    title="Print Bank Ledger / Save PDF"
                  >
                    <Printer size={12} className="text-blue-600" />
                    Print Ledger / PDF
                  </button>
                </div>

                <div className="p-4 bg-gradient-to-r from-blue-50/10 to-transparent border-b border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Activity (Posts: {bankRows.length})</span>
                  <div className="flex gap-4 font-mono text-[11px]">
                    <span className="text-emerald-700">Dr: {formatAmount(accountBalances[bankAccount.id]?.debit || 0)}</span>
                    <span className="text-rose-700">Cr: {formatAmount(accountBalances[bankAccount.id]?.credit || 0)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-blue-50/20 text-blue-900 font-mono font-semibold select-none border-b border-gray-200 text-[10px]">
                        <th className="p-2.5 w-24">Date</th>
                        <th className="p-2.5">Particulars / Counter</th>
                        <th className="p-2.5 text-right w-16">Dr</th>
                        <th className="p-2.5 text-right w-16">Cr</th>
                        <th className="p-2.5 text-right w-24">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {bankRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-gray-400 italic">
                            No bank transactions journalized yet.
                          </td>
                        </tr>
                      ) : (
                        bankRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/5 transition-colors">
                            <td className="p-2.5 font-mono text-gray-400 whitespace-nowrap">{row.date}</td>
                            <td className="p-2.5 font-medium text-gray-700 truncate max-w-[130px]" title={row.particulars}>
                              {row.particulars}
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-emerald-600">
                              {row.type === 'Debit' ? formatAmount(row.amount) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-rose-500">
                              {row.type === 'Credit' ? formatAmount(row.amount) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-gray-900">
                              {formatAmount(row.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-blue-50/20 border-t border-blue-100 flex items-center justify-between">
                <span className="text-[10px] text-blue-800 font-medium italic">Accrued bank statement statement synced</span>
                <button
                  onClick={() => {
                    setSelectedAccountId(bankAccount.id);
                    setActiveSubTab('all');
                  }}
                  className="inline-flex items-center gap-0.5 text-xs text-blue-700 hover:text-blue-950 font-bold transition-all"
                >
                  Inspect ledger fully
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* STANDARD ALL ACCOUNTS DETAILED SINGLE LEDGER SCREEN */
        <div className="space-y-6">
          {/* Account Selector panel */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BookOpen className="text-blue-600" size={20} />
              <div>
                <h4 className="font-bold text-gray-950">Detailed Ledgers Focus Mode</h4>
                <p className="text-xs text-gray-400">Select any individual ledger account from your Chart of Accounts to view posting registry</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase font-mono">Select Ledger:</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedAccount && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Summary cards */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-sm border border-slate-950 flex flex-col justify-between">
                  <div>
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-[10px] font-semibold uppercase tracking-wider rounded-md font-mono">
                      {selectedAccount.type}
                    </span>
                    <h4 className="text-xl font-extrabold tracking-tight mt-2">{selectedAccount.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">Classification type: {selectedAccount.type}</p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-700/60 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-mono">Automated Ledger Balance</p>
                      <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                        {formatAmount(balInfo?.balance || 0)}
                      </p>
                    </div>
                    <div className="text-[10px] uppercase font-mono px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 font-bold">
                      {selectedAccount.type === 'Asset' || selectedAccount.type === 'Expense' ? 'Debit Dr Bal' : 'Credit Cr Bal'}
                    </div>
                  </div>
                </div>

                {/* Quick calculations stats */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-3 font-sans">
                  <h5 className="text-xs font-bold text-gray-600 uppercase tracking-wider font-mono">Posting Activity Statistics</h5>
                  <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span className="text-gray-500">Total Dr Journalized:</span>
                    <span className="font-mono font-semibold text-emerald-600">{formatAmount(balInfo?.debit || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span className="text-gray-500">Total Cr Journalized:</span>
                    <span className="font-mono font-semibold text-rose-600">{formatAmount(balInfo?.credit || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Total Post Count:</span>
                    <span className="font-mono font-semibold text-gray-700">{ledgerRows.length} occurrences</span>
                  </div>
                </div>
              </div>

              {/* Ledger Table right side */}
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-150 flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Calendar size={14} className="text-gray-400" />
                    Posting Journalized Rows ({selectedAccount.name})
                  </h5>
                  <button
                    onClick={() => setPrintAccount(selectedAccount)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-850 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-250 shadow-3xs hover:shadow-2xs transition-all"
                    title="Print Selected Ledger / Save PDF"
                  >
                    <Printer size={13} className="text-indigo-500" />
                    Print Ledger / PDF
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-xs font-semibold select-none border-b border-gray-200">
                        <th className="p-3 w-28 font-mono">Posting Date</th>
                        <th className="p-3">Particulars / Counter Ledger</th>
                        <th className="p-3 text-right w-24">Debit (Dr)</th>
                        <th className="p-3 text-right w-24">Credit (Cr)</th>
                        <th className="p-3 text-right w-32 font-mono">Running Bal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {ledgerRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-gray-400 italic">
                            No double-entry posts detected for {selectedAccount.name} yet.
                          </td>
                        </tr>
                      ) : (
                        ledgerRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-mono text-xs text-gray-500 whitespace-nowrap">{row.date}</td>
                            <td className="p-3 font-medium text-gray-700 flex items-center gap-1">
                              <CreditCard size={12} className="text-slate-300" />
                              {row.particulars}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-emerald-600">
                              {row.type === 'Debit' ? formatAmount(row.amount) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-rose-600">
                              {row.type === 'Credit' ? formatAmount(row.amount) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-800">
                              {formatAmount(row.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-3 bg-gray-50 font-mono text-[10px] text-gray-400 text-right">
                  Double-entry postings are balanced automatically upon transaction entries.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Screen Audit Printable Ledger Report Modal */}
      {printAccount && (() => {
        const rows = getLedgerForAccount(printAccount.id, accounts, entries);
        const bal = accountBalances[printAccount.id];
        const currentDate = new Date().toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        return (
          <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col md:flex-row p-3 md:p-6 select-none animate-fade-in no-print-backdrop">
            {/* Local Printing Style Rules */}
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
                #ledger-pdf-printable, #ledger-pdf-printable * {
                  visibility: visible !important;
                }
                #ledger-pdf-printable {
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
              }
            `}</style>

            {/* Left Control Sidebar */}
            <div className="w-full md:w-80 bg-slate-950 text-slate-100 rounded-2xl md:rounded-r-none p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800 shadow-md">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Printer className="text-indigo-400" size={18} />
                    Ledger Print Room
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Print or export official ledger registry sheets for review and archiving</p>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Ledger Metadata</span>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Name:</span>
                      <span className="font-bold text-slate-250 text-right">{printAccount.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Type:</span>
                      <span className="font-mono text-indigo-450">{printAccount.type}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 mt-1">
                      <span className="text-slate-400">Ledger Balance:</span>
                      <span className="font-bold text-emerald-400 font-mono">{formatAmount(bal?.balance || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar actions */}
              <div className="pt-6 border-t border-slate-800 space-y-2 mt-4 md:mt-0">
                <button
                  onClick={async () => {
                    const element = document.getElementById('ledger-pdf-printable');
                    if (!element) return;
                    try {
                      setIsGeneratingPdf(true);
                      await new Promise((resolve) => setTimeout(resolve, 200));

                      const canvas = await html2canvas(element, {
                        scale: 2.2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff'
                      });

                      const imgData = canvas.toDataURL('image/png');
                      const isLandscape = canvas.width > canvas.height * 1.15;
                      const orientation = isLandscape ? 'l' : 'p';

                      const pdf = new jsPDF(orientation, 'mm', 'a4');
                      const pageWidth = pdf.internal.pageSize.getWidth();
                      const pageHeight = pdf.internal.pageSize.getHeight();

                      const margin = 12; // Standard professional 12mm margin
                      const contentWidth = pageWidth - (margin * 2);
                      const contentHeight = pageHeight - (margin * 2);

                      const canvasWidth = canvas.width;
                      const canvasHeight = canvas.height;

                      // Calculate the height of one PDF page's content slice in canvas pixels
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

                      pdf.save(`Ledger_${printAccount.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsGeneratingPdf(false);
                    }
                  }}
                  disabled={isGeneratingPdf}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/60 disabled:text-indigo-300 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving PDF...
                    </>
                  ) : (
                    <>
                      <Download size={15} />
                      Save as PDF
                    </>
                  )}
                </button>

                <button
                  onClick={() => setPrintAccount(null)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-850 hover:text-slate-200 text-slate-400 border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <X size={15} />
                  Exit Print Review
                </button>
              </div>
            </div>

            {/* Right Interactive HD PDF Document Preview Canvas */}
            <div className="flex-1 bg-slate-800 p-3 md:p-6 overflow-y-auto flex justify-center items-start">
              <div 
                id="ledger-pdf-printable"
                className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-xl p-8 md:p-12 font-serif text-xs text-left selection:bg-indigo-100"
              >
                {/* Header sheet header strip */}
                <div className="border-b-4 border-double border-slate-900 pb-5 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-slate-950 font-serif leading-none mb-1.5 uppercase tracking-tight">
                      {sheetName}
                    </h1>
                    <p className="text-xs uppercase font-mono tracking-widest text-slate-500 font-bold mb-1">
                      {sheetTagline}
                    </p>
                    <p className="text-[11px] text-slate-400 italic">
                      Fiscal Period Ledger - Academic Auditing Stage {academicYear}
                    </p>
                  </div>

                  <div className="text-right font-serif md:max-w-xs text-xs">
                    <span className="block font-bold text-slate-950 font-mono tracking-wider text-[10px] uppercase">OFFICIAL STATEMENT FOR RECORD</span>
                    <p className="text-slate-500 mt-1">Generated: <span className="font-mono text-slate-800 font-bold">{currentDate}</span></p>
                    <p className="text-slate-500">Classification: <span className="font-mono text-indigo-700 font-bold underline uppercase">{printAccount.type} Account</span></p>
                  </div>
                </div>

                {/* Subtitle statement label */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold text-indigo-700 tracking-wider uppercase font-mono">SPECIFIC SUB-LEDGER POSTINGS REPORT</p>
                    <h2 className="text-lg font-black text-slate-950 font-serif uppercase">{printAccount.name}</h2>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-slate-400 text-[10px] block font-mono font-bold uppercase">LEDGER BALANCE CURVE</span>
                    <span className="text-lg font-black font-mono text-slate-950">{formatAmount(bal?.balance || 0)}</span>
                  </div>
                </div>

                {/* Main Double Entry Journalized Postings Table */}
                <div className="space-y-4">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-950 font-serif text-[11px] text-slate-800 font-black">
                        <th className="py-2.5 w-28 font-semibold">Date</th>
                        <th className="py-2.5">Particulars Counter Ledger / Narration</th>
                        <th className="py-2.5 text-right w-28">Debit Dr (₹)</th>
                        <th className="py-2.5 text-right w-28">Credit Cr (₹)</th>
                        <th className="py-2.5 text-right w-36 font-semibold">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-sans text-[11px]">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic font-serif">
                            No balance postings reported for this ledger.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 font-mono text-slate-500">{row.date}</td>
                            <td className="py-2.5 text-slate-800">
                              <span className="font-bold underline text-slate-900 block">{row.particulars}</span>
                              {row.narration && <span className="text-[10px] text-slate-400 block mt-0.5 font-serif font-medium leading-tight">Narration: {row.narration}</span>}
                            </td>
                            <td className="py-2.5 text-right font-mono font-semibold text-emerald-700">
                              {row.type === 'Debit' ? formatAmount(row.amount) : '-'}
                            </td>
                            <td className="py-2.5 text-right font-mono font-semibold text-rose-700">
                              {row.type === 'Credit' ? formatAmount(row.amount) : '-'}
                            </td>
                            <td className="py-2.5 text-right font-mono font-black text-slate-950">
                              {formatAmount(row.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Account Summary metrics on bottom line */}
                  <div className="border-t border-slate-300 pt-3 flex justify-between items-center text-xs font-mono font-bold text-slate-800">
                    <div>Total Journal Activity Count: {rows.length} Posting Logs</div>
                    <div className="flex gap-6">
                      <span className="text-emerald-800">Total Debit Dr: {formatAmount(bal?.debit || 0)}</span>
                      <span className="text-rose-800">Total Credit Cr: {formatAmount(bal?.credit || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Audit Signature Block Footer section of sheet page */}
                <div className="mt-16 pt-8 border-t border-slate-300 flex flex-col md:flex-row justify-between items-start gap-12 font-serif text-xs">
                  <div className="w-64 space-y-1">
                    <span className="block font-bold text-slate-900">PREPARED BY UNION TREASURER</span>
                    <div className="border-b border-slate-400 h-10 w-48"></div>
                    <p className="text-[11px] text-slate-500 font-mono font-bold py-1 leading-none">{treasurerName}</p>
                    <p className="text-[10px] text-slate-400 font-sans italic">{treasurerEmail}</p>
                  </div>

                  <div className="w-64 space-y-1 self-end md:self-auto md:text-right flex flex-col items-start md:items-end">
                    <span className="block font-bold text-slate-900">AUTHORIZED AUDITOR SIGN-OFF</span>
                    <div className="border-b border-slate-400 h-10 w-48"></div>
                    <p className="text-[11px] text-slate-500 italic py-1">Mechanical Class Union Auditing Board</p>
                    <p className="text-[10px] text-slate-400 font-mono tracking-widest font-extrabold text-[9px] uppercase">SECURE CHECKPOINT VERIFIED</p>
                  </div>
                </div>

                {/* Bottom Disclaimer */}
                <div className="mt-12 text-center text-[9px] text-slate-400 font-sans tracking-wide leading-relaxed">
                  Notice: This sub-ledger document was generated securely from live cloud-synchronized data. It represents balances of the class union fiscal accounts using professional double-entry ledger bookkeeping.
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
