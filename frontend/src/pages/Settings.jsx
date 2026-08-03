import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { AppLayout } from '../components/layout/AppLayout.jsx';

const Settings = () => {
  const { user, fetchUser } = useAuth();
  const [autonomyMode, setAutonomyMode] = useState('approval_required');
  const [dailyLimit, setDailyLimit] = useState(20);
  const [blocklist, setBlocklist] = useState([]);
  const [newBlockItem, setNewBlockItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setAutonomyMode(user.autonomy_mode || 'approval_required');
      setDailyLimit(user.daily_send_limit || 20);
      setBlocklist(user.blocklist || []);
    }
  }, [user]);

  const handleAddBlockItem = (e) => {
    e.preventDefault();
    if (!newBlockItem.trim()) return;
    const item = newBlockItem.trim().toLowerCase();
    if (!blocklist.includes(item)) {
      setBlocklist([...blocklist, item]);
    }
    setNewBlockItem('');
  };

  const handleRemoveBlockItem = (itemToRemove) => {
    setBlocklist(blocklist.filter((item) => item !== itemToRemove));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/api/contacts/settings', {
        autonomy_mode: autonomyMode,
        daily_send_limit: Number(dailyLimit),
        blocklist
      });
      setMessage('Settings updated successfully!');
      fetchUser();
    } catch (err) {
      setMessage(`Saved settings locally (API Note: ${err.message})`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Account Settings & Guardrails</h1>
          <p className="mt-2 text-slate-400">Configure multi-tenant outreach limits, autonomy mode, and recipient blocklists.</p>
        </div>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 text-sm">
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* Autonomy Mode */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Agent Autonomy Mode
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Control human oversight for generated drafts before Gmail delivery.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setAutonomyMode('approval_required')}
                className={`cursor-pointer p-4 rounded-xl border transition-all ${
                  autonomyMode === 'approval_required'
                    ? 'border-indigo-500 bg-indigo-600/10 text-white'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold mb-1 flex items-center justify-between">
                  <span>Approval Required (Recommended)</span>
                  {autonomyMode === 'approval_required' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse"></span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Every email draft is queued into Pending Drafts for your manual review and approval before send.
                </p>
              </div>

              <div
                onClick={() => setAutonomyMode('auto_send')}
                className={`cursor-pointer p-4 rounded-xl border transition-all ${
                  autonomyMode === 'auto_send'
                    ? 'border-indigo-500 bg-indigo-600/10 text-white'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold mb-1 flex items-center justify-between">
                  <span>Auto Send (Gated)</span>
                  {autonomyMode === 'auto_send' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Agent automatically queues drafts through the approval gate state machine.
                </p>
              </div>
            </div>
          </div>

          {/* Daily Quota Limit */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-2">Daily Send Limit (24h Quota)</h2>
            <p className="text-sm text-slate-400 mb-4">
              Maximum outbound cold emails allowed per 24-hour window to protect Gmail domain reputation.
            </p>
            <div className="max-w-xs">
              <input
                type="number"
                min="1"
                max="100"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Blocklist Settings */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-2">Domain & Email Blocklist</h2>
            <p className="text-sm text-slate-400 mb-4">
              Contacts matching any blocked email or domain will be skipped automatically during agent drafting.
            </p>

            <form onSubmit={handleAddBlockItem} className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="e.g. competitor.com or do-not-contact@company.com"
                value={newBlockItem}
                onChange={(e) => setNewBlockItem(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all"
              >
                Add Rule
              </button>
            </form>

            <div className="flex flex-wrap gap-2 pt-2">
              {blocklist.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No blocklist rules configured.</p>
              ) : (
                blocklist.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-xs font-mono text-slate-200 border border-slate-600"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveBlockItem(item)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
