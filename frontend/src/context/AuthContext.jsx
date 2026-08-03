import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/auth/me');
      setUser(data.user);
      setError(null);
    } catch (err) {
      setUser(null);
      // 401 is expected when not logged in
      if (err.status !== 401) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const data = await api.get('/api/auth/google/url');
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert(`Login initialization failed: ${err.message}`);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
      setUser(null);
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const updateUserSettings = (updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginWithGoogle,
        logout,
        fetchUser,
        updateUserSettings
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
