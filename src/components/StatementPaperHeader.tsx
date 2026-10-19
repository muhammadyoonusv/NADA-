/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { getPeriodDescription } from '../utils/dateFilter';

interface StatementPaperHeaderProps {
  sheetName?: string;
  statementTitle: string;
  subtitle?: string;
  startDate?: string;
  endDate?: string;
  generatedDate?: string;
  academicYear?: string;
  className?: string;
}

export function StatementPaperHeader({
  sheetName = 'NADA',
  statementTitle,
  subtitle = 'Double-Entry Bookkeeping Record',
  startDate = '',
  endDate = '',
  generatedDate,
  academicYear = '2026 - 2027',
  className = '',
}: StatementPaperHeaderProps) {
  const periodText = getPeriodDescription(startDate, endDate);
  const today = generatedDate || new Date().toISOString().split('T')[0];

  return (
    <div
      className={`statement-header border-b-2 border-indigo-600 pb-3 mb-5 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 ${className}`}
    >
      <div>
        <div className="text-[11px] font-bold tracking-widest uppercase text-indigo-700 font-mono">
          {sheetName} • Financial Statements
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
          {statementTitle}
        </h1>
        <div className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</div>
      </div>

      <div className="meta sm:text-right text-xs text-slate-500 leading-relaxed shrink-0">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-900 font-semibold text-[11.5px] mb-1">
          <span>{periodText}</span>
        </div>
        <div>
          <strong className="text-slate-700">Fiscal Term:</strong> {academicYear}
        </div>
        <div>
          <strong className="text-slate-700">Generated:</strong> {today}
        </div>
      </div>
    </div>
  );
}
