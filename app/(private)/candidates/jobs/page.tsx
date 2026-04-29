'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import { JobRecord, DepartmentRecord, UserRecord, CandidateProfileRecord } from '@/types';
import { hydrateJobs } from '@/lib/pb-hydration';

export default function JobsPage() {
  // Data State
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  
  // User State
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [user, setUser] = useState<UserRecord | null>(null);
  
  // Filter State
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [hideApplied, setHideApplied] = useState(false); // New Filter

  const PER_PAGE = 10;

  // 1. Initial Data Fetch (Depts, User, Applied Jobs)
  useEffect(() => {
    const initData = async () => {
      try {
        // Fetch Depts
        const depts = await pb.collection('departments').getFullList({ sort: 'department' });
        setDepartments(depts as unknown as DepartmentRecord[]);

        // Check User & Applications
        if (pb.authStore.isValid) {
          const currentUser = pb.authStore.model as unknown as UserRecord;
          setUser(currentUser);

          if (currentUser.role === 'Applicant') {
            try {
              // Get Profile
              const profile = await pb.collection('candidates').getFirstListItem(
                `user = "${currentUser.id}"`, 
                { requestKey: null }
              );
              
              // Get All Applications for this profile (just the job IDs)
              const apps = await pb.collection('applications').getFullList({
                filter: `applicant = "${currentUser.id}"`,
                fields: 'job', // Optimization: only fetch job ID
                requestKey: null
              });
              
              setAppliedJobIds(apps.map((a: any) => a.job));
            } catch (e) {
              // No profile or no apps, ignore
            }
          }
        }
      } catch (e) {
        console.error("Failed to load initial data", e);
      }
    };
    initData();
  }, []);

  // 2. Fetch Jobs whenever filters or page changes
  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        // Build Filter String
        const constraints = ['stage = "Open"'];

        if (searchTerm) {
          constraints.push(`role ~ "${searchTerm}"`);
        }

        if (selectedTypes.length > 0) {
          const typeQuery = selectedTypes.map(t => `type = "${t}"`).join(' || ');
          constraints.push(`(${typeQuery})`);
        }

        if (selectedDepts.length > 0) {
          const deptQuery = selectedDepts.map(d => `department ~ "${d}"`).join(' || ');
          constraints.push(`(${deptQuery})`);
        }

        // New Filter: Hide Applied
        if (hideApplied && appliedJobIds.length > 0) {
          // Construct a "NOT IN" query: id != 'id1' && id != 'id2'
          const excludeQuery = appliedJobIds.map(id => `id != "${id}"`).join(' && ');
          constraints.push(`(${excludeQuery})`);
        }

        const filterString = constraints.join(' && ');

        const result = await pb.collection('jobs').getList(page, PER_PAGE, {
          filter: filterString,
          sort: '-created',
          requestKey: null // Prevent auto-cancel issues
        });

        setJobs(await hydrateJobs(result.items as unknown as JobRecord[]));
        setTotalItems(result.totalItems);
      } catch (err) {
        console.error("Error fetching jobs:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchJobs();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [page, searchTerm, selectedTypes, selectedDepts, hideApplied, appliedJobIds]);

  // Handlers
  const handleTypeToggle = (type: string) => {
    setPage(1);
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleDeptToggle = (id: string) => {
    setPage(1);
    setSelectedDepts(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPage(1);
    setSearchTerm(e.target.value);
  };

  const totalPages = Math.ceil(totalItems / PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <span className="text-brand-green font-bold tracking-[0.2em] uppercase text-xs">Opportunities</span>
            <h1 className="text-3xl font-bold text-brand-dark mt-2">Explore Jobs</h1>
            <p className="text-gray-500 mt-2">Find your next career opportunity across the Afrigini network.</p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-4 min-w-[180px]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">Open Roles</p>
            <p className="mt-2 text-3xl font-bold text-brand-dark">{totalItems}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Search */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Search</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search role..." 
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Application Status Filter (Only for Applicants) */}
          {user?.role === 'Applicant' && (
            <div className="bg-green-50 p-5 rounded-2xl border border-green-100 shadow-sm">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={hideApplied}
                  onChange={(e) => { setPage(1); setHideApplied(e.target.checked); }}
                  className="w-4 h-4 text-brand-green border-gray-300 rounded focus:ring-brand-green"
                />
                <span className="text-sm font-medium text-green-900">Hide jobs I've applied to</span>
              </label>
            </div>
          )}

          {/* Job Type Filter */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Job Type</h3>
            <div className="space-y-2">
              {['Full Time', 'Part Time', 'Contract'].map((type) => (
                <label key={type} className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedTypes.includes(type)}
                    onChange={() => handleTypeToggle(type)}
                    className="w-4 h-4 text-brand-green border-gray-300 rounded focus:ring-brand-green"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-brand-dark">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Department Filter */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Department</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {departments.length === 0 && <p className="text-sm text-gray-400 italic">No departments found</p>}
              {departments.map((dept) => (
                <label key={dept.id} className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedDepts.includes(dept.id)}
                    onChange={() => handleDeptToggle(dept.id)}
                    className="w-4 h-4 text-brand-green border-gray-300 rounded focus:ring-brand-green"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-brand-dark truncate">{dept.department}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Job Listings Column */}
        <div className="lg:col-span-3 space-y-6">
          {loading ? (
            <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-gray-200">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green mx-auto mb-4"></div>
              Loading opportunities...
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
              <div className="mx-auto h-12 w-12 text-gray-300 mb-4">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-brand-dark">No jobs found</h3>
              <p className="text-gray-500">Try adjusting your filters.</p>
              <button 
                onClick={() => { setSearchTerm(''); setSelectedTypes([]); setSelectedDepts([]); setHideApplied(false); }}
                className="mt-4 text-brand-green hover:text-green-800 font-medium text-sm"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              {/* Results Count */}
              <p className="text-sm text-gray-500">Showing {jobs.length} of {totalItems} jobs</p>

              {/* List */}
              <div className="grid gap-4">
                {jobs.map((job) => {
                  const org = job.expand?.organization;
                  const orgName = org?.name || 'Confidential Company';
                  const logoUrl = org?.logo 
                    ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/orgs/${org.id}/${org.logo}`
                    : null;
                  
                  const isApplied = appliedJobIds.includes(job.id);

                  return (
                    <Link key={job.id} href={`/candidates/jobs/${job.id}`} className="block group">
                      <div className={`bg-white border rounded-2xl p-6 hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center gap-6 ${isApplied ? 'border-green-200 bg-green-50/30' : 'border-gray-200 hover:border-green-100'}`}>
                        {/* Company Logo */}
                        <div className="h-16 w-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100 overflow-hidden text-gray-400">
                          {logoUrl ? (
                            <img src={logoUrl} alt={orgName} className="h-full w-full object-contain" />
                          ) : (
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          )}
                        </div>

                        {/* Job Info */}
                        <div className="flex-grow">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-brand-dark group-hover:text-brand-green transition-colors">
                              {job.role}
                            </h3>
                            {isApplied && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Applied
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 font-medium">{orgName}</p>
                          
                          <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
                            {/* Job Type */}
                            <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded text-gray-700">
                              <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {job.type}
                            </span>

                            {/* Salary */}
                            {(job.salary ?? 0) > 0 && (
                              <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded border border-green-100">
                                <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {job.currency} {(job.salary ?? 0).toLocaleString()} / {job.paymentType}
                              </span>
                            )}

                            {/* Departments */}
                            {job.expand?.department && job.expand.department.map((dept: any) => (
                              <span key={dept.id} className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded border border-green-100">
                                <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                {dept.department}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex-shrink-0 self-start md:self-center">
                          {isApplied ? (
                            <span className="px-5 py-2 bg-green-100 text-green-800 font-medium rounded-lg border border-green-200">
                              View Status
                            </span>
                          ) : (
                            <span className="px-5 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg group-hover:bg-green-50 group-hover:text-green-800 group-hover:border-green-200 transition-colors">
                              View Details
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-4 pt-8">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-gray-700"
                  >
                    Previous
                  </button>
                  <span className="text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-gray-700"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
