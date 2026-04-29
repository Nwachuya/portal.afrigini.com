import Link from 'next/link';
import type { CandidateProfileRecord } from '@/types';
import { getCandidateInitials } from '@/lib/candidate-resume';

export default function CandidateHero({
  profile,
  fullName,
  headshotUrl,
}: {
  profile: CandidateProfileRecord;
  fullName: string;
  headshotUrl: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-brand-green/10 bg-white shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(0,104,74,0.18),_transparent_42%),linear-gradient(135deg,_#f8fffb_0%,_#ffffff_55%,_#eef8f3_100%)] px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-white/70 bg-brand-green/10 text-2xl font-bold text-brand-green shadow-sm sm:h-24 sm:w-24 sm:text-3xl">
              {headshotUrl ? (
                <img src={headshotUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span>{getCandidateInitials(profile)}</span>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-green">Candidate Preview</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">{fullName}</h1>
              <p className="mt-2 text-base text-gray-600 sm:text-lg">
                {profile.headline || 'Add a headline in your profile to define your professional positioning.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/candidates/my-profile"
              className="inline-flex items-center justify-center rounded-xl bg-brand-green px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-green-800"
            >
              Edit Profile
            </Link>
            <Link
              href="/candidates/settings"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Account Settings
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
