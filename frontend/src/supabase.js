import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: Supabase environment variables are missing! Make sure to add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel settings.");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.url', supabaseKey || 'placeholder_key');

