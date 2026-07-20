'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, TOKEN_KEY } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  permissions: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    username: string;
    name?: string;
  }) => Promise<void>;
  logout: () => void;
  updateUser: (changes: Partial<User>) => void;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Extrae el user id (claim `sub`) de un JWT sin verificarlo. */
function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Al montar: si hay token, verifica la sesión y carga perfil + permisos.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userId = token ? decodeUserId(token) : null;

    if (!userId) {
      localStorage.removeItem(TOKEN_KEY);
      setLoading(false);
      return;
    }

    api
      .get('/api/users/me')
      .then((res) => {
        setUser(res.data.profile);
        setPermissions(res.data.permissions ?? []);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setPermissions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setUser(res.data.user);
    setPermissions(res.data.permissions ?? []);
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      username: string;
      name?: string;
    }) => {
      await api.post('/api/auth/register', data);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setPermissions([]);
  }, []);

  const updateUser = useCallback((changes: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...changes } : prev));
  }, []);

  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions]
  );

  // Es admin si tiene al menos un permiso del sistema.
  const isAdmin = permissions.length > 0;

  const value = useMemo(
    () => ({
      user,
      permissions,
      loading,
      login,
      register,
      logout,
      updateUser,
      hasPermission,
      isAdmin,
    }),
    [
      user,
      permissions,
      loading,
      login,
      register,
      logout,
      updateUser,
      hasPermission,
      isAdmin,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
