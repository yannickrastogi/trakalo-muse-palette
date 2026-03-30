import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const SUPABASE_URL = "https://xhmeitivkclbeziqavxw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik";

const customStorage = {
  getItem: (key: string) => {
    const value = localStorage.getItem(key);
    if (value) return value;
    // Fallback to backup for auth key
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      return localStorage.getItem('trakalog_session_backup');
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    localStorage.setItem(key, value);
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      localStorage.setItem('trakalog_session_backup', value);
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
