import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://xhmeitivkclbeziqavxw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_d5KUqa-Lr4kNcFO4NuXieg_LL4TZQyb";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
