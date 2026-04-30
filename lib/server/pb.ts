import PocketBase from 'pocketbase';

export const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.afrigini.com';

export function createUserPb(pbToken: string): PocketBase {
  const pb = new PocketBase(PB_URL);
  pb.authStore.save(pbToken, null);
  return pb;
}

export async function createAdminPb(): Promise<PocketBase> {
  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
  const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

  const logMsg = `createAdminPb: Attempting auth with ${adminEmail} (length: ${adminEmail?.length}) password length: ${adminPassword?.length}\n`;
  require('fs').appendFileSync('scratch/admin_auth_log.txt', logMsg);

  if (!adminEmail || !adminPassword) {
    throw new Error('Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD.');
  }

  const pb = new PocketBase(PB_URL);
  await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
  return pb;
}

