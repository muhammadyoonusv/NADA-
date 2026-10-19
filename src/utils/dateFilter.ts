/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { JournalEntry } from '../types';

export type DatePreset = 'all' | 'today' | 'this_month' | 'fy_2026_2027' | 'custom';

/**
 * Returns formatted start and end dates (YYYY-MM-DD) for standard financial presets.
 */
export function getPresetDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'this_month': {
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const fYear = firstDay.getFullYear();
      const fMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
      const fDate = String(firstDay.getDate()).padStart(2, '0');

      const lYear = lastDay.getFullYear();
      const lMonth = String(lastDay.getMonth() + 1).padStart(2, '0');
      const lDate = String(lastDay.getDate()).padStart(2, '0');

      return {
        startDate: `${fYear}-${fMonth}-${fDate}`,
        endDate: `${lYear}-${lMonth}-${lDate}`,
      };
    }

    case 'fy_2026_2027':
      // Indian Financial Year 2026–2027: 01-Apr-2026 to 31-Mar-2027
      return {
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      };

    case 'all':
    case 'custom':
    default:
      return { startDate: '', endDate: '' };
  }
}

/**
 * Filter journal entries by inclusive start and end dates.
 */
export function filterEntriesByDateRange(
  entries: JournalEntry[],
  startDate: string,
  endDate: string
): JournalEntry[] {
  if (!startDate && !endDate) return entries;

  return entries.filter((entry) => {
    if (!entry.date) return true;
    const d = entry.date.trim();

    if (startDate && endDate) {
      return d >= startDate && d <= endDate;
    }
    if (startDate) {
      return d >= startDate;
    }
    if (endDate) {
      return d <= endDate;
    }
    return true;
  });
}

/**
 * Formats YYYY-MM-DD into DD-MMM-YYYY (e.g. 19-Oct-2026)
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2].padStart(2, '0');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthIdx] || parts[1];

  return `${day}-${monthName}-${year}`;
}

/**
 * Creates dynamic statement header period text based on active date range.
 */
export function getPeriodDescription(startDate: string, endDate: string): string {
  if (!startDate && !endDate) {
    return 'All Records (All Time)';
  }
  if (startDate && endDate) {
    if (startDate === endDate) {
      return `Statement as of: ${formatDateDisplay(startDate)}`;
    }
    return `Statement for Period: ${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}`;
  }
  if (startDate && !endDate) {
    return `Statement from: ${formatDateDisplay(startDate)} onwards`;
  }
  return `Statement up to: ${formatDateDisplay(endDate)}`;
}

/**
 * Creates a clean, safe filename for PDF exports based on statement type and date filter.
 */
export function generateStatementFilename(
  statementType: string,
  startDate: string,
  endDate: string,
  orgName: string = 'NADA_Union'
): string {
  const cleanOrg = orgName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanType = statementType.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!startDate && !endDate) {
    return `${cleanOrg}_${cleanType}_AllTime_${new Date().toISOString().split('T')[0]}.pdf`;
  }
  if (startDate && endDate) {
    return `${cleanOrg}_${cleanType}_${startDate}_to_${endDate}.pdf`;
  }
  return `${cleanOrg}_${cleanType}_${startDate || 'Start'}_to_${endDate || 'End'}.pdf`;
}
