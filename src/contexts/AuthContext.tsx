import React, { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { Profile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: {
    firstName: string;
    lastName: string;
    company: string;
  }) => Promise<{ data: any; error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ data: Profile | null; error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  // Debug the auth state being provided
  console.log('🔍 AuthProvider values:', {
    user: auth.user?.email,
    loading: auth.loading,
    hasSession: !!auth.session
  });

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}