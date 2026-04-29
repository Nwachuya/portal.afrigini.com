import type { CandidateProfileRecord } from '@/types';
import { formatDisplayDate } from '@/lib/candidate-resume';

export default function CandidateSummary({
  profile,
  preferences,
}: {
  profile: CandidateProfileRecord;
  preferences: string[];
}) {
  return (
    <section className="rounded-[24px] border border-brand-green/10 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-brand-dark">Professional Summary</h2>
          <p className="mt-1 text-sm text-gray-500">This is the recruiter-facing overview of your profile.</p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
            {profile.bio || 'Add a bio in your profile so recruiters can quickly understand your background and strengths.'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-600">Profile Snapshot</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-600">
              <span className="rounded-full bg-brand-green/10 px-3 py-1 text-brand-green">
                {profile.is_open_to_work ? 'Open to work' : 'Not actively looking'}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1">
                {profile.country || 'Location not specified'}
              </span>
              {profile.level && (
                <span className="rounded-full bg-gray-100 px-3 py-1">{profile.level}</span>
              )}
              <span className="rounded-full bg-gray-100 px-3 py-1">
                Updated {formatDisplayDate(profile.updated)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-600">Department Preferences</h3>
            {preferences.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {preferences.map((item) => (
                  <span key={item} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">No work preferences listed.</p>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
