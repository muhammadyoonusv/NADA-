/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Account, JournalEntry, AccountType } from '../types';
import { ChartOfAccounts } from './ChartOfAccounts';
import { 
  Settings, 
  Database, 
  Download, 
  Trash2, 
  RefreshCw, 
  Building, 
  User, 
  Mail, 
  Calendar, 
  CloudLightning, 
  Check, 
  Sparkles, 
  ShieldAlert, 
  Info,
  Clock,
  Plus,
  Shield,
  BookOpen,
  Users,
  Award,
  Star,
  Heart,
  Zap,
  Building2,
  Scale,
  Briefcase,
  GraduationCap,
  FolderLock,
  Image,
  Upload,
  AlertCircle
} from 'lucide-react';

interface SettingsViewProps {
  accounts: Account[];
  entries: JournalEntry[];
  
  sheetName: string;
  sheetTagline: string;
  treasurerName: string;
  treasurerEmail: string;
  academicYear: string;
  logoIcon: string;
  allowedEmails: string[];
  isEditor: boolean;
  currentUser: any | null;
  
  onQuickUpdateLogo?: (newLogo: string) => void;

  onSaveConfig: (config: {
    sheetName: string;
    sheetTagline: string;
    treasurerName: string;
    treasurerEmail: string;
    academicYear: string;
    allowedEmails: string[];
    logoIcon: string;
  }) => Promise<void>;
  
  onLoadPresets: () => Promise<void>;
  onClearAll: () => Promise<void>;
  onImportBackup: (data: string) => Promise<boolean>;
  onAddAccount: (account: Omit<Account, 'id'>) => void;
  onEditAccount: (id: string, newName: string, newType: AccountType) => void;
  onDeleteAccount: (id: string) => void;
}

