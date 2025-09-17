import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    
    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          if (mounted) {
            setAuthState(prev => ({ ...prev, loading: false, user: null, session: null }));
          }
          return;
        }
        
        console.log('✅ Initial session:', session?.user?.email || 'No session');
        
        if (mounted) {
          if (session?.user) {
            setAuthState(prev => ({ 
              ...prev, 
              session, 
              user: session.user, 
              loading: false // Set loading false immediately if we have a user
            }));
            // Try to fetch profile, but don't block on it
            fetchProfile(session.user.id);
          } else {
            setAuthState(prev => ({ ...prev, session, user: null, loading: false }));
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setAuthState(prev => ({ ...prev, loading: false, user: null, session: null }));
        }
      }
    };
    
    initializeAuth();
    
    // Additional session check for OAuth callbacks
    const checkSessionAfterDelay = async () => {
      console.log('🔄 Additional session check for OAuth callback');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const { data, error } = await supabase.auth.getSession();
      console.log('🔄 Delayed session check:', { 
        hasSession: !!data.session, 
        hasUser: !!data.session?.user, 
        userEmail: data.session?.user?.email,
        error: error?.message 
      });
      
      if (data.session?.user && mounted) {
        console.log('✅ Delayed session check found user:', data.session.user.email);
        setAuthState(prev => ({ 
          ...prev, 
          session: data.session, 
          user: data.session.user, 
          loading: false 
        }));
        
        // Force redirect if we're on signin page
        if (window.location.pathname === '/signin') {
          console.log('🔄 Delayed check: User authenticated on signin page, redirecting');
          window.location.href = '/';
        }
      }
    };
    
    checkSessionAfterDelay();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email, 'mounted:', mounted);
        console.log('🔄 Session details:', { 
          hasSession: !!session, 
          hasUser: !!session?.user, 
          userEmail: session?.user?.email,
          event 
        });
        
        if (mounted) {
          if (session?.user) {
            console.log('✅ Setting authenticated user:', session.user.email);
            setAuthState(prev => ({ 
              ...prev, 
              session, 
              user: session.user, 
              loading: false // Always set loading false when we get auth state change
            }));
            // Try to fetch profile, but don't block on it
            fetchProfile(session.user.id);
            
            // Force redirect if we're on signin page
            if (window.location.pathname === '/signin') {
              console.log('🔄 User authenticated on signin page, redirecting to dashboard');
              window.location.href = '/';
            }
          } else {
            console.log('❌ No session, clearing auth state');
            setAuthState(prev => ({ ...prev, session, user: null, profile: null, loading: false }));
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!userId) {
      console.error('❌ No userId provided to fetchProfile');
      return;
    }
    
    try {
      console.log('🔄 Fetching profile for user:', userId);
      
      // Fetch profile with timeout protection, but don't block auth loading on it
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 15000);
      });
      
      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error) {
        if (error.message === 'Profile fetch timeout') {
          console.warn('⚠️ Profile fetch timed out, continuing without profile');
        } else if (error.code === 'PGRST116') {
          console.log('ℹ️ No profile found, this is normal for new users');
        } else {
          console.error('❌ Error fetching profile:', error);
        }
      } else {
        console.log('✅ Profile fetched successfully:', profile);
      }

      // Update only the profile, don't touch loading state
      setAuthState(prev => ({ ...prev, profile }));
    } catch (error) {
      console.error('❌ Error in fetchProfile:', error);
      // Don't set loading to false here - it should already be false
    }
  };

  const signUp = async (email: string, password: string, userData: {
    firstName: string;
    lastName: string;
    company: string;
  }) => {
    console.log('🔄 Signing up user:', email);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            company: userData.company,
          },
        },
      });

      console.log('✅ Sign up response:', { userId: data?.user?.id, error });
      return { data, error };
    } catch (err) {
      console.error('❌ Sign up error:', err);
      return { data: null, error: err as any };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔄 Attempting sign in for:', email);
    
    // Set loading state
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Sign in error:', error);
        setAuthState(prev => ({ ...prev, loading: false }));
        sessionStorage.removeItem('justLoggedIn'); 
        return { data, error };
      }

      if (data?.user) {
        console.log('✅ Sign in successful for user:', data.user.id);
        // Set flag for just logged in to trigger preloader
        sessionStorage.setItem('justLoggedIn', 'true');
        
        // Rely on Supabase client session persistence. Do not manually store tokens.
        return { data, error: null };
      } else {
        console.error('❌ Sign in returned no user data');
        setAuthState(prev => ({ ...prev, loading: false }));
        return { data, error: { message: 'No user data returned' } as any };
      }
    } catch (err) {
      console.error('❌ Sign in catch block:', err);
      setAuthState(prev => ({ ...prev, loading: false }));
      return { data: null, error: err as any };
    }
  };

  const signOut = async () => {
    console.log('🔄 Signing out...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Sign out error:', error);
      } else {
        console.log('✅ Signed out successfully');
      }
      return { error };
    } catch (err) {
      console.error('❌ Sign out catch block:', err);
      return { error: err as any };
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!authState.user) {
      console.error('❌ No user logged in for profile update');
      return { error: new Error('No user logged in') };
    }

    console.log('🔄 Updating profile for user:', authState.user.id);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', authState.user.id)
        .select()
        .single();

      if (!error && data) {
        console.log('✅ Profile updated successfully');
        setAuthState(prev => ({ ...prev, profile: data }));
      } else if (error) {
        console.error('❌ Profile update error:', error);
      }

      return { data, error };
    } catch (err) {
      console.error('❌ Profile update catch block:', err);
      return { data: null, error: err as any };
    }
  };

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };
}