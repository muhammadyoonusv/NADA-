/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Account, JournalEntry } from '../types';
import { getReceiptsAndPaymentsSum } from '../utils/accounting';
import { Landmark, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { DateRangeFilter } from './DateRangeFilter';
import { StatementPaperHeader } from './StatementPaperHeader';
import { VerificationBlock } from './VerificationBlock';
import {
  DatePreset,
  filterEntriesByDateRange,
  generateStatementFilename,
} from '../utils/dateFilter';
import { exportElementToPdf, triggerNativePrint } from '../utils/printExport';

interface ReceiptsPaymentsViewProps {
  accounts: Account[];
  entries: JournalEntry[];
  sheetName?: string;
  treasurerName?: string;
  treasurerEmail?: string;
  academicYear?: string;
}

export function ReceiptsPaymentsView({
  accounts,
  entries,
  sheetName = 'NADA Union',
  treasurerName = 'Union Treasurer',
  treasurerEmail = '',
  academicYear = '2026 - 2027',
}: ReceiptsPaymentsViewProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<DatePreset>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filter entries based on active date filter
  const filteredEntries = useMemo(() => {
    return filterEntriesByDateRange(entries, startDate, endDate);
  }, [entries, startDate, endDate]);

  const {
    receipts,
    payments,
    totalReceipts,
    totalPayments,
    openingBalance,
    closingBalance,
  } = useMemo(() => {
    return getReceiptsAndPaymentsSum(accounts, filteredEntries);
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

  // Find Cash and Bank balances for the filtered entries
  const cashBal = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => {
      if (entry.debitAccount === '1') acc += entry.amount;
      if (entry.creditAccount === '1') acc -= entry.amount;
      return acc;
    }, 0);
  }, [filteredEntries]);

  const bankBal = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => {
      if (entry.debitAccount === '2') acc += entry.amount;
      if (entry.creditAccount === '2') acc -= entry.amount;
      return acc;
    }, 0);
  }, [filteredEntries]);

  const filename = generateStatementFilename('Receipts_And_Payments', startDate, endDate, sheetName);

  const handleExportPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await exportElementToPdf({
        elementId: 'receipts-payments-printable',
        filename,
        defaultOrientation: 'landscape', // Dual-column T-shape looks best in landscape
        columnCount: 4,
      });
    } catch (err) {
      console.error('Failed to export Receipts & Payments PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    triggerNativePrint(filename);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Date Filter & Universal Print/Export Bar */}
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
        statementTitle="Receipts & Payments"
      />

      {/* Printable Sheet */}
      <div
        id="receipts-payments-printable"
        className="statement-sheet bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden p-6 sm:p-8 space-y-6"
      >
        {/* Dynamic Statement Paper Header */}
        <StatementPaperHeader
          sheetName={sheetName}
          statementTitle="Receipts & Payments Account"
          subtitle="Summary of liquid Cash & Bank transactions (Accrual & Realized)"
          startDate={startDate}
          endDate={endDate}
          academicYear={academicYear}
        />

        {/* Posture / Liquidity summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-3.5 border border-blue-100 bg-blue-50/40 rounded-xl">
            <p className="text-[11px] font-bold text-blue-700 uppercase tracking-widest font-mono">
              Cash in Hand Balance
            </p>
            <p className="text-xl font-black font-mono mt-1 text-blue-950">
              {formatAmount(cashBal)}
            </p>
          </div>
          <div className="card p-3.5 border border-emerald-100 bg-emerald-50/40 rounded-xl">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest font-mono">
              Union Bank Balance
            </p>
            <p className="text-xl font-black font-mono mt-1 text-emerald-950">
              {formatAmount(bankBal)}
            </p>
          </div>
          <div className="card p-3.5 border border-slate-200 bg-slate-50/80 rounded-xl">
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest font-mono">
              Total Liquid Holdings
            </p>
            <p className="text-xl font-black font-mono mt-1 text-slate-900">
              {formatAmount(cashBal + bankBal)}
            </p>
          </div>
        </div>

        {/* Symmetric Double-Column T-Account Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border border-gray-200 rounded-xl overflow-hidden bg-slate-50">
          {/* LEFT COLUMN: RECEIPTS (Debit side / Inflows) */}
          <div className="bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col justify-between">
            <div>
              <div className="p-3 bg-emerald-50 text-emerald-900 text-xs font-bold border-b border-gray-150 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight size={15} className="text-emerald-600" />
                  RECEIPTS / CASH INFLOWS
                </span>
                <span className="text-[11px] uppercase tracking-wider">DEBIT (Dr)</span>
              </div>

              <div className="divide-y divide-gray-100">
                {/* Opening balance line */}
                <div className="p-3 flex items-center justify-between text-xs sm:text-sm italic font-medium bg-gray-50/60">
                  <span className="text-gray-600 flex items-center gap-1.5 pl-1">
                    <Wallet size={13} className="text-gray-400" />
                    To Balance b/d (Opening Cash & Bank)
                  </span>
                  <span className="font-mono font-bold text-gray-800">
                    {formatAmount(openingBalance)}
                  </span>
                </div>

                {receipts.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs italic">
                    No receipts recorded in this period.
                  </div>
                ) : (
                  receipts.map((r, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-gray-800 pl-1 font-medium">To {r.accountName}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatAmount(r.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-gray-200 flex justify-between font-extrabold text-xs sm:text-sm font-mono text-emerald-950">
              <span>TOTAL RECEIPTS (A):</span>
              <span>{formatAmount(openingBalance + totalReceipts)}</span>
            </div>
          </div>

          {/* RIGHT COLUMN: PAYMENTS (Credit side / Outflows) */}
          <div className="bg-white flex flex-col justify-between">
            <div>
              <div className="p-3 bg-rose-50 text-rose-900 text-xs font-bold border-b border-gray-150 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5">
                  <ArrowDownRight size={15} className="text-rose-600" />
                  PAYMENTS / CASH OUTFLOWS
                </span>
                <span className="text-[11px] uppercase tracking-wider">CREDIT (Cr)</span>
              </div>

              <div className="divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs italic">
                    No payments recorded in this period.
                  </div>
                ) : (
                  payments.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-gray-800 pl-1 font-medium">By {p.accountName}</span>
                      <span className="font-mono font-bold text-rose-700">
                        {formatAmount(p.amount)}
                      </span>
                    </div>
                  ))
                )}

                {/* Closing balance line */}
                <div className="p-3 flex items-center justify-between text-xs sm:text-sm italic font-medium bg-gray-50/60">
                  <span className="text-gray-600 flex items-center gap-1.5 pl-1">
                    <Wallet size={13} className="text-gray-400" />
                    By Balance c/d (Closing Cash & Bank)
                  </span>
                  <span className="font-mono font-bold text-blue-900">
                    {formatAmount(closingBalance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-gray-200 flex justify-between font-extrabold text-xs sm:text-sm font-mono text-rose-950">
              <span>TOTAL PAYMENTS & BAL (B):</span>
              <span>{formatAmount(totalPayments + closingBalance)}</span>
            </div>
          </div>
        </div>

        {/* Verification & Signature Block */}
        <VerificationBlock
          treasurerName={treasurerName}
          treasurerEmail={treasurerEmail}
          academicYear={academicYear}
        />
      </div>
    </div>
  );
}
