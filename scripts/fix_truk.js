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

async function fixTruk() {
  console.log('Fetching active shipments...');
  const { data: activeShipments, error: errShip } = await supabase
    .from('pengiriman')
    .select('id_truk')
    .in('status', ['jadwal', 'berangkat']);
  
  if (errShip) {
    console.error('Error fetching shipments:', errShip);
    return;
  }

  const activeTrukIds = new Set(activeShipments.map(s => s.id_truk).filter(Boolean));
  console.log('Active Truck IDs:', Array.from(activeTrukIds));

  console.log('Fetching all trucks...');
  const { data: trucks, error: errTruk } = await supabase.from('truk').select('*');
  
  if (errTruk) {
    console.error('Error fetching trucks:', errTruk);
    return;
  }

  for (const truck of trucks) {
    const shouldBeTersedia = !activeTrukIds.has(truck.id);
    if (shouldBeTersedia && truck.status === 'beroperasi') {
      console.log(`Fixing truck ${truck.plat_nomor} (${truck.id}) status from 'beroperasi' -> 'tersedia'`);
      const { error: errUpdate } = await supabase
        .from('truk')
        .update({ status: 'tersedia' })
        .eq('id', truck.id);
      
      if (errUpdate) {
        console.error(`Failed to update truck ${truck.plat_nomor}:`, errUpdate);
      } else {
        console.log(`Successfully updated truck ${truck.plat_nomor}`);
      }
    }
  }
}

fixTruk();
