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
  RefreshCw,
  Upload,
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
  ChevronDown,
  Camera,
  Trash2
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

  const isSuperAdmin = !!(currentUser && currentUser.email && ['klrmuhsin809@gmail.com', 'yoonuschr@gmail.com'].includes(currentUser.email.toLowerCase()));

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoSavedFast, setLogoSavedFast] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempSheetName(sheetName);
    setTempSheetTagline(sheetTagline);
    setTempTreasurerName(treasurerName);
    setTempTreasurerEmail(treasurerEmail);
    setTempAcademicYear(academicYear);
    setTempLogoIcon(logoIcon);
  }, [sheetName, sheetTagline, treasurerName, treasurerEmail, academicYear, logoIcon]);

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditor) {
      setSaveError('Access denied: You do not have active editor permissions.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSaveConfig({
        sheetName: tempSheetName,
        sheetTagline: tempSheetTagline,
        treasurerName: tempTreasurerName,
        treasurerEmail: tempTreasurerEmail,
        academicYear: tempAcademicYear,
        allowedEmails: allowedEmails,
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
        {/* Profile Photo / Emblem Button (Placed above Organization / Title) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider font-mono">
              Profile Photo & Emblem
            </label>
            {logoSavedFast && (
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Check size={10} /> Saved!
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowPhotoOptions(!showPhotoOptions)}
            className="w-full flex items-center gap-3 p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer group text-left shadow-3xs"
            title="Click to edit profile photo & emblem"
          >
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-xs overflow-hidden shrink-0 group-hover:scale-102 transition-transform">
              {tempLogoIcon.startsWith('data:image/') ? (
                <img src={tempLogoIcon} alt="Emblem" className="w-full h-full object-cover" />
              ) : tempLogoIcon === 'Shield' ? (
                <Shield size={20} />
              ) : tempLogoIcon === 'BookOpen' ? (
                <BookOpen size={20} />
              ) : tempLogoIcon === 'Users' ? (
                <Users size={20} />
              ) : tempLogoIcon === 'Award' ? (
                <Award size={20} />
              ) : tempLogoIcon === 'Star' ? (
                <Star size={20} />
              ) : tempLogoIcon === 'Heart' ? (
                <Heart size={20} />
              ) : tempLogoIcon === 'Zap' ? (
                <Zap size={20} />
              ) : tempLogoIcon === 'Building2' ? (
                <Building2 size={20} />
              ) : tempLogoIcon === 'Scale' ? (
                <Scale size={20} />
              ) : tempLogoIcon === 'Briefcase' ? (
                <Briefcase size={20} />
              ) : tempLogoIcon === 'GraduationCap' ? (
                <GraduationCap size={20} />
              ) : (
                <FolderLock size={20} />
              )}
              {/* Hover camera badge */}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera size={14} />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-gray-800 group-hover:text-indigo-600 transition-colors truncate">
                {tempSheetName || 'Class Union Ledger'}
              </div>
            </div>

            <div className="p-1 rounded-md bg-white border border-slate-200 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors shrink-0">
              <ChevronDown size={14} className={`transition-transform duration-200 ${showPhotoOptions ? 'rotate-180 text-indigo-600' : ''}`} />
            </div>
          </button>

          {/* Collapsible Photo Editing Options */}
          {showPhotoOptions && (
            <div className="p-3 bg-slate-50/90 border border-indigo-100 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span>Select Icon Emblem</span>
                <span className="text-[10px] text-gray-400 font-normal">Saves instantly</span>
              </div>

              {/* Emblem grid */}
              <div className="grid grid-cols-6 gap-1.5">
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

              {/* Upload Custom Photo Button */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
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
          )}
        </div>

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
        </div>
      </form>
    </div>
  );
}
