import PocketBase from 'pocketbase';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.afrigini.com';
const email = process.env.POCKETBASE_ADMIN_EMAIL;
const password = process.env.POCKETBASE_ADMIN_PASSWORD;

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
    console.log('Response data:', err.data);
  }
}

test();
