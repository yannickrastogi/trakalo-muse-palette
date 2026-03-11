import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://iejmrufqtqdwdsywbnsm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Wg4TNL2dS0EWmnWRnn4VZA_wkJiBdDM";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
