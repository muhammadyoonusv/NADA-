/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, 
  User, 
  Mail, 
  Calendar, 
  Check, 
  Sparkles, 
  ShieldAlert, 
  RefreshCw,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
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
  FolderLock
} from 'lucide-react';

interface SidebarProfileFolderProps {
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
  onOpenFullSettings: () => void;
}

const EMBLEM_PRESETS = [
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
];

export function SidebarProfileFolder({
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
  onOpenFullSettings,
}: SidebarProfileFolderProps) {
  const [tempSheetName, setTempSheetName] = useState(sheetName);
  const [tempSheetTagline, setTempSheetTagline] = useState(sheetTagline);
  const [tempTreasurerName, setTempTreasurerName] = useState(treasurerName);
  const [tempTreasurerEmail, setTempTreasurerEmail] = useState(treasurerEmail);
  const [tempAcademicYear, setTempAcademicYear] = useState(academicYear);
  const [tempLogoIcon, setTempLogoIcon] = useState(logoIcon);
  const [whitelistedEmails, setWhitelistedEmails] = useState<string[]>([]);

  const isSuperAdmin = !!(currentUser && currentUser.email && ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'].includes(currentUser.email.toLowerCase()));

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoSavedFast, setLogoSavedFast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempSheetName(sheetName);
    setTempSheetTagline(sheetTagline);
    setTempTreasurerName(treasurerName);
    setTempTreasurerEmail(treasurerEmail);
    setTempAcademicYear(academicYear);
    setTempLogoIcon(logoIcon);

    const unique: string[] = Array.from(new Set<string>(
      allowedEmails
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
    ));
    const mandatory = ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];
    const other = unique.filter(e => !mandatory.includes(e));
    setWhitelistedEmails([...mandatory, ...other]);
  }, [sheetName, sheetTagline, treasurerName, treasurerEmail, academicYear, logoIcon, allowedEmails]);

  const handleSelectEmblem = (id: string) => {
    setTempLogoIcon(id);
    onQuickUpdateLogo?.(id);
    setLogoSavedFast(true);
    setTimeout(() => setLogoSavedFast(false), 2500);
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setTempLogoIcon(result);
          onQuickUpdateLogo?.(result);
          setLogoSavedFast(true);
          setTimeout(() => setLogoSavedFast(false), 2500);

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditor) {
      setSaveError('Access denied: You do not have active editor permissions.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const cleanedEmails: string[] = Array.from(new Set<string>(
      whitelistedEmails
        .map(email => email.trim().toLowerCase())
        .filter(Boolean)
    ));
    
    const mandatory = ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'];
    const other = cleanedEmails.filter(e => !mandatory.includes(e));
    const finalEmails = [...mandatory, ...other];

    try {
      await onSaveConfig({
        sheetName: tempSheetName,
        sheetTagline: tempSheetTagline,
        treasurerName: tempTreasurerName,
        treasurerEmail: tempTreasurerEmail,
        academicYear: tempAcademicYear,
        allowedEmails: finalEmails,
        logoIcon: tempLogoIcon
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || 'Error updating configuration profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-left">
      {/* Header Badge */}
      <div className="flex items-center justify-between pb-2 border-b border-indigo-100/60">
        <div>
          <h4 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
            <span>Profile & Institutional Identity</span>
          </h4>
        </div>
        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
          SETTINGS
        </span>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-3.5">
        {/* Organization / Sheet Name */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 font-mono">
            Organization / Title
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
              <Building size={13} />
            </div>
            <input
              type="text"
              required
              placeholder="e.g. Mechanical Engineering Union"
              value={tempSheetName}
              onChange={(e) => setTempSheetName(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 border border-gray-250 rounded-lg text-xs font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Subtitle / Tagline */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 font-mono">
            Subtitle / Slogan
          </label>
          <input
            type="text"
            required
            placeholder="Double-entry accounting tracking"
            value={tempSheetTagline}
            onChange={(e) => setTempSheetTagline(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-250 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
          />
        </div>

        {/* Treasurer Name */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 font-mono">
            Treasurer Name / Signature
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
              <User size={13} />
            </div>
            <input
              type="text"
              required
              placeholder="e.g. Yoonus Chr"
              value={tempTreasurerName}
              onChange={(e) => setTempTreasurerName(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 border border-gray-250 rounded-lg text-xs font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Auditable Email */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 font-mono">
            Treasurer Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
              <Mail size={13} />
            </div>
            <input
              type="email"
              required
              placeholder="treasurer@union.edu"
              value={tempTreasurerEmail}
              onChange={(e) => setTempTreasurerEmail(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 border border-gray-250 rounded-lg text-xs font-mono text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Academic Year */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 font-mono">
            Fiscal Academic Year
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
              <Calendar size={13} />
            </div>
            <input
              type="text"
              required
              placeholder="2026 - 2027"
              value={tempAcademicYear}
              onChange={(e) => setTempAcademicYear(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 border border-gray-250 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Visual Identity & Emblem Picker */}
        <div className="pt-2.5 border-t border-gray-150">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-800 tracking-normal cursor-pointer">
              <Sparkles size={16} className="text-indigo-600 shrink-0" />
              <span>Profile Emblem & Icon</span>
            </label>
            {logoSavedFast && (
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Check size={10} /> Saved!
              </span>
            )}
          </div>

          {/* Live Emblem Thumbnail */}
          <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-xs overflow-hidden shrink-0">
              {tempLogoIcon.startsWith('data:image/') ? (
                <img src={tempLogoIcon} alt="Emblem" className="w-full h-full object-cover" />
              ) : tempLogoIcon === 'Shield' ? (
                <Shield size={22} />
              ) : tempLogoIcon === 'BookOpen' ? (
                <BookOpen size={22} />
              ) : tempLogoIcon === 'Users' ? (
                <Users size={22} />
              ) : tempLogoIcon === 'Award' ? (
                <Award size={22} />
              ) : tempLogoIcon === 'Star' ? (
                <Star size={22} />
              ) : tempLogoIcon === 'Heart' ? (
                <Heart size={22} />
              ) : tempLogoIcon === 'Zap' ? (
                <Zap size={22} />
              ) : tempLogoIcon === 'Building2' ? (
                <Building2 size={22} />
              ) : tempLogoIcon === 'Scale' ? (
                <Scale size={22} />
              ) : tempLogoIcon === 'Briefcase' ? (
                <Briefcase size={22} />
              ) : tempLogoIcon === 'GraduationCap' ? (
                <GraduationCap size={22} />
              ) : (
                <FolderLock size={22} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-gray-800 truncate">
                {tempSheetName || 'Class Union Ledger'}
              </div>
            </div>
          </div>

          {/* Emblem grid */}
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {EMBLEM_PRESETS.map((item) => {
              const IconComp = item.icon;
              const isSelected = tempLogoIcon === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectEmblem(item.id)}
                  title={item.label}
                  className={`p-2 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-1 ring-indigo-300' 
                      : 'bg-white text-slate-700 border-slate-250 hover:bg-slate-50'
                  }`}
                >
                  <IconComp size={15} className={isSelected ? 'text-white' : 'text-indigo-600'} />
                </button>
              );
            })}
          </div>

          {/* Upload Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shadow-3xs"
            >
              <Upload size={13} className="text-indigo-600" />
              <span>Upload Custom Photo</span>
            </button>
            {tempLogoIcon.startsWith('data:image/') && (
              <button
                type="button"
                onClick={() => handleSelectEmblem('FolderLock')}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Remove photo"
              >
                <Trash2 size={14} />
              </button>
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

        {/* Role-Based Access Control / Whitelisted Editors */}
        <div className="pt-2.5 border-t border-gray-150">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800 tracking-normal">
              <ShieldAlert size={16} className="text-indigo-600 shrink-0" />
              <span>Whitelisted Editors ({Math.max(0, whitelistedEmails.length - 2)})</span>
            </div>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={handleAddEmailSlot}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
              >
                <Plus size={11} />
                <span>Add Slot</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {whitelistedEmails.map((email, idx) => {
              if (idx === 0 || idx === 1) return null;
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="email"
                    required
                    value={email}
                    disabled={!isSuperAdmin}
                    onChange={(e) => handleUpdateEmailSlot(idx, e.target.value)}
                    placeholder="editor@gmail.com"
                    className="flex-1 px-2 py-1 text-[11px] border border-gray-250 rounded-md font-mono text-gray-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                  />
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEmailSlot(idx)}
                      className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            {whitelistedEmails.length <= 2 && (
              <p className="text-[10px] text-gray-400 italic">No extra editors added. Primary admins are active.</p>
            )}
          </div>
        </div>

        {/* Feedback notices */}
        {saveSuccess && (
          <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex items-center gap-1.5 animate-fade-in">
            <Check size={14} className="text-emerald-600 stroke-[3]" />
            <span>Profile saved and synchronized!</span>
          </div>
        )}
        {saveError && (
          <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg animate-fade-in">
            {saveError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-gray-150 flex flex-col gap-2">
          <button
            type="submit"
            disabled={isSaving || !isEditor}
            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
          >
            {isSaving ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Check size={13} className="stroke-[3]" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenFullSettings}
            className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink size={12} />
            <span>Open Full Settings & Database Tab</span>
          </button>
        </div>
      </form>
    </div>
  );
}
