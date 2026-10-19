/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface VerificationBlockProps {
  treasurerName?: string;
  treasurerEmail?: string;
  academicYear?: string;
  generatedDate?: string;
  className?: string;
}

export function VerificationBlock({
  treasurerName = 'Union Treasurer',
  treasurerEmail = '',
  academicYear = '2026 - 2027',
  generatedDate,
  className = '',
}: VerificationBlockProps) {
  const today = generatedDate || new Date().toISOString().split('T')[0];

  return (
    <div
      className={`verification-block border border-dashed border-slate-300 bg-slate-50/80 p-4 sm:p-5 rounded-xl mt-6 text-slate-800 break-inside-avoid ${className}`}
    >
      <div className="verification-title font-bold text-xs sm:text-sm text-emerald-800 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
        <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
        <span>Automated Double-Entry Statement Verification</span>
      </div>

      <p className="verification-text text-xs text-slate-600 leading-relaxed mb-4">
        I, as the appointed Union Treasurer, do hereby verify that this statement is an authentic,
        balanced reflection of all recorded union debits, credits, and liquid holdings for the
        selected reporting period in accordance with standard double-entry accounting rules.
      </p>

      <div className="sign-row flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pt-3 border-t border-slate-200/80 text-xs">
        <div className="sign-box space-y-0.5">
          <div className="font-bold text-slate-900">Prepared & Certified By:</div>
          <div className="text-slate-700">
            Treasurer: <strong className="font-semibold text-slate-900">{treasurerName}</strong>
          </div>
          {treasurerEmail && <div className="text-slate-500 text-[11px]">{treasurerEmail}</div>}
          <div className="text-slate-500 text-[11px]">
            Certified Electronically: <span className="font-mono">{today}</span>
          </div>
        </div>

        <div className="sign-box sm:text-right space-y-0.5">
          <div className="font-bold text-slate-900">Audited & Approved By:</div>
          <div className="text-slate-700">General Auditor / President</div>
          <div className="text-slate-500 text-[11px]">
            Academic Fiscal Term: <strong className="font-semibold">{academicYear}</strong>
          </div>
          <div className="text-slate-400 text-[11px] pt-1">
            Sign: ___________________________
          </div>
        </div>
      </div>
    </div>
  );
}
