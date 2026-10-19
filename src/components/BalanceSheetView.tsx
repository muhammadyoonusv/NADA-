/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Account, JournalEntry } from '../types';
import { getBalanceSheet } from '../utils/accounting';
import { ShieldCheck, Scale } from 'lucide-react';
import { DateRangeFilter } from './DateRangeFilter';
import { StatementPaperHeader } from './StatementPaperHeader';
import { VerificationBlock } from './VerificationBlock';
import {
  DatePreset,
  filterEntriesByDateRange,
  generateStatementFilename,
} from '../utils/dateFilter';
import { exportElementToPdf, triggerNativePrint } from '../utils/printExport';

interface BalanceSheetViewProps {
  accounts: Account[];
  entries: JournalEntry[];
  sheetName?: string;
  treasurerName?: string;
  treasurerEmail?: string;
  academicYear?: string;
}

export function BalanceSheetView({
  accounts,
  entries,
  sheetName = 'NADA Union',
  treasurerName = 'Union Treasurer',
  treasurerEmail = '',
  academicYear = '2026 - 2027',
}: BalanceSheetViewProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<DatePreset>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filter entries based on active date range
  const filteredEntries = useMemo(() => {
    return filterEntriesByDateRange(entries, startDate, endDate);
  }, [entries, startDate, endDate]);

  const {
    assets,
    liabilities,
    unionFund,
    totalAssets,
    totalLiabilitiesAndFund,
  } = useMemo(() => {
    return getBalanceSheet(accounts, filteredEntries);
  }, [accounts, filteredEntries]);

  // Financial system balance check
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndFund) < 0.01;
  const difference = Math.abs(totalAssets - totalLiabilitiesAndFund);

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

  const filename = generateStatementFilename('Balance_Sheet', startDate, endDate, sheetName);

  const handleExportPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await exportElementToPdf({
        elementId: 'balance-sheet-printable',
        filename,
        defaultOrientation: 'landscape',
        columnCount: 4,
      });
    } catch (err) {
      console.error('Failed to export Balance Sheet PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    triggerNativePrint(filename);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Date Filter & Universal Export Toolbar */}
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
        statementTitle="Balance Sheet"
      />

      {/* Printable Sheet */}
      <div
        id="balance-sheet-printable"
        className="statement-sheet bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden p-6 sm:p-8 space-y-6"
      >
        {/* Dynamic Statement Paper Header */}
        <StatementPaperHeader
          sheetName={sheetName}
          statementTitle="Statement of Financial Position (Balance Sheet)"
          subtitle="Equilibrium ledger statement: Total Assets = Total Liabilities + Accumulated Union Fund"
          startDate={startDate}
          endDate={endDate}
          academicYear={academicYear}
        />

        {/* Posture / Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
          <div className="card p-3.5 border border-emerald-100 bg-emerald-50/40 rounded-xl">
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest font-mono">
              Total Economic Assets
            </p>
            <p className="text-xl font-black font-mono mt-1 text-emerald-950">
              {formatAmount(totalAssets)}
            </p>
          </div>

          <div className="card p-3.5 border border-indigo-100 bg-indigo-50/40 rounded-xl">
            <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-widest font-mono">
              Liabilities & Union Capital
            </p>
            <p className="text-xl font-black font-mono mt-1 text-indigo-950">
              {formatAmount(totalLiabilitiesAndFund)}
            </p>
          </div>

          <div
            className={`card p-3.5 border rounded-xl ${
              isBalanced
                ? 'border-teal-100 bg-teal-50/40'
                : 'border-rose-100 bg-rose-50/40'
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest font-mono text-slate-800">
              Equilibrium State
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-slate-900">
                {isBalanced ? 'Balanced' : formatAmount(difference)}
              </span>
              <span
                className={`text-[10px] font-sans font-bold uppercase ${
                  isBalanced ? 'text-teal-700' : 'text-rose-700'
                }`}
              >
                {isBalanced ? '✓ In Equilibrium' : '⚠ Discrepancy'}
              </span>
            </div>
          </div>
        </div>

        {/* Safety balance verification status banner */}
        {isBalanced && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Perfect Balance Sheet Integrity</span> — Total Assets correspond exactly to Total Liabilities and Union Funds. Both sides balance at{' '}
              <span className="font-bold underline">{formatAmount(totalAssets)}</span>.
            </div>
          </div>
        )}

        {/* Structured Double-Column Balance Sheet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border border-gray-200 rounded-xl overflow-hidden bg-slate-50 shadow-2xs">
          {/* COLUMN 1: ASSETS */}
          <div className="bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col justify-between">
            <div>
              <div className="p-3 bg-slate-100 border-b border-gray-200 text-xs font-bold text-slate-800 tracking-wider font-mono">
                ASSETS & LIQUID ECONOMIC HOLDINGS
              </div>

              <div className="p-3 divide-y divide-gray-100 space-y-2">
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                  Current & Capital Assets
                </h5>
                {assets.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs italic">
                    No Assets found in this period.
                  </div>
                ) : (
                  assets.map((item, idx) => (
                    <div
                      key={idx}
                      className="py-2.5 px-2 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-slate-800 font-serif font-semibold text-sm">
                        {item.name}
                      </span>
                      <span className="font-mono font-bold text-emerald-800">
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-gray-200 flex justify-between font-extrabold text-xs sm:text-sm font-mono text-slate-900">
              <span>TOTAL ASSETS:</span>
              <span>{formatAmount(totalAssets)}</span>
            </div>
          </div>

          {/* COLUMN 2: LIABILITIES & UNION FUND */}
          <div className="bg-white flex flex-col justify-between">
            <div>
              <div className="p-3 bg-slate-100 border-b border-gray-200 text-xs font-bold text-slate-800 tracking-wider font-mono">
                LIABILITIES & ACCUMULATED UNION FUND
              </div>

              <div className="p-3 divide-y divide-gray-100 space-y-2">
                {/* Union Equity/Fund breakdown */}
                <div>
                  <h5 className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest pl-1 pb-1">
                    Accumulated Capital Fund
                  </h5>
                  <div className="py-2 px-3 space-y-1.5 text-xs text-slate-700 bg-indigo-50/40 rounded-lg border border-indigo-100">
                    <div className="flex justify-between">
                      <span>Opening Union Fund Balance:</span>
                      <span className="font-mono font-semibold">{formatAmount(unionFund.opening)}</span>
                    </div>
                    {unionFund.surplus >= 0 ? (
                      <div className="flex justify-between">
                        <span className="text-emerald-700 font-semibold">+ Net Period Surplus:</span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {formatAmount(unionFund.surplus)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-rose-700 font-semibold">- Net Period Deficit:</span>
                        <span className="font-mono font-semibold text-rose-700">
                          {formatAmount(Math.abs(unionFund.surplus))}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-indigo-100 pt-1.5 text-xs sm:text-sm font-bold text-indigo-950">
                      <span>Closing Accumulated Capital:</span>
                      <span className="font-mono">{formatAmount(unionFund.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities breakdown */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1 pt-2">
                    Current & External Liabilities
                  </h5>
                  {liabilities.length === 0 ? (
                    <div className="py-3 px-2 text-xs text-slate-400 italic">
                      Zero external payload liabilities.
                    </div>
                  ) : (
                    liabilities.map((item, idx) => (
                      <div
                        key={idx}
                        className="py-2 px-2 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-slate-800">{item.name}</span>
                        <span className="font-mono font-bold text-rose-800">
                          {formatAmount(item.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-gray-200 flex justify-between font-extrabold text-xs sm:text-sm font-mono text-slate-900">
              <span>TOTAL LIABILITIES & FUNDS:</span>
              <span>{formatAmount(totalLiabilitiesAndFund)}</span>
            </div>
          </div>
        </div>

        {/* Verification & Certification Block */}
        <VerificationBlock
          treasurerName={treasurerName}
          treasurerEmail={treasurerEmail}
          academicYear={academicYear}
        />
      </div>
    </div>
  );
}
