import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('c:\\Users\\lorenzo.antoneli\\.gemini\\antigravity\\scratch\\beach-tennis-app-supabase\\frontend\\.env', 'utf-8');
let url = '', key = '';
envContent.split('\n').forEach(line => {
    if(line.startsWith('VITE_SUPABASE_URL')) url = line.split('=')[1].trim();
    if(line.startsWith('VITE_SUPABASE_ANON_KEY')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('matches').select('*').limit(1);
    console.log(data);
}
check();
