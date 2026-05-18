import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth, secondaryAuth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, LogOut, X, Trash2 } from 'lucide-react';
import { signOut, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newIC, setNewIC] = useState('');
  const [newTMId, setNewTMId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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
        icNumber: newIC,
        tmMembershipId: newTMId,
        fullName: newName,
        role: newRole,
        isActive: true,
        createdAt: new Date().toISOString(),
        phoneNumber: '',
        kukkiwonDan: '',
        kyorugiRefereeLevel: 'TR',
        poomsaeRefereeLevel: 'TR',
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
        setAddError("A referee with this IC number already exists.");
      } else {
        setAddError("Failed to create user: " + error.message);
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-[260px] bg-white border-r border-border flex flex-col shrink-0">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 bg-primary [clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)] shrink-0"></div>
          <div className="text-[16px] font-extrabold tracking-[-0.5px] uppercase text-primary leading-tight">
            TM Referee<br />Admin
          </div>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors bg-primary text-white">
            <Users size={18} />
            All Referees
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
          <header className="flex justify-between items-center pb-6 border-b-2 border-primary mb-6">
            <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">Referee Directory</h1>
            <button onClick={handleOpenModal} className="bg-primary text-white px-4 py-2 rounded font-bold text-sm flex items-center gap-2 hover:bg-primary/90">
              <UserPlus size={16} />
              Add New User
            </button>
          </header>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="bg-white border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Name</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Referee ID</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">IC Number</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Role</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-border hover:bg-gray-50">
                      <td className="p-4 font-semibold text-sm">{user.fullName || 'N/A'}</td>
                      <td className="p-4 text-sm font-mono text-muted whitespace-nowrap">
                        {user.tmMembershipId ? `${user.tmMembershipId}-K${user.kyorugiRefereeLevel || 'IR'}-P${user.poomsaeRefereeLevel || 'IR'}-${user.refereeSerialNumber || '0001'}` : 'N/A'}
                      </td>
                      <td className="p-4 text-sm text-muted">{user.icNumber || 'N/A'}</td>
                      <td className="p-4 text-sm uppercase">{user.role}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${user.isActive ? 'bg-[#C6F6D5] text-[#22543D]' : 'bg-gray-200 text-gray-600'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 flex items-center gap-4">
                        <button 
                          onClick={() => navigate(`/admin/user/${user.id}`)}
                          className="text-primary text-sm font-bold hover:underline"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.fullName || 'this user')}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
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
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">TM Blackbelt ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. TM-12345" 
                  value={newTMId}
                  onChange={(e) => setNewTMId(e.target.value)}
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
              
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. AHMAD BIN ABDULLAH" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2 rounded border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors uppercase"
                  required
                />
              </div>
              
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
    </div>
  );
}