export function SettingsView({
  accounts,
  entries,
  sheetName,
  sheetTagline,
  treasurerName,
  treasurerEmail,
  academicYear,
  logoIcon,
  allowedEmails = ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'],
  isEditor,
  currentUser,
  onQuickUpdateLogo,
  onSaveConfig,
  onLoadPresets,
  onClearAll,
  onImportBackup,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
}: SettingsViewProps) {
  // Local state for the config form inputs
  const [tempSheetName, setTempSheetName] = useState(sheetName);
  const [tempSheetTagline, setTempSheetTagline] = useState(sheetTagline);
  const [tempTreasurerName, setTempTreasurerName] = useState(treasurerName);
  const [tempTreasurerEmail, setTempTreasurerEmail] = useState(treasurerEmail);
  const [tempAcademicYear, setTempAcademicYear] = useState(academicYear);
  const [tempLogoIcon, setTempLogoIcon] = useState(logoIcon);

  // Local state for dynamic whitelisted editor emails
  const [whitelistedEmails, setWhitelistedEmails] = useState<string[]>([]);

  // Calculate if current logged-in user is the main administrator/owner klrmuhsin809@gmail.com or yoonuschr@gmail.com
  const isSuperAdmin = !!(currentUser && currentUser.email && ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'].includes(currentUser.email.toLowerCase()));

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoSavedFast, setLogoSavedFast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; text?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Sync state if prop changes (e.g., initial load from DB finishes)
  useEffect(() => {
    setTempSheetName(sheetName);
    setTempSheetTagline(sheetTagline);
    setTempTreasurerName(treasurerName);
    setTempTreasurerEmail(treasurerEmail);
    setTempAcademicYear(academicYear);
    setTempLogoIcon(logoIcon);
    
    // Ensure klrmuhsin809@gmail.com and yoonuschr@gmail.com are always included and are at the top
    const unique: string[] = Array.from(new Set<string>(
      allowedEmails
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
    ));
    const mandatory = ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];
    const other = unique.filter(e => !mandatory.includes(e));
    setWhitelistedEmails([...mandatory, ...other]);
  }, [sheetName, sheetTagline, treasurerName, treasurerEmail, academicYear, logoIcon, allowedEmails]);

  // Instant save on click for emblem selection
  const handleSelectEmblem = (id: string) => {
    setTempLogoIcon(id);
    onQuickUpdateLogo?.(id);
    setLogoSavedFast(true);
    setTimeout(() => setLogoSavedFast(false), 2500);
  };

  // Instant save on click for photo upload
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          // Instant 0ms update so preview and header change right on the click
          setTempLogoIcon(result);
          onQuickUpdateLogo?.(result);
          setLogoSavedFast(true);
          setTimeout(() => setLogoSavedFast(false), 2500);

          // Fast background thumbnail optimization for durable storage
          const img = new window.Image();
          img.src = result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 120;
            if (width > height) {
              if (width > maxSize) {
                height *= maxSize / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width *= maxSize / height;
                height = maxSize;
              }
            }
            canvas.width = Math.round(width);
            canvas.height = Math.round(height);
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setTempLogoIcon(compressedDataUrl);
            onQuickUpdateLogo?.(compressedDataUrl);
          };
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler to add a new slot (email input field)
  const handleAddEmailSlot = () => {
    setWhitelistedEmails(prev => [...prev, '']);
  };

  // Handler to update an email input at a specific index
  const handleUpdateEmailSlot = (index: number, val: string) => {
    setWhitelistedEmails(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  // Handler to remove an email input slot
  const handleRemoveEmailSlot = (index: number) => {
    setWhitelistedEmails(prev => prev.filter((_, idx) => idx !== index));
  };

  // Instant optimistic form submit handler - saves on the click!
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditor) {
      setSaveError('Access denied: You do not have active editor permissions.');
      return;
    }
    // Instant visual confirmation right on the click
    setIsSaving(false);
    setSaveSuccess(true);
    setSaveError(null);
    setTimeout(() => setSaveSuccess(false), 4000);

    const cleanedEmails: string[] = Array.from(new Set<string>(
      whitelistedEmails
        .map(email => email.trim().toLowerCase())
        .filter(Boolean)
    ));
    
    // Ensure the mandatory ones are always preserved
    const mandatory = ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];
    const other = cleanedEmails.filter(e => !mandatory.includes(e));
    const finalEmails = [...mandatory, ...other];

    // Fire background cloud synchronization non-blocking
    onSaveConfig({
      sheetName: tempSheetName,
      sheetTagline: tempSheetTagline,
      treasurerName: tempTreasurerName,
      treasurerEmail: tempTreasurerEmail,
      academicYear: tempAcademicYear,
      allowedEmails: finalEmails,
      logoIcon: tempLogoIcon
    }).catch((err: any) => {
      console.error(err);
      setSaveError(err.message || 'Error updating configuration profile.');
    });
  };

  // Download JSON backup
  const handleDownloadBackup = () => {
    try {
      const backupData = {
        accounts,
        entries,
        metadata: {
          sheetName,
          sheetTagline,
          treasurerName,
          treasurerEmail,
          academicYear,
          exportedAt: new Date().toISOString()
        }
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `class_union_ledger_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error(err);
      alert('Failed to generate the ledger backup file.');
    }
  };

  // Upload JSON backup
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const success = await onImportBackup(content);
        if (success) {
          setImportStatus({ success: true, text: 'Ledger backup imported successfully! State has synchronized.' });
        } else {
          setImportStatus({ success: false, text: 'Failed to import backup: Content structure parse failed.' });
        }
      } catch (err) {
        setImportStatus({ success: false, text: 'Syntax or validation error in uploading JSON backup.' });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
            <Settings size={22} className="text-indigo-400 rotate-45" />
            <span>Settings & Database Maintenance</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Manage your ledger profile information, synchronize offline balances, backup double-entry sheets, or restore verified transaction checkpoints instantly.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700/60 px-4 py-2 rounded-xl text-xs font-semibold select-none font-mono text-emerald-400">
          <CloudLightning size={14} className="text-emerald-400 animate-pulse" />
          <span>CLOUDFIRE STORE CONNECTED</span>
        </div>
      </div>

      {/* Grid Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COL 1 & 2: Forms & Backups */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Profile Folder (Institutional Identity & Profile Settings) */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-3xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100/80 rounded-xl text-indigo-600 shadow-3xs">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span>Profile Folder: Institutional Identity & Settings</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Manage your ledger title, tagline, signature, visual emblem, and authorized editors</p>
                </div>
              </div>
              <span className="p-1 px-2.5 rounded-full text-[10px] font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 tracking-wider">PROFILE FOLDER</span>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Sheet Name */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 font-mono">
                    Ledger Board Title / Organization Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Building size={14} />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mechanical Engineering Class Union"
                      value={tempSheetName}
                      onChange={(e) => setTempSheetName(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-gray-800 transition-all"
                    />
                  </div>
                </div>

                {/* Tagline */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 font-mono">
                    Subtitle Slogan Tagline Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Double-entry accounting tracking system"
                    value={tempSheetTagline}
                    onChange={(e) => setTempSheetTagline(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-gray-700 transition-all"
                  />
                </div>

                {/* Treasurer Name */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 font-mono">
                    Treasurer Signature / Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <User size={14} />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Yoonus Chr"
                      value={tempTreasurerName}
                      onChange={(e) => setTempTreasurerName(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-gray-800 transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 font-mono">
                    Auditable Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Mail size={14} />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="klrmuhsin809@gmail.com"
                      value={tempTreasurerEmail}
                      onChange={(e) => setTempTreasurerEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-gray-700 font-mono transition-all"
                    />
                  </div>
                </div>

                {/* Academic Year */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 font-mono">
                    Active Fiscal Academic Year
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Calendar size={14} />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2026 - 2027"
                      value={tempAcademicYear}
                      onChange={(e) => setTempAcademicYear(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold text-slate-800 transition-all"
                    />
                  </div>
                </div>

                {/* Advanced Formal App Profile Photo & Icon Customizer */}
                <div className="md:col-span-2 pt-4 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-600" />
                        <span>Application Visual Identity & Profile Emblem</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Customize the official emblem or upload a custom leadership/union badge displayed across the application header.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-semibold border border-indigo-100 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                      <span>Header Branding</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                    {/* Live Preview Column */}
                    <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider mb-3">Live Header Preview</span>
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg overflow-hidden ring-4 ring-white transition-all transform hover:scale-105">
                        {tempLogoIcon.startsWith('data:image/') ? (
                          <img src={tempLogoIcon} alt="Custom Logo" className="w-full h-full object-cover" />
                        ) : tempLogoIcon === 'Shield' ? (
                          <Shield size={36} />
                        ) : tempLogoIcon === 'BookOpen' ? (
                          <BookOpen size={36} />
                        ) : tempLogoIcon === 'Users' ? (
                          <Users size={36} />
                        ) : tempLogoIcon === 'Award' ? (
                          <Award size={36} />
                        ) : tempLogoIcon === 'Star' ? (
                          <Star size={36} />
                        ) : tempLogoIcon === 'Heart' ? (
                          <Heart size={36} />
                        ) : tempLogoIcon === 'Zap' ? (
                          <Zap size={36} />
                        ) : tempLogoIcon === 'Building2' ? (
                          <Building2 size={36} />
                        ) : tempLogoIcon === 'Scale' ? (
                          <Scale size={36} />
                        ) : tempLogoIcon === 'Briefcase' ? (
                          <Briefcase size={36} />
                        ) : tempLogoIcon === 'GraduationCap' ? (
                          <GraduationCap size={36} />
                        ) : (
                          <FolderLock size={36} />
                        )}
                      </div>
                      <div className="mt-3 text-xs font-semibold text-slate-800 truncate max-w-full">
                        {tempSheetName || 'Class Union Ledger'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {logoSavedFast ? (
                          <span className="text-emerald-700 font-bold flex items-center justify-center gap-1 animate-pulse">
                            <Check size={11} className="text-emerald-600" /> Saved instantly!
                          </span>
                        ) : (
                          tempLogoIcon.startsWith('data:image/') ? 'Custom Uploaded Badge' : `Preset Symbol: ${tempLogoIcon}`
                        )}
                      </div>
                    </div>

                    {/* Selection & Upload Controls Column */}
                    <div className="lg:col-span-8 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Select Official Emblem Symbol
                          </label>
                          {logoSavedFast && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <Check size={12} className="text-emerald-600" />
                              Saved on click!
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-6 gap-2">
                          {[
                            { id: 'FolderLock', label: 'Lock Archive', icon: FolderLock },
                            { id: 'Shield', label: 'Security Shield', icon: Shield },
                            { id: 'BookOpen', label: 'Ledger Book', icon: BookOpen },
                            { id: 'Users', label: 'Members', icon: Users },
                            { id: 'Award', label: 'Achievement', icon: Award },
                            { id: 'Star', label: 'Featured Star', icon: Star },
                            { id: 'Heart', label: 'Community', icon: Heart },
                            { id: 'Zap', label: 'Active Pulse', icon: Zap },
                            { id: 'Building2', label: 'Institution', icon: Building2 },
                            { id: 'Scale', label: 'Auditing Scale', icon: Scale },
                            { id: 'Briefcase', label: 'Treasurer', icon: Briefcase },
                            { id: 'GraduationCap', label: 'Student Union', icon: GraduationCap },
                          ].map((item) => {
                            const IconComp = item.icon;
                            const isSelected = tempLogoIcon === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectEmblem(item.id)}
                                title={item.label}
                                className={`p-3 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                                  isSelected 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200' 
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                              >
                                <IconComp size={20} className={isSelected ? 'text-white' : 'text-indigo-600'} />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Or Upload Custom Profile / Emblem Photo
                          </label>
                          {logoSavedFast && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <Check size={12} className="text-emerald-600" />
                              Photo updated!
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-3xs"
                          >
                            <Upload size={16} className="text-indigo-600" />
                            <span>Browse Device / Gallery</span>
                          </button>
                          
                          {tempLogoIcon.startsWith('data:image/') ? (
                            <button
                              type="button"
                              onClick={() => handleSelectEmblem('FolderLock')}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                            >
                              <span>Remove Custom Photo</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Supports JPG, PNG, WEBP (Automatically compressed to 150×150px thumbnail).
                            </span>
                          )}

                          <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleGalleryUpload}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role-Based Access Control Panel */}
                <div className="md:col-span-2 mt-4 p-5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 mt-0.5">
                        <ShieldAlert size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Role-Based Access Control: Whitelisted Editors ({Math.max(0, whitelistedEmails.length - 2)})
                        </h4>
                        <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">
                          Define additional Google accounts permitted to make transactions. The primary administrators are always authorized and hidden from this display.
                        </p>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={handleAddEmailSlot}
                        className="p-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Plus size={12} className="stroke-[3]" />
                        <span>Add Slot</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {whitelistedEmails.map((email, idx) => {
                      const isMandatory = idx === 0 || idx === 1;
                      if (isMandatory) return null;
                      
                      return (
                        <div key={idx} className="relative group p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between shadow-3xs hover:border-slate-300 transition-all">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 font-mono">
                              Slot {idx - 1}: Whitelisted Editor
                            </label>
                            
                            <div className="flex items-center gap-1.5">
                              <input
                                type="email"
                                required
                                disabled={!isSuperAdmin}
                                placeholder="editor@gmail.com"
                                value={email}
                                onChange={(e) => handleUpdateEmailSlot(idx, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                              />
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEmailSlot(idx)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                  title="Remove this whitelisted editor"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Status Tip */}
                  <div className={`p-2.5 rounded-lg text-[10px] ${
                    isSuperAdmin 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                      : 'bg-amber-50 border border-amber-200 text-amber-800'
                  } border`}>
                    {isSuperAdmin ? (
                      <span className="font-medium">
                        ✓ <strong>Admin Mode Active:</strong> You are signed in as <strong>{currentUser?.email}</strong> and have full authorization to dynamically add, edit, or delete editor whitelist slots.
                      </span>
                    ) : (
                      <span>
                        ⚠ <strong>Read-Only Whitelist:</strong> Only the primary administrators (<strong>klrmuhsin809@gmail.com / yoonuschr@gmail.com</strong>) can edit these whitelisted email addresses. {currentUser ? `Signed in as ${currentUser.email}.` : 'Please sign in above.'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 p-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 animate-fade-in">
                      <Check size={14} className="text-emerald-500 stroke-[3]" />
                      Profile synchronized with cloud database!
                    </span>
                  )}
                  {saveError && (
                    <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 animate-fade-in">
                      <AlertCircle size={14} className="text-amber-600" />
                      {saveError}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSaving || !isEditor}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-3xs hover:shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin text-white" />
                      <span>Saving Profile...</span>
                    </>
                  ) : !isEditor ? (
                    <>
                      <ShieldAlert size={14} />
                      <span>Read-Only Viewer Profile</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} className="stroke-[3]" />
                      <span>Update Profile Info</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Backup Recovery Center */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-3xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Backup & Disaster Recovery Center</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Export structured accounting checkpoints or restore historical double-entry logs</p>
              </div>
              <span className="p-1 px-2.5 rounded-full text-[10px] font-bold font-mono text-blue-700 bg-blue-50 tracking-wider">BACKUP ROOM</span>
            </div>

            <div className="p-5 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Download Backup Side */}
                <div className="p-4 bg-slate-50 border border-gray-150 rounded-xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <Download size={15} className="text-blue-500" />
                      Download General Ledger Backup
                    </h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Compiles all accounts labels and journal ledger transactions into a portable custom signed JSON file. This can be stored or shared.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 hover:bg-blue-600 border hover:border-blue-600 border-blue-200 text-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all"
                  >
                    <Download size={14} />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                {/* Upload Backup Side */}
                <div className="p-4 bg-slate-50 border border-gray-150 rounded-xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <Upload size={15} className="text-indigo-500" />
                      Restore JSON Account Checkpoint
                    </h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Select an exported JSON ledger file from your local disk folder to clear current Firestore state and restore history block.
                    </p>
                  </div>
                  <div>
                    <label className={`w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      isEditor 
                        ? 'hover:bg-indigo-600 border border-indigo-200 text-indigo-600 hover:text-white hover:border-indigo-600 cursor-pointer' 
                        : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}>
                      <Upload size={14} />
                      <span>{isImporting ? 'Restoring Ledger...' : !isEditor ? 'Restore Locked (View-Only)' : 'Choose JSON Backup File'}</span>
                      {isEditor && (
                        <input 
                          ref={fileInputRef}
                          type="file" 
                          accept=".json" 
                          onChange={handleImportFile} 
                          disabled={isImporting}
                          className="hidden" 
                        />
                      )}
                    </label>
                  </div>
                </div>

              </div>

              {/* Import status block */}
              {importStatus && (
                <div className={`p-3.5 border rounded-xl flex items-start gap-2.5 text-xs animate-fade-in ${
                  importStatus.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="mt-0.5">
                    {importStatus.success ? <Check size={16} /> : <ShieldAlert size={16} />}
                  </div>
                  <div>
                    <span className="font-bold block uppercase tracking-wider text-[10px] mb-0.5">
                      {importStatus.success ? 'Restore Succeeded' : 'Import Exception'}
                    </span>
                    <p className="leading-relaxed text-[11px]">{importStatus.text}</p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Section 3: Chart of Accounts */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-3xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-gray-900">Chart of Accounts Mapping</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage and configure your custom double-entry account categories and ledger groups</p>
            </div>
            <div className="p-5">
              <ChartOfAccounts
                accounts={accounts}
                isEditor={isEditor}
                onAddAccount={onAddAccount}
                onEditAccount={onEditAccount}
                onDeleteAccount={onDeleteAccount}
              />
            </div>
          </div>

        </div>

        {/* COL 3: Telemetry Stats & Dangerous Actions */}
        <div className="space-y-6">
          
          {/* Section 3: Telemetry Dashboard Status */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-3xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-slate-50/50">
              <h3 className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                <Database size={15} className="text-indigo-600" />
                Live Cloud Telemetry
              </h3>
            </div>
            
            <div className="p-4 divide-y divide-gray-100 font-sans">
              
              <div className="py-2.5 flex justify-between text-xs">
                <span className="text-gray-400">Database Engine</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <Database size={12} className="text-indigo-500" />
                  Google Cloud Firestore
                </span>
              </div>

              <div className="py-2.5 flex justify-between text-xs">
                <span className="text-gray-400">Project Workspace ID</span>
                <span className="font-mono text-slate-700 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                  phrasal-cascade-7sx2c
                </span>
              </div>

              <div className="py-2.5 flex justify-between text-xs">
                <span className="text-gray-400">Active Tenant DB ID</span>
                <span className="font-mono text-slate-500 text-[10px] truncate max-w-[150px]" title="ai-studio-9e691d9e-dfd9-42e1-8fc5-b7f4e5e194fc">
                  9e691d9e-dfd9-42e1
                </span>
              </div>

              <div className="py-2.5 flex justify-between text-xs">
                <span className="text-gray-400">Account Sub-ledgers</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {accounts.length} Accounts
                </span>
              </div>

              <div className="py-2.5 flex justify-between text-xs">
                <span className="text-gray-400">Journal Records</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {entries.length} Rows
                </span>
              </div>

              <div className="py-2.5 flex justify-between text-xs">
                <span className="text-gray-400">Sync Status</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  Live Listeners Connected
                </span>
              </div>

              <div className="py-2.5 flex justify-between text-xs">
                <span className="text-gray-400">Real-Time Sync Protocol</span>
                <span className="font-semibold text-slate-600">
                  onSnapshot WS Link
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Maintenance / Danger Zone */}
          <div className="bg-white border border-rose-100 rounded-2xl shadow-3xs overflow-hidden">
            <div className="p-4 border-b border-rose-100 bg-rose-50/50">
              <h3 className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-rose-600" />
                Ledger Disaster/Danger Zone
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Clear database */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Trash2 size={16} className="text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">Hard Reset Ledger Book</h4>
                    <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                      Deletes all custom accounting rows and logs, resetting the double-entry dashboard back to blank system configurations. (Whitelisted Editors are actively excluded and will not be changed).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isEditor}
                  onClick={onClearAll}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-50 disabled:hover:text-rose-750 font-bold"
                >
                  <Trash2 size={12} />
                  <span>Hard Reset Database</span>
                </button>
              </div>
            </div>
          </div>

          {/* Guidelines info box */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex gap-2 w-full text-left">
            <Info className="text-indigo-600 shrink-0 mt-0.5" size={16} />
            <div className="text-[11px] text-indigo-950 leading-relaxed space-y-1">
              <span className="font-bold">Automated Statement Consistency:</span>
              <p>
                Every preset and backup transaction is strictly double-balanced. Deleting default system accounts is blocked to preserve auditing fund reserves integrity.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
