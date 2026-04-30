import type { UserRole } from '@/types';
import {
  canAccessBilling,
  canBrowseCandidates,
  canManageJobs,
  canManageOrganization,
  canManageTeam,
  canViewTeam,
  getDefaultDashboardPath,
  isApplicantRole,
} from '@/lib/access';

export type NavIconKey =
  | 'dashboard'
  | 'briefcase'
  | 'fileText'
  | 'user'
  | 'search'
  | 'users'
  | 'creditCard'
  | 'building2'
  | 'settings';

export interface AppNavItem {
  label: string;
  href: string;
  icon: NavIconKey;
}

export function getNavItems(
  userRole?: UserRole | null,
  orgMembershipRole?: string | null,
  candidatePaymentsEligible?: boolean
): AppNavItem[] {
  if (isApplicantRole(userRole)) {
    const items: AppNavItem[] = [
      { label: 'Dashboard', href: '/candidates/applicant', icon: 'dashboard' },
      { label: 'Jobs', href: '/candidates/jobs', icon: 'briefcase' },
      { label: 'My Applications', href: '/candidates/my-applications', icon: 'fileText' },
      { label: 'My Profile', href: '/candidates/my-profile', icon: 'user' },
      { label: 'My Placements', href: '/candidates/placements', icon: 'briefcase' },
      { label: 'Payments', href: '/candidates/payments', icon: 'creditCard' },
    ];
    items.push(
      { label: 'Resume', href: '/candidates/resume', icon: 'fileText' },
      { label: 'Settings', href: '/candidates/settings', icon: 'settings' }
    );
    return items;
  }

  const items: AppNavItem[] = [
    {
      label: 'Dashboard',
      href: getDefaultDashboardPath(userRole, orgMembershipRole),
      icon: 'dashboard',
    },
  ];

  if (canManageJobs(orgMembershipRole)) {
    items.push(
      { label: 'Manage Jobs', href: '/org/manage-jobs', icon: 'briefcase' },
      { label: 'Applications', href: '/org/applications', icon: 'fileText' }
    );
  }

  if (canBrowseCandidates(orgMembershipRole)) {
    items.push({ label: 'Find Candidates', href: '/org/find-candidates', icon: 'search' });
  }

  if (canViewTeam(orgMembershipRole)) {
    items.push({ label: 'Team', href: '/org/team', icon: 'users' });
  }

  if (canAccessBilling(orgMembershipRole)) {
    items.push({ label: 'Billing', href: '/org/billing', icon: 'creditCard' });
  }

  if (canManageOrganization(orgMembershipRole)) {
    items.push({ label: 'Organization', href: '/org/settings', icon: 'building2' });
  }

  return items;
}
