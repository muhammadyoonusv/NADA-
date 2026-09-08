/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Account, JournalEntry } from '../types';
import { getTrialBalance } from '../utils/accounting';
import { CheckCircle2, AlertTriangle, Download, FileText } from 'lucide-react';

interface TrialBalanceViewProps {
  accounts: Account[];
  entries: JournalEntry[];
}

export function TrialBalanceView({ accounts, entries }: TrialBalanceViewProps) {
  const { items, totalDebit, totalCredit } = getTrialBalance(accounts, entries);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const [isGenerating, setIsGenerating] = useState(false);

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(num);
  };

  const handlePrint = async () => {
    const element = document.getElementById('trial-balance-printable');
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

      pdf.save(`Trial_Balance_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="trial-balance-printable" className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-150 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" />
            Class Union - Automated Trial Balance
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">As on {new Date().toISOString().split('T')[0]} (Generated Instantly)</p>
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

      {/* Trial balance verification status banner */}
      <div className={`p-4 rounded-xl border flex items-center gap-3 ${
        isBalanced
          ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
          : 'bg-rose-50 border-rose-100 text-rose-800'
      }`}>
        {isBalanced ? (
          <>
            <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-sm">Ledger Books Verified & Balanced!</p>
              <p className="text-xs text-emerald-600 font-sans mt-0.5">
                Excellent! Every recorded Debit matches its corresponding double-entry Credit perfectly. Total debits are {formatAmount(totalDebit)}.
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle size={24} className="text-rose-500 shrink-0" />
            <div>
              <p className="font-bold text-sm">Trial Balance Mismatch Detected!</p>
              <p className="text-xs text-rose-600 font-sans mt-0.5">
                Warning: Total Debit side ({formatAmount(totalDebit)}) does not equal Total Credit side ({formatAmount(totalCredit)}). Total Difference is {formatAmount(Math.abs(totalDebit - totalCredit))}. Please verify your double-entries.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Trial Balance accounting sheet table */}
      <div className="border border-gray-250 rounded-xl overflow-hidden shadow-2xs bg-slate-50/50">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-xs font-bold font-mono uppercase tracking-wider border-b border-gray-200 select-none">
              <th className="p-3 w-16 text-center">Row</th>
              <th className="p-3">Ledger Name</th>
              <th className="p-3">Type</th>
              <th className="p-3 text-right w-36">Debit Balance Dr (₹)</th>
              <th className="p-3 text-right w-36">Credit Balance Cr (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150 font-sans bg-white">
            {items.map((item, idx) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3 font-mono text-xs text-gray-400 text-center">{idx + 1}</td>
                <td className="p-3 font-semibold text-gray-800 font-serif text-base">{item.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    item.type === 'Asset' ? 'bg-emerald-50 text-emerald-700' :
                    item.type === 'Liability' ? 'bg-amber-50 text-amber-700' :
                    item.type === 'Equity' ? 'bg-indigo-50 text-indigo-700' :
                    item.type === 'Income' ? 'bg-sky-50 text-sky-700' :
                    'bg-rose-50 text-rose-700'
                  }`}>
                    {item.type}
                  </span>
                </td>
                <td className="p-3 text-right font-mono font-bold text-emerald-700">
                  {item.debit > 0 ? formatAmount(item.debit) : '-'}
                </td>
                <td className="p-3 text-right font-mono font-bold text-rose-700">
                  {item.credit > 0 ? formatAmount(item.credit) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-350 text-slate-800 font-bold font-mono h-12 text-base">
              <td colSpan={3} className="p-3 text-right text-sm">TOTAL BALANCES:</td>
              <td className="p-3 text-right text-emerald-800 border-t-2 border-slate-400 border-double">
                {formatAmount(totalDebit)}
              </td>
              <td className="p-3 text-right text-rose-800 border-t-2 border-slate-400 border-double">
                {formatAmount(totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="text-center text-xs text-gray-400">
        Computerized ledger postings generated by class union treasurer automator. Non-repudiable audit standard.
      </div>
    </div>
  );
}
