import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, isAdminUser, login as appwriteLogin, logout as appwriteLogout } from '../lib/auth';

interface User {
  $id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();

      if (currentUser) {
        // avoid calling /account twice by using email if you want,
        // but keeping your isAdminUser() is fine.
        const adminCheck = await isAdminUser();
        setUser(currentUser as User);
        setIsAdmin(adminCheck);
      } else {
        setUser(null);
        setIsAdmin(false);
      }

      setError(null);
    } catch (err: any) {
      setUser(null);
      setIsAdmin(false);
      setError(err?.message ?? 'Auth error');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    await appwriteLogin(email, password);
    await refresh(); // ✅ critical: update context after login
  };

  const logout = async () => {
    await appwriteLogout();
    await refresh();
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, error, refresh, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
