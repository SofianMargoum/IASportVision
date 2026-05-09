import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setToken, getToken, clearToken } from '../api/client';
import { login as apiLogin, me as apiMe } from '../api/authApi';

const AuthContext = createContext(null);

const USER_KEY = 'iasv.user';

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [error, setError] = useState(null);

  // Validation du token au démarrage si présent.
  useEffect(() => {
    let cancelled = false;
    if (!getToken()) {
      setLoading(false);
      return () => {};
    }
    (async () => {
      try {
        const data = await apiMe();
        const u = data?.user || data;
        if (!cancelled && u) {
          setUser(u);
          storeUser(u);
        }
      } catch (e) {
        if (!cancelled) {
          clearToken();
          storeUser(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-logout si une 401 est levée par le client.
  useEffect(() => {
    const handler = () => {
      storeUser(null);
      setUser(null);
    };
    window.addEventListener('iasv:auth:expired', handler);
    return () => window.removeEventListener('iasv:auth:expired', handler);
  }, []);

  const signIn = useCallback(async (username, password) => {
    setError(null);
    try {
      const { token, user: u } = await apiLogin(username, password);
      setToken(token);
      storeUser(u);
      setUser(u);
      return u;
    } catch (e) {
      setError(e.message || 'Connexion impossible');
      throw e;
    }
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    storeUser(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      isAuthenticated: Boolean(user),
      loading,
      error,
      signIn,
      signOut,
    }),
    [user, loading, error, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
