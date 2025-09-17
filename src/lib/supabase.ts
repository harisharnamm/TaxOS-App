import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isProd = import.meta.env.MODE === 'production';

// Determine the site URL for auth redirects
const siteUrl = import.meta.env.VITE_SITE_URL || 
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

// Environment validation completed

if (!supabaseUrl || !supabaseAnonKey) {
  if (!isProd) {
    console.error('Missing Supabase environment variables:', {
      VITE_SUPABASE_URL: !!supabaseUrl,
      VITE_SUPABASE_ANON_KEY: !!supabaseAnonKey
    });
  } else {
    console.error('Missing Supabase environment variables.');
  }
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, 
    flowType: 'pkce',
    // Add site URL for auth redirects
    site: siteUrl
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey
    }
  }
});

// Supabase client initialized successfully

// Enhanced connection testing with better recovery options
let connectionTestRunning = true;

// First try with a short timeout for quick feedback
Promise.race([
  supabase.auth.getSession(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout (initial)')), 5000))
]).then((result: any) => {
  const { data, error } = result;
  connectionTestRunning = false;
  
  // Initial session check completed
  
  // Return success flag to any listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase:connection:success'));
  }
}).catch((error: Error) => {
  if (!isProd) {
    console.warn('⚠️ Fast connection test failed, trying with longer timeout:', error.message);
  }
  
  // Try again with a longer timeout as backup
  if (connectionTestRunning) {
    Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout (extended)')), 15000))
    ]).then((result: any) => {
      const { data, error } = result;
      connectionTestRunning = false;
      
      // Extended session check completed
      
      // Return success flag to any listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabase:connection:success'));
      }
    }).catch((finalError: Error) => {
      connectionTestRunning = false;
      if (!isProd) {
        console.error('❌ Session check failed after extended timeout:', finalError.message);
      }
      
      // Signal connection issue to listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabase:connection:error', { 
          detail: { message: isProd ? 'Connection error' : finalError.message } 
        }));
      }
    });
  }
});

// Types
export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  profile?: Profile;
}