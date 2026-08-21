"use client";

import { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'Client' | 'Seller' | 'InventoryManager' | 'Admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
  isVip?: boolean;
}

const DEFAULT_USERS: User[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Alice (Cliente VIP)', role: 'Client', isVip: true },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Bob (Cliente)', role: 'Client', isVip: false },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Joe (Gerente Estoque)', role: 'InventoryManager', isVip: false },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Super Admin', role: 'Admin', isVip: false },
  { id: '66666666-6666-6666-6666-666666666666', name: 'Sally (Vendedor)', role: 'Seller', isVip: false },
];

interface AuthContextType {
  user: User | null;
  setUser: (user: User) => void;
  mockUsers: User[];
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  mockUsers: DEFAULT_USERS,
  refreshUsers: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>(DEFAULT_USERS);

  const refreshUsers = async () => {
    try {
      const adminUser = usersList.find(u => u.role === 'Admin') || DEFAULT_USERS[3];
      const res = await authFetch('/users', {}, adminUser);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
        // If current user was updated, sync current user state
        const updatedSelf = data.find((u: User) => u.id === user?.id);
        if (updatedSelf) setUser(updatedSelf);
      }
    } catch {
      // Fallback to DEFAULT_USERS if backend not reachable yet
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      let currentUsers = DEFAULT_USERS;
      try {
        const adminUser = DEFAULT_USERS[3];
        const res = await authFetch('/users', {}, adminUser);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            currentUsers = data;
            setUsersList(data);
          }
        }
      } catch {
        // Fallback to DEFAULT_USERS
      }

      const savedId = localStorage.getItem('mockUserId');
      if (savedId) {
        const found = currentUsers.find(u => u.id === savedId);
        if (found) setUser(found);
        else setUser(currentUsers[0]);
      } else {
        setUser(currentUsers[0]);
      }
    };

    initAuth();
  }, []);

  const handleSetUser = (u: User) => {
    setUser(u);
    localStorage.setItem('mockUserId', u.id);
  };

  return (
    <AuthContext.Provider value={{ user, setUser: handleSetUser, mockUsers: usersList, refreshUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const authFetch = async (url: string, options: RequestInit = {}, user: User | null) => {
  const headers = new Headers(options.headers || {});
  if (user) {
    headers.set('x-user-role', user.role);
    headers.set('x-user-id', user.id);
  }
  const targetUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
  return fetch(targetUrl, { ...options, headers });
};
