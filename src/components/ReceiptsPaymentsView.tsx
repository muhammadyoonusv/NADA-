/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Account, JournalEntry } from '../types';
import { getReceiptsAndPaymentsSum } from '../utils/accounting';
import { Landmark, ArrowUpRight, ArrowDownRight, Wallet, Download } from 'lucide-react';

interface ReceiptsPaymentsViewProps {
  accounts: Account[];
  entries: JournalEntry[];
}

export function ReceiptsPaymentsView({ accounts, entries }: ReceiptsPaymentsViewProps) {
  const {
    receipts,
    payments,
    totalReceipts,
    totalPayments,
    openingBalance,
    closingBalance,
  } = getReceiptsAndPaymentsSum(accounts, entries);

  const [isGenerating, setIsGenerating] = useState(false);

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(num);
  };

  const handlePrint = async () => {
    const element = document.getElementById('receipts-payments-printable');
    if (!element) return;

    try {
      setIsGenerating(true);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (el) => el.tagName === 'BUTTON'
      });

      const imgData = canvas.toDataURL('image/png');
      const isLandscape = canvas.width > canvas.height * 1.15 || true; // Dual-column T-shape usually looks much better in landscape
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

      pdf.save(`Receipts_And_Payments_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Find Cash and Bank balances
  const cashBal = entries.reduce((acc, entry) => {
    if (entry.debitAccount === '1') acc += entry.amount;
    if (entry.creditAccount === '1') acc -= entry.amount;
    return acc;
  }, 0);

  const bankBal = entries.reduce((acc, entry) => {
    if (entry.debitAccount === '2') acc += entry.amount;
    if (entry.creditAccount === '2') acc -= entry.amount;
    return acc;
  }, 0);

  return (
    <div id="receipts-payments-printable" className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-150 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-950 flex items-center gap-2">
            <Landmark size={20} className="text-blue-600" />
            Receipts and Payments Account (Cash Summary)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Summary of Cash & Bank books for the union period</p>
        </div>

        <button
          onClick={handlePrint}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-800/60 disabled:text-rose-300 text-white text-sm rounded-lg font-semibold transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving PDF...
            </>
          ) : (
            <>
              <Download size={14} />
              Save as PDF
            </>
          )}
        </button>
      </div>

      {/* Cash Box & Bank balance indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 border border-blue-50 bg-blue-50/30 rounded-xl">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest font-mono">Available Cash Cashbox</p>
          <p className="text-xl font-bold font-mono mt-1 text-blue-900">{formatAmount(cashBal)}</p>
        </div>
        <div className="p-4 border border-emerald-50 bg-emerald-50/30 rounded-xl">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono">Available Bank Balance</p>
          <p className="text-xl font-bold font-mono mt-1 text-emerald-900">{formatAmount(bankBal)}</p>
        </div>
        <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-widest font-mono">Total Liquid Funds (Cash+Bank)</p>
          <p className="text-xl font-bold font-mono mt-1 text-slate-900">{formatAmount(cashBal + bankBal)}</p>
        </div>
      </div>

      {/* Symmetric Double-Column T-Account Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border border-gray-200 rounded-xl overflow-hidden bg-slate-50">
        
        {/* LEFT COLUMN: RECEIPTS (Debit side / Inflows) */}
        <div className="bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col justify-between">
          <div>
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold border-b border-gray-150 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <ArrowUpRight size={14} className="text-emerald-600" />
                RECEIPTS / CASH INFLOWS
              </span>
              <span>DEBIT SIDE (Dr)</span>
            </div>

            <div className="divide-y divide-gray-100">
              {/* Opening balance line */}
              <div className="p-3 flex items-center justify-between text-sm italic font-medium bg-gray-50/50">
                <span className="text-gray-500 flex items-center gap-1.5 pl-2">
                  <Wallet size={12} className="text-gray-400" />
                  To Balance b/d (Opening Cash/Bank)
                </span>
                <span className="font-mono font-semibold text-gray-700">{formatAmount(openingBalance)}</span>
              </div>

              {receipts.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs italic">
                  No receipts recorded.
                </div>
              ) : (
                receipts.map((r, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                    <span className="text-gray-700 pl-2">To {r.accountName}</span>
                    <span className="font-mono font-bold text-emerald-700">{formatAmount(r.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-gray-150 flex justify-between font-extrabold text-sm font-mono text-emerald-950">
            <span>TOTAL RECEIPTS (A):</span>
            <span>{formatAmount(openingBalance + totalReceipts)}</span>
          </div>
        </div>

        {/* RIGHT COLUMN: PAYMENTS (Credit side / Outflows) */}
        <div className="bg-white flex flex-col justify-between">
          <div>
            <div className="p-3 bg-rose-50 text-rose-800 text-xs font-bold border-b border-gray-150 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <ArrowDownRight size={14} className="text-rose-600" />
                PAYMENTS / CASH OUTFLOWS
              </span>
              <span>CREDIT SIDE (Cr)</span>
            </div>

            <div className="divide-y divide-gray-100">
              {payments.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs italic">
                  No payments recorded.
                </div>
              ) : (
                payments.map((p, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                    <span className="text-gray-700 pl-2">By {p.accountName}</span>
                    <span className="font-mono font-bold text-rose-700">{formatAmount(p.amount)}</span>
                  </div>
                ))
              )}

              {/* Balance Carried Down (Closing balance line) */}
              <div className="p-3 flex items-center justify-between text-sm italic font-medium bg-gray-50/50">
                <span className="text-gray-600 flex items-center gap-1.5 pl-2">
                  <Wallet size={12} className="text-gray-400" />
                  By Balance c/d (Closing Cash & Bank)
                </span>
                <span className="font-mono font-bold text-blue-900">{formatAmount(closingBalance)}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-gray-150 flex justify-between font-extrabold text-sm font-mono text-rose-950">
            <span>TOTAL PAYMENTS & BAL (B):</span>
            <span>{formatAmount(totalPayments + closingBalance)}</span>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
        <span>ℹ️</span>
        <span>A double check: Total Left Hand Side (A) is equal to Right Hand Side (B). Mathematical integrity is guaranteed by double entry.</span>
      </div>
    </div>
  );
}
