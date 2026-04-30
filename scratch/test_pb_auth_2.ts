import PocketBase from 'pocketbase';

const PB_URL = 'https://pb.afrigini.com';
const email = 'obinnanwachuya@gmail.com';
const password = 'Radegast87#';

async function test() {
  const pb = new PocketBase(PB_URL);
  try {
    console.log('Testing _superusers auth...');
    const authData = await pb.collection('_superusers').authWithPassword(email, password);
    console.log('Success! Token:', pb.authStore.token.substring(0, 10) + '...');
    console.log('Auth data collection:', authData.record.collectionName);
  } catch (err: any) {
    console.log('Failed _superusers auth:', err.message);
  }
}

test();
