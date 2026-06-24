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

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDrivers() {
  console.log('Fetching all users...');
  const { data: users, error: errUsers } = await supabase.from('users').select('*');
  if (errUsers) {
    console.error('Error fetching users:', errUsers);
  } else {
    console.log('--- USERS ---');
    console.table(users.map(u => ({ id: u.id, nama: u.nama, email: u.email, role: u.role })));
  }

  console.log('Fetching all shipments with nested data...');
  const { data: shipments, error: errShip } = await supabase.from('pengiriman').select(`
    id,
    id_truk,
    id_pengemudi,
    status,
    truk:id_truk (plat_nomor),
    pengemudi:id_pengemudi (nama)
  `);
  if (errShip) {
    console.error('Error fetching shipments:', errShip);
  } else {
    console.log('--- SHIPMENTS ---');
    console.table(shipments.map(s => ({
      id: s.id,
      truk: s.truk ? s.truk.plat_nomor : 'NULL',
      id_pengemudi: s.id_pengemudi,
      driver_name: s.pengemudi ? s.pengemudi.nama : 'NULL'
    })));
  }
}

inspectDrivers();
