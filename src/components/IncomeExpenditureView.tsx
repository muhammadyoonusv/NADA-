/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Account, JournalEntry } from '../types';
import { getIncomeAndExpenditure } from '../utils/accounting';
import { Landmark, ArrowUpRight, ArrowDownRight, Download, AlertTriangle, HelpCircle } from 'lucide-react';

interface IncomeExpenditureViewProps {
  accounts: Account[];
  entries: JournalEntry[];
}

export function IncomeExpenditureView({ accounts, entries }: IncomeExpenditureViewProps) {
  const {
    incomes,
    expenditures,
    totalIncome,
    totalExpenditure,
    balanceType,
    balanceAmount,
  } = getIncomeAndExpenditure(accounts, entries);

  const [isGenerating, setIsGenerating] = useState(false);

  // Formatting helper
  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(num);
  };

  const handlePrint = async () => {
    const element = document.getElementById('income-expenditure-printable');
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

      pdf.save(`Income_And_Expenditure_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Balancing columns logic for beautiful symmetric T-layout
  const grandTotal = Math.max(totalIncome, totalExpenditure);

  return (
    <div id="income-expenditure-printable" className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden max-w-5xl mx-auto p-6 space-y-6 text-left">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-150 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-950 flex items-center gap-2">
            <Landmark size={20} className="text-indigo-600" />
            Income and Expenditure Account (NPO Revenue Statement)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Automated revenue accounts matching classic non-profit accrual guidelines</p>
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

      {/* Summary Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
        <div className="p-4 border border-teal-100 bg-teal-50/20 rounded-xl">
          <p className="text-xs font-bold text-teal-700 uppercase tracking-widest font-mono">Total Revenue Income</p>
          <p className="text-xl font-bold font-mono mt-1 text-teal-900">{formatAmount(totalIncome)}</p>
        </div>
        <div className="p-4 border border-rose-100 bg-rose-50/20 rounded-xl">
          <p className="text-xs font-bold text-rose-700 uppercase tracking-widest font-mono">Total Revenue Expenditures</p>
          <p className="text-xl font-bold font-mono mt-1 text-rose-900">{formatAmount(totalExpenditure)}</p>
        </div>
        <div className={`p-4 border rounded-xl ${
          balanceType === 'Surplus'
            ? 'border-indigo-100 bg-indigo-50/30'
            : 'border-amber-100 bg-amber-50/30'
        }`}>
          <p className={`text-xs font-bold uppercase tracking-widest font-mono ${
            balanceType === 'Surplus' ? 'text-indigo-700' : 'text-amber-700'
          }`}>
            Periodical Net {balanceType === 'Surplus' ? 'Surplus' : 'Deficit'}
          </p>
          <span className="flex items-baseline gap-1 mt-1 justify-between">
            <span className={`text-xl font-black font-mono ${
              balanceType === 'Surplus' ? 'text-indigo-900' : 'text-amber-900'
            }`}>
              {formatAmount(balanceAmount)}
            </span>
            <span className="text-[10px] font-sans font-semibold opacity-75">
              {balanceType === 'Surplus' ? 'Income > Exp' : 'Exp > Income'}
            </span>
          </span>
        </div>
      </div>

      {/* Classic NPO T-Account: Expenditures on LHS / Income on RHS */}
      <div className="border border-gray-250 rounded-xl overflow-hidden bg-slate-50 grid grid-cols-1 lg:grid-cols-2 shadow-2xs">
        
        {/* LEFT COLUMN: EXPENDITURES (Dr - Debit Side) */}
        <div className="bg-white border-b lg:border-b-0 lg:border-r border-gray-250 flex flex-col justify-between">
          <div>
            <div className="p-3 bg-rose-50/80 text-rose-950 text-xs font-bold border-b border-gray-150 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <ArrowDownRight size={14} className="text-rose-600" />
                EXPENDITURES (REVENUE EXPENSES)
              </span>
              <span>DEBIT SIDE (Dr)</span>
            </div>

            <div className="divide-y divide-gray-100 min-h-[160px]">
              {expenditures.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-xs italic">
                  No expenditures recorded in this period.
                </div>
              ) : (
                expenditures.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                    <span className="text-gray-700 pl-2">To {item.name}</span>
                    <span className="font-mono font-semibold text-rose-800">{formatAmount(item.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Balancing Surplus is written on Left Hand Side to total columns symmetrically */}
          <div className="border-t border-gray-100 bg-slate-50/20">
            {balanceType === 'Surplus' && balanceAmount > 0 && (
              <div className="p-3 flex items-center justify-between text-sm border-b border-gray-150 italic font-mono bg-indigo-50/10 text-indigo-950 font-bold">
                <span className="pl-2">To Surplus (Excess of Income over Expenditure)</span>
                <span>{formatAmount(balanceAmount)}</span>
              </div>
            )}
            <div className="p-3 bg-slate-100 flex items-center justify-between font-extrabold text-sm font-mono text-gray-900 border-t border-gray-250">
              <span>TOTAL (Expenditures side):</span>
              <span>{formatAmount(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INCOME (Cr - Credit Side) */}
        <div className="bg-white flex flex-col justify-between">
          <div>
            <div className="p-3 bg-emerald-50/80 text-emerald-950 text-xs font-bold border-b border-gray-150 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <ArrowUpRight size={14} className="text-emerald-600" />
                INCOMES (REVENUE COOPERATIVE RECEIPTS)
              </span>
              <span>CREDIT SIDE (Cr)</span>
            </div>

            <div className="divide-y divide-gray-100 min-h-[160px]">
              {incomes.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-xs italic">
                  No incomes recorded in this period.
                </div>
              ) : (
                incomes.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                    <span className="text-gray-700 pl-2">By {item.name}</span>
                    <span className="font-mono font-semibold text-emerald-800">{formatAmount(item.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Balancing Deficit is written on Right Hand Side to total columns symmetrically */}
          <div className="border-t border-gray-100 bg-slate-50/20">
            {balanceType === 'Deficit' && balanceAmount > 0 && (
              <div className="p-3 flex items-center justify-between text-sm border-b border-gray-150 italic font-mono bg-amber-50/10 text-amber-950 font-bold">
                <span className="pl-2">By Deficit (Excess of Expenditure over Income)</span>
                <span>{formatAmount(balanceAmount)}</span>
              </div>
            )}
            <div className="p-3 bg-slate-100 flex items-center justify-between font-extrabold text-sm font-mono text-gray-900 border-t border-gray-250">
              <span>TOTAL (Incomes side):</span>
              <span>{formatAmount(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accrual warning helper & NPO notes */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-xl space-y-2 text-xs text-indigo-900">
        <h4 className="font-bold flex items-center gap-1">
          <HelpCircle size={14} />
          Important Accrual Ledger Insight:
        </h4>
        <p className="leading-relaxed">
          The <strong>Receipts & Payments Account</strong> captures purely physical cash flow movements (e.g. including Capital additions). The <strong>Income & Expenditure Account</strong> is prepared strictly on an accrual basis, extracting revenue income/expenditures to determine current-period financial surplus/deficits of the union or non-profit trust.
        </p>
      </div>
    </div>
  );
}
