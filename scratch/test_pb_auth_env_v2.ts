import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const envVars = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [key, ...val] = line.split('=');
      return [key.trim(), val.join('=').trim()];
    })
);

const PB_URL = envVars.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.afrigini.com';
const email = envVars.POCKETBASE_ADMIN_EMAIL;
const password = envVars.POCKETBASE_ADMIN_PASSWORD;

async function test() {
  console.log('Testing with email:', email);
  console.log('Testing with password:', password ? '********' : 'MISSING');
  
  if (!email || !password) {
    console.log('Error: Missing credentials in .env');
    return;
  }

  const pb = new PocketBase(PB_URL);
  try {
    console.log('Testing _superusers auth...');
    const authData = await pb.collection('_superusers').authWithPassword(email, password);
    console.log('Success! Token:', pb.authStore.token.substring(0, 10) + '...');
    console.log('Auth data collection:', authData.record.collectionName);
  } catch (err: any) {
    console.log('Failed _superusers auth:', err.message);
    console.log('Response data:', JSON.stringify(err.data, null, 2));
  }
}

test();
