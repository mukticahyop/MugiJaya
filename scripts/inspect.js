const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Connecting to:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: truk, error: errTruk } = await supabase.from('truk').select('*');
  if (errTruk) {
    console.error('Error fetching truk:', errTruk);
  } else {
    console.log('--- TRUK ---');
    console.table(truk.map(t => ({ id: t.id, plat_nomor: t.plat_nomor, status: t.status })));
  }

  const { data: pengiriman, error: errPengiriman } = await supabase.from('pengiriman').select('*');
  if (errPengiriman) {
    console.error('Error fetching pengiriman:', errPengiriman);
  } else {
    console.log('--- PENGIRIMAN ---');
    console.table(pengiriman.map(p => ({ id: p.id, id_truk: p.id_truk, status: p.status, check_in_tiba: p.check_in_tiba })));
  }
}

inspect();
