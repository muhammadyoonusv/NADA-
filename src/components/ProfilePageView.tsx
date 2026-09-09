import React from 'react';
import { User, ArrowLeft, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { SidebarProfileFolder } from './SidebarProfileFolder';

interface ProfilePageViewProps {
  sheetName: string;
  sheetTagline: string;
  treasurerName: string;
  treasurerEmail: string;
  academicYear: string;
  logoIcon: string;
  allowedEmails: string[];
  isEditor: boolean;
  currentUser: any;
  onQuickUpdateLogo: (logo: string) => void;
  onSaveConfig: (config: any) => Promise<boolean>;
  onNavigateHome: () => void;
  onOpenFullSettings: () => void;
}

export const ProfilePageView: React.FC<ProfilePageViewProps> = ({
  sheetName,
  sheetTagline,
  treasurerName,
  treasurerEmail,
  academicYear,
  logoIcon,
  allowedEmails,
  isEditor,
  currentUser,
  onQuickUpdateLogo,
  onSaveConfig,
  onNavigateHome,
  onOpenFullSettings,
}) => {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
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
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <User size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Profile & Settings</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onOpenFullSettings}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-3xs"
          >
            <Settings size={14} className="text-slate-500" />
            <span>Full System Settings</span>
          </button>
        </div>
      </div>

      {/* Main Profile Form Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-3xs overflow-hidden">
        <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-gray-800">Organization & Ledger Identity Details</h3>
          </div>
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            Changes synchronize directly with Cloud Firestore
          </span>
        </div>

        <div className="p-4 sm:p-6">
          <SidebarProfileFolder
            sheetName={sheetName}
            sheetTagline={sheetTagline}
            treasurerName={treasurerName}
            treasurerEmail={treasurerEmail}
            academicYear={academicYear}
            logoIcon={logoIcon}
            allowedEmails={allowedEmails}
            isEditor={isEditor}
            currentUser={currentUser}
            onQuickUpdateLogo={onQuickUpdateLogo}
            onSaveConfig={onSaveConfig}
            onOpenFullSettings={onOpenFullSettings}
          />
        </div>
      </div>
    </div>
  );
};
