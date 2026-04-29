'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import { getDefaultDashboardPath } from '@/lib/access';
import type { CandidateProfileRecord, DepartmentRecord, UserRecord } from '@/types';
import CandidateHero from '@/components/candidates/resume/CandidateHero';
import CandidateSummary from '@/components/candidates/resume/CandidateSummary';
import CandidateLinksIcons from '@/components/candidates/resume/CandidateLinksIcons';
import CandidateSkillsPanel from '@/components/candidates/resume/CandidateSkillsPanel';
import CandidateExperienceList from '@/components/candidates/resume/CandidateExperienceList';
import CandidateEducationList from '@/components/candidates/resume/CandidateEducationList';
import CandidateCertificationsList from '@/components/candidates/resume/CandidateCertificationsList';
import CandidateResumeAssets from '@/components/candidates/resume/CandidateResumeAssets';
import EmptyResumeState from '@/components/candidates/resume/EmptyResumeState';
import {
  getCandidateFullName,
  getCandidateProfileFileUrl,
  hasCandidatePreviewContent,
  parseObjectArray,
  parseStringArray,
  type ResumeCertificationItem,
  type ResumeEducationItem,
  type ResumeWorkExperienceItem,
} from '@/lib/candidate-resume';

export default function CandidateResumePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<CandidateProfileRecord | null>(null);
  const [departmentLabelById, setDepartmentLabelById] = useState<Record<string, string>>({});

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      try {
        if (!pb.authStore.isValid) {
          router.replace('/login');
          return;
        }

        const currentUser = pb.authStore.model as unknown as UserRecord | null;
        if (!currentUser) {
          router.replace('/login');
          return;
        }

        if (currentUser.role !== 'Applicant') {
          router.replace(getDefaultDashboardPath(currentUser.role));
          return;
        }

        try {
          const candidateProfile = await pb.collection('candidates').getFirstListItem(
            `user = "${currentUser.id}"`
          );

          if (isActive) {
            setProfile(candidateProfile as unknown as CandidateProfileRecord);
            setError('');
          }
        } catch (err: any) {
          if (!isActive) {
            return;
          }

          if (err?.status === 404) {
            setProfile(null);
            setError('');
          } else {
            console.error('Error loading candidate preview:', err);
            setError('Failed to load your candidate preview.');
          }
        }

        try {
          const departments = await pb.collection('departments').getFullList({
            sort: 'department',
            requestKey: null,
          });

          if (isActive) {
            const map = (departments as unknown as DepartmentRecord[]).reduce<Record<string, string>>(
              (acc, department) => {
                if (department.id && department.department) {
                  acc[department.id] = department.department;
                }
                return acc;
              },
              {}
            );
            setDepartmentLabelById(map);
          }
        } catch {
          if (isActive) {
            setDepartmentLabelById({});
          }
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [router]);

  const fullName = useMemo(() => getCandidateFullName(profile), [profile]);
  const skills = useMemo(() => parseStringArray(profile?.skills), [profile?.skills]);
  const languages = useMemo(() => parseStringArray(profile?.languages), [profile?.languages]);
  const preferences = useMemo(() => {
    const rawPreferences = parseStringArray(profile?.preference);

    return rawPreferences
      .map((item) => {
        const label = departmentLabelById[item];
        if (label) {
          return label;
        }

        // PocketBase record ids are opaque/noisy in the preview.
        const isLikelyRecordId = /^[a-z0-9]{15}$/.test(item);
        return isLikelyRecordId ? '' : item;
      })
      .filter(Boolean);
  }, [profile?.preference, departmentLabelById]);
  const workExperience = useMemo(
    () => parseObjectArray<ResumeWorkExperienceItem>(profile?.work_experience),
    [profile?.work_experience]
  );
  const education = useMemo(
    () => parseObjectArray<ResumeEducationItem>(profile?.education),
    [profile?.education]
  );
  const certifications = useMemo(
    () => parseObjectArray<ResumeCertificationItem>(profile?.certifications),
    [profile?.certifications]
  );

  const headshotUrl = getCandidateProfileFileUrl(profile, profile?.headshot);
  const uploadedResumeUrl = getCandidateProfileFileUrl(profile, profile?.resume);
  const generatedPdfUrl = getCandidateProfileFileUrl(profile, profile?.resume_generated_pdf);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-8 text-center text-gray-500">Loading candidate preview...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="text-2xl font-bold text-red-800">Candidate Preview Unavailable</h1>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!profile || !hasCandidatePreviewContent(profile)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <EmptyResumeState />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <CandidateHero profile={profile} fullName={fullName} headshotUrl={headshotUrl} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="min-w-0 space-y-6">
            <CandidateSummary profile={profile} preferences={preferences} />
            <CandidateExperienceList items={workExperience} />
            <div className="grid gap-6 xl:grid-cols-2">
              <CandidateEducationList items={education} />
              <CandidateCertificationsList items={certifications} />
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <CandidateLinksIcons profile={profile} />
            <CandidateSkillsPanel skills={skills} languages={languages} />
            <CandidateResumeAssets
              uploadedResumeUrl={uploadedResumeUrl}
              uploadedResumeName={profile.resume || null}
              generatedPdfUrl={generatedPdfUrl}
              generatedMarkdown={profile.resume_generated || null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
