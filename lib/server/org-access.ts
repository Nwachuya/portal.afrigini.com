import PocketBase from 'pocketbase';
import { canAccessBilling } from '@/lib/access';

export async function assertOrgBillingAccess(
  pb: PocketBase,
  authenticatedUserId: string,
  orgId: string
): Promise<{ membershipId: string; role: string }> {
  const membership = await pb.collection('org_members').getFirstListItem(
    `user = "${authenticatedUserId}" && organization = "${orgId}"`,
    { requestKey: null }
  );

  const role = typeof membership?.role === 'string' ? membership.role : '';
  if (!role || !canAccessBilling(role)) {
    throw new Error('FORBIDDEN');
  }

  return {
    membershipId: membership.id,
    role,
  };
}

