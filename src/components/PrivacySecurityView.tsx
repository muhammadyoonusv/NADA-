import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Lock, 
  UserCheck, 
  Key, 
  Database, 
  EyeOff, 
  CheckCircle2, 
  RefreshCw, 
  FileText, 
  ExternalLink, 
  ShieldAlert,
  HardDrive,
  Plus,
  Trash2,
  Check
} from 'lucide-react';

interface PrivacySecurityViewProps {
  currentUser: any | null;
  isEditor: boolean;
  allowedEmails: string[];
  treasurerName: string;
  treasurerEmail: string;
  academicYear: string;
  totalEntries: number;
  totalAccounts: number;
  onNavigateHome: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onUpdateAllowedEmails?: (newEmails: string[]) => Promise<void>;
}

export const PrivacySecurityView: React.FC<PrivacySecurityViewProps> = ({
  currentUser,
  isEditor,
  allowedEmails = [],
  treasurerName,
  treasurerEmail,
  academicYear,
  totalEntries,
  totalAccounts,
  onNavigateHome,
  onOpenProfile,
  onOpenSettings,
  onUpdateAllowedEmails,
}) => {
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheClearedSuccess, setCacheClearedSuccess] = useState(false);

  const [whitelistedEmails, setWhitelistedEmails] = useState<string[]>([]);
  const [savingWhitelist, setSavingWhitelist] = useState(false);
  const [whitelistSuccess, setWhitelistSuccess] = useState(false);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);

  const superAdmins = ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];
  const userEmail = currentUser?.email?.toLowerCase();
  const isSuperAdmin = !!(userEmail && superAdmins.includes(userEmail));

  useEffect(() => {
    const unique: string[] = Array.from(new Set<string>(
      (allowedEmails || [])
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
    ));
    const mandatory = ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];
    const other = unique.filter(e => !mandatory.includes(e));
    setWhitelistedEmails([...mandatory, ...other]);
  }, [allowedEmails]);

  const handleAddEmailSlot = () => {
    setWhitelistedEmails(prev => [...prev, '']);
  };

  const handleUpdateEmailSlot = (index: number, val: string) => {
    setWhitelistedEmails(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemoveEmailSlot = (index: number) => {
    setWhitelistedEmails(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveWhitelist = async () => {
    if (!isSuperAdmin && !isEditor) {
      setWhitelistError('Access denied: You need administrative permissions to update the whitelist.');
      return;
    }
    setSavingWhitelist(true);
    setWhitelistError(null);

    const cleanedEmails: string[] = Array.from(new Set<string>(
      whitelistedEmails
        .map(email => email.trim().toLowerCase())
        .filter(Boolean)
    ));
    const mandatory = ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];
    const other = cleanedEmails.filter(e => !mandatory.includes(e));
    const finalEmails = [...mandatory, ...other];

    try {
      if (onUpdateAllowedEmails) {
        await onUpdateAllowedEmails(finalEmails);
      }
      setWhitelistSuccess(true);
      setTimeout(() => setWhitelistSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      setWhitelistError(e?.message || 'Failed to update whitelist');
    } finally {
      setSavingWhitelist(false);
    }
  };

  const handleClearLocalCache = () => {
    setClearingCache(true);
    try {
      // Clear non-critical local caches while preserving system config
      const keysToPreserve = ['ai_studio_user'];
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToPreserve.includes(key) && key.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
      setCacheClearedSuccess(true);
      setTimeout(() => setCacheClearedSuccess(false), 3000);
    } catch (e) {
      console.error('Error clearing local cache', e);
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12 text-left">
      {/* Top Header Card */}
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Privacy & Security</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg text-xs font-semibold">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Security Status: Active</span>
          </div>
        </div>
      </div>

      {/* Security Health & Session Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* User Identity & Role */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-3xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              Current Session
            </span>
            <UserCheck size={16} className="text-indigo-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-900 truncate">
              {currentUser?.email || 'Unauthenticated Session'}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isSuperAdmin
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : isEditor
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {isSuperAdmin ? 'Super Administrator' : isEditor ? 'Authorized Editor' : 'Read-Only Viewer'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-100">
            {isEditor ? 'Granted full write & reconciliation rights.' : 'Read-only access enabled.'}
          </p>
        </div>

        {/* Database Encryption */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-3xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              Cloud Storage
            </span>
            <Database size={16} className="text-teal-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-900">
              Cloud Firestore (Encrypted)
            </div>
            <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
              <Lock size={12} />
              <span>AES-256 in-transit & at-rest</span>
            </p>
          </div>
          <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-100">
            {totalEntries} ledger entries securely persisted.
          </p>
        </div>

        {/* Auditable Treasurer Signature */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-3xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              Audit Signature
            </span>
            <Key size={16} className="text-amber-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-900 truncate">
              {treasurerName || 'Default Treasurer'}
            </div>
            <div className="text-[11px] text-gray-500 font-mono truncate">
              {treasurerEmail || 'treasurer@union.edu'}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-100">
            Fiscal Cycle: {academicYear || '2026 - 2027'}
          </p>
        </div>
      </div>

      {/* Main Security Policies Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-3xs overflow-hidden divide-y divide-gray-100">
        {/* Section 1: Access Control & Whitelist */}
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Access Control & Permissions (RBAC)</h3>
                <p className="text-[11px] text-gray-500">Authorized accounts with full double-entry write & edit permissions</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <ExternalLink size={12} />
              <span>Open Full Settings & Database Tab</span>
            </button>
          </div>

          {/* Super Admins Display */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Authorized System Administrators</span>
              <span className="font-mono text-[11px] text-indigo-600">2 Protected Super Admins</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {superAdmins.map((admin, idx) => (
                <div key={idx} className="bg-white border border-slate-200 px-3 py-2 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-mono text-gray-800 truncate">{admin}</span>
                  <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold">
                    Super Admin
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">
              Only primary administrators can authorize new editing slots, reset balances, or manage global institutional preferences.
            </p>
          </div>

          {/* Whitelisted Editors Management Card */}
          <div className="border border-indigo-100 bg-indigo-50/25 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                <ShieldAlert size={15} className="text-indigo-600 shrink-0" />
                <span>Whitelisted Editors ({Math.max(0, whitelistedEmails.length - 2)})</span>
              </div>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleAddEmailSlot}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 rounded-md cursor-pointer hover:bg-indigo-50 transition-colors shadow-3xs"
                >
                  <Plus size={13} />
                  <span>Add Slot</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {whitelistedEmails.map((email, idx) => {
                if (idx === 0 || idx === 1) return null;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="email"
                      required
                      value={email}
                      disabled={!isSuperAdmin}
                      onChange={(e) => handleUpdateEmailSlot(idx, e.target.value)}
                      placeholder="editor@gmail.com"
                      className="flex-1 px-3 py-1.5 text-xs border border-gray-250 rounded-lg font-mono text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                    />
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEmailSlot(idx)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                        title="Remove editor slot"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              {whitelistedEmails.length <= 2 && (
                <p className="text-xs text-gray-400 italic py-1">
                  No extra editors added. Primary admins are active.
                </p>
              )}
            </div>

            {/* Whitelist feedback notices */}
            {whitelistSuccess && (
              <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex items-center gap-1.5 animate-fade-in">
                <Check size={14} className="text-emerald-600 stroke-[3]" />
                <span>Authorized editors whitelist updated and saved!</span>
              </div>
            )}
            {whitelistError && (
              <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg animate-fade-in">
                {whitelistError}
              </div>
            )}

            {isSuperAdmin && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={savingWhitelist}
                  onClick={handleSaveWhitelist}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  {savingWhitelist ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving Whitelist...</span>
                    </>
                  ) : (
                    <>
                      <Check size={13} className="stroke-[3]" />
                      <span>Save Whitelist Changes</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Privacy Standards */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <EyeOff size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Data Privacy & Zero Telemetry</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-1 bg-white">
              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>No Third-Party Analytics</span>
              </div>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                We do not sell, share, or broadcast financial entries to third-party ad networks or tracking trackers.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 space-y-1 bg-white">
              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Double-Entry Math Integrity</span>
              </div>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                All debit and credit balances are verified locally and server-side to guarantee equal balancing (Total Dr = Total Cr).
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Client Cache & Storage Maintenance */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <HardDrive size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Local Cache & Device Storage</h3>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <div className="text-xs font-bold text-gray-800">Clear Temporary Browser Cache</div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Refreshes local temporary views without affecting your permanent Cloud Firestore ledger.
              </p>
            </div>
            <button
              type="button"
              disabled={clearingCache}
              onClick={handleClearLocalCache}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={13} className={clearingCache ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
              <span>{clearingCache ? 'Clearing...' : 'Clear Local Cache'}</span>
            </button>
          </div>

          {cacheClearedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>Local browser cache cleared successfully. Cloud ledger remains intact.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
