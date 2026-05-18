/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserProfile from './components/UserProfile';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            // Fallback for bootstrapped admin
            if (currentUser.email === 'anak2nsky@gmail.com') {
              setRole('admin');
            } else {
              setRole('user');
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole('user');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to={role === 'admin' ? '/admin' : '/profile'} />} />
        
        <Route path="/admin" element={
          user && role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />
        } />
        
        <Route path="/admin/user/:id" element={
          user && role === 'admin' ? <UserProfile isAdminView={true} /> : <Navigate to="/login" />
        } />
        
        <Route path="/profile" element={
          user ? <UserProfile isAdminView={false} /> : <Navigate to="/login" />
        } />
        
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
