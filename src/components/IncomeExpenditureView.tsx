/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Account, JournalEntry } from '../types';
import { getIncomeAndExpenditure } from '../utils/accounting';
import { Landmark, ArrowUpRight, ArrowDownRight, HelpCircle } from 'lucide-react';
import { DateRangeFilter } from './DateRangeFilter';
import { StatementPaperHeader } from './StatementPaperHeader';
import { VerificationBlock } from './VerificationBlock';
import {
  DatePreset,
  filterEntriesByDateRange,
  generateStatementFilename,
} from '../utils/dateFilter';
import { exportElementToPdf, triggerNativePrint } from '../utils/printExport';

interface IncomeExpenditureViewProps {
  accounts: Account[];
  entries: JournalEntry[];
  sheetName?: string;
  treasurerName?: string;
  treasurerEmail?: string;
  academicYear?: string;
}

export function IncomeExpenditureView({
  accounts,
  entries,
  sheetName = 'NADA Union',
  treasurerName = 'Union Treasurer',
  treasurerEmail = '',
  academicYear = '2026 - 2027',
}: IncomeExpenditureViewProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<DatePreset>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filter entries based on active date range
  const filteredEntries = useMemo(() => {
    return filterEntriesByDateRange(entries, startDate, endDate);
  }, [entries, startDate, endDate]);

  const {
    incomes,
    expenditures,
    totalIncome,
    totalExpenditure,
    balanceType,
    balanceAmount,
  } = useMemo(() => {
    return getIncomeAndExpenditure(accounts, filteredEntries);
  }, [accounts, filteredEntries]);

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

  const filename = generateStatementFilename('Income_And_Expenditure', startDate, endDate, sheetName);

  const handleExportPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await exportElementToPdf({
        elementId: 'income-expenditure-printable',
        filename,
        defaultOrientation: 'landscape',
        columnCount: 4,
      });
    } catch (err) {
      console.error('Failed to export Income & Expenditure PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    triggerNativePrint(filename);
  };

  const grandTotal = Math.max(totalIncome, totalExpenditure);

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
        statementTitle="Income & Expenditure"
      />

      {/* Printable Sheet */}
      <div
        id="income-expenditure-printable"
        className="statement-sheet bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden p-6 sm:p-8 space-y-6 text-left"
      >
        {/* Dynamic Statement Paper Header */}
        <StatementPaperHeader
          sheetName={sheetName}
          statementTitle="Income and Expenditure Account"
          subtitle="Non-profit accrual revenue statement for union programs and operations"
          startDate={startDate}
          endDate={endDate}
          academicYear={academicYear}
        />

        {/* Summary Posture Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
          <div className="card p-3.5 border border-teal-100 bg-teal-50/30 rounded-xl">
            <p className="text-[11px] font-bold text-teal-800 uppercase tracking-widest font-mono">
              Total Revenue Income
            </p>
            <p className="text-xl font-black font-mono mt-1 text-teal-950">
              {formatAmount(totalIncome)}
            </p>
          </div>

          <div className="card p-3.5 border border-rose-100 bg-rose-50/30 rounded-xl">
            <p className="text-[11px] font-bold text-rose-800 uppercase tracking-widest font-mono">
              Total Revenue Expenses
            </p>
            <p className="text-xl font-black font-mono mt-1 text-rose-950">
              {formatAmount(totalExpenditure)}
            </p>
          </div>

          <div
            className={`card p-3.5 border rounded-xl ${
              balanceType === 'Surplus'
                ? 'border-indigo-100 bg-indigo-50/40'
                : 'border-amber-100 bg-amber-50/40'
            }`}
          >
            <p
              className={`text-[11px] font-bold uppercase tracking-widest font-mono ${
                balanceType === 'Surplus' ? 'text-indigo-800' : 'text-amber-800'
              }`}
            >
              Net {balanceType === 'Surplus' ? 'Surplus' : 'Deficit'} Posture
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span
                className={`text-xl font-black font-mono ${
                  balanceType === 'Surplus' ? 'text-indigo-950' : 'text-amber-950'
                }`}
              >
                {formatAmount(balanceAmount)}
              </span>
              <span className="text-[10px] font-sans font-bold uppercase opacity-80">
                {balanceType === 'Surplus' ? 'Excess Income' : 'Excess Expense'}
              </span>
            </div>
          </div>
        </div>

        {/* Classic NPO T-Account: Expenditures on LHS / Income on RHS */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-slate-50 grid grid-cols-1 lg:grid-cols-2 shadow-2xs">
          {/* LEFT COLUMN: EXPENDITURES (Dr - Debit Side) */}
          <div className="bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col justify-between">
            <div>
              <div className="p-3 bg-rose-50/80 text-rose-950 text-xs font-bold border-b border-gray-150 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5">
                  <ArrowDownRight size={15} className="text-rose-600" />
                  EXPENDITURES (OPERATIONAL EXPENSES)
                </span>
                <span className="text-[11px] uppercase tracking-wider">DEBIT (Dr)</span>
              </div>

              <div className="divide-y divide-gray-100 min-h-[140px]">
                {expenditures.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs italic">
                    No expenditures recorded in this period.
                  </div>
                ) : (
                  expenditures.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-gray-800 pl-1 font-medium">To {item.name}</span>
                      <span className="font-mono font-bold text-rose-800">
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Balancing Surplus is written on Left Hand Side to total columns symmetrically */}
            <div className="border-t border-gray-100 bg-slate-50/20">
              {balanceType === 'Surplus' && balanceAmount > 0 && (
                <div className="p-3 flex items-center justify-between text-xs sm:text-sm border-b border-gray-150 italic font-mono bg-indigo-50/20 text-indigo-950 font-bold">
                  <span className="pl-1">To Surplus (Excess of Income over Expenditure)</span>
                  <span>{formatAmount(balanceAmount)}</span>
                </div>
              )}
              <div className="p-3 bg-slate-100 flex items-center justify-between font-extrabold text-xs sm:text-sm font-mono text-gray-900 border-t border-gray-200">
                <span>TOTAL (Expenditures side):</span>
                <span>{formatAmount(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: INCOME (Cr - Credit Side) */}
          <div className="bg-white flex flex-col justify-between">
            <div>
              <div className="p-3 bg-emerald-50/80 text-emerald-950 text-xs font-bold border-b border-gray-150 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight size={15} className="text-emerald-600" />
                  INCOME (REVENUE RECEIPTS & DUES)
                </span>
                <span className="text-[11px] uppercase tracking-wider">CREDIT (Cr)</span>
              </div>

              <div className="divide-y divide-gray-100 min-h-[140px]">
                {incomes.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs italic">
                    No incomes recorded in this period.
                  </div>
                ) : (
                  incomes.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-gray-800 pl-1 font-medium">By {item.name}</span>
                      <span className="font-mono font-bold text-emerald-800">
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Balancing Deficit is written on Right Hand Side to total columns symmetrically */}
            <div className="border-t border-gray-100 bg-slate-50/20">
              {balanceType === 'Deficit' && balanceAmount > 0 && (
                <div className="p-3 flex items-center justify-between text-xs sm:text-sm border-b border-gray-150 italic font-mono bg-amber-50/20 text-amber-950 font-bold">
                  <span className="pl-1">By Deficit (Excess of Expenditure over Income)</span>
                  <span>{formatAmount(balanceAmount)}</span>
                </div>
              )}
              <div className="p-3 bg-slate-100 flex items-center justify-between font-extrabold text-xs sm:text-sm font-mono text-gray-900 border-t border-gray-200">
                <span>TOTAL (Incomes side):</span>
                <span>{formatAmount(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Accrual warning helper & NPO notes */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-xl space-y-1.5 text-xs text-indigo-900">
          <h4 className="font-bold flex items-center gap-1.5">
            <HelpCircle size={14} />
            <span>Accrual Principle Insight:</span>
          </h4>
          <p className="leading-relaxed">
            Revenue expenses and revenues strictly map to the academic calendar. Capital acquisitions (e.g. sound systems or sports gear) are capitalized onto the Balance Sheet rather than expensed here.
          </p>
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
