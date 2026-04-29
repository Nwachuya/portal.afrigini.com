import { Globe, Linkedin } from 'lucide-react';
import type { CandidateProfileRecord } from '@/types';

export default function CandidateLinksIcons({
  profile,
}: {
  profile: CandidateProfileRecord;
}) {
  return (
    <section className="rounded-[24px] border border-brand-green/10 bg-white p-6 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold text-brand-dark">Links</h2>
      <p className="mt-1 text-sm text-gray-500">Quick access to your public profiles.</p>
      <div className="mt-4 flex items-center gap-5">
        {profile.linkedin ? (
          <a
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-green/20 bg-brand-green/5 text-brand-green transition-colors hover:bg-green-50"
          >
            <Linkedin size={18} />
          </a>
        ) : (
          <span
            aria-label="LinkedIn not provided"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400"
          >
            <Linkedin size={18} />
          </span>
        )}

        {profile.portfolio ? (
          <a
            href={profile.portfolio}
            target="_blank"
            rel="noreferrer"
            aria-label="Portfolio"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-green/20 bg-brand-green/5 text-brand-green transition-colors hover:bg-green-50"
          >
            <Globe size={18} />
          </a>
        ) : (
          <span
            aria-label="Portfolio not provided"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400"
          >
            <Globe size={18} />
          </span>
        )}
      </div>
    </section>
  );
}
