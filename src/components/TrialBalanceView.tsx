/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Account, JournalEntry } from '../types';
import { getTrialBalance } from '../utils/accounting';
import { CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { DateRangeFilter } from './DateRangeFilter';
import { StatementPaperHeader } from './StatementPaperHeader';
import { VerificationBlock } from './VerificationBlock';
import {
  DatePreset,
  filterEntriesByDateRange,
  generateStatementFilename,
} from '../utils/dateFilter';
import { exportElementToPdf, triggerNativePrint } from '../utils/printExport';

interface TrialBalanceViewProps {
  accounts: Account[];
  entries: JournalEntry[];
  sheetName?: string;
  treasurerName?: string;
  treasurerEmail?: string;
  academicYear?: string;
}

export function TrialBalanceView({
  accounts,
  entries,
  sheetName = 'NADA Union',
  treasurerName = 'Union Treasurer',
  treasurerEmail = '',
  academicYear = '2026 - 2027',
}: TrialBalanceViewProps) {
  // Date range filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<DatePreset>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filter entries based on date range
  const filteredEntries = useMemo(() => {
    return filterEntriesByDateRange(entries, startDate, endDate);
  }, [entries, startDate, endDate]);

  const { items, totalDebit, totalCredit } = useMemo(() => {
    return getTrialBalance(accounts, filteredEntries);
  }, [accounts, filteredEntries]);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const difference = Math.abs(totalDebit - totalCredit);

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(num);
  };

  const handleFilterChange = (start: string, end: string, preset: DatePreset) => {
    setStartDate(start);
    setEndDate(end);
    setActivePreset(preset);
  };

  const filename = generateStatementFilename('Trial_Balance', startDate, endDate, sheetName);

  const handleExportPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await exportElementToPdf({
        elementId: 'trial-balance-printable',
        filename,
        defaultOrientation: 'portrait',
        columnCount: 5,
      });
    } catch (err) {
      console.error('Failed to export Trial Balance PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    triggerNativePrint(filename);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Date Range Selector & Universal Export Toolbar (Hidden on print) */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        activePreset={activePreset}
        onFilterChange={handleFilterChange}
        onPrint={handlePrint}
        onExportPdf={handleExportPdf}
        isGeneratingPdf={isGeneratingPdf}
        totalRecords={entries.length}
        filteredRecords={filteredEntries.length}
        statementTitle="Trial Balance"
      />

      {/* Printable Statement Sheet */}
      <div
        id="trial-balance-printable"
        className="statement-sheet bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden p-6 sm:p-8 space-y-6"
      >
        {/* Dynamic Statement Paper Header */}
        <StatementPaperHeader
          sheetName={sheetName}
          statementTitle="Automated Trial Balance"
          subtitle="Double-entry ledger balances summary"
          startDate={startDate}
          endDate={endDate}
          academicYear={academicYear}
        />

        {/* Posture / Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest font-mono">
              Total Debits (Dr)
            </div>
            <div className="text-xl font-black text-emerald-950 font-mono mt-1">
              {formatAmount(totalDebit)}
            </div>
          </div>

          <div className="card p-3.5 bg-rose-50/60 border border-rose-100 rounded-xl">
            <div className="text-[11px] font-bold text-rose-800 uppercase tracking-widest font-mono">
              Total Credits (Cr)
            </div>
            <div className="text-xl font-black text-rose-950 font-mono mt-1">
              {formatAmount(totalCredit)}
            </div>
          </div>

          <div
            className={`card p-3.5 border rounded-xl ${
              isBalanced
                ? 'bg-blue-50/60 border-blue-100 text-blue-950'
                : 'bg-amber-50/60 border-amber-200 text-amber-950'
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-widest font-mono">
              Net Balance Posture
            </div>
            <div className="text-xl font-black font-mono mt-1 flex items-center justify-between">
              <span>{isBalanced ? 'Balanced (₹0.00)' : formatAmount(difference)}</span>
              <span className="text-xs font-sans font-bold">
                {isBalanced ? '✓ 100% Match' : '⚠ Mismatch'}
              </span>
            </div>
          </div>
        </div>

        {/* Status Notification Banner */}
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
            isBalanced
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {isBalanced ? (
            <>
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-sm">Ledger Books Verified & In Balance</p>
                <p className="text-emerald-700 mt-0.5">
                  Every recorded debit corresponds exactly to double-entry credits. Total transacted volume is {formatAmount(totalDebit)}.
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={20} className="text-rose-600 shrink-0" />
              <div>
                <p className="font-bold text-sm">Trial Balance Mismatch Detected</p>
                <p className="text-rose-700 mt-0.5">
                  Difference between Debit side ({formatAmount(totalDebit)}) and Credit side ({formatAmount(totalCredit)}) is {formatAmount(difference)}.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Data Table (Pixel-perfect A4 fit with repeating header) */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold font-mono uppercase tracking-wider border-b border-slate-200">
                <th className="p-2.5 w-12 text-center">Row</th>
                <th className="p-2.5">Account / Ledger Title</th>
                <th className="p-2.5 w-28">Classification</th>
                <th className="p-2.5 text-right w-36">Debit (Dr) ₹</th>
                <th className="p-2.5 text-right w-36">Credit (Cr) ₹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                    No transactions found in the selected date range.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-mono text-slate-400 text-center">{idx + 1}</td>
                    <td className="p-2.5 font-semibold text-slate-900 font-serif text-sm">
                      {item.name}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.type === 'Asset'
                            ? 'bg-emerald-100/70 text-emerald-800'
                            : item.type === 'Liability'
                            ? 'bg-amber-100/70 text-amber-800'
                            : item.type === 'Equity'
                            ? 'bg-indigo-100/70 text-indigo-800'
                            : item.type === 'Income'
                            ? 'bg-sky-100/70 text-sky-800'
                            : 'bg-rose-100/70 text-rose-800'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-800">
                      {item.debit > 0 ? formatAmount(item.debit) : '—'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-rose-800">
                      {item.credit > 0 ? formatAmount(item.credit) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold font-mono text-xs sm:text-sm text-slate-900">
                <td colSpan={3} className="p-3 text-right">
                  TOTAL TRIAL BALANCES:
                </td>
                <td className="p-3 text-right text-emerald-900 border-t border-double border-slate-400">
                  {formatAmount(totalDebit)}
                </td>
                <td className="p-3 text-right text-rose-900 border-t border-double border-slate-400">
                  {formatAmount(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Automated Double-Entry Verification & Signatures */}
        <VerificationBlock
          treasurerName={treasurerName}
          treasurerEmail={treasurerEmail}
          academicYear={academicYear}
        />
      </div>
    </div>
  );
}
