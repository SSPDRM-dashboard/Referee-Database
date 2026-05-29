import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth, secondaryAuth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, LogOut, X, Trash2, Plus } from 'lucide-react';
import { signOut, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('referees');
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newIC, setNewIC] = useState('');
  const [newTMId, setNewTMId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newKyorugiLevel, setNewKyorugiLevel] = useState('TR');
  const [newPoomsaeLevel, setNewPoomsaeLevel] = useState('TR');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Quick Add Experience State
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [expType, setExpType] = useState('kyorugi'); // 'kyorugi' or 'poomsae'
  const [expYear, setExpYear] = useState('');
  const [expEvent, setExpEvent] = useState('');
  const [expLocation, setExpLocation] = useState('');
  const [expRole, setExpRole] = useState('');
  const [isExpSaving, setIsExpSaving] = useState(false);
  const [expError, setExpError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleDeleteUser = async (userId: string, fullName: string) => {
    if (window.confirm(`Are you sure you want to completely delete ${fullName}? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(users.filter(u => u.id !== userId));
      } catch (error: any) {
        console.error("Error deleting user:", error);
        alert("Failed to delete user: " + error.message);
      }
    }
  };

  const handleOpenModal = () => {
    setAddError('');
    setNewIC('');
    setNewTMId('');
    setNewName('');
    setNewPassword('');
    setNewRole('user');
    setNewKyorugiLevel('TR');
    setNewPoomsaeLevel('TR');
    
    let nextSerial = 1;
    const existingSerials = users
      .map(u => parseInt(u.refereeSerialNumber || "0", 10))
      .filter(n => !isNaN(n));
    if (existingSerials.length > 0) {
      nextSerial = Math.max(...existingSerials) + 1;
    }
    setNewSerialNumber(nextSerial.toString().padStart(4, '0'));
    
    setIsModalOpen(true);
  };

  const submitCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setIsAdding(true);

    if (newPassword.length < 6) {
      setAddError("Password must be at least 6 characters.");
      setIsAdding(false);
      return;
    }

    try {
      if (!newTMId.trim()) {
        setAddError("TM Blackbelt ID is required.");
        setIsAdding(false);
        return;
      }

      const cleanTMId = newTMId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const dummyEmail = `${cleanTMId}@tmreferee.local`;

      // Create user in Firebase Auth using secondary app to avoid logging out the admin
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, newPassword);
      const newUid = userCredential.user.uid;
      
      // Sign out the secondary app immediately
      await signOutSecondary(secondaryAuth);

      const newUser = {
        uid: newUid,
        email: dummyEmail,
        icNumber: newRole === 'admin' ? '' : newIC,
        tmMembershipId: newTMId,
        fullName: newName,
        role: newRole,
        isActive: true,
        createdAt: new Date().toISOString(),
        phoneNumber: '',
        kukkiwonDan: '',
        kyorugiRefereeLevel: newRole === 'admin' ? 'NIL' : newKyorugiLevel,
        poomsaeRefereeLevel: newRole === 'admin' ? 'NIL' : newPoomsaeLevel,
        refereeSerialNumber: newRole === 'admin' ? '' : newSerialNumber,
        licenseExpiry: '',
        address: '',
        premierClub: '',
        stateAssociation: '',
        gender: '',
        dateOfBirth: ''
      };

      // Create user document in Firestore
      await setDoc(doc(db, 'users', newUid), newUser);
      
      // Create login mapping
      await setDoc(doc(db, 'login_mappings', cleanTMId), { email: dummyEmail, uid: newUid });

      // Update local state
      setUsers([...users, { id: newUid, ...newUser }]);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === 'auth/operation-not-allowed') {
        setAddError("Email/Password sign-in is not enabled in Firebase Console. Please enable it.");
      } else if (error.code === 'auth/email-already-in-use') {
        setAddError("A user with this username/login ID already exists.");
      } else {
        setAddError("Failed to create user: " + error.message);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = (user.fullName || '').toLowerCase();
    const icNumber = (user.icNumber || '').toLowerCase();
    const tmId = (user.tmMembershipId || '').toLowerCase();

    return (
      fullName.includes(searchLower) ||
      icNumber.includes(searchLower) ||
      tmId.includes(searchLower)
    );
  });

  const handleOpenExpModal = (user: any) => {
    setSelectedUser(user);
    setExpType('kyorugi');
    setExpYear(new Date().getFullYear().toString());
    setExpEvent('');
    setExpLocation('');
    setExpRole('');
    setExpError('');
    setIsExpModalOpen(true);
  };

  const submitAddExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setExpError('');
    setIsExpSaving(true);

    try {
      const fieldName = expType === 'kyorugi' ? 'experienceHistory' : 'poomsaeExperienceHistory';
      const newEntry = {
        id: Date.now().toString(),
        year: expYear,
        eventName: expEvent,
        location: expLocation,
        role: expRole
      };

      await updateDoc(doc(db, 'users', selectedUser.id), {
        [fieldName]: arrayUnion(newEntry)
      });

      // Update local state is optional but good for immediate feedback if we showed it
      alert('Experience successfully added to ' + selectedUser.fullName);
      setIsExpModalOpen(false);
    } catch (error: any) {
      console.error("Error adding experience:", error);
      setExpError("Failed to add experience: " + error.message);
    } finally {
      setIsExpSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-[260px] bg-white border-r border-border flex flex-col shrink-0">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <img 
            src="https://ouhnnj8dinujboyi.public.blob.vercel-storage.com/logo.png" 
            alt="TM Logo" 
            className="h-18 w-auto object-contain shrink-0" 
          />
          <div className="text-[16px] font-extrabold tracking-[-0.5px] uppercase text-primary leading-tight">
            TM Referee<br />Admin
          </div>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('referees')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'referees' ? 'bg-primary text-white' : 'text-primary hover:bg-primary/10'}`}
          >
            <Users size={18} />
            All Referees
          </button>
          <button 
            onClick={() => setActiveTab('fees')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'fees' ? 'bg-primary text-white' : 'text-primary hover:bg-primary/10'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Annual Fees
          </button>
        </nav>
        <div className="p-4 border-t border-border">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors text-red-600 hover:bg-red-50 w-full">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b-2 border-primary mb-6 gap-4">
            <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">{activeTab === 'referees' ? 'Referee Directory' : 'Annual Fees Tracking'}</h1>
            <div className="flex flex-1 w-full md:w-auto md:max-w-md gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by name, ID or IC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pr-10 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                />
                {searchQuery && (
                   <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                   >
                     <X size={14} />
                   </button>
                )}
              </div>
              <button onClick={handleOpenModal} className="bg-primary text-white px-4 py-2 rounded font-bold text-sm flex items-center shrink-0 gap-2 hover:bg-primary/90">
                <UserPlus size={16} />
                Add User
              </button>
            </div>
          </header>

          {loading ? (
            <p>Loading...</p>
          ) : activeTab === 'referees' ? (
            <div className="bg-white border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Name</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Login ID</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Password</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Referee ID</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">IC Number</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="border-b border-border hover:bg-gray-50">
                      <td className="p-4 font-semibold text-sm">{user.fullName || 'N/A'}</td>
                      <td className="p-4 text-sm font-mono text-primary font-bold">{user.tmMembershipId || 'N/A'}</td>
                      <td className="p-4 text-xs text-muted italic">Hidden<br/><span className="text-[10px]">(Reset via Profile)</span></td>
                      <td className="p-4 text-sm text-muted whitespace-nowrap">
                        {user.role === 'admin' ? '-' : (user.tmMembershipId ? `${user.tmMembershipId}-K${user.kyorugiRefereeLevel || 'IR'}-P${user.poomsaeRefereeLevel || 'IR'}-${user.refereeSerialNumber || '0001'}` : 'N/A')}
                      </td>
                      <td className="p-4 text-sm text-muted">
                        {user.role === 'admin' ? '-' : (user.icNumber || 'N/A')}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${user.isActive ? 'bg-[#C6F6D5] text-[#22543D]' : 'bg-gray-200 text-gray-600'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 flex items-center gap-4">
                        {user.role === 'admin' ? (
                          <span className="text-muted text-xs italic">No actions</span>
                        ) : (
                          <>
                            <button 
                              onClick={() => navigate(`/admin/user/${user.id}`)}
                              className="text-primary text-sm font-bold hover:underline"
                            >
                              View Profile
                            </button>
                            <button 
                              onClick={() => handleOpenExpModal(user)}
                              className="text-primary text-sm font-bold hover:underline flex items-center gap-1"
                            >
                              <Plus size={14} />
                              Add Exp
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.fullName || 'this user')}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        {users.length === 0 ? "No users found." : "No results match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'fees' ? (
            <div className="bg-white border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Name</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Referee ID</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Last Paid Year</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.filter(user => user.role !== 'admin').map(user => {
                    const fees = user.annualFeeHistory || [];
                    const maxYear = fees.length ? Math.max(...fees.map((f: any) => parseInt(f.year)).filter((y: number) => !isNaN(y))) : 0;
                    const lastYearPaid = maxYear > 0 ? maxYear.toString() : 'N/A';
                    const currentYear = new Date().getFullYear();
                    const isPaidThisYear = maxYear === currentYear;
                    
                    return (
                        <tr key={user.id} className="border-b border-border hover:bg-gray-50">
                          <td className="p-4 font-semibold text-sm">{user.fullName || 'N/A'}</td>
                          <td className="p-4 text-sm text-muted whitespace-nowrap">
                            {user.tmMembershipId ? `${user.tmMembershipId}-K${user.kyorugiRefereeLevel || 'IR'}-P${user.poomsaeRefereeLevel || 'IR'}-${user.refereeSerialNumber || '0001'}` : 'N/A'}
                          </td>
                          <td className="p-4 text-sm font-semibold">{lastYearPaid}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${isPaidThisYear ? 'bg-[#C6F6D5] text-[#22543D]' : 'bg-[#FED7D7] text-[#9B2C2C]'}`}>
                              {isPaidThisYear ? 'Paid' : 'Due'}
                            </span>
                          </td>
                          <td className="p-4 flex items-center gap-4">
                            <button 
                              onClick={() => navigate(`/admin/user/${user.id}?tab=annual_fee`)}
                              className="text-primary text-sm font-bold hover:underline"
                            >
                              View & Manage
                            </button>
                          </td>
                        </tr>
                    );
                  })}
                  {filteredUsers.filter(user => user.role !== 'admin').length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        No results match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </main>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase tracking-tight">Add New User</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-primary transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={submitCreateUser} className="p-6 flex flex-col gap-4">
              {addError && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-2">
                  {addError}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Account Role</label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors bg-white"
                >
                  <option value="user">Referee (Standard User)</option>
                  <option value="admin">Administrator (Admin Dashboard Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
                  {newRole === 'admin' ? 'Admin Username / Login ID' : 'TM Blackbelt ID'}
                </label>
                <input 
                  type="text" 
                  placeholder={newRole === 'admin' ? 'e.g. admin123' : 'e.g. TM-12345'} 
                  value={newTMId}
                  onChange={(e) => setNewTMId(e.target.value)}
                  className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  required
                />
              </div>

              {newRole !== 'admin' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Referee Serial Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 0001" 
                      value={newSerialNumber}
                      onChange={(e) => setNewSerialNumber(e.target.value)}
                      className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">IC Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 850101-14-5567" 
                      value={newIC}
                      onChange={(e) => setNewIC(e.target.value)}
                      className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      required
                    />
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Full Name</label>
                <input 
                  type="text" 
                  placeholder={newRole === 'admin' ? 'e.g. LEO CHEN' : 'e.g. AHMAD BIN ABDULLAH'} 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors uppercase"
                  required
                />
              </div>

              {newRole !== 'admin' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Kyorugi Level</label>
                    <select 
                      value={newKyorugiLevel}
                      onChange={(e) => setNewKyorugiLevel(e.target.value)}
                      className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors bg-white"
                    >
                      <option value="NIL">NIL</option>
                      <option value="TR">TR</option>
                      <option value="SR">SR</option>
                      <option value="NR">NR</option>
                      <option value="IRS">IRS</option>
                      <option value="IR3">IR3</option>
                      <option value="IR2">IR2</option>
                      <option value="IR1">IR1</option>
                      <option value="IR">IR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Poomsae Level</label>
                    <select 
                      value={newPoomsaeLevel}
                      onChange={(e) => setNewPoomsaeLevel(e.target.value)}
                      className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors bg-white"
                    >
                      <option value="NIL">NIL</option>
                      <option value="TR">TR</option>
                      <option value="SR">SR</option>
                      <option value="NR">NR</option>
                      <option value="IRS">IRS</option>
                      <option value="IR3">IR3</option>
                      <option value="IR2">IR2</option>
                      <option value="IR1">IR1</option>
                      <option value="IR">IR</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Temporary Password</label>
                <input 
                  type="password" 
                  placeholder="Min 6 characters" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  required
                  minLength={6}
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-muted hover:text-primary transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isAdding}
                  className="bg-primary text-white px-6 py-2 rounded font-bold text-sm hover:bg-primary/90 disabled:opacity-70 transition-colors"
                >
                  {isAdding ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Experience Modal */}
      {isExpModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-primary uppercase tracking-tight">Add Experience</h2>
                <p className="text-xs text-muted font-semibold">{selectedUser?.fullName}</p>
              </div>
              <button onClick={() => setIsExpModalOpen(false)} className="text-muted hover:text-primary transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={submitAddExperience} className="p-6 flex flex-col gap-4">
              {expError && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-2">
                  {expError}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Experience Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExpType('kyorugi')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase transition-colors ${expType === 'kyorugi' ? 'bg-primary text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'}`}
                  >
                    Kyorugi
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpType('poomsae')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase transition-colors ${expType === 'poomsae' ? 'bg-[#b50000] text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'}`}
                  >
                    Poomsae
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input 
                    type="text" 
                    placeholder="Date" 
                    value={expYear}
                    onChange={(e) => setExpYear(e.target.value)}
                    className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    required
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Kuala Lumpur" 
                    value={expLocation}
                    onChange={(e) => setExpLocation(e.target.value)}
                    className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Event Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. National Championship" 
                  value={expEvent}
                  onChange={(e) => setExpEvent(e.target.value)}
                  className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Role / Responsibility</label>
                <input 
                  type="text" 
                  placeholder="e.g. Referee / Judge" 
                  value={expRole}
                  onChange={(e) => setExpRole(e.target.value)}
                  className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsExpModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-muted hover:text-primary transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isExpSaving}
                  className="bg-primary text-white px-6 py-2 rounded font-bold text-sm hover:bg-primary/90 disabled:opacity-70 transition-colors"
                >
                  {isExpSaving ? 'Saving...' : 'Add Experience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
