import pb from '@/lib/pocketbase';
import type {
  CandidateProfileRecord,
  DepartmentRecord,
  JobApplicationRecord,
  JobInvitationRecord,
  JobRecord,
  OrganizationRecord,
} from '@/types';

function unique(values: Array<string | null | undefined>): string[] {
  const result: string[] = [];

  values.forEach((value) => {
    if (value && !result.includes(value)) {
      result.push(value);
    }
  });

  return result;
}

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildOrFilter(field: string, values: string[]): string {
  return values.map((value) => `${field} = "${escapeFilterValue(value)}"`).join(' || ');
}

async function fetchByIds<T extends { id: string }>(
  collection: string,
  ids: Array<string | null | undefined>,
  sort = ''
): Promise<T[]> {
  const normalizedIds = unique(ids);

  if (normalizedIds.length === 0) {
    return [];
  }

  return await pb.collection(collection).getFullList<T>({
    filter: `(${buildOrFilter('id', normalizedIds)})`,
    ...(sort ? { sort } : {}),
    requestKey: null,
  });
}

export async function fetchCandidateProfilesByUserIds(
  userIds: Array<string | null | undefined>
): Promise<Map<string, CandidateProfileRecord>> {
  const normalizedUserIds = unique(userIds);

  if (normalizedUserIds.length === 0) {
    return new Map();
  }

  const profiles = await pb.collection('candidates').getFullList<CandidateProfileRecord>({
    filter: `(${buildOrFilter('user', normalizedUserIds)})`,
    requestKey: null,
  });

  return new Map(profiles.map((profile) => [profile.user, profile]));
}

export async function hydrateJobs<T extends JobRecord>(jobs: T[]): Promise<T[]> {
  if (jobs.length === 0) {
    return jobs;
  }

  const getDepartmentIds = (department?: string | string[]): string[] => {
    if (Array.isArray(department)) {
      return department;
    }

    return department ? [department] : [];
  };

  let orgsById = new Map<string, OrganizationRecord>();
  try {
    const orgs = await fetchByIds<OrganizationRecord>(
      'orgs',
      jobs.map((job) => job.organization)
    );
    orgsById = new Map(orgs.map((organization) => [organization.id, organization]));
  } catch {
    // Candidate-facing pages can't read orgs with the current schema.
  }

  const departments = await fetchByIds<DepartmentRecord>(
    'departments',
    jobs.flatMap((job) => getDepartmentIds(job.department)),
    'department'
  );
  const departmentsById = new Map(departments.map((department) => [department.id, department]));

  return jobs.map((job) => ({
    ...job,
      expand: {
        ...job.expand,
        organization: orgsById.get(job.organization),
        department: getDepartmentIds(job.department)
          .map((departmentId) => departmentsById.get(departmentId))
          .filter((department): department is DepartmentRecord => Boolean(department)),
      },
    }));
}

export async function hydrateApplications<T extends JobApplicationRecord>(applications: T[]): Promise<T[]> {
  if (applications.length === 0) {
    return applications;
  }

  const jobs = await fetchByIds<JobRecord>(
    'jobs',
    applications.map((application) => application.job)
  );
  const hydratedJobs = await hydrateJobs(jobs);
  const jobsById = new Map(hydratedJobs.map((job) => [job.id, job]));

  const applicantsByUserId = await fetchCandidateProfilesByUserIds(
    applications.map((application) => application.applicant)
  );

  return applications.map((application) => ({
    ...application,
    expand: {
      ...application.expand,
      job: jobsById.get(application.job),
      applicant: applicantsByUserId.get(application.applicant),
    },
  }));
}

export async function hydrateJobInvitations<T extends JobInvitationRecord>(invitations: T[]): Promise<T[]> {
  if (invitations.length === 0) {
    return invitations;
  }

  const jobs = await fetchByIds<JobRecord>(
    'jobs',
    invitations.map((invitation) => invitation.job)
  );
  const hydratedJobs = await hydrateJobs(jobs);
  const jobsById = new Map(hydratedJobs.map((job) => [job.id, job]));

  let orgsById = new Map<string, OrganizationRecord>();
  try {
    const orgs = await fetchByIds<OrganizationRecord>(
      'orgs',
      invitations.map((invitation) => invitation.organization)
    );
    orgsById = new Map(orgs.map((organization) => [organization.id, organization]));
  } catch {
    // Candidate-facing pages can't read orgs with the current schema.
  }

  return invitations.map((invitation) => ({
    ...invitation,
    expand: {
      ...invitation.expand,
      job: invitation.job ? jobsById.get(invitation.job) : undefined,
      organization: invitation.organization
        ? orgsById.get(invitation.organization)
        : undefined,
    },
  }));
}

export function buildIdEqualsFilter(field: string, ids: string[]): string {
  const normalizedIds = unique(ids);
  return normalizedIds.length > 0 ? `(${buildOrFilter(field, normalizedIds)})` : '';
}
