/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar, Printer, Download, RotateCcw, Filter, ChevronDown, Check } from 'lucide-react';
import { DatePreset, getPresetDateRange } from '../utils/dateFilter';

export interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  activePreset: DatePreset;
  onFilterChange: (startDate: string, endDate: string, preset: DatePreset) => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
  isGeneratingPdf?: boolean;
  totalRecords?: number;
  filteredRecords?: number;
  statementTitle?: string;
  className?: string;
  showPrintOptions?: boolean;
}

export function DateRangeFilter({
  startDate,
  endDate,
  activePreset,
  onFilterChange,
  onPrint,
  onExportPdf,
  isGeneratingPdf = false,
  totalRecords,
  filteredRecords,
  statementTitle = 'Financial Statement',
  className = '',
  showPrintOptions = true,
}: DateRangeFilterProps) {
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetClick = (preset: DatePreset) => {
    if (preset === 'custom') {
      onFilterChange(startDate, endDate, 'custom');
      return;
    }
    const range = getPresetDateRange(preset);
    onFilterChange(range.startDate, range.endDate, preset);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onFilterChange(val, endDate, 'custom');
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onFilterChange(startDate, val, 'custom');
  };

  const handleReset = () => {
    onFilterChange('', '', 'all');
  };

  const presets: { id: DatePreset; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'this_month', label: 'This Month' },
    { id: 'fy_2026_2027', label: 'FY 2026–2027' },
    { id: 'custom', label: 'Custom Range' },
  ];

  const isFiltered = Boolean(startDate || endDate || activePreset !== 'all');

  return (
    <div
      className={`no-print bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-3 ${className}`}
    >
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
            <Filter size={14} className="text-indigo-600" />
            <span>Date Presets:</span>
          </div>

          {presets.map((p) => {
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetClick(p.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                {p.label}
              </button>
            );
          })}

          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-1 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
              title="Reset date filter"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Print / Save as PDF button */}
        {showPrintOptions && (
          <div className="relative shrink-0 flex items-center gap-2" ref={menuRef}>
            {/* Primary Action Button */}
            <div className="inline-flex rounded-lg shadow-xs overflow-hidden border border-indigo-700">
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() => {
                  if (onExportPdf) onExportPdf();
                  else if (onPrint) onPrint();
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:bg-indigo-400 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Save filtered report as pixel-perfect A4 PDF"
              >
                {isGeneratingPdf ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Printer size={15} />
                    <span>Print / Save as PDF</span>
                  </>
                )}
              </button>

              {/* Dropdown chevron to pick either direct print or PDF download */}
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() => setShowExportMenu((v) => !v)}
                className="px-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs border-l border-indigo-500 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                title="Choose print format"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 text-xs text-slate-700 font-medium animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    if (onExportPdf) onExportPdf();
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Download size={14} className="text-indigo-600" />
                  <div>
                    <div className="font-semibold">Download A4 PDF</div>
                    <div className="text-[10px] text-slate-400">High-res vector/raster export</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    if (onPrint) onPrint();
                    else window.print();
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100"
                >
                  <Printer size={14} className="text-slate-600" />
                  <div>
                    <div className="font-semibold">Direct Browser Print</div>
                    <div className="text-[10px] text-slate-400">Opens system printer dialog</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Date Pickers Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-start-date" className="text-slate-500 font-semibold text-xs flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              <span>Start Date:</span>
            </label>
            <input
              id="filter-start-date"
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>

          <span className="text-slate-400 font-bold">to</span>

          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-end-date" className="text-slate-500 font-semibold text-xs flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              <span>End Date:</span>
            </label>
            <input
              id="filter-end-date"
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Record count indicator */}
        {totalRecords !== undefined && (
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              Showing <strong className="text-slate-900">{filteredRecords ?? totalRecords}</strong> of{' '}
              <strong className="text-slate-900">{totalRecords}</strong> records
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
