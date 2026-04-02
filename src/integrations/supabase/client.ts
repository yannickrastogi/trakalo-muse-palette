import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './constants';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './constants';

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
    if (key.startsWith('sb-') && key.endsWith('-auth-token') && value) {
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
    autoRefreshToken: false,
  }
});
