import React, { useState } from 'react';
import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { SignInPage } from '../components/ui/sign-in';
import { useAuthContext } from '../contexts/AuthContext';
import { usePreloader } from '../contexts/PreloaderContext';
import { supabase } from '../lib/supabase';

export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, loading } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const { setShowPreloader } = usePreloader();

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('🔄 Checking for OAuth callback...');
        console.log('🔄 Current URL:', window.location.href);
        
        // Check if we have OAuth callback parameters in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        console.log('🔄 URL params:', Object.fromEntries(urlParams));
        console.log('🔄 Hash params:', Object.fromEntries(hashParams));
        
        if (urlParams.get('code') || hashParams.get('access_token') || hashParams.get('code')) {
          console.log('🔄 OAuth callback detected in URL');
          
          // Wait a bit for Supabase to process the callback
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Force a session refresh to pick up the OAuth session
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('❌ OAuth callback error:', error);
            setError('Authentication failed. Please try again.');
            return;
          }
          
          if (data.session?.user) {
            console.log('✅ OAuth callback successful, user:', data.session.user.email);
            // Clear any error states
            setError(null);
            setConnectionError(false);
            // Force a page reload to ensure auth state is properly set
            window.location.href = '/';
            return;
          } else {
            console.log('❌ No session found after OAuth callback');
            setError('Authentication failed. Please try again.');
          }
        } else {
          // Regular session check
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('❌ Session check error:', error);
            return;
          }
          
          if (data.session?.user) {
            console.log('✅ User already authenticated:', data.session.user.email);
          }
        }
      } catch (err) {
        console.error('❌ OAuth callback error:', err);
      }
    };

    // Check for OAuth callback on component mount
    handleOAuthCallback();
  }, []);

  // Listen for Supabase connection events
  useEffect(() => {
    const handleConnectionError = () => {
      console.log('⚠️ SignIn: Supabase connection error detected');
      setConnectionError(true);
      
      // Don't set error if already authenticated to prevent blocking the redirect
      if (!user) {
        setError('Connection to authentication service failed. Please check your network and try again.');
      }
    };

    const handleConnectionSuccess = () => {
      console.log('✅ SignIn: Supabase connection successful');
      setConnectionError(false);
      setError(null);
    };

    window.addEventListener('supabase:connection:error', handleConnectionError);
    window.addEventListener('supabase:connection:success', handleConnectionSuccess);

    return () => {
      window.removeEventListener('supabase:connection:error', handleConnectionError);
      window.removeEventListener('supabase:connection:success', handleConnectionSuccess);
    };
  }, [user]);

  // Redirect if user is already authenticated
  useEffect(() => {
    console.log('🔄 Auth state check:', { user: !!user, loading, userEmail: user?.email });
    
    if (user && !loading) {
      // Redirect to the page they were trying to access, or dashboard
      const from = (location as any).state?.from || '/';
      console.log('✅ User already authenticated, redirecting to dashboard from:', from);
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, location]);

  // Handle forced navigation when user exists despite connection issues
  useEffect(() => {
    if (user) {
      // Redirect to the page they were trying to access, or dashboard
      const from = (location as any).state?.from || '/';
      console.log('✅ User exists in SignIn, forcing navigation to dashboard');
      // Small delay to allow state updates to complete
      const navTimer = setTimeout(() => navigate(from, { replace: true }), 100);
      return () => clearTimeout(navTimer);
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setShowPreloader(true);

    // Prevent sign-in attempts if there's a connection error
    if (connectionError) {
      console.warn('⚠️ Sign in prevented due to connection error');
      setError('Cannot sign in while offline. Please check your network connection.');
      return;
    }

    console.log('🔄 Form submitted, starting sign in process...');

    // Extract form data
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { error } = await signIn(email, password);

      if (error) {
        console.error('❌ Sign in failed:', error.message);

        // Provide user-friendly error messages
        let userFriendlyMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          userFriendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          userFriendlyMessage = 'Please check your email and confirm your account before signing in.';
        } else if (error.message.includes('Too many requests')) {
          userFriendlyMessage = 'Too many sign-in attempts. Please wait a few minutes before trying again.';
        }

        setError(userFriendlyMessage);
        setShowPreloader(false);
      } else {
        console.log('✅ Sign in successful, navigating to dashboard');
        // Don't navigate here - let the useEffect handle it when user state updates
        // Navigation will happen automatically via auth state change
      }
    } catch (err: any) {
      console.error('❌ Unexpected sign in error:', err);
      setError(err?.message || 'An unexpected error occurred');
      setShowPreloader(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (connectionError) {
      console.warn('⚠️ Google sign-in prevented due to connection error');
      setError('Cannot sign in with Google while offline. Please check your network connection.');
      return;
    }

    try {
      setError(null);
      setShowPreloader(true);
      console.log('🔄 Redirecting to Google OAuth...');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Let Supabase Auth use the configured site URL to avoid expired preview redirects
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) {
        console.error('❌ Google sign-in error:', error.message);
        setError(error.message);
        setShowPreloader(false);
        return;
      }

      console.log('✅ Google sign-in initiated:', data?.url ? 'redirecting' : 'using popup');
    } catch (err: any) {
      console.error('❌ Unexpected Google sign-in error:', err);
      setError(err?.message || 'An unexpected error occurred while starting Google sign-in');
      setShowPreloader(false);
    }
  };

  const handleResetPassword = () => {
    navigate('/forgot-password');
  };

  const handleCreateAccount = () => {
    navigate('/signup');
  };

  // Show loading if we're in the middle of auth state change
  // Critical fix: The user might be authenticated but we have connection issues
  // Force navigate to dashboard when user exists, even with connection issues
  if (user) {
    console.log('✅ User exists in SignIn, showing redirect loading UI');

    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-900">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Logo Overlay */}
      <div className="absolute top-8 left-8 z-10">
        <img
          src="/taxos-logo.png"
          alt="Taxos"
          className="h-10 w-auto"
        />
      </div>



      <SignInPage
        title={
          <span className="font-light text-gray-900 tracking-tighter">
            Welcome back!
          </span>
        }
        description="Sign in to your Taxos account"
        heroImageSrc="https://images.pexels.com/photos/32489809/pexels-photo-32489809.jpeg?_gl=1*j7c3pm*_ga*NDg0MTc4NzYzLjE3NDg1OTk1MTM.*_ga_8JE65Q40S6*czE3NTExMTMyNzgkajM3JGwwJGgw"
        error={error}
        overlayContent={
          <div className="h-full flex flex-col py-16">
            {/* Upper side - Main text */}
            <div className="flex-[3] flex items-center justify-center">
              <div className="max-w-lg">
                <h2 className="text-3xl xl:text-4xl font-bold mb-6 leading-tight text-white">
                  Your AI-powered tax assistant awaits
                </h2>
                <p className="text-lg xl:text-xl text-white/90 leading-relaxed">
                  Streamline your tax workflow with intelligent document processing,
                  automated deduction detection, and seamless client management.
                </p>
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-[2]"></div>

            {/* Bottom side - Testimonial */}
            <div className="flex-[2] flex items-center justify-center">
              <div className="max-w-lg">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 xl:p-6 border border-white/20">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 xl:w-10 xl:h-10 bg-primary rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs xl:text-sm font-semibold text-gray-900">JD</span>
                      </div>
                      <div className="w-8 h-8 xl:w-10 xl:h-10 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs xl:text-sm font-semibold text-white">SM</span>
                      </div>
                      <div className="w-8 h-8 xl:w-10 xl:h-10 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs xl:text-sm font-semibold text-white">AL</span>
                      </div>
                    </div>
                    <span className="text-white/90 font-medium text-sm xl:text.base">Trusted by 2,500+ CPAs</span>
                  </div>
                  <p className="text.white/80 italic text-sm xl:text-base">
                    "Taxos has transformed how we handle tax season. The AI insights save us hours every day."
                  </p>
                  <p className="text.white/70 text-xs xl:text-sm mt-2">— Sarah Chen, Managing Partner</p>
                </div>
              </div>
            </div>
          </div>
        }
        onSignIn={handleSubmit}
        onGoogleSignIn={handleGoogleSignIn}
        onResetPassword={handleResetPassword}
        onCreateAccount={handleCreateAccount}
      />

      {/* Terms Footer */}
      <div className="absolute bottom-4 left-8 z-10">
        <p className="text-xs text-gray-600 leading-relaxed text-center">
          By signing in, you agree to our{' '}
          <Link to="/terms" className="text-violet-400 hover:text-violet-300 transition-colors duration-200">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-violet-400 hover:text-violet-300 transition-colors duration-200">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}