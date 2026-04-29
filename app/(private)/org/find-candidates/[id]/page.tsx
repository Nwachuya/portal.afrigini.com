'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import { CandidateProfileRecord, JobRecord, UserRecord } from '@/types';
import { canBrowseCandidates, canInviteCandidates, getDefaultOrgPath } from '@/lib/access';
import { getCurrentOrgMembership } from '@/lib/org-membership';
import { formatCandidateFullName } from '@/lib/candidate-name';

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Unknown';
}

function toArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function toObjectArray<T extends Record<string, any>>(value: any): T[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === 'object');
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && typeof item === 'object');
      }
    } catch {
      return [];
    }
  }

  return [];
}

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const candidateId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [candidate, setCandidate] = useState<CandidateProfileRecord | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [myJobs, setMyJobs] = useState<JobRecord[]>([]);
  const [eligibleJobs, setEligibleJobs] = useState<JobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [error, setError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const canInvite = canInviteCandidates(orgRole);

  useEffect(() => {
    let isActive = true;

    const init = async () => {
      try {
        const user = pb.authStore.model as unknown as UserRecord;
        if (!user) {
          router.replace('/login');
          return;
        }

        if (!candidateId) {
          setError('Candidate profile not found.');
          return;
        }

        const memberRes = await getCurrentOrgMembership(user.id);
        if (!isActive) {
          return;
        }

        if (!memberRes?.organization) {
          setError('You need an organization membership to access this candidate.');
          return;
        }

        if (!canBrowseCandidates(memberRes.role)) {
          router.replace(getDefaultOrgPath(memberRes.role));
          return;
        }

        setOrgRole(memberRes.role || null);
        setOrgId(memberRes.organization);

        const [candidateRes, jobsRes] = await Promise.all([
          pb.collection('candidates').getOne(candidateId, {
            requestKey: null,
          }),
          canInviteCandidates(memberRes.role)
            ? pb.collection('jobs').getFullList({
                filter: `organization = "${escapeFilterValue(memberRes.organization)}" && stage = "Open"`,
                sort: '-updated',
                requestKey: null,
              })
            : Promise.resolve([]),
        ]);

        if (!isActive) {
          return;
        }

        setCandidate(candidateRes as unknown as CandidateProfileRecord);
        setMyJobs(jobsRes as unknown as JobRecord[]);
        setError('');
      } catch (err) {
        console.error('Error loading candidate detail:', err);
        if (isActive) {
          setError('Failed to load candidate details.');
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
  }, [candidateId, router]);

  useEffect(() => {
    let isActive = true;

    const checkEligibility = async () => {
      if (!candidate || !orgId || !canInvite) {
        return;
      }

      setCheckingEligibility(true);
      try {
        const [existingApps, existingInvites] = await Promise.all([
          pb.collection('applications').getFullList({
            filter: `applicant = "${escapeFilterValue(candidate.user)}"`,
            fields: 'job',
            requestKey: null,
          }),
          pb.collection('job_invites').getFullList({
            filter: `candidate_profile = "${escapeFilterValue(candidate.id)}"`,
            fields: 'job',
            requestKey: null,
          }),
        ]);

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
        console.error('Error checking invite eligibility:', err);
      } finally {
        if (isActive) {
          setCheckingEligibility(false);
        }
      }
    };

    checkEligibility();

    return () => {
      isActive = false;
    };
  }, [candidate, canInvite, myJobs, orgId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !orgId || !selectedJobId || !canInvite) {
      return;
    }

    setSendingInvite(true);
    setInviteError('');

    try {
      await pb.collection('job_invites').create({
        organization: orgId,
        job: selectedJobId,
        profile: candidate.id,
        message: inviteMessage || `We think you'd be a great fit for this role!`,
        status: 'pending',
      });

      setInviteSuccess(
        `Invitation sent to ${formatCandidateFullName(candidate.firstName, candidate.lastName, 'this candidate')}!`
      );
    } catch (err: any) {
      console.error('Invite failed:', err);
      setInviteError(err?.message || 'Failed to send invitation.');
    } finally {
      setSendingInvite(false);
    }
  };

  const fullName = formatCandidateFullName(candidate?.firstName, candidate?.lastName, 'Unnamed Candidate');
  const skillTags = useMemo(() => toArray(candidate?.skills), [candidate?.skills]);
  const languageTags = useMemo(() => toArray(candidate?.languages), [candidate?.languages]);
  const workExperience = useMemo(() => toObjectArray<any>(candidate?.work_experience), [candidate?.work_experience]);
  const education = useMemo(() => toObjectArray<any>(candidate?.education), [candidate?.education]);
  const certifications = useMemo(() => toObjectArray<any>(candidate?.certifications), [candidate?.certifications]);
  const hasResume = Boolean(candidate?.resume || candidate?.resume_generated_pdf);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">Loading candidate...</div>;
  }

  if (error || !candidate) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="text-2xl font-bold text-red-800">Candidate Unavailable</h1>
          <p className="mt-2">{error || 'Candidate profile could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link href="/org/find-candidates" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-dark">
        <span aria-hidden="true">←</span>
        Back to Find Candidates
      </Link>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-green-100 bg-green-50 text-2xl font-bold text-brand-green">
                  {`${candidate.firstName?.[0] || ''}${candidate.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                </div>
                <div>
                  <span className="text-brand-green font-bold tracking-[0.2em] uppercase text-xs">Candidate</span>
                  <h1 className="mt-2 text-3xl font-bold text-brand-dark">{fullName}</h1>
                  <p className="mt-2 text-gray-500">{candidate.headline || 'No headline provided'}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-gray-500">
                    <span className="rounded-full bg-brand-green/10 px-3 py-1 text-brand-green">Open to work</span>
                    <span className="rounded-full bg-gray-100 px-3 py-1">{candidate.country || 'Location not specified'}</span>
                    <span className="rounded-full bg-gray-100 px-3 py-1">Updated {formatDate(candidate.updated)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={candidate.linkedin || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${candidate.linkedin ? 'border-brand-green/20 text-brand-green hover:bg-green-50' : 'cursor-not-allowed border-gray-200 text-gray-400'}`}
                >
                  LinkedIn
                </a>
                <a
                  href={candidate.portfolio || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${candidate.portfolio ? 'border-brand-green/20 text-brand-green hover:bg-green-50' : 'cursor-not-allowed border-gray-200 text-gray-400'}`}
                >
                  Portfolio
                </a>
              </div>
            </div>

            {skillTags.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Skills</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {skillTags.map((skill) => (
                    <span key={skill} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {candidate.bio && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h2 className="text-xl font-bold text-brand-dark">About</h2>
                <p className="mt-3 whitespace-pre-wrap text-gray-600">{candidate.bio}</p>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-dark">Profile Snapshot</h2>
              <dl className="mt-4 space-y-3 text-sm text-gray-600">
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-brand-dark">Country</dt>
                  <dd>{candidate.country || 'Not specified'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-brand-dark">Level</dt>
                  <dd>{candidate.level || 'Not specified'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-brand-dark">Resume</dt>
                  <dd>{hasResume ? 'Available' : 'Not available'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-brand-dark">Portfolio</dt>
                  <dd>{candidate.portfolio ? 'Available' : 'Not available'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-brand-dark">LinkedIn</dt>
                  <dd>{candidate.linkedin ? 'Available' : 'Not available'}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-dark">Languages</h2>
              {languageTags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {languageTags.map((language) => (
                    <span key={language} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600">
                      {language}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No languages listed.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-brand-dark">Work Experience</h2>
            {workExperience.length > 0 ? (
              <div className="mt-4 space-y-4">
                {workExperience.map((item, index) => (
                  <div key={`${item.role || 'role'}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <h3 className="font-semibold text-brand-dark">{item.role || 'Role not specified'}</h3>
                    <p className="text-sm text-gray-500">{item.company || 'Company not specified'}</p>
                    {(item.startDate || item.endDate) && (
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-gray-400">
                        {item.startDate || 'Unknown'} - {item.isCurrent ? 'Present' : (item.endDate || 'Unknown')}
                      </p>
                    )}
                    {item.description && <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{item.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No work experience listed.</p>
            )}
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-dark">Education</h2>
              {education.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {education.map((item, index) => (
                    <div key={`${item.school || 'school'}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <h3 className="font-semibold text-brand-dark">{item.school || 'School not specified'}</h3>
                      <p className="text-sm text-gray-500">{item.degree || 'Degree not specified'}{item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ''}</p>
                      {item.description && <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{item.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No education listed.</p>
              )}
            </div>

            <div className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-dark">Certifications</h2>
              {certifications.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {certifications.map((item, index) => (
                    <div key={`${item.name || 'cert'}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <h3 className="font-semibold text-brand-dark">{item.name || 'Certification not specified'}</h3>
                      <p className="text-sm text-gray-500">{item.issuer || 'Issuer not specified'}</p>
                      {item.credentialUrl && (
                        <a
                          href={item.credentialUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-sm font-medium text-brand-green hover:text-green-800"
                        >
                          View credential
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No certifications listed.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-brand-dark">Invite to Apply</h2>
            <p className="mt-2 text-sm text-gray-500">
              Invite this candidate to one of your open roles.
            </p>

            {!canInvite && (
              <div className="mt-4 rounded-xl border border-brand-green/10 bg-brand-green/5 p-4 text-sm text-brand-dark">
                Your current organization role can review candidate profiles, but it cannot send invitations.
              </div>
            )}

            {inviteSuccess && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {inviteSuccess}
              </div>
            )}

            {inviteError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Eligible job</label>
                {checkingEligibility ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    Checking eligible jobs...
                  </div>
                ) : eligibleJobs.length > 0 ? (
                  <div className="relative">
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      disabled={!canInvite}
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-12 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green disabled:cursor-not-allowed disabled:bg-gray-50"
                    >
                      {eligibleJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.role}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                      <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                    No eligible open jobs are available for this candidate right now.
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Message (Optional)</label>
                <textarea
                  rows={5}
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Hi, we think you'd be a strong fit for this role..."
                  disabled={!canInvite}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green disabled:cursor-not-allowed disabled:bg-gray-50"
                />
              </div>

              <button
                type="submit"
                disabled={!canInvite || sendingInvite || eligibleJobs.length === 0 || !selectedJobId}
                className="w-full rounded-lg bg-brand-green px-4 py-3 font-bold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingInvite ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-brand-dark">Profile Links</h2>
            <div className="mt-4 space-y-3">
              <a
                href={candidate.linkedin || undefined}
                target="_blank"
                rel="noreferrer"
                className={`block rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${candidate.linkedin ? 'border-brand-green/20 text-brand-green hover:bg-green-50' : 'cursor-not-allowed border-gray-200 text-gray-400'}`}
              >
                Open LinkedIn
              </a>
              <a
                href={candidate.portfolio || undefined}
                target="_blank"
                rel="noreferrer"
                className={`block rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${candidate.portfolio ? 'border-brand-green/20 text-brand-green hover:bg-green-50' : 'cursor-not-allowed border-gray-200 text-gray-400'}`}
              >
                Open Portfolio
              </a>
              {hasResume && (
                <div className="rounded-lg border border-brand-green/10 bg-brand-green/5 px-4 py-3 text-sm text-brand-dark">
                  Resume information is available on the profile record.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
