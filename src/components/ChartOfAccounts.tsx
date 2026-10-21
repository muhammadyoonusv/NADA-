/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Account, AccountType } from '../types';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
  Landmark,
  Wallet,
  TrendingUp,
  Receipt,
  Scale
} from 'lucide-react';

interface ChartOfAccountsProps {
  accounts: Account[];
  isEditor?: boolean;
  onAddAccount: (account: Omit<Account, 'id'>) => void;
  onEditAccount: (id: string, newName: string, newType: AccountType) => void;
  onDeleteAccount: (id: string) => void;
}

const ACCOUNT_TYPE_META: Record<AccountType, {
  label: string;
  normalBalance: 'Debit (Dr)' | 'Credit (Cr)';
  color: string;
  bgLight: string;
  badgeClass: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  Asset: {
    label: 'Asset',
    normalBalance: 'Debit (Dr)',
    color: 'text-emerald-700',
    bgLight: 'bg-emerald-50/70 border-emerald-100',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    description: 'Cash in hand, bank balances, equipment, receivables & advances',
    icon: Wallet
  },
  Liability: {
    label: 'Liability',
    normalBalance: 'Credit (Cr)',
    color: 'text-amber-700',
    bgLight: 'bg-amber-50/70 border-amber-100',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    description: 'Payables to students, vendor bills, advances & money owed',
    icon: Scale
  },
  Equity: {
    label: 'Equity',
    normalBalance: 'Credit (Cr)',
    color: 'text-violet-700',
    bgLight: 'bg-violet-50/70 border-violet-100',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80',
    description: 'Capital reserves, opening balances & accumulated union surplus',
    icon: Landmark
  },
  Income: {
    label: 'Income',
    normalBalance: 'Credit (Cr)',
    color: 'text-sky-700',
    bgLight: 'bg-sky-50/70 border-sky-100',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    description: 'Membership dues, sponsorship grants, ticket revenue & contributions',
    icon: TrendingUp
  },
  Expense: {
    label: 'Expense',
    normalBalance: 'Debit (Dr)',
    color: 'text-rose-700',
    bgLight: 'bg-rose-50/70 border-rose-100',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    description: 'Refreshments, printing, stationery, programs, venue rent & operations',
    icon: Receipt
  }
};

