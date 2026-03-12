import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://xhmeitivkclbeziqavxw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
