'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import { UserRecord, CandidateProfileRecord, JobInvitationRecord } from '@/types';
import { hydrateJobInvitations } from '@/lib/pb-hydration';

// Helper Type
interface InvitationRecord {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  created: string;
  expand: {
    job: {
      id: string;
      role: string;
    },
    organization: {
      name: string;
      logo: string;
      id: string;
    }
  }
}

export default function MyInvitesPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<InvitationRecord[]>([]);
  const [profile, setProfile] = useState<CandidateProfileRecord | null>(null);

  useEffect(() => {
    const loadInvites = async () => {
      try {
        const user = pb.authStore.model as unknown as UserRecord;
        if (!user || user.role !== 'Applicant') {
          router.push('/login');
          return;
        }

        let candidateProfile = null;
        try {
          candidateProfile = await pb.collection('candidates').getFirstListItem(
            `user = "${user.id}"`
          );
          setProfile(candidateProfile as unknown as CandidateProfileRecord);
        } catch (e) {
          console.log("No profile found, cannot fetch invites.");
          setLoading(false);
          return;
        }

        // Fetch all invitations linked to this profile
        const result = await pb.collection('job_invites').getFullList({
          filter: `candidate_profile = "${candidateProfile.id}"`,
          sort: '-created',
          requestKey: null,
        });

        setInvites(
          await hydrateJobInvitations(result as unknown as JobInvitationRecord[]) as unknown as InvitationRecord[]
        );

      } catch (err) {
        console.error("Error loading invitations:", err);
      } finally {
        setLoading(false);
      }
    };
    loadInvites();
  }, [router]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">Loading your invites...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Job Invitations</h1>
        <p className="text-gray-500 mt-1">Review opportunities from companies. Invitation status is managed by the hiring team.</p>
      </div>

      {invites.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <div className="text-4xl mb-4">📨</div>
          <h3 className="text-lg font-medium text-gray-900">No invitations yet.</h3>
          <p className="text-gray-500">Keep your profile updated to attract recruiters!</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {invites.map(invite => {
              const job = invite.expand?.job;
              const org = invite.expand?.organization;
              const orgName = org?.name || 'Confidential Company';
              
              const logoUrl = org?.logo 
                  ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/orgs/${org.id}/${org.logo}`
                : null;
              
              return (
                <li key={invite.id} className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 flex-shrink-0 text-gray-400">
                        {logoUrl ? (
                          <img src={logoUrl} alt={orgName} className="h-full w-full object-contain p-1" />
                        ) : (
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <Link href={`/candidates/jobs/${job?.id}`} className="font-bold text-lg text-gray-900 hover:text-blue-600 transition-colors">
                          {job?.role}
                        </Link>
                        <p className="text-sm text-gray-600">{orgName}</p>
                      </div>
                    </div>
                    
                    {/* Actions / Status */}
                    <div className="flex items-center gap-3 sm:justify-end flex-shrink-0">
                      {invite.status === 'pending' && (
                        <span className="px-3 py-1.5 text-sm font-semibold text-amber-800 bg-amber-100 rounded-full border border-amber-200">
                          Pending Review
                        </span>
                      )}
                      {invite.status === 'accepted' && (
                        <span className="px-3 py-1.5 text-sm font-semibold text-green-800 bg-green-100 rounded-full border border-green-200">
                          ✓ Accepted
                        </span>
                      )}
                      {invite.status === 'declined' && (
                        <span className="px-3 py-1.5 text-sm font-semibold text-red-800 bg-red-100 rounded-full border border-red-200">
                          ✗ Declined
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
