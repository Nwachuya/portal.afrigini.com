'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import { UserRecord, CandidateProfileRecord, JobRecord } from '@/types';
import Link from 'next/link';
import { getApplicantProfileBanner } from '@/lib/candidate-profile';
import { hydrateJobs } from '@/lib/pb-hydration';

function isAutoCancelledError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.toLowerCase().includes('autocancelled');
}

export default function ApplicantDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [profile, setProfile] = useState<CandidateProfileRecord | null>(null);
  const [stats, setStats] = useState({ applied: 0, interviews: 0, accepted: 0, videoRequests: 0, invites: 0 });
  const [recommendedJobs, setRecommendedJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!pb.authStore.isValid) {
          router.replace('/login');
          return;
        }

        const freshUser = await pb.collection('users').getOne(pb.authStore.model!.id, {
          requestKey: null,
        });
        const userRecord = freshUser as unknown as UserRecord;
        
        // SECURITY CHECK: Redirect if not an Applicant
        if (userRecord.role !== 'Applicant') {
          router.replace('/org/dashboard');
          return;
        }

        setUser(userRecord);

        // ... (Rest of the logic remains the same) ...
        let candidateProfile: CandidateProfileRecord | null = null;
        try {
          candidateProfile = await pb.collection('candidates').getFirstListItem(
            `user = "${freshUser.id}"`, { requestKey: null }
          ) as unknown as CandidateProfileRecord;
          setProfile(candidateProfile);
        } catch (e) {
          if (isAutoCancelledError(e)) return;
          console.log("No profile record found.");
        }

        if (candidateProfile) {
          const profileId = candidateProfile.id;
          const filter = `applicant = "${freshUser.id}"`;

          const [
            appliedRes, interviewRes, acceptedRes, videoRes, invitesRes, allApplicationsRes,
          ] = await Promise.all([
            pb.collection('applications').getList(1, 1, { filter, requestKey: null }),
            pb.collection('applications').getList(1, 1, { filter: `${filter} && (stage = "Interview" || stage = "Invited")`, requestKey: null }),
            pb.collection('applications').getList(1, 1, { filter: `${filter} && stage = "Accepted"`, requestKey: null }),
            pb.collection('applications').getList(1, 1, { filter: `${filter} && stage = "Send Video"`, requestKey: null }),
            pb.collection('job_invites').getList(1, 1, { filter: `candidate_profile = "${profileId}" && status = "pending"`, requestKey: null }),
            pb.collection('applications').getFullList({ filter, requestKey: null }),
          ]);

          setStats({
            applied: appliedRes.totalItems,
            interviews: interviewRes.totalItems,
            accepted: acceptedRes.totalItems,
            videoRequests: videoRes.totalItems,
            invites: invitesRes.totalItems,
          });

          const appliedJobIds = allApplicationsRes.map(app => app.job);
          const preferredDeptIds = candidateProfile.preference || [];

          if (preferredDeptIds.length > 0) {
            const recommendationFilters = ['stage = "Open"'];
            const deptFilter = preferredDeptIds.map(id => `department ~ "${id}"`).join(' || ');
            recommendationFilters.push(`(${deptFilter})`);
            
            if (appliedJobIds.length > 0) {
              const appliedFilter = appliedJobIds.map(id => `id != "${id}"`).join(' && ');
              recommendationFilters.push(appliedFilter);
            }
            
            const recommendedRes = await pb.collection('jobs').getList(1, 3, {
              filter: recommendationFilters.join(' && '),
              sort: '-created',
              requestKey: null,
            });
            setRecommendedJobs(await hydrateJobs(recommendedRes.items as unknown as JobRecord[]));
          }
        }
      } catch (e) {
        if (isAutoCancelledError(e)) return;
        console.error("Error fetching dashboard data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500">Loading dashboard...</div>;
  if (!user) return null; // Will redirect

  const profileBanner = getApplicantProfileBanner(profile);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-brand-green">Welcome</p>
          <h1 className="text-3xl font-bold text-gray-900">Hello, {user.name || 'Applicant'}!</h1>
          <p className="text-gray-500 mt-1">Welcome back. Let's find your next opportunity.</p>
        </div>
      </div>

      {/* Profile Callout */}
      {profileBanner.show && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-yellow-500">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-yellow-800">{profileBanner.title}</h3>
              <p className="text-sm text-yellow-700">{profileBanner.message}</p>
            </div>
          </div>
          <Link 
            href="/candidates/my-profile" 
            className="px-5 py-2.5 bg-yellow-400 text-yellow-900 font-bold text-sm rounded-lg hover:bg-yellow-500 transition-colors flex-shrink-0"
          >
            Go to Profile
          </Link>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <MetricCard title="Applications Sent" value={stats.applied} icon="mail" color="blue" href="/candidates/my-applications" />
        <MetricCard title="Video Requests" value={stats.videoRequests} icon="video" color="purple" href="/candidates/my-applications" />
        <MetricCard title="Interviews" value={stats.interviews} icon="calendar" color="teal" href="/candidates/my-applications" />
        <MetricCard title="Job Invites" value={stats.invites} icon="inbox" color="indigo" href="/candidates/my-invites" />
        <MetricCard title="Offers" value={stats.accepted} icon="sparkles" color="green" href="/candidates/my-applications" />
      </div>
      
      {/* Recommended Jobs */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recommended for You</h2>
        {recommendedJobs.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            <p>
              {(profile?.preference?.length ?? 0) > 0 
                ? "No new jobs match your preferences right now. Check back later!" 
                : "Add department preferences to your profile to see recommended jobs."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendedJobs.map((job) => (
              <Link key={job.id} href={`/candidates/jobs/${job.id}`} className="block group">
                <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-sm transition-all flex items-center gap-4">
                  <div className="flex-grow">
                    <p className="font-bold text-gray-900 group-hover:text-blue-600">{job.role}</p>
                    <p className="text-sm text-gray-500">{job.expand?.organization?.name || 'A Company'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{job.type}</span>
                    <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// Reusable Metric Card Component
type IconKey = 'mail' | 'video' | 'calendar' | 'inbox' | 'sparkles';
type ColorKey = 'blue' | 'purple' | 'teal' | 'indigo' | 'green';

const MetricCard = ({ title, value, icon, color, href }: { title: string; value: number; icon: IconKey; color: ColorKey; href: string }) => {
  
  const icons: Record<IconKey, React.ReactNode> = {
    mail: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    video: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    calendar: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    inbox: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>,
    sparkles: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  };

  const bgColors: Record<ColorKey, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <Link href={href} className="block group">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-full group-hover:border-blue-500 group-hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-500 font-medium text-sm">{title}</h3>
          <div className={`p-2 rounded-lg ${bgColors[color]}`}>
            {icons[icon]}
          </div>
        </div>
        <p className="text-3xl font-bold mt-2 text-gray-900">{value}</p>
      </div>
    </Link>
  );
};
