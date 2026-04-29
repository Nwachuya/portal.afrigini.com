'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import { UserRecord, CandidateProfileRecord, JobApplicationRecord } from '@/types';
import { hydrateApplications } from '@/lib/pb-hydration';

// FIX: Use Omit to prevent type conflict with the base record
interface ExpandedApplication extends Omit<JobApplicationRecord, 'expand'> {
  expand: {
    job: {
      id: string;
      role: string;
      expand: {
        organization: {
          name: string;
          logo: string;
          id: string;
        }
      }
    }
  }
}

export default function MyApplicationsPage() {
  const router = useRouter();
  
  // Data State
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<ExpandedApplication[]>([]);
  const [applicantId, setApplicantId] = useState<string | null>(null);
  
  // Filter & Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [totalItems, setTotalItems] = useState(0);

  const PER_PAGE = 6;

  // 1. Initialize User
  useEffect(() => {
    const initUser = async () => {
      try {
        const user = pb.authStore.model as unknown as UserRecord;
        if (!user || user.role !== 'Applicant') {
          router.push('/login');
          return;
        }

        setApplicantId(user.id);
      } catch (e) {
        console.log("No applicant found");
        setLoading(false);
      }
    };
    initUser();
  }, [router]);

  // 2. Fetch Applications (Runs when profile, page, or filters change)
  useEffect(() => {
    const fetchApplications = async () => {
      if (!applicantId) return;
      
      setLoading(true);
      try {
        // Build Filter
        const constraints = [`applicant = "${applicantId}"`];
        
        if (filterStage !== 'All') {
          constraints.push(`stage = "${filterStage}"`);
        }

        const result = await pb.collection('applications').getList(page, PER_PAGE, {
          filter: constraints.join(' && '),
          sort: '-created', // Sort by Apply Date (Newest First)
          requestKey: null,
        });

        const hydratedApplications = await hydrateApplications(result.items as unknown as JobApplicationRecord[]);
        setApplications(
          hydratedApplications.filter((app) => {
            if (!searchTerm) {
              return true;
            }

            const query = searchTerm.toLowerCase();
            const role = app.expand?.job?.role?.toLowerCase() || '';
            const orgName = app.expand?.job?.expand?.organization?.name?.toLowerCase() || '';
            return role.includes(query) || orgName.includes(query);
          }) as unknown as ExpandedApplication[]
        );
        setTotalPages(result.totalPages);
        setTotalItems(
          searchTerm
            ? hydratedApplications.filter((app) => {
                const query = searchTerm.toLowerCase();
                const role = app.expand?.job?.role?.toLowerCase() || '';
                const orgName = app.expand?.job?.expand?.organization?.name?.toLowerCase() || '';
                return role.includes(query) || orgName.includes(query);
              }).length
            : result.totalItems
        );

      } catch (err) {
        console.error("Error loading applications:", err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search slightly
    const timeoutId = setTimeout(() => {
      fetchApplications();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [applicantId, page, filterStage, searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStage, searchTerm]);

  const getStatusStyle = (stage: string) => {
    switch (stage) {
      case 'Applied': return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'Review': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Interview': return 'bg-brand-green/10 text-brand-green border-brand-green/20'; // Brand Green for progress
      case 'Accepted': return 'bg-green-50 text-green-700 border-green-200';
      case 'Rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'Send Video': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const stages = ['All', 'Applied', 'Review', 'Interview', 'Send Video', 'Accepted', 'Rejected'];

  if (loading && !applicantId) return <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-brand-green uppercase">Applications</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-dark mt-2">My Applications</h1>
            <p className="text-gray-500 mt-2 text-sm sm:text-base">Track and manage your job applications.</p>
          </div>
          <div className="bg-brand-green/10 border border-brand-green/20 rounded-2xl px-6 py-5 min-w-[220px]">
            <p className="text-xs font-bold tracking-[0.2em] text-brand-green uppercase">Total Found</p>
            <p className="text-4xl font-bold text-brand-dark mt-1">{totalItems}</p>
          </div>
        </div>
      </div>

      {/* Controls: Search & Filter */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Search */}
        <div className="relative flex-grow">
          <input 
            type="text" 
            placeholder="Search by job title..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
          />
          <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Stage Filter (Scrollable on mobile) */}
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
          {stages.map((stage) => (
            <button
              key={stage}
              onClick={() => setFilterStage(stage)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all border ${
                filterStage === stage 
                  ? 'bg-brand-green text-white border-brand-green shadow-md' 
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green mx-auto mb-4"></div>
          Updating list...
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
          <div className="mx-auto h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-brand-dark">No applications found</h3>
          <p className="text-gray-500 mt-2 mb-6">
            {searchTerm || filterStage !== 'All' 
              ? "Try adjusting your filters to see more results." 
              : "You haven't applied to any jobs yet."}
          </p>
          <Link href="/candidates/jobs" className="px-6 py-3 bg-brand-green text-white font-bold rounded-lg hover:bg-green-800 transition-colors shadow-lg shadow-green-900/10">
            Find Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* List */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {applications.map(app => {
                const job = app.expand?.job;
                const org = job?.expand?.organization;
                const orgName = org?.name || 'Confidential Company';
                
                const logoUrl = org?.logo 
                  ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/orgs/${org.id}/${org.logo}`
                  : null;
                
                return (
                  <li key={app.id} className="group hover:bg-gray-50 transition-colors">
                    <Link href={`/candidates/my-applications/${app.id}`} className="block p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        {/* Job Info */}
                        <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center border border-gray-200 flex-shrink-0 text-gray-400 overflow-hidden">
                          {logoUrl ? (
                              <img src={logoUrl} alt={orgName} className="h-full w-full object-contain p-1" />
                            ) : (
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-lg text-brand-dark group-hover:text-brand-green transition-colors">{job?.role}</p>
                            <p className="text-sm text-gray-500">{orgName}</p>
                          </div>
                        </div>

                        {/* Meta & Status */}
                        <div className="flex items-center gap-6 sm:justify-end">
                          <div className="hidden sm:block text-right">
                            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Applied</p>
                            <p className="text-sm text-gray-600">{new Date(app.created).toLocaleDateString()}</p>
                          </div>
                          
                          <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusStyle(app.stage)}`}>
                            {app.stage}
                          </span>
                          
                          <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-green transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
