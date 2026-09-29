// src/lib/auth.js
'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

function parseToken(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

function readCookie() {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/dms_token=([^;]+)/);
  return m ? m[1] : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = readCookie();
    if (token) {
      const payload = parseToken(token);
      if (payload) setUser(payload);
    }
  }, []);

  const login = useCallback((token) => {
    const payload = parseToken(token);
    if (!payload) return;
    const maxAge = 7 * 24 * 3600;
    document.cookie = `dms_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
    setUser(payload);
  }, []);

  const logout = useCallback(() => {
    document.cookie = 'dms_token=; path=/; max-age=0';
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
