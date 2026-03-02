import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true
});

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('userInfo');
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      return parsed.user || parsed;
    } catch { return null; }
  });

  // 🔥 THE BIG TECH FIX: Splash screen state
  // Agar localStorage mein data hai, toh pehle loading dikhao
  const [isInitialLoading, setIsInitialLoading] = useState(!!localStorage.getItem('userInfo'));

  const fetchFreshProfile = useCallback(async () => {
    if (!localStorage.getItem('userInfo')) {
      setIsInitialLoading(false);
      return;
    }
    
    try {
      const { data } = await API.get('/users/profile');
      setUser(data);
      
      const stored = JSON.parse(localStorage.getItem('userInfo') || '{}');
      localStorage.setItem('userInfo', JSON.stringify({ ...stored, user: data }));
    } catch (err) {
      console.error("Profile sync error:", err);
      // Agar token expire ho gaya ho toh logout kardo
      if (err.response?.status === 401) {
        localStorage.removeItem('userInfo');
        setUser(null);
      }
    } finally {
      // 🔥 Data aane ke baad hi loading hatayenge (Render Block removed)
      setIsInitialLoading(false); 
    }
  }, []);

  useEffect(() => {
    fetchFreshProfile();
    window.addEventListener('profileUpdated', fetchFreshProfile);
    return () => window.removeEventListener('profileUpdated', fetchFreshProfile);
  }, [fetchFreshProfile]);

  const getStatus = (targetId) => {
    if (!user) return 'NONE';
    const tid = String(targetId);
    
    const isConnected = user.connections?.some(c => String(c._id || c) === tid);
    if (isConnected) return 'CONNECTED';

    const isPending = user.sentRequests?.some(r => String(r._id || r) === tid);
    if (isPending) return 'PENDING';

    return 'NONE';
  };

  // 🔥 THE SPLASH SCREEN UI
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white">
        <div className="animate-spin w-12 h-12 border-4 border-[#1d9bf0] border-t-transparent rounded-full mb-6 shadow-[0_0_15px_#1d9bf0]"></div>
        <h2 className="text-2xl font-black tracking-widest animate-pulse bg-gradient-to-r from-[#1d9bf0] to-purple-500 text-transparent bg-clip-text">
          CAMPUS CONNECT
        </h2>
        <p className="text-gray-500 text-sm mt-2 font-medium">Syncing your campus...</p>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, getStatus, fetchFreshProfile, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);