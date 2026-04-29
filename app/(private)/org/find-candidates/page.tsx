'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import { CandidateProfileRecord, JobRecord, UserRecord } from '@/types';
import { canBrowseCandidates, canInviteCandidates, getDefaultOrgPath } from '@/lib/access';
import { getCurrentOrgMembership } from '@/lib/org-membership';
import { formatCandidateFullName } from '@/lib/candidate-name';

const PER_PAGE = 15;
const SORT_OPTIONS = [
  { label: 'Recently updated', value: '-updated' },
  { label: 'Oldest updated', value: 'updated' },
  { label: 'Newest profiles', value: '-created' },
  { label: 'Oldest profiles', value: 'created' },
] as const;
const DEFAULT_SORT = '-updated';

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Unknown';
}

function getCandidateInitials(candidate: CandidateProfileRecord) {
  return `${candidate.firstName?.[0] || ''}${candidate.lastName?.[0] || ''}`.toUpperCase() || 'U';
}

function getSkillTags(skills: CandidateProfileRecord['skills']) {
  if (Array.isArray(skills)) {
    return skills.map((skill) => String(skill).trim()).filter(Boolean);
  }

  if (typeof skills === 'string') {
    return skills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);
  }

  return [];
}

function buildCandidateFilter({
  searchTerm,
  locationFilter,
  hasResumeOnly,
  hasPortfolioOnly,
  hasLinkedInOnly,
}: {
  searchTerm: string;
  locationFilter: string;
  hasResumeOnly: boolean;
  hasPortfolioOnly: boolean;
  hasLinkedInOnly: boolean;
}) {
  const constraints = ['is_open_to_work = true'];

  if (searchTerm.trim()) {
    const query = escapeFilterValue(searchTerm.trim());
    constraints.push(
      `(firstName ~ "${query}" || lastName ~ "${query}" || headline ~ "${query}" || skills ~ "${query}")`
    );
  }

  if (locationFilter.trim()) {
    const location = escapeFilterValue(locationFilter.trim());
    constraints.push(`country ~ "${location}"`);
  }

  if (hasResumeOnly) {
    constraints.push(`(resume != "" || resume_generated_pdf != "")`);
  }

  if (hasPortfolioOnly) {
    constraints.push(`portfolio != ""`);
  }

  if (hasLinkedInOnly) {
    constraints.push(`linkedin != ""`);
  }

  return constraints.join(' && ');
}

export default function FindCandidatesPage() {
  const router = useRouter();

  const [candidates, setCandidates] = useState<CandidateProfileRecord[]>([]);
  const [myJobs, setMyJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]['value']>(DEFAULT_SORT);
  const [showFilters, setShowFilters] = useState(false);
  const [hasResumeOnly, setHasResumeOnly] = useState(false);
  const [hasPortfolioOnly, setHasPortfolioOnly] = useState(false);
  const [hasLinkedInOnly, setHasLinkedInOnly] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canInvite, setCanInvite] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfileRecord | null>(null);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibleJobs, setEligibleJobs] = useState<JobRecord[]>([]);

  useEffect(() => {
    let isActive = true;

    const init = async () => {
      try {
        const user = pb.authStore.model as unknown as UserRecord;
        if (!user) {
          router.replace('/login');
          return;
        }

        if (user.role === 'Applicant') {
          router.replace('/candidates/applicant');
          return;
        }

        const memberRes = await getCurrentOrgMembership(user.id);
        if (!isActive) {
          return;
        }

        if (!memberRes?.organization) {
          setAccessError('You need an organization membership to access the candidate directory.');
          setLoading(false);
          return;
        }

        if (!canBrowseCandidates(memberRes.role)) {
          router.replace(getDefaultOrgPath(memberRes.role));
          return;
        }

        setOrgId(memberRes.organization);

        const memberCanInvite = canInviteCandidates(memberRes.role);
        setCanInvite(memberCanInvite);

        if (memberCanInvite) {
          const jobsRes = await pb.collection('jobs').getFullList({
            filter: `organization = "${escapeFilterValue(memberRes.organization)}" && stage = "Open"`,
            sort: '-updated',
            requestKey: null,
          });

          if (!isActive) {
            return;
          }

          setMyJobs(jobsRes as unknown as JobRecord[]);
        }
      } catch (err) {
        console.error('Error loading init data:', err);
        if (isActive) {
          setAccessError('Unable to load candidate directory access for your account.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!orgId || accessError) {
      return;
    }

    let isActive = true;

    const fetchCandidates = async () => {
      setLoading(true);
      try {
        const result = await pb.collection('candidates').getList(page, PER_PAGE, {
          filter: buildCandidateFilter({
            searchTerm,
            locationFilter,
            hasResumeOnly,
            hasPortfolioOnly,
            hasLinkedInOnly,
          }),
          sort: sortBy,
          requestKey: null,
        });

        if (!isActive) {
          return;
        }

        setCandidates(result.items as unknown as CandidateProfileRecord[]);
        setTotalItems(result.totalItems);
        setTotalPages(result.totalPages);
      } catch (err) {
        console.error('Error fetching candidates:', err);
        if (isActive) {
          setCandidates([]);
          setTotalItems(0);
          setTotalPages(0);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchCandidates, 300);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [accessError, hasLinkedInOnly, hasPortfolioOnly, hasResumeOnly, locationFilter, orgId, page, searchTerm, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, locationFilter, hasResumeOnly, hasPortfolioOnly, hasLinkedInOnly, sortBy]);

  useEffect(() => {
    candidates.forEach((candidate) => {
      router.prefetch(`/org/find-candidates/${candidate.id}`);
    });
  }, [candidates, router]);

  useEffect(() => {
    let isActive = true;

    const checkEligibility = async () => {
      if (!selectedCandidate || !orgId) {
        return;
      }

      setCheckingEligibility(true);
      setEligibleJobs([]);

      try {
        const existingApps = await pb.collection('applications').getFullList({
          filter: `applicant = "${escapeFilterValue(selectedCandidate.user)}"`,
          fields: 'job',
          requestKey: null,
        });

        const existingInvites = await pb.collection('job_invites').getFullList({
          filter: `candidate_profile = "${escapeFilterValue(selectedCandidate.id)}"`,
          fields: 'job',
          requestKey: null,
        });

        if (!isActive) {
          return;
        }

        const appliedJobIds = existingApps.map((application: any) => application.job);
        const invitedJobIds = existingInvites.map((invite: any) => invite.job);

        const available = myJobs.filter(
          (job) => !appliedJobIds.includes(job.id) && !invitedJobIds.includes(job.id)
        );

        setEligibleJobs(available);
        setSelectedJobId(available[0]?.id || '');
      } catch (err) {
        console.error('Error checking candidate eligibility:', err);
        if (isActive) {
          setEligibleJobs([]);
          setSelectedJobId('');
        }
      } finally {
        if (isActive) {
          setCheckingEligibility(false);
        }
      }
    };

    if (selectedCandidate) {
      checkEligibility();
    }

    return () => {
      isActive = false;
    };
  }, [myJobs, orgId, selectedCandidate]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedJobId || !selectedCandidate || !canInvite) {
      return;
    }

    setSendingInvite(true);
    setInviteError(null);

    try {
      await pb.collection('job_invites').create({
        organization: orgId,
        job: selectedJobId,
        profile: selectedCandidate.id,
        message: inviteMessage || `We think you'd be a great fit for this role!`,
        status: 'pending',
      });

      setInviteSuccess(
        `Invitation sent to ${formatCandidateFullName(selectedCandidate.firstName, selectedCandidate.lastName, 'this candidate')}!`
      );
      setTimeout(() => {
        setInviteSuccess(null);
        setSelectedCandidate(null);
        setInviteMessage('');
        setSelectedJobId('');
      }, 2000);
    } catch (err: any) {
      console.error('Invite failed:', err);
      setInviteError(err?.message || 'Failed to send invitation.');
    } finally {
      setSendingInvite(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setLocationFilter('');
    setHasResumeOnly(false);
    setHasPortfolioOnly(false);
    setHasLinkedInOnly(false);
    setSortBy(DEFAULT_SORT);
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    locationFilter.trim() ||
    hasResumeOnly ||
    hasPortfolioOnly ||
    hasLinkedInOnly ||
    sortBy !== DEFAULT_SORT
  );
  const activeFilterCount = [locationFilter.trim(), hasResumeOnly, hasPortfolioOnly, hasLinkedInOnly]
    .filter(Boolean)
    .length;

  if (accessError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-900">
          <h1 className="text-2xl font-bold mb-2">Candidate Directory</h1>
          <p>{accessError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <span className="text-brand-green font-bold tracking-[0.2em] uppercase text-xs">Talent</span>
        <h1 className="mt-2 text-3xl font-bold text-brand-dark">Find Candidates</h1>
        <p className="text-gray-500 mt-1">Discover talent open to new opportunities.</p>
      </div>

      {!canInvite && (
        <div className="rounded-2xl border border-brand-green/10 bg-brand-green/5 p-4 text-sm text-brand-dark">
          Your current organization role can browse candidates, but it cannot send invitations.
        </div>
      )}

      {!!orgId && (
        <div className="rounded-2xl border border-brand-green/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Search</label>
              <input
                type="text"
                placeholder="Search candidate, title, or skills..."
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
                  {activeFilterCount > 0 ? `${activeFilterCount} selected` : 'Location and profile completeness'}
                </p>
              </div>
              <svg className={`h-5 w-5 text-brand-green transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFilters && (
              <div className="mt-4 grid grid-cols-1 gap-5 rounded-xl border border-brand-green/10 bg-brand-green/5 p-4 md:grid-cols-2 xl:grid-cols-4 md:gap-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Location</h3>
                  <input
                    type="text"
                    placeholder="e.g. Nigeria or Remote"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-brand-green focus:ring-2 focus:ring-brand-green"
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Profile Assets</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hasResumeOnly}
                        onChange={() => setHasResumeOnly((prev) => !prev)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                      />
                      <span>Has resume</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hasPortfolioOnly}
                        onChange={() => setHasPortfolioOnly((prev) => !prev)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                      />
                      <span>Has portfolio</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hasLinkedInOnly}
                        onChange={() => setHasLinkedInOnly((prev) => !prev)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                      />
                      <span>Has LinkedIn</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Availability</h3>
                  <p className="rounded-lg border border-brand-green/10 bg-white px-4 py-3 text-sm text-gray-600">
                    Only candidates open to work are shown.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Actions</h3>
                  <div className="rounded-lg border border-brand-green/10 bg-white px-4 py-3 text-sm text-gray-600">
                    Use the card to review a profile, or invite directly from the card.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
            <p>{totalItems} candidate{totalItems === 1 ? '' : 's'}{hasActiveFilters ? ' matching current filters' : ''}</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="font-medium text-brand-green hover:text-green-800"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-gray-500">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-brand-green"></div>
          Loading directory...
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <div className="mb-4 text-4xl">👥</div>
          <h3 className="text-lg font-bold text-brand-dark">No candidates found</h3>
          <p className="mt-2 text-gray-500">
            {hasActiveFilters ? 'Try adjusting your search or filters.' : 'There are no open-to-work candidates yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {candidates.map((candidate) => {
            const skillTags = getSkillTags(candidate.skills);
            const visibleSkillTags = skillTags.length > 2 ? [skillTags[0]] : skillTags;
            const hiddenSkillCount = skillTags.length > 2 ? skillTags.length - 1 : 0;
            const initials = getCandidateInitials(candidate);
            const fullName = formatCandidateFullName(candidate.firstName, candidate.lastName, 'Unnamed Candidate');
            const hasResume = Boolean(candidate.resume || candidate.resume_generated_pdf);
            const hasPortfolio = Boolean(candidate.portfolio);
            const hasLinkedIn = Boolean(candidate.linkedin);

            return (
              <div
                key={candidate.id}
                className="rounded-2xl border border-brand-green/10 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <Link
                  href={`/org/find-candidates/${candidate.id}`}
                  className="block rounded-t-2xl p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 flex h-14 w-14 items-center justify-center rounded-full border border-green-100 bg-green-50 text-xl font-bold text-brand-green">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 text-lg font-bold text-brand-dark break-words">{fullName}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500 break-words">{candidate.headline || 'No headline provided'}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
                    <div className="min-w-0">
                      <span className="font-medium text-brand-dark">Location:</span>{' '}
                      <span className="truncate align-bottom inline-block max-w-[calc(100%-4.75rem)]">
                        {candidate.country || 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-brand-dark">Updated:</span> {formatDate(candidate.updated)}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-xs font-semibold text-brand-green">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-green" />
                        Open
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {visibleSkillTags.map((skill) => (
                      <span
                        key={skill}
                        className="max-w-full truncate rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600"
                        title={skill}
                      >
                        {skill}
                      </span>
                    ))}
                    {hiddenSkillCount > 0 && (
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500">
                        +{hiddenSkillCount} more
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-gray-500">
                    <span className={`max-w-full truncate rounded-full px-2.5 py-1 ${hasResume ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {hasResume ? 'Resume' : 'No resume'}
                    </span>
                    <span className={`max-w-full truncate rounded-full px-2.5 py-1 ${hasPortfolio ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {hasPortfolio ? 'Portfolio' : 'No portfolio'}
                    </span>
                    <span className={`max-w-full truncate rounded-full px-2.5 py-1 ${hasLinkedIn ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {hasLinkedIn ? 'LinkedIn' : 'No LinkedIn'}
                    </span>
                  </div>

                  <div className="mt-5 text-sm font-medium text-brand-green">View candidate details</div>
                </Link>

                <div className="border-t border-gray-100 p-6 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedCandidate(candidate)}
                    disabled={!canInvite}
                    className="w-full rounded-lg border border-brand-green bg-white py-2.5 font-bold text-brand-green transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
                  >
                    {canInvite ? 'Invite to Apply' : 'Invite Unavailable'}
                  </button>
                  {!canInvite && (
                    <p className="mt-2 text-xs text-gray-500">
                      Your current role can review candidate profiles, but it cannot send invitations.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white disabled:opacity-50"
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
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl">
            {inviteSuccess ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-8 w-8 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-brand-dark">Invitation Sent!</h3>
                <p className="mt-2 text-gray-500">{inviteSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleInvite}>
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
                  <h3 className="text-lg font-bold text-brand-dark">Invite Candidate</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCandidate(null);
                      setInviteError(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 p-6">
                  <p className="text-sm text-gray-600">
                    You are inviting{' '}
                    <strong>{formatCandidateFullName(selectedCandidate.firstName, selectedCandidate.lastName, 'this candidate')}</strong>{' '}
                    to apply.
                  </p>

                  {inviteError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {inviteError}
                    </div>
                  )}

                  {checkingEligibility ? (
                    <div className="py-4 text-center text-sm text-gray-500">Checking eligible jobs...</div>
                  ) : eligibleJobs.length === 0 ? (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                      You have no open jobs available for this candidate. They may have already applied or been invited to all your open roles.
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Select Job</label>
                      <select
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green"
                      >
                        {eligibleJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.role}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">Message (Optional)</label>
                    <textarea
                      rows={3}
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      placeholder="Hi, we think your profile is impressive..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCandidate(null);
                      setInviteError(null);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingInvite || eligibleJobs.length === 0}
                    className="rounded-lg bg-brand-green px-4 py-2 font-bold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sendingInvite ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
