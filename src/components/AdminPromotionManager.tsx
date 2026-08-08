import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Plus, Trash2, CheckCircle2, Award, X, UserCheck } from 'lucide-react';

interface AdminPromotionManagerProps {
  users: any[];
  onUserUpdated: (updatedUser: any) => void;
}

const REFEREE_LEVELS = ["NIL", "TR", "SR", "NR", "IRS", "IR3", "IR2", "IR1", "IR"];

export default function AdminPromotionManager({ users, onUserUpdated }: AdminPromotionManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Editor state for selected user
  const [kyorugiLevel, setKyorugiLevel] = useState('TR');
  const [poomsaeLevel, setPoomsaeLevel] = useState('TR');
  const [promotionHistory, setPromotionHistory] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Filter users by search
  const refereeUsers = users.filter((u) => u.role !== 'admin');
  const filteredUsers = refereeUsers.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (u.fullName || '').toLowerCase();
    const ic = (u.icNumber || '').toLowerCase();
    const tm = (u.tmMembershipId || '').toLowerCase();
    return name.includes(q) || ic.includes(q) || tm.includes(q);
  });

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setKyorugiLevel(user.kyorugiRefereeLevel || 'TR');
    setPoomsaeLevel(user.poomsaeRefereeLevel || 'TR');
    const promos = user.promotionHistory || [];
    setPromotionHistory(promos.map((p: any) => ({ ...p })));

    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleAddPromotionRecord = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setPromotionHistory([
      ...promotionHistory,
      {
        id: Date.now().toString(),
        date: todayStr,
        category: 'Kyorugi',
        levelAchieved: 'SR',
        remarks: 'Promoted after passing national seminar',
      },
    ]);
  };

  const handleRemovePromotionRecord = (index: number) => {
    setPromotionHistory(promotionHistory.filter((_, i) => i !== index));
  };

  const handlePromotionRecordChange = (index: number, field: string, value: string) => {
    const updated = [...promotionHistory];
    updated[index] = { ...updated[index], [field]: value };
    setPromotionHistory(updated);
  };

  const handleSavePromotions = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const updatePayload = {
        kyorugiRefereeLevel: kyorugiLevel,
        poomsaeRefereeLevel: poomsaeLevel,
        promotionHistory: promotionHistory,
      };

      await updateDoc(doc(db, 'users', selectedUser.id), updatePayload);

      const updatedUserObj = {
        ...selectedUser,
        ...updatePayload,
      };

      setSelectedUser(updatedUserObj);
      onUserUpdated(updatedUserObj);
      setSuccessMessage(`Promotion & level records updated successfully for ${selectedUser.fullName}!`);
    } catch (err: any) {
      console.error("Error updating promotion history:", err);
      setErrorMessage("Failed to update promotions: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Bar with Quick Search User Selector */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-bold text-primary uppercase tracking-tight flex items-center gap-2">
              <Award size={20} className="text-primary" />
              Promotion & Level Quick Manager
            </h2>
            <p className="text-xs text-muted">
              Select or search a referee by Name, IC Number, or TM Membership ID to manage referee levels and promotion history directly.
            </p>
          </div>
        </div>

        {/* Quick Search Selector */}
        <div className="relative">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search referee by Name, IC Number (e.g. 790124...), or TM No (e.g. TM0001212)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown List */}
          {searchQuery.trim() !== '' && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-30 max-h-60 overflow-y-auto p-1">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      handleSelectUser(u);
                      setSearchQuery('');
                    }}
                    className="w-full text-left p-2.5 hover:bg-primary/5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-sm text-primary">{u.fullName || 'Unnamed'}</div>
                      <div className="text-xs text-muted flex items-center gap-3">
                        <span>TM ID: <strong className="text-foreground">{u.tmMembershipId || 'N/A'}</strong></span>
                        <span>IC: <strong className="text-foreground">{u.icNumber || 'N/A'}</strong></span>
                        <span>Kyorugi: <strong className="text-foreground">{u.kyorugiRefereeLevel || 'TR'}</strong></span>
                      </div>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-bold shrink-0">
                      Select
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-muted">No referees found matching "{searchQuery}"</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected User Direct Update Panel Card */}
      {selectedUser ? (
        <div className="bg-white border-2 border-primary/30 rounded-xl p-6 shadow-md flex flex-col gap-5 relative">
          <button
            type="button"
            onClick={() => setSelectedUser(null)}
            className="absolute right-4 top-4 text-muted hover:text-primary p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            title="Close Editor"
          >
            <X size={20} />
          </button>

          {/* User Header Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary/5 p-4 rounded-lg border border-primary/15">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">
                {selectedUser.fullName ? selectedUser.fullName.charAt(0) : 'U'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-primary m-0">{selectedUser.fullName}</h3>
                <div className="text-xs text-muted flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
                  <span>TM ID: <strong className="text-foreground">{selectedUser.tmMembershipId || 'N/A'}</strong></span>
                  <span>IC No: <strong className="text-foreground">{selectedUser.icNumber || 'N/A'}</strong></span>
                  <span>Serial: <strong className="text-foreground">{selectedUser.refereeSerialNumber || '0001'}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-xs bg-white px-3 py-2 rounded-md border border-border flex items-center gap-3">
              <Award size={18} className="text-primary" />
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Current Active Levels</span>
                <span className="font-bold text-primary">
                  Kyorugi: {kyorugiLevel} | Poomsae: {poomsaeLevel}
                </span>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Referee Level Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-border">
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
                Kyorugi Referee Level
              </label>
              <select
                value={kyorugiLevel}
                onChange={(e) => setKyorugiLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary font-bold text-sm bg-white"
              >
                {REFEREE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
                Poomsae Referee Level
              </label>
              <select
                value={poomsaeLevel}
                onChange={(e) => setPoomsaeLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary font-bold text-sm bg-white"
              >
                {REFEREE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Promotion History Table */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold text-muted uppercase">Promotion & Seminar Qualification History</span>
              <button
                type="button"
                onClick={handleAddPromotionRecord}
                className="bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Promotion Record
              </button>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-border text-muted uppercase font-bold">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Level Achieved</th>
                    <th className="p-2.5">Remarks / Details</th>
                    <th className="p-2.5 w-16 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {promotionHistory.map((item, index) => (
                    <tr key={item.id || index} className="border-b border-border last:border-none">
                      <td className="p-2">
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => handlePromotionRecordChange(index, 'date', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-border focus:outline-none focus:border-primary font-medium"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.category || 'Kyorugi'}
                          onChange={(e) => handlePromotionRecordChange(index, 'category', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-border focus:outline-none focus:border-primary font-medium bg-white"
                        >
                          <option value="Kyorugi">Kyorugi</option>
                          <option value="Poomsae">Poomsae</option>
                          <option value="Seminar">Seminar</option>
                          <option value="Special">Special</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.levelAchieved}
                          onChange={(e) => handlePromotionRecordChange(index, 'levelAchieved', e.target.value)}
                          placeholder="e.g. SR / NR / IR1"
                          className="w-full px-2 py-1 rounded border border-border focus:outline-none focus:border-primary font-semibold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => handlePromotionRecordChange(index, 'remarks', e.target.value)}
                          placeholder="Remarks / Course details"
                          className="w-full px-2 py-1 rounded border border-border focus:outline-none focus:border-primary font-medium"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemovePromotionRecord(index)}
                          className="text-red-500 hover:text-red-700 p-1 font-bold cursor-pointer"
                          title="Remove Entry"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {promotionHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted">
                        No promotion history recorded yet. Click "+ Add Promotion Record" to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save Action Bar */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="px-4 py-2 rounded-lg text-xs font-bold text-muted hover:text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSavePromotions}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold text-xs shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <UserCheck size={16} />
              {isSaving ? 'Saving...' : 'Save Promotion Record'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Directory Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            All Referees Promotion & Level Directory ({filteredUsers.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-border text-xs font-bold text-muted uppercase tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">TM ID / Referee ID</th>
                <th className="p-4">IC Number</th>
                <th className="p-4">Kyorugi Level</th>
                <th className="p-4">Poomsae Level</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-border hover:bg-gray-50/80 transition-colors">
                  <td className="p-4 font-bold text-sm text-primary">{user.fullName || 'N/A'}</td>
                  <td className="p-4 text-xs font-mono font-bold text-foreground">{user.tmMembershipId || 'N/A'}</td>
                  <td className="p-4 text-xs text-muted font-mono">{user.icNumber || 'N/A'}</td>
                  <td className="p-4 text-xs font-bold">
                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                      {user.kyorugiRefereeLevel || 'TR'}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-bold">
                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                      {user.poomsaeRefereeLevel || 'TR'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="bg-primary text-white hover:bg-primary/90 text-xs font-bold px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      Update Promotion
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted text-sm">
                    No referees match your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
