import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../api';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/auth/me`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    apiFetch(`${API_BASE_URL}/api/auth/me`)
      .then(async (res) => {
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          if (mounted) setUser(data);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const clearUser = () => setUser(null);
    window.addEventListener('auth:unauthorized', clearUser);
    return () => {
      mounted = false;
      window.removeEventListener('auth:unauthorized', clearUser);
    };
  }, []);

  const login = async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await apiFetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: formData,
    });
    
    if (res.ok) {
      await checkAuth();
      return { success: true };
    } else {
      const data = await res.json();
      return { success: false, message: data.detail || 'Login failed' };
    }
  };

  const logout = async () => {
    await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './useAuth';

