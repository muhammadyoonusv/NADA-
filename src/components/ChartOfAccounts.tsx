/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Account, AccountType } from '../types';
import { ListCollapse, Plus, HelpCircle, ShieldAlert, Trash2 } from 'lucide-react';

interface ChartOfAccountsProps {
  accounts: Account[];
  isEditor?: boolean;
  onAddAccount: (account: Omit<Account, 'id'>) => void;
  onEditAccount: (id: string, newName: string, newType: AccountType) => void;
  onDeleteAccount: (id: string) => void;
}

export function ChartOfAccounts({ accounts, isEditor = false, onAddAccount, onEditAccount, onDeleteAccount }: ChartOfAccountsProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Expense');
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingType, setEditingType] = useState<AccountType>('Expense');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditor) {
      alert('Access denied: You have read-only authorizations.');
      return;
    }
    if (!name.trim()) return;

    // Direct check for duplicate names
    const duplicate = accounts.some((a) => a.name.toLowerCase() === name.trim().toLowerCase());
    if (duplicate) {
      alert('An account with this name already exists in your union database chart.');
      return;
    }

    onAddAccount({
      name: name.trim(),
      type,
    });

    setName('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Add accounts panel LHS */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm self-start">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <ListCollapse className="text-blue-600" size={18} />
          <h3 className="font-bold text-gray-900 text-sm">Add New Union Account</h3>
        </div>

        {!isEditor && (
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg text-amber-900 text-[11px] text-left leading-normal">
            ⚙️ <strong>Read-Only Access:</strong> Registering custom ledger classes/titles is restricted to whitelisted editors with active login certificates.
          </div>
        )}

        <p className="text-xs text-gray-500">
          Create customized accounts corresponding to your union's activities (e.g., Annual Sports, Seminar Fee Income, Exam Food, Welfare Grant).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Account Name</label>
            <input
              type="text"
              required
              disabled={!isEditor}
              placeholder="e.g. Annual Tour Fees"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Accounting Classification</label>
            <select
              value={type}
              disabled={!isEditor}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <option value="Asset">Asset (Cash, Bank, Equipment, Advances)</option>
              <option value="Liability">Liability (Payables, Unearned Revenue)</option>
              <option value="Equity">Equity / Capital Fund (Union reserves)</option>
              <option value="Income">Income (Fees, Ticket Sales, Donations)</option>
              <option value="Expense">Expense (Refreshments, Stationary, Rent)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!isEditor}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors shadow-2xs cursor-pointer disabled:bg-slate-350 disabled:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            <span>Add Account Class</span>
          </button>
        </form>

        <div className="bg-slate-50 p-3.5 border border-slate-100 rounded-lg text-xs leading-5 text-slate-500 space-y-2">
          <span className="font-bold flex items-center gap-1 text-slate-700">
            <HelpCircle size={14} className="text-slate-400" />
            Accounting Guide:
          </span>
          <p>
            • <span className="font-semibold text-slate-700">Income</span> accounts model fees collections or donations.
          </p>
          <p>
            • <span className="font-semibold text-slate-700">Expense</span> accounts model daily operational payments.
          </p>
          <p>
            • <span className="font-semibold text-slate-700">Assets</span> cover liquid funds (Cash/Bank) or items owned.
          </p>
        </div>
      </div>

      {/* Chart list RHS */}
      <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700 font-mono">Chart of Accounts Mapping ({accounts.length})</h4>
          <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-0.5 rounded-full uppercase">
            Treasurer Approved Chart
          </span>
        </div>

        <div className="divide-y divide-gray-105">
          {accounts.map((acc) => (
            <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="space-y-1 w-full mr-4">
                {editingAccountId === acc.id ? (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const cleanName = editingName.trim();
                      if (!cleanName) return;
                      
                      if (cleanName.toLowerCase() !== acc.name.toLowerCase()) {
                        const duplicate = accounts.some((a) => a.id !== acc.id && a.name.toLowerCase() === cleanName.toLowerCase());
                        if (duplicate) {
                          alert('An account with this name already exists in your union database chart.');
                          return;
                        }
                      }
                      onEditAccount(acc.id, cleanName, editingType);
                      setEditingAccountId(null);
                    }}
                    className="flex flex-col md:flex-row gap-3 items-stretch md:items-end bg-slate-50 border border-indigo-100 rounded-xl p-3 w-full max-w-xl shadow-xs"
                  >
                    <div className="flex-1 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Account Name</label>
                      <input
                        autoFocus
                        type="text"
                        required
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-250 rounded-lg text-xs leading-normal font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="w-full md:w-48 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Classification</label>
                      <select
                        value={editingType}
                        onChange={(e) => setEditingType(e.target.value as AccountType)}
                        className="w-full px-2 py-1.5 bg-white border border-gray-250 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Asset">Asset</option>
                        <option value="Liability">Liability</option>
                        <option value="Equity">Equity</option>
                        <option value="Income">Income</option>
                        <option value="Expense">Expense</option>
                      </select>
                    </div>
                    <div className="flex gap-2 shrink-0 pt-1 md:pt-0">
                      <button 
                        type="submit" 
                        className="px-3.5 py-1.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs"
                      >
                        Save
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setEditingAccountId(null)} 
                        className="px-3.5 py-1.5 text-xs font-extrabold bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300 rounded-lg cursor-pointer transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <span className="font-serif font-bold text-lg text-gray-900">{acc.name}</span>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    acc.type === 'Asset' ? 'bg-emerald-50 text-emerald-700' :
                    acc.type === 'Liability' ? 'bg-amber-50 text-amber-700' :
                    acc.type === 'Equity' ? 'bg-indigo-50 text-indigo-700' :
                    acc.type === 'Income' ? 'bg-sky-50 text-sky-700' :
                    'bg-rose-50 text-rose-700'
                  }`}>
                    {acc.type}
                  </span>
                  {acc.isSystem && (
                    <span className="text-[9px] font-mono font-medium text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                      System Reserved Account
                    </span>
                  )}
                </div>
              </div>

              {isEditor ? (
                 <div className="flex gap-2 shrink-0">
                  {!acc.isSystem && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAccountId(acc.id);
                          setEditingName(acc.name);
                          setEditingType(acc.type);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-white border border-indigo-200 hover:bg-indigo-600 rounded transition-all shadow-3xs cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAccountId(acc.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-white border border-rose-200 hover:bg-rose-600 rounded transition-all shadow-3xs cursor-pointer"
                      >
                        Delete
                      </button>
                    </>
                  )}
                 </div>
                ) : (
                  <span className="text-[10px] text-gray-400 font-mono italic">
                    Immutable
                  </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {deletingAccountId && (() => {
        const accountBeingDeleted = accounts.find(a => a.id === deletingAccountId);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border text-left border-gray-200 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-gray-100 bg-rose-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="text-rose-600 animate-bounce" size={18} />
                  <h3 className="text-sm font-bold text-slate-950">
                    Delete Account Title?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingAccountId(null)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-3">
                <p className="text-xs text-gray-650 leading-relaxed">
                  Do you wish to delete the account label <strong>"{accountBeingDeleted?.name}"</strong>?
                </p>
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 p-2.5 rounded-lg font-medium">
                  ⚠️ Note: If there are recorded physical journal transactions tied to this ledger, you must delete those entries first to maintain balance sheets!
                </p>
              </div>

              <div className="p-4 bg-slate-50 border-t border-gray-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeletingAccountId(null)}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deletingAccountId) {
                      onDeleteAccount(deletingAccountId);
                      setDeletingAccountId(null);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Confirm Delete Label
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
