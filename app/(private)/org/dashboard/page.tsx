'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import { UserRecord } from '@/types';
import Link from 'next/link';
import {
  canAccessBilling,
  canBrowseCandidates,
  canManageJobs,
  canManageOrganization,
  canViewTeam,
} from '@/lib/access';
import { getCurrentOrgMembership } from '@/lib/org-membership';
import { buildIdEqualsFilter, hydrateApplications } from '@/lib/pb-hydration';
import { formatCandidateFullName } from '@/lib/candidate-name';

export default function OrganizationDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalApplications: 0,
    totalCandidates: 0,
    interviews: 0,
  });
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!pb.authStore.isValid) {
          router.replace('/login');
          return;
        }

        const freshUser = await pb.collection('users').getOne(pb.authStore.model!.id);
        const userRecord = freshUser as unknown as UserRecord;

        if (userRecord.role === 'Applicant') {
          router.replace('/candidates/applicant');
          return;
        }

        setUser(userRecord);

        const membership = await getCurrentOrgMembership(freshUser.id, 'organization');
        setMemberRole(membership?.role ?? null);

        const id = membership?.organization ?? null;
        setOrgId(id);

        let resolvedOrgName = 'Your Company';
        if (id) {
          const expandedOrg = membership?.expand?.organization;
          if (expandedOrg?.name) {
            resolvedOrgName = expandedOrg.name;
          } else {
            try {
              const org = await pb.collection('orgs').getOne(id, {
                requestKey: null,
              });
              resolvedOrgName = org.name || resolvedOrgName;
            } catch {
            }
          }
        }
        setOrgName(resolvedOrgName);

        if (id && canManageJobs(membership?.role)) {
          const [orgJobs, recentJobsRes] = await Promise.all([
            pb.collection('jobs').getFullList({
              filter: `organization = "${id}"`,
              fields: 'id,stage',
              requestKey: null,
            }),
            pb.collection('jobs').getList(1, 3, {
              filter: `organization = "${id}" && stage = "Open"`,
              sort: '-created',
              requestKey: null,
            }),
          ]);

          const jobFilter = buildIdEqualsFilter('job', orgJobs.map((job: any) => job.id));

          const orgApplications = jobFilter
            ? await pb.collection('applications').getFullList({
                filter: jobFilter,
                sort: '-created',
                requestKey: null,
              })
            : [];

          const totalCandidates = new Set(
            orgApplications.map((application: any) => application.applicant).filter(Boolean)
          ).size;
          const interviewCount = orgApplications.filter(
            (application: any) => application.stage === 'Interview'
          ).length;

          setStats({
            activeJobs: orgJobs.filter((job: any) => job.stage === 'Open').length,
            totalApplications: orgApplications.length,
            totalCandidates,
            interviews: interviewCount,
          });
          setRecentApps(await hydrateApplications(orgApplications.slice(0, 5) as any[]));
          setRecentJobs(recentJobsRes.items);
        } else {
          setStats({
            activeJobs: 0,
            totalApplications: 0,
            totalCandidates: 0,
            interviews: 0,
          });
          setRecentApps([]);
          setRecentJobs([]);
        }
      } catch (e) {
        console.error("Error fetching dashboard data", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500">Loading dashboard...</div>;
  if (!user) return null;
  const canViewHiring = canManageJobs(memberRole);
  const canViewCandidates = canBrowseCandidates(memberRole);
  const primaryOrgLink = canManageOrganization(memberRole)
    ? '/org/settings'
    : canViewTeam(memberRole)
      ? '/org/team'
      : canAccessBilling(memberRole)
        ? '/org/billing'
        : '/org/dashboard';
  const primaryOrgLinkLabel = canManageOrganization(memberRole)
    ? 'Organization Settings'
    : canViewTeam(memberRole)
      ? 'Team Directory'
      : canAccessBilling(memberRole)
        ? 'Billing'
        : 'Organization Home';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-brand-green/10 bg-white px-6 py-7 shadow-sm">
        <div>
          <span className="text-brand-green font-bold tracking-[0.2em] uppercase text-xs">Organization</span>
          <h1 className="mt-2 text-3xl font-bold text-brand-dark">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {user.name || 'Recruiter'}. Here&apos;s what&apos;s happening at{' '}
            <span className="font-semibold text-brand-dark">{orgName}</span>.
          </p>
          {memberRole && (
            <p className="mt-3 inline-flex rounded-full border border-brand-green/15 bg-brand-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
              {memberRole}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {canViewCandidates && (
            <Link href="/org/find-candidates" className="px-4 py-2 bg-white border border-brand-green/20 text-brand-dark font-medium rounded-lg hover:bg-brand-green/5 transition-colors shadow-sm">
              Find Talent
            </Link>
          )}
          {canViewHiring && (
            <Link href="/org/manage-jobs/new" className="px-4 py-2 bg-brand-green text-white font-medium rounded-lg hover:bg-green-800 transition-colors shadow-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Post Job
            </Link>
          )}
        </div>
      </div>

      {canViewHiring ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-green/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Jobs</p>
                <p className="text-3xl font-bold text-brand-dark mt-1">{stats.activeJobs}</p>
              </div>
              <div className="p-3 bg-brand-green/10 rounded-xl text-brand-green">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-green/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Applications</p>
                <p className="text-3xl font-bold text-brand-dark mt-1">{stats.totalApplications}</p>
              </div>
              <div className="p-3 bg-brand-green/10 rounded-xl text-brand-green">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-green/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Candidates</p>
                <p className="text-3xl font-bold text-brand-dark mt-1">{stats.totalCandidates}</p>
              </div>
              <div className="p-3 bg-brand-green/10 rounded-xl text-brand-green">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-green/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Interviews</p>
                <p className="text-3xl font-bold text-brand-dark mt-1">{stats.interviews}</p>
              </div>
              <div className="p-3 bg-brand-green/10 rounded-xl text-brand-green">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-brand-dark">Recent Applications</h2>
                <Link href="/org/applications" className="text-sm text-brand-green hover:text-green-800 font-medium">View All &rarr;</Link>
              </div>

              <div className="bg-white border border-brand-green/10 rounded-2xl shadow-sm overflow-hidden">
                {recentApps.length === 0 ? (
                  <div className="p-10 text-center text-gray-500">
                    <p>No applications received yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-brand-green/5 border-b border-brand-green/10">
                      <tr>
                        <th className="px-6 py-3 font-semibold text-gray-700">Candidate</th>
                        <th className="px-6 py-3 font-semibold text-gray-700">Role</th>
                        <th className="px-6 py-3 font-semibold text-gray-700">Date</th>
                        <th className="px-6 py-3 font-semibold text-gray-700 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentApps.map((app) => {
                        const candidateName = formatCandidateFullName(
                          app.expand?.applicant?.firstName,
                          app.expand?.applicant?.lastName,
                          'Candidate'
                        );
                        const roleName = app.expand?.job?.role || 'Job opening';
                        return (
                          <tr key={app.id} className="hover:bg-brand-green/5 transition-colors">
                            <td className="px-6 py-4 text-gray-900 font-medium">{candidateName}</td>
                            <td className="px-6 py-4 text-gray-600">{roleName}</td>
                            <td className="px-6 py-4 text-gray-600">{new Date(app.created).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-right">
                              <Link href={`/org/applications/${app.id}`} className="text-brand-green hover:text-green-800 font-medium">
                                Review
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-brand-dark">Quick Links</h2>
                <div className="mt-4 space-y-3">
                  <Link href={primaryOrgLink} className="block rounded-xl border border-brand-green/10 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-brand-green/5">
                    {primaryOrgLinkLabel}
                  </Link>
                  {canViewHiring && (
                    <Link href="/org/manage-jobs" className="block rounded-xl border border-brand-green/10 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-brand-green/5">
                      Manage Jobs
                    </Link>
                  )}
                  {canViewCandidates && (
                    <Link href="/org/find-candidates" className="block rounded-xl border border-brand-green/10 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-brand-green/5">
                      Find Candidates
                    </Link>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-brand-dark">Recent Jobs</h2>
                  {canViewHiring && (
                    <Link href="/org/manage-jobs" className="text-sm text-brand-green hover:text-green-800 font-medium">
                      View All
                    </Link>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  {recentJobs.length === 0 ? (
                    <p className="text-sm text-gray-500">No open jobs yet.</p>
                  ) : (
                    recentJobs.map((job: any) => (
                      <Link
                        key={job.id}
                        href={`/org/manage-jobs/${job.id}`}
                        className="block rounded-xl border border-brand-green/10 px-4 py-3 hover:bg-brand-green/5"
                      >
                        <p className="font-medium text-brand-dark">{job.role}</p>
                        <p className="text-sm text-gray-500">{job.department || 'General'}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-brand-green/10 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold text-brand-dark">Organization Access</h2>
          <p className="mt-2 text-gray-500">
            Your current role focuses on operational access rather than hiring activity. Use the links below to manage the parts of the workspace available to you.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link href={primaryOrgLink} className="flex items-center gap-3 rounded-2xl border border-brand-green/10 p-4 text-gray-700 hover:bg-brand-green/5">
              <div className="rounded-xl bg-brand-green/10 p-3 text-brand-green">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
              </div>
              <div>
                <p className="font-medium text-brand-dark">{primaryOrgLinkLabel}</p>
                <p className="text-sm text-gray-500">Open the most relevant admin area for your role.</p>
              </div>
            </Link>

            {canAccessBilling(memberRole) && (
              <Link href="/org/billing" className="flex items-center gap-3 rounded-2xl border border-brand-green/10 p-4 text-gray-700 hover:bg-brand-green/5">
                <div className="rounded-xl bg-brand-green/10 p-3 text-brand-green">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2m-2 0h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z" /></svg>
                </div>
                <div>
                  <p className="font-medium text-brand-dark">Billing</p>
                  <p className="text-sm text-gray-500">Review credits, purchases, and receipts.</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
