'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import {
  CandidateProfileRecord,
  DepartmentRecord,
  JobApplicationRecord,
  JobRecord,
  UserRecord,
} from '@/types';
import { canReviewApplications, getDefaultOrgPath } from '@/lib/access';
import { getCurrentOrgMembership } from '@/lib/org-membership';
import { buildIdEqualsFilter, hydrateApplications } from '@/lib/pb-hydration';
import { formatCandidateFullName } from '@/lib/candidate-name';

const PER_PAGE = 10;
const STAGE_OPTIONS: JobApplicationRecord['stage'][] = [
  'Applied',
  'Review',
  'Invited',
  'Send Video',
  'Interview',
  'Rejected',
  'Accepted',
  'Completed',
];
const TYPE_OPTIONS: Array<NonNullable<JobRecord['type']>> = ['Full Time', 'Part Time', 'Contract'];
const SORT_OPTIONS = [
  { label: 'Newest applied', value: '-created' },
  { label: 'Oldest applied', value: 'created' },
  { label: 'Recently updated', value: '-updated' },
  { label: 'Oldest updated', value: 'updated' },
] as const;
const DEFAULT_SORT = '-created';

type ApplicationRecord = JobApplicationRecord & {
  expand?: {
    job?: JobRecord;
    applicant?: CandidateProfileRecord;
  };
};

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildOrFilter(field: string, values: string[]): string {
  return values
    .map((value) => `${field} = "${escapeFilterValue(value)}"`)
    .join(' || ');
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]['value']>(DEFAULT_SORT);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const user = pb.authStore.model as unknown as UserRecord;
        if (!user) {
          router.replace('/login');
          return;
        }

        const memberRes = await getCurrentOrgMembership(user.id);

        if (memberRes?.role && !canReviewApplications(memberRes.role)) {
          router.replace(getDefaultOrgPath(memberRes.role));
          return;
        }

        const deptRes = await pb.collection('departments').getFullList({
          sort: 'department',
          requestKey: null,
        });
        setDepartments(deptRes as unknown as DepartmentRecord[]);

        if (memberRes?.organization) {
          setOrgId(memberRes.organization);
        }
      } catch (err) {
        console.error('Error initializing applications page:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    const fetchApplications = async () => {
      setLoading(true);
      try {
        const jobBaseConstraints = [`organization = "${escapeFilterValue(orgId)}"`];

        if (selectedTypes.length > 0) {
          jobBaseConstraints.push(`(${buildOrFilter('type', selectedTypes)})`);
        }

        if (selectedDepartments.length > 0) {
          jobBaseConstraints.push(`(${buildOrFilter('department', selectedDepartments)})`);
        }

        const baseJobs = await pb.collection('jobs').getFullList({
          filter: jobBaseConstraints.join(' && '),
          fields: 'id',
          requestKey: null,
        });
        const baseJobIds = baseJobs.map((job: any) => job.id);
        const baseJobFilter = buildIdEqualsFilter('job', baseJobIds);

        if (!baseJobFilter) {
          setApplications([]);
          setTotalPages(0);
          setTotalItems(0);
          return;
        }

        const applicationConstraints = [baseJobFilter];

        if (selectedStages.length > 0) {
          applicationConstraints.push(`(${buildOrFilter('stage', selectedStages)})`);
        }

        const trimmedSearch = searchTerm.trim();
        if (trimmedSearch) {
          const escapedQuery = escapeFilterValue(trimmedSearch);

          const roleJobs = await pb.collection('jobs').getFullList({
            filter: `${jobBaseConstraints.join(' && ')} && (role ~ "${escapedQuery}")`,
            fields: 'id',
            requestKey: null,
          });
          const roleJobIds = roleJobs.map((job: any) => job.id);
          const roleJobFilter = buildIdEqualsFilter('job', roleJobIds);

          const matchedProfiles = await pb.collection('candidates').getFullList({
            filter: `firstName ~ "${escapedQuery}" || lastName ~ "${escapedQuery}" || headline ~ "${escapedQuery}"`,
            fields: 'user',
            requestKey: null,
          });
          const matchedApplicantIds = matchedProfiles
            .map((profile: any) => profile.user)
            .filter(Boolean);
          const applicantFilter = buildIdEqualsFilter('applicant', matchedApplicantIds);

          const searchBranches = [roleJobFilter, applicantFilter].filter(Boolean);

          if (searchBranches.length === 0) {
            setApplications([]);
            setTotalPages(0);
            setTotalItems(0);
            return;
          }

          applicationConstraints.push(`(${searchBranches.join(' || ')})`);
        }

        const result = await pb.collection('applications').getList(page, PER_PAGE, {
          filter: applicationConstraints.join(' && '),
          sort: sortBy,
          requestKey: null,
        });

        setApplications(
          await hydrateApplications(result.items as unknown as JobApplicationRecord[]) as ApplicationRecord[]
        );
        setTotalPages(result.totalPages);
        setTotalItems(result.totalItems);
      } catch (err) {
        console.error('Error fetching applications:', err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchApplications, 300);
    return () => clearTimeout(timeoutId);
  }, [orgId, page, searchTerm, selectedStages, selectedTypes, selectedDepartments, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedStages, selectedTypes, selectedDepartments, sortBy]);

  useEffect(() => {
    applications.forEach((application) => {
      router.prefetch(`/org/applications/${application.id}`);
    });
  }, [applications, router]);

  const toggleSelection = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => (
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    ));
  };

  const getStatusColor = (stage: string) => {
    switch (stage) {
      case 'Applied': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'Review': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Invited': return 'bg-brand-green/10 text-brand-green border-brand-green/20';
      case 'Send Video': return 'bg-brand-green/10 text-brand-green border-brand-green/20';
      case 'Interview': return 'bg-brand-green/10 text-brand-green border-brand-green/20';
      case 'Rejected': return 'bg-red-50 text-red-700 border-red-100';
      case 'Accepted': return 'bg-green-50 text-green-700 border-green-100';
      case 'Completed': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedStages.length ||
    selectedTypes.length ||
    selectedDepartments.length ||
    sortBy !== DEFAULT_SORT
  );
  const activeFilterCount = selectedStages.length + selectedTypes.length + selectedDepartments.length;

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStages([]);
    setSelectedTypes([]);
    setSelectedDepartments([]);
    setSortBy(DEFAULT_SORT);
    setPage(1);
  };

  const formatDate = (value: string) => new Date(value).toLocaleDateString();

  const renderFilterGroup = (
    label: string,
    options: Array<{ label: string; value: string }>,
    selected: string[],
    onToggle: (value: string) => void
  ) => (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</h3>
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-3 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  if (loading && !orgId) {
    return <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">Loading applications...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-brand-green font-bold tracking-[0.2em] uppercase text-xs">Hiring</span>
          <h1 className="mt-2 text-3xl font-bold text-brand-dark">Applications</h1>
          <p className="text-gray-500 mt-1">Manage and track candidates for your open roles.</p>
        </div>
      </div>

      {!!orgId && (
        <div className="rounded-2xl border border-brand-green/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Search</label>
              <input
                type="text"
                placeholder="Search candidate or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 outline-none transition-all focus:border-brand-green focus:ring-2 focus:ring-brand-green"
              />
              <svg className="absolute left-3 top-[46px] h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="w-full lg:w-64">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Sort by</label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as (typeof SORT_OPTIONS)[number]['value'])}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-12 text-gray-900 outline-none transition-all focus:border-brand-green focus:ring-2 focus:ring-brand-green"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-xl border border-brand-green/10 bg-brand-green/5 px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-brand-dark">Filters</p>
                <p className="text-xs text-gray-500">
                  {activeFilterCount > 0 ? `${activeFilterCount} selected` : 'Stage, type, department'}
                </p>
              </div>
              <svg className={`h-5 w-5 text-brand-green transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFilters && (
              <div className="mt-4 grid grid-cols-1 gap-5 rounded-xl border border-brand-green/10 bg-brand-green/5 p-4 md:grid-cols-3 md:gap-6">
                {renderFilterGroup(
                  'Stage',
                  STAGE_OPTIONS.map((option) => ({ label: option, value: option })),
                  selectedStages,
                  (value) => toggleSelection(value, setSelectedStages)
                )}
                {renderFilterGroup(
                  'Type',
                  TYPE_OPTIONS.map((option) => ({ label: option, value: option })),
                  selectedTypes,
                  (value) => toggleSelection(value, setSelectedTypes)
                )}
                {renderFilterGroup(
                  'Department',
                  departments.map((department) => ({ label: department.department, value: department.id })),
                  selectedDepartments,
                  (value) => toggleSelection(value, setSelectedDepartments)
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-brand-green/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-brand-dark">{totalItems}</span>{' '}
              applications{hasActiveFilters ? ' matching current filters' : ''}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="bg-white border border-brand-green/10 rounded-2xl p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-green/10 bg-brand-green/5 text-brand-green">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-gray-500">
            {hasActiveFilters ? 'No applications found matching your criteria.' : 'No applications received yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-brand-green/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="space-y-4 bg-brand-green/5 p-4 md:hidden">
              {applications.map((app) => {
                const applicant = app.expand?.applicant;
                const job = app.expand?.job;
                const fullName = applicant
                  ? formatCandidateFullName(applicant.firstName, applicant.lastName, 'Unknown User')
                  : 'Unknown User';

                return (
                  <div key={app.id} className="space-y-4 rounded-2xl border border-brand-green/15 bg-white p-5 shadow-sm transition-all hover:border-brand-green/30 hover:shadow-md">
                    <Link href={`/org/applications/${app.id}`} className="block space-y-4 focus:outline-none focus:ring-2 focus:ring-brand-green rounded-xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-brand-dark">{fullName}</h3>
                          <p className="mt-1 text-sm text-gray-500">{applicant?.headline || 'No headline'}</p>
                        </div>
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(app.stage)}`}>
                          {app.stage}
                        </span>
                      </div>

                      <div className="rounded-xl border border-brand-green/10 bg-brand-green/5 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Applied For</p>
                        <p className="mt-1 text-sm font-medium text-brand-dark">{job?.role || 'Unknown Job'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-brand-green/10 bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Applied</p>
                          <p className="mt-1 text-sm font-medium text-brand-dark">{formatDate(app.created)}</p>
                        </div>
                        <div className="rounded-xl border border-brand-green/10 bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Updated</p>
                          <p className="mt-1 text-sm font-medium text-brand-dark">{formatDate(app.updated)}</p>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 text-sm font-medium text-brand-green">
                        <span>Review application</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-green/5 border-b border-brand-green/10">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-700">Candidate</th>
                    <th className="px-6 py-4 font-semibold text-gray-700">Applied For</th>
                    <th className="px-6 py-4 font-semibold text-gray-700">Stage</th>
                    <th className="px-6 py-4 font-semibold text-gray-700">Updated</th>
                    <th className="px-6 py-4 font-semibold text-gray-700">Applied</th>
                    <th className="px-6 py-4 font-semibold text-gray-700 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-green/10">
                  {applications.map((app) => {
                    const applicant = app.expand?.applicant;
                    const job = app.expand?.job;
                    const fullName = applicant
                      ? formatCandidateFullName(applicant.firstName, applicant.lastName, 'Unknown User')
                      : 'Unknown User';

                    return (
                      <tr key={app.id} className="hover:bg-brand-green/5 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/org/applications/${app.id}`} className="block -mx-6 -my-4 px-6 py-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-green">
                            <div className="font-medium text-brand-dark">{fullName}</div>
                            <div className="text-xs text-gray-500">{applicant?.headline || 'No headline'}</div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <Link href={`/org/applications/${app.id}`} className="block -mx-6 -my-4 px-6 py-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-green">
                            {job?.role || 'Unknown Job'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/org/applications/${app.id}`} className="block -mx-6 -my-4 px-6 py-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-green">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(app.stage)}`}>
                              {app.stage}
                            </span>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          <Link href={`/org/applications/${app.id}`} className="block -mx-6 -my-4 px-6 py-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-green">
                            {formatDate(app.updated)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          <Link href={`/org/applications/${app.id}`} className="block -mx-6 -my-4 px-6 py-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-green">
                            {formatDate(app.created)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/org/applications/${app.id}`}
                            className="text-brand-green hover:text-green-800 font-medium"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
              >
                Previous
              </button>
              <span className="text-sm font-medium text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
