import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Plus, Trash2, Save, X, UserCheck, Briefcase, Trophy, Filter } from 'lucide-react';

interface AdminExperienceManagerProps {
  users: any[];
  onUserUpdated: (updatedUser: any) => void;
}

interface ExperienceItem {
  id: string;
  year: string;
  eventName: string;
  level?: string;
  location: string;
  role: string;
}

export default function AdminExperienceManager({ users, onUserUpdated }: AdminExperienceManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Experience state for selected user
  const [kyorugiExp, setKyorugiExp] = useState<ExperienceItem[]>([]);
  const [poomsaeExp, setPoomsaeExp] = useState<ExperienceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Active view inside experience manager: 'by-user' or 'all-records'
  const [viewMode, setViewMode] = useState<'by-user' | 'all-records'>('by-user');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

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
    const kExp = (user.experienceHistory || []).map((item: any) => ({
      id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 4),
      year: item.year || '',
      eventName: item.eventName || '',
      level: item.level || 'District',
      location: item.location || '',
      role: item.role || '',
    }));
    const pExp = (user.poomsaeExperienceHistory || []).map((item: any) => ({
      id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 4),
      year: item.year || '',
      eventName: item.eventName || '',
      level: item.level || 'District',
      location: item.location || '',
      role: item.role || '',
    }));

    setKyorugiExp(kExp);
    setPoomsaeExp(pExp);
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Add Kyorugi Exp
  const handleAddKyorugiExp = () => {
    const newEntry: ExperienceItem = {
      id: 'k_' + Date.now().toString(),
      year: new Date().getFullYear().toString(),
      eventName: '',
      level: 'District',
      location: '',
      role: 'Referee',
    };
    setKyorugiExp([...kyorugiExp, newEntry]);
  };

  // Delete Kyorugi Exp
  const handleDeleteKyorugiExp = (id: string) => {
    setKyorugiExp(kyorugiExp.filter((item) => item.id !== id));
  };

  // Field change for Kyorugi Exp
  const handleKyorugiChange = (index: number, field: keyof ExperienceItem, value: string) => {
    const updated = [...kyorugiExp];
    updated[index] = { ...updated[index], [field]: value };
    setKyorugiExp(updated);
  };

  // Add Poomsae Exp
  const handleAddPoomsaeExp = () => {
    const newEntry: ExperienceItem = {
      id: 'p_' + Date.now().toString(),
      year: new Date().getFullYear().toString(),
      eventName: '',
      level: 'District',
      location: '',
      role: 'Referee',
    };
    setPoomsaeExp([...poomsaeExp, newEntry]);
  };

  // Delete Poomsae Exp
  const handleDeletePoomsaeExp = (id: string) => {
    setPoomsaeExp(poomsaeExp.filter((item) => item.id !== id));
  };

  // Field change for Poomsae Exp
  const handlePoomsaeChange = (index: number, field: keyof ExperienceItem, value: string) => {
    const updated = [...poomsaeExp];
    updated[index] = { ...updated[index], [field]: value };
    setPoomsaeExp(updated);
  };

  // Save changes to Firestore
  const handleSaveExperiences = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const updatePayload = {
        experienceHistory: kyorugiExp,
        poomsaeExperienceHistory: poomsaeExp,
      };

      await updateDoc(doc(db, 'users', selectedUser.id), updatePayload);

      const updatedUserObj = {
        ...selectedUser,
        ...updatePayload,
      };

      setSelectedUser(updatedUserObj);
      onUserUpdated(updatedUserObj);
      setSuccessMessage(`Experience records successfully updated for ${selectedUser.fullName}!`);
    } catch (err: any) {
      console.error('Error saving experience history:', err);
      setErrorMessage('Failed to save experience records: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick delete from All Records view
  const handleDeleteRecordFromAll = async (user: any, expId: string, type: 'kyorugi' | 'poomsae') => {
    if (!window.confirm(`Are you sure you want to delete this experience record for ${user.fullName}?`)) return;

    try {
      let updatedUserObj;
      if (type === 'kyorugi') {
        const newHistory = (user.experienceHistory || []).filter((item: any) => item.id !== expId);
        await updateDoc(doc(db, 'users', user.id), { experienceHistory: newHistory });
        updatedUserObj = { ...user, experienceHistory: newHistory };
      } else {
        const newHistory = (user.poomsaeExperienceHistory || []).filter((item: any) => item.id !== expId);
        await updateDoc(doc(db, 'users', user.id), { poomsaeExperienceHistory: newHistory });
        updatedUserObj = { ...user, poomsaeExperienceHistory: newHistory };
      }

      if (selectedUser && selectedUser.id === user.id) {
        handleSelectUser(updatedUserObj);
      }
      onUserUpdated(updatedUserObj);
    } catch (err: any) {
      alert('Failed to delete record: ' + err.message);
    }
  };

  // Collect all records for master table
  const allExperienceRecords: Array<{
    user: any;
    exp: ExperienceItem;
    type: 'Kyorugi' | 'Poomsae';
  }> = [];

  refereeUsers.forEach((u) => {
    (u.experienceHistory || []).forEach((item: any) => {
      allExperienceRecords.push({ user: u, exp: item, type: 'Kyorugi' });
    });
    (u.poomsaeExperienceHistory || []).forEach((item: any) => {
      allExperienceRecords.push({ user: u, exp: item, type: 'Poomsae' });
    });
  });

  const filteredAllRecords = allExperienceRecords.filter((rec) => {
    if (filterType !== 'ALL' && rec.type !== filterType) return false;
    if (filterLevel !== 'ALL' && (rec.exp.level || 'District') !== filterLevel) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const userName = (rec.user.fullName || '').toLowerCase();
    const eventName = (rec.exp.eventName || '').toLowerCase();
    const location = (rec.exp.location || '').toLowerCase();
    const role = (rec.exp.role || '').toLowerCase();
    const year = (rec.exp.year || '').toLowerCase();
    return (
      userName.includes(q) ||
      eventName.includes(q) ||
      location.includes(q) ||
      role.includes(q) ||
      year.includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      {/* View Switcher Header */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-primary uppercase tracking-tight flex items-center gap-2">
            <Briefcase size={20} className="text-primary" />
            Referee Experience Management
          </h2>
          <p className="text-xs text-muted">
            Add or delete Kyorugi & Poomsae tournament experience records directly for any referee.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('by-user')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === 'by-user' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            Manage by Referee
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all-records')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === 'all-records' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            All Experience Records ({allExperienceRecords.length})
          </button>
        </div>
      </div>

      {viewMode === 'by-user' ? (
        <>
          {/* Search / Select Referee Bar */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col gap-3">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">
              1. Select or Search Referee
            </label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search referee by Name, IC Number, or TM ID..."
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

              {/* Autocomplete List */}
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
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center justify-between transition-colors border-b border-gray-100 last:border-none"
                      >
                        <div>
                          <div className="font-semibold text-sm text-primary">{u.fullName || 'N/A'}</div>
                          <div className="text-xs text-muted">
                            TM: <span className="font-mono font-bold">{u.tmMembershipId || 'N/A'}</span> | IC: {u.icNumber || 'N/A'}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          Select
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted">No referees match your search.</div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Chips of Referees if none selected */}
            {!selectedUser && (
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs text-muted py-1">Quick Select:</span>
                {refereeUsers.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-primary/10 hover:text-primary border border-border rounded-md text-xs font-medium transition-colors"
                  >
                    {u.fullName || u.tmMembershipId}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Editor for Selected User */}
          {selectedUser ? (
            <div className="flex flex-col gap-6">
              {/* Selected User Details Banner */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shrink-0">
                    {selectedUser.fullName ? selectedUser.fullName.charAt(0).toUpperCase() : 'R'}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-primary leading-tight">
                      {selectedUser.fullName || 'Referee Profile'}
                    </h3>
                    <p className="text-xs text-muted">
                      TM ID: <span className="font-mono font-bold text-primary">{selectedUser.tmMembershipId || 'N/A'}</span> | IC: {selectedUser.icNumber || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveExperiences}
                    disabled={isSaving}
                    className="bg-success text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Save size={16} />
                    {isSaving ? 'Saving...' : 'Save Experience Records'}
                  </button>
                </div>
              </div>

              {/* Status Messages */}
              {successMessage && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3.5 rounded-xl text-sm font-semibold flex items-center justify-between">
                  <span>{successMessage}</span>
                  <button onClick={() => setSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900">
                    <X size={16} />
                  </button>
                </div>
              )}
              {errorMessage && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-3.5 rounded-xl text-sm font-semibold flex items-center justify-between">
                  <span>{errorMessage}</span>
                  <button onClick={() => setErrorMessage('')} className="text-red-600 hover:text-red-800">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Kyorugi Experience Section */}
              <div className="bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className="text-red-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                      Kyorugi Experience History ({kyorugiExp.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddKyorugiExp}
                    className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Kyorugi Experience
                  </button>
                </div>

                {kyorugiExp.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-border">
                          <th className="p-2.5 text-xs font-bold text-muted uppercase w-20">Year</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase">Event Name</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase w-40">Level</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase">Location</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase w-32">Role</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase w-16 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kyorugiExp.map((item, idx) => (
                          <tr key={item.id || idx} className="border-b border-border hover:bg-gray-50/50">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.year}
                                onChange={(e) => handleKyorugiChange(idx, 'year', e.target.value)}
                                placeholder="YYYY"
                                className="w-full border border-border rounded px-2 py-1 text-xs font-bold focus:outline-none focus:border-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.eventName}
                                onChange={(e) => handleKyorugiChange(idx, 'eventName', e.target.value)}
                                placeholder="e.g. National Open Championship"
                                className="w-full border border-border rounded px-2 py-1 text-xs font-medium focus:outline-none focus:border-primary"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.level || 'District'}
                                onChange={(e) => handleKyorugiChange(idx, 'level', e.target.value)}
                                className="w-full border border-border rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-primary bg-white"
                              >
                                <option value="District">District</option>
                                <option value="State">State</option>
                                <option value="National Level">National Level</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.location}
                                onChange={(e) => handleKyorugiChange(idx, 'location', e.target.value)}
                                placeholder="e.g. Kuala Lumpur"
                                className="w-full border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.role}
                                onChange={(e) => handleKyorugiChange(idx, 'role', e.target.value)}
                                placeholder="e.g. Corner Judge"
                                className="w-full border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteKyorugiExp(item.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete Experience Record"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted border border-dashed border-border rounded-lg">
                    No Kyorugi experience records listed for this referee. Click "+ Add Kyorugi Experience" above to add one.
                  </div>
                )}
              </div>

              {/* Poomsae Experience Section */}
              <div className="bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className="text-blue-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                      Poomsae Experience History ({poomsaeExp.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPoomsaeExp}
                    className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Poomsae Experience
                  </button>
                </div>

                {poomsaeExp.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-border">
                          <th className="p-2.5 text-xs font-bold text-muted uppercase w-20">Year</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase">Event Name</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase w-40">Level</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase">Location</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase w-32">Role</th>
                          <th className="p-2.5 text-xs font-bold text-muted uppercase w-16 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poomsaeExp.map((item, idx) => (
                          <tr key={item.id || idx} className="border-b border-border hover:bg-gray-50/50">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.year}
                                onChange={(e) => handlePoomsaeChange(idx, 'year', e.target.value)}
                                placeholder="YYYY"
                                className="w-full border border-border rounded px-2 py-1 text-xs font-bold focus:outline-none focus:border-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.eventName}
                                onChange={(e) => handlePoomsaeChange(idx, 'eventName', e.target.value)}
                                placeholder="e.g. State Poomsae Tournament"
                                className="w-full border border-border rounded px-2 py-1 text-xs font-medium focus:outline-none focus:border-primary"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.level || 'District'}
                                onChange={(e) => handlePoomsaeChange(idx, 'level', e.target.value)}
                                className="w-full border border-border rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-primary bg-white"
                              >
                                <option value="District">District</option>
                                <option value="State">State</option>
                                <option value="National Level">National Level</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.location}
                                onChange={(e) => handlePoomsaeChange(idx, 'location', e.target.value)}
                                placeholder="e.g. Penang"
                                className="w-full border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.role}
                                onChange={(e) => handlePoomsaeChange(idx, 'role', e.target.value)}
                                placeholder="e.g. Poomsae Judge"
                                className="w-full border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeletePoomsaeExp(item.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete Experience Record"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted border border-dashed border-border rounded-lg">
                    No Poomsae experience records listed for this referee. Click "+ Add Poomsae Experience" above to add one.
                  </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveExperiences}
                  disabled={isSaving}
                  className="bg-success text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition-colors flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Save size={18} />
                  {isSaving ? 'Saving Changes...' : 'Save All Experience Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
              <Briefcase size={40} className="text-muted/50" />
              <h3 className="font-bold text-base text-primary">No Referee Selected</h3>
              <p className="text-xs text-muted max-w-sm">
                Search or click a referee above to view, add, or delete their Kyorugi and Poomsae tournament experience records.
              </p>
            </div>
          )}
        </>
      ) : (
        /* ALL RECORDS MASTER TABLE VIEW */
        <div className="bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                All Experience Records ({filteredAllRecords.length})
              </h3>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search event, referee name, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold focus:outline-none focus:border-primary bg-white"
              >
                <option value="ALL">All Discipline Types</option>
                <option value="Kyorugi">Kyorugi Only</option>
                <option value="Poomsae">Poomsae Only</option>
              </select>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold focus:outline-none focus:border-primary bg-white"
              >
                <option value="ALL">All Levels</option>
                <option value="District">District</option>
                <option value="State">State</option>
                <option value="National Level">National Level</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-border">
                  <th className="p-3 text-xs font-bold text-muted uppercase">Referee Name</th>
                  <th className="p-3 text-xs font-bold text-muted uppercase">Type</th>
                  <th className="p-3 text-xs font-bold text-muted uppercase">Year</th>
                  <th className="p-3 text-xs font-bold text-muted uppercase">Event Name</th>
                  <th className="p-3 text-xs font-bold text-muted uppercase">Level</th>
                  <th className="p-3 text-xs font-bold text-muted uppercase">Location</th>
                  <th className="p-3 text-xs font-bold text-muted uppercase">Role</th>
                  <th className="p-3 text-xs font-bold text-muted uppercase text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllRecords.map((item, idx) => (
                  <tr key={item.exp.id || idx} className="border-b border-border hover:bg-gray-50/50">
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectUser(item.user);
                          setViewMode('by-user');
                        }}
                        className="font-bold text-xs text-primary hover:underline text-left"
                      >
                        {item.user.fullName || 'N/A'}
                      </button>
                      <div className="text-[10px] text-muted font-mono">{item.user.tmMembershipId || 'N/A'}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.type === 'Kyorugi' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-bold">{item.exp.year || '-'}</td>
                    <td className="p-3 text-xs font-semibold">{item.exp.eventName || '-'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-800 border border-gray-200 rounded">
                        {item.exp.level || 'District'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted">{item.exp.location || '-'}</td>
                    <td className="p-3 text-xs">{item.exp.role || '-'}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRecordFromAll(item.user, item.exp.id, item.type.toLowerCase() as any)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAllRecords.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-muted">
                      No experience records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
