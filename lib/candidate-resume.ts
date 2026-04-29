import type { CandidateProfileRecord } from '@/types';
import { formatCandidateFullName, toProperCaseNamePart } from '@/lib/candidate-name';

export type ResumeWorkExperienceItem = {
  role?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
};

export type ResumeEducationItem = {
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
};

export type ResumeCertificationItem = {
  name?: string;
  issuer?: string;
  issuedDate?: string;
  credentialId?: string;
  credentialUrl?: string;
};

function hasText(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseStringArray(value: unknown): string[] {
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

export function parseObjectArray<T extends Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is T => Boolean(item) && typeof item === 'object');
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is T => Boolean(item) && typeof item === 'object');
      }
    } catch {
      return [];
    }
  }

  return [];
}

export function getCandidateFullName(profile: CandidateProfileRecord | null): string {
  return formatCandidateFullName(profile?.firstName, profile?.lastName, 'Your Candidate Profile');
}

export function getCandidateInitials(profile: CandidateProfileRecord | null): string {
  const firstInitial = toProperCaseNamePart(profile?.firstName).charAt(0);
  const lastInitial = toProperCaseNamePart(profile?.lastName).charAt(0);
  const initials = `${firstInitial}${lastInitial}`.toUpperCase();
  return initials || 'CP';
}

export function getCandidateProfileFileUrl(
  profile: CandidateProfileRecord | null,
  fileName?: string | null
): string | null {
  if (!profile || !hasText(fileName)) {
    return null;
  }

  return `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/candidates/${profile.id}/${fileName}`;
}

export function formatDisplayDate(value?: string | null): string {
  if (!hasText(value)) {
    return 'Unknown';
  }

  const safeValue = typeof value === 'string' ? value.trim() : '';
  const date = new Date(safeValue);
  if (Number.isNaN(date.getTime())) {
    return safeValue;
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTimelineDate(value?: string | null): string {
  if (!hasText(value)) {
    return 'Unknown';
  }

  const safeValue = typeof value === 'string' ? value.trim() : '';
  const isoLikeMonth = /^\d{4}-\d{2}$/;
  if (isoLikeMonth.test(safeValue)) {
    const date = new Date(`${safeValue}-01T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
      });
    }
  }

  const date = new Date(safeValue);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
    });
  }

  return safeValue;
}

export function hasCandidatePreviewContent(profile: CandidateProfileRecord | null): boolean {
  if (!profile) {
    return false;
  }

  return Boolean(
    hasText(profile.headline) ||
    hasText(profile.bio) ||
    parseStringArray(profile.skills).length > 0 ||
    parseStringArray(profile.languages).length > 0 ||
    parseObjectArray(profile.work_experience).length > 0 ||
    parseObjectArray(profile.education).length > 0 ||
    parseObjectArray(profile.certifications).length > 0 ||
    hasText(profile.linkedin) ||
    hasText(profile.portfolio) ||
    hasText(profile.resume) ||
    hasText(profile.resume_generated) ||
    hasText(profile.resume_generated_pdf)
  );
}
