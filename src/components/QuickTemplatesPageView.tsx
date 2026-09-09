import React from 'react';
import { Sparkles, ArrowLeft, RefreshCw, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

interface QuickTemplatesPageViewProps {
  standardPresets: Array<{
    label: string;
    desc: string;
    entries?: any[];
  }>;
  aiPresets: Array<{
    label: string;
    desc: string;
    entries?: any[];
  }>;
  activePresetTab: 'standard' | 'ai';
  setActivePresetTab: (tab: 'standard' | 'ai') => void;
  loadingAiPresets: boolean;
  isEditor: boolean;
  onApplyTemplate: (preset: any) => void;
  onGenerateAiPresets: () => void;
  onNavigateJournal: () => void;
  onNavigateHome: () => void;
}

export const QuickTemplatesPageView: React.FC<QuickTemplatesPageViewProps> = ({
  standardPresets,
  aiPresets,
  activePresetTab,
  setActivePresetTab,
  loadingAiPresets,
  isEditor,
  onApplyTemplate,
  onGenerateAiPresets,
  onNavigateJournal,
  onNavigateHome,
}) => {
  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onNavigateHome}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Return to Home Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">Quick Templates Hub</h2>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                TEMPLATES PAGE
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Rapidly journalize recurring union transactions, dues collections, and AI-recognized double-entry ledger patterns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onNavigateJournal}
            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-3xs"
          >
            <FileText size={14} className="text-indigo-600" />
            <span>Open Journal Sheet</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Preset Selector Tabs & Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs max-w-md w-full">
          <button
            type="button"
            onClick={() => setActivePresetTab('standard')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activePresetTab === 'standard'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>Standard Presets</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1.5 py-0.2 rounded-full">
              {standardPresets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActivePresetTab('ai')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activePresetTab === 'ai'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles size={13} className="text-indigo-600 animate-pulse" />
            <span>AI Recognized</span>
            {aiPresets.length > 0 ? (
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-mono px-1.5 py-0.2 rounded-full">
                {aiPresets.length}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            )}
          </button>
        </div>

        {activePresetTab === 'ai' && (
          <button
            type="button"
            disabled={loadingAiPresets || !isEditor}
            onClick={onGenerateAiPresets}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-3xs self-end sm:self-auto"
          >
            <RefreshCw size={13} className={loadingAiPresets ? 'animate-spin' : ''} />
            <span>{loadingAiPresets ? 'Gemini Analyzing Ledger...' : 'Run AI Pattern Analysis'}</span>
          </button>
        )}
      </div>

      {/* Grid Content */}
      {activePresetTab === 'standard' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {standardPresets.map((preset, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl p-5 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {preset.label}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    Standard
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  {preset.desc}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-medium">
                  {isEditor ? 'Ready to journalize' : 'Read-only'}
                </span>
                <button
                  type="button"
                  disabled={!isEditor}
                  onClick={() => onApplyTemplate(preset)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={13} />
                  <span>Insert to Journal</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="animate-fade-in">
          {aiPresets.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-3xs max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                <Sparkles size={28} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900">No AI Templates Generated Yet</h3>
                <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
                  Let Gemini analyze your general ledger entries to automatically recognize recurring fee collections, programs, and operational expenses.
                </p>
              </div>
              <button
                type="button"
                disabled={loadingAiPresets || !isEditor}
                onClick={onGenerateAiPresets}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <RefreshCw size={14} className={loadingAiPresets ? 'animate-spin' : ''} />
                <span>{loadingAiPresets ? 'Analyzing Transactions...' : 'Analyze Ledger Now'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aiPresets.map((preset, idx) => (
                <div
                  key={idx}
                  className="bg-white border-2 border-indigo-100/80 hover:border-indigo-300 rounded-2xl p-5 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-950 group-hover:text-indigo-600 transition-colors">
                        {preset.label}
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles size={10} />
                        <span>AI Recognized</span>
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      {preset.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-medium">
                      Gemini Pattern
                    </span>
                    <button
                      type="button"
                      disabled={!isEditor}
                      onClick={() => onApplyTemplate(preset)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-3xs"
                    >
                      <CheckCircle2 size={13} />
                      <span>Insert to Journal</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