export function ChartOfAccounts({ accounts, isEditor = false, onAddAccount, onEditAccount, onDeleteAccount }: ChartOfAccountsProps) {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | AccountType>('ALL');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'type'>('id');

  // Modal Dialog States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  // Form States (Add)
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('Expense');
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Form States (Edit)
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('Expense');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Filtered & Sorted Accounts
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts
      .filter((acc) => {
        const matchesSearch = !q || acc.name.toLowerCase().includes(q) || acc.id.toLowerCase().includes(q) || acc.type.toLowerCase().includes(q);
        const matchesType = selectedTypeFilter === 'ALL' || acc.type === selectedTypeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'type') return a.type.localeCompare(b.type);
        // Default sort: ID numeric order if numbers, else alphabetical
        const numA = parseInt(a.id, 10);
        const numB = parseInt(b.id, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.id.localeCompare(b.id);
      });
  }, [accounts, searchQuery, selectedTypeFilter, sortBy]);

  // Handler: Add Account Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditor) return;

    const trimmed = newName.trim();
    if (!trimmed) {
      setAddFormError('Please enter a valid account name.');
      return;
    }

    const duplicate = accounts.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setAddFormError(`An account titled "${trimmed}" already exists in the Chart of Accounts.`);
      return;
    }

    onAddAccount({
      name: trimmed,
      type: newType,
    });

    setNewName('');
    setNewType('Expense');
    setAddFormError(null);
    setIsAddModalOpen(false);
  };

  // Handler: Start Editing
  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditFormError(null);
  };

  // Handler: Save Edit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditor || !editingAccount) return;

    const trimmed = editName.trim();
    if (!trimmed) {
      setEditFormError('Account name cannot be empty.');
      return;
    }

    if (trimmed.toLowerCase() !== editingAccount.name.toLowerCase()) {
      const duplicate = accounts.some((a) => a.id !== editingAccount.id && a.name.toLowerCase() === trimmed.toLowerCase());
      if (duplicate) {
        setEditFormError(`An account titled "${trimmed}" already exists.`);
        return;
      }
    }

    onEditAccount(editingAccount.id, trimmed, editType);
    setEditingAccount(null);
    setEditFormError(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-left">

      {/* 2. TOOLBAR: SEARCH, CATEGORY PILL FILTER, SORT & PRIMARY ACTION */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts by name, code or classification..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          
          {/* Classification Filter Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs shrink-0">
            <button
              type="button"
              onClick={() => setSelectedTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                selectedTypeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-3xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({accounts.length})
            </button>
            {(['Asset', 'Liability', 'Income', 'Expense'] as AccountType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTypeFilter(t)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                  selectedTypeFilter === t
                    ? 'bg-white text-slate-900 shadow-3xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-3xs"
            >
              <option value="id">Sort by Code (#)</option>
              <option value="name">Sort by Name (A-Z)</option>
              <option value="type">Sort by Type</option>
            </select>
            <SlidersHorizontal size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Add Account Trigger */}
          {isEditor ? (
            <button
              type="button"
              onClick={() => {
                setAddFormError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>Add Account</span>
            </button>
          ) : (
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2.5 py-2 rounded-xl border border-slate-200 shrink-0">
              Read-Only
            </span>
          )}
        </div>
      </div>

      {/* 3. MASTER LEDGER MAPPING TABLE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-3xs overflow-hidden">
        
        {/* Table Header */}
        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-mono">
              Chart of Accounts Registry
            </h3>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredAccounts.length} of {accounts.length} accounts
            </span>
          </div>
          
          {isEditor && (
            <button
              type="button"
              onClick={() => {
                setAddFormError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Account</span>
            </button>
          )}
        </div>

        {/* Table Content */}
        {filteredAccounts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center border border-slate-100">
              <Search size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">No matching accounts found</p>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `No account titles match "${searchQuery}". Try clearing search or category filter.`
                  : 'No accounts have been registered under this classification.'}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTypeFilter('ALL');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/40">
                  <th className="py-2.5 px-4 w-20 text-center">#</th>
                  <th className="py-2.5 px-4">Account Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAccounts.map((acc, index) => {
                  const meta = ACCOUNT_TYPE_META[acc.type as AccountType] || ACCOUNT_TYPE_META.Expense;

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors group">
                      
                      {/* Row Number */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-slate-600 text-xs bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/60">
                          {index + 1}
                        </span>
                      </td>

                      {/* Account Title */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm tracking-tight">
                              {acc.name}
                            </span>
                            {acc.isSystem && (
                              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                                Core
                              </span>
                            )}
                          </div>

                          {isEditor && !acc.isSystem && (
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => openEditModal(acc)}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edit account label or type"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingAccount(acc)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete account"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Accounting Footer Advice Bar */}
        <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-indigo-600 shrink-0" />
            <span>
              <strong>Accounting Rule:</strong> Assets and Expenses increase on <strong>Debit (Dr)</strong>. Liabilities, Equity, and Incomes increase on <strong>Credit (Cr)</strong>.
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[10px]">
            Formula: Assets = Liabilities + Equity
          </span>
        </div>
      </div>

      {/* 4. MODAL: ADD ACCOUNT DIALOG */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-3xs">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Add Ledger Account</h3>
                  <p className="text-xs text-slate-500">Register a new double-entry account title</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-3xs"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              
              {addFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{addFormError}</span>
                </div>
              )}

              {/* Account Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Account Name / Ledger Label *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Annual Sports Day, Printing & Banners, Seminar Grants"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (addFormError) setAddFormError(null);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Accounting Classification */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Classification Category *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as AccountType)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer bg-white"
                >
                  <option value="Expense">Expense — Disbursals for tea, printing, event rent, food</option>
                  <option value="Income">Income — Fees collections, ticket sales, sponsorships, donations</option>
                  <option value="Asset">Asset — Liquid cash, bank balance, sports kits, permanent equipment</option>
                  <option value="Liability">Liability — Union payables, loans borrowed, advance obligations</option>
                  <option value="Equity">Equity — Capital reserves, accumulated union surplus fund</option>
                </select>
              </div>

              {/* Accounting Guidance Preview */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1 text-slate-600">
                <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                  <span>Accounting Impact:</span>
                  <span className="font-mono text-indigo-700">
                    Normal Balance: {ACCOUNT_TYPE_META[newType].normalBalance}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {ACCOUNT_TYPE_META[newType].description}.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer disabled:opacity-50"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: EDIT ACCOUNT DIALOG */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-3xs">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Account Title</h3>
                  <p className="text-xs text-slate-500">Updating #{editingAccount.id} · {editingAccount.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-3xs"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              
              {editFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{editFormError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editFormError) setEditFormError(null);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Accounting Classification *
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as AccountType)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer bg-white"
                >
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Equity">Equity</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: DELETE ACCOUNT CONFIRMATION */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left">
            
            <div className="p-5 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-3xs">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Delete Account?</h3>
                  <p className="text-xs text-rose-700/80">Permanent ledger modification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-3xs"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs leading-relaxed text-slate-600">
              <p>
                Are you sure you want to delete the account label <strong>"{deletingAccount.name}"</strong> (#{deletingAccount.id})?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                ⚠️ <strong>Ledger Integrity Warning:</strong> If any journal transactions are actively posted to this account, deleting it will break double-entry balance sheets! Reassign or remove those transactions first.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAccount(deletingAccount.id);
                  setDeletingAccount(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-3xs cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
