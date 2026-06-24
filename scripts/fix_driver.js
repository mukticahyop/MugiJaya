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

async function fixDriver() {
  console.log('Fetching driver...');
  const { data: drivers, error: errDrivers } = await supabase
    .from('users')
    .select('id, nama')
    .eq('role', 'pengemudi');
  
  if (errDrivers || !drivers || drivers.length === 0) {
    console.error('Error fetching driver or no driver found:', errDrivers);
    return;
  }

  const defaultDriverId = drivers[0].id;
  const defaultDriverName = drivers[0].nama;
  console.log(`Using default driver: ${defaultDriverName} (${defaultDriverId})`);

  console.log('Fetching shipments with NULL id_pengemudi...');
  const { data: shipments, error: errShip } = await supabase
    .from('pengiriman')
    .select('id, status')
    .is('id_pengemudi', null);

  if (errShip) {
    console.error('Error fetching shipments:', errShip);
    return;
  }

  console.log(`Found ${shipments.length} shipments to update.`);

  for (const s of shipments) {
    console.log(`Updating shipment ${s.id} with driver...`);
    const { error: errUpdate } = await supabase
      .from('pengiriman')
      .update({ id_pengemudi: defaultDriverId })
      .eq('id', s.id);
    
    if (errUpdate) {
      console.error(`Failed to update shipment ${s.id}:`, errUpdate);
    } else {
      console.log(`Successfully updated shipment ${s.id}`);
    }
  }
}

fixDriver();
