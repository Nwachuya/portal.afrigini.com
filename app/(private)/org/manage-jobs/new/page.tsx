'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import { UserRecord, DepartmentRecord, OrganizationRecord } from '@/types';
import { canAccessBilling, canManageJobs, getDefaultOrgPath } from '@/lib/access';
import { getCurrentOrgMembership } from '@/lib/org-membership';

export default function NewJobPage() {
  const router = useRouter();
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Org & Config Data
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [credits, setCredits] = useState<number>(0);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [deptOptions, setDeptOptions] = useState<DepartmentRecord[]>([]);
  
  // Debug/Error state
  const [debugError, setDebugError] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Form State
  const [role, setRole] = useState('');
  const [type, setType] = useState('Full Time');
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paymentType, setPaymentType] = useState('Monthly');
  const [scope, setScope] = useState('Listing Only');
  const [description, setDescription] = useState('');
  const [benefits, setBenefits] = useState('');
  const [expires, setExpires] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        if (!pb.authStore.isValid) {
          router.push('/login');
          return;
        }

        const user = pb.authStore.model as unknown as UserRecord;
        if (user?.is_super_admin && isMounted) setIsSuperAdmin(true);

        // 1. Fetch Departments
        try {
          const depts = await pb.collection('departments').getFullList({ sort: 'department' });
          if (isMounted) setDeptOptions(depts as unknown as DepartmentRecord[]);
        } catch (e) {
          console.error("Failed to fetch departments", e);
        }

        // 2. Fetch Organization & Credits
        try {
          const membership = await getCurrentOrgMembership(user.id, 'organization');

          if (!isMounted) return;
          setMemberRole(membership?.role ?? null);

          if (membership?.role && !canManageJobs(membership.role) && !user?.is_super_admin) {
            router.replace(getDefaultOrgPath(membership.role));
            return;
          }

          if (membership && membership.organization) {
            setOrgId(membership.organization);

            let orgRecord = membership.expand?.organization as OrganizationRecord | undefined;
            if (!orgRecord) {
              try {
                orgRecord = await pb.collection('orgs').getOne(membership.organization, {
                  requestKey: null,
                }) as unknown as OrganizationRecord;
              } catch (orgError) {
                console.error('Failed to load organization details', orgError);
              }
            }

            if (orgRecord) {
              setOrgName(orgRecord.name || 'Your Organization');
            }

            try {
              const orgAdmin = await pb.collection('org_admin').getFirstListItem<{ job_credit?: number }>(
                `org = "${membership.organization}"`,
                { requestKey: null }
              );
              if (isMounted) {
                setCredits(orgAdmin?.job_credit || 0);
              }
            } catch (creditsError) {
              console.error('Failed to load organization credits', creditsError);
              if (isMounted) {
                setCredits(0);
              }
            }
          } else {
            setDebugError('Membership found, but not linked to a valid organization.');
          }
        } catch (innerErr: any) {
          if (!isMounted) return;
          if (innerErr.name !== 'ClientResponseError 0' && !innerErr.isAbort) {
            console.error("Org Lookup Failed:", innerErr);
            setDebugError("Could not find an organization linked to your account.");
          }
        }

      } catch (err: any) {
        if (isMounted) setDebugError(err.message);
      } finally {
        if (isMounted) setIsLoadingState(false);
      }
    };

    init();

    return () => { isMounted = false; };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDebugError('');
    setIsSubmitting(true);

    if (!orgId) {
      setDebugError('Missing Organization ID.');
      setIsSubmitting(false);
      return;
    }

    if (credits < 1) {
      setDebugError('Insufficient job credits.');
      setIsSubmitting(false);
      return;
    }

    try {
      await pb.collection('jobs').create({
        role,
        type,
        salary: salary ? parseInt(salary) : 0,
        currency,
        paymentType,
        scope, 
        description,
        benefits,
        organization: orgId,
        department: selectedDept,
        expires: expires ? new Date(expires).toISOString() : '',
        stage: 'Open', 
      });

      router.push('/org/manage-jobs');
    } catch (err: any) {
      console.error('Create Error:', err);
      setDebugError(err.message || 'Failed to create job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingState) {
    return <div className="p-10 text-center text-gray-500">Loading form...</div>;
  }

  // Styles
  const inputClass = "w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all shadow-sm";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-2";
  const selectWrapperClass = "relative";
  const chevronIcon = (
    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/org/manage-jobs" className="text-sm text-gray-500 hover:text-gray-900 font-medium flex items-center">
          &larr; Back to Manage Jobs
        </Link>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-brand-green font-bold tracking-[0.2em] uppercase text-xs">Hiring</span>
            <h1 className="mt-2 text-3xl font-bold text-brand-dark">Post a New Job</h1>
            <p className="text-gray-500 mt-1">
              Posting for: <span className="font-semibold text-gray-800">{orgName || 'Your Organization'}</span>
            </p>
          </div>
          
          {/* Credit Display with Coin Icon */}
          <div className={`px-5 py-3 rounded-lg border flex items-center shadow-sm ${credits > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-red-50 border-red-100 text-red-700'}`}>
            <div className="mr-3 flex items-center justify-center bg-yellow-400 text-white rounded-full w-10 h-10 shadow-inner">
              <span className="text-2xl">🪙</span>
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-wide opacity-70">Job Credits</p>
              <p className="text-xl font-bold">{credits} Remaining</p>
            </div>
          </div>
        </div>

        {debugError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-bold text-sm mb-1">Error:</h3>
            <p className="text-red-700 text-sm">{debugError}</p>
          </div>
        )}

        <div className="bg-white border border-brand-green/10 rounded-2xl shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            
            {/* 1. Job Details */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-brand-dark border-b border-gray-100 pb-3">Job Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Role Title <span className="text-red-500">*</span></label>
                  <input type="text" required value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Product Designer" className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Job Type</label>
                  <div className={selectWrapperClass}>
                    <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputClass} appearance-none`}>
                      <option value="Full Time">Full Time</option>
                      <option value="Part Time">Part Time</option>
                      <option value="Contract">Contract</option>
                    </select>
                    {chevronIcon}
                  </div>
                </div>
              </div>

              {/* Departments & Expiration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Expiration Date</label>
                  <input 
                    type="date" 
                    value={expires}
                    onChange={(e) => setExpires(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to keep open indefinitely.</p>
                </div>

                <div>
                  <label className={labelClass}>Department <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      required
                      className={`${inputClass} appearance-none`}
                    >
                      <option value="">Select a department</option>
                      {deptOptions.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.department}
                        </option>
                      ))}
                    </select>
                    {chevronIcon}
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>Salary Amount</label>
                  <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. 60000" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <div className={selectWrapperClass}>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${inputClass} appearance-none`}>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                    {chevronIcon}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Payment Frequency</label>
                  <div className={selectWrapperClass}>
                    <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={`${inputClass} appearance-none`}>
                      <option value="Monthly">Monthly</option>
                      <option value="Hourly">Hourly</option>
                      <option value="Annually">Annually</option>
                    </select>
                    {chevronIcon}
                  </div>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="bg-brand-green/5 p-4 rounded-lg border border-brand-green/10">
                   <label className={labelClass}>Recruitment Scope (Super Admin)</label>
                   <div className={selectWrapperClass}>
                     <select value={scope} onChange={(e) => setScope(e.target.value)} className={`${inputClass} appearance-none`}>
                        <option value="Listing Only">Listing Only</option>
                        <option value="Full Recruitment">Full Recruitment</option>
                      </select>
                      {chevronIcon}
                   </div>
                </div>
              )}
            </div>

            {/* 2. Description & Benefits */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-brand-dark border-b border-gray-100 pb-3">Description & Benefits</h3>
              
              <div>
                <label className={labelClass}>Job Description</label>
                <textarea 
                  rows={6} 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Describe the role..." 
                  className={inputClass}
                ></textarea>
              </div>

              <div>
                <label className={labelClass}>Benefits</label>
                <textarea 
                  rows={4} 
                  value={benefits} 
                  onChange={(e) => setBenefits(e.target.value)} 
                  placeholder="What perks do you offer?" 
                  className={inputClass}
                ></textarea>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-end space-x-4 border-t border-gray-100">
              <Link href="/org/manage-jobs" className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</Link>
              {credits > 0 ? (
                <button 
                  type="submit" 
                  disabled={isSubmitting || !orgId || !selectedDept}
                  className="px-8 py-3 bg-brand-green text-white font-medium rounded-lg hover:bg-green-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Posting...' : 'Post Job (-1 Credit)'}
                </button>
              ) : canAccessBilling(memberRole) ? (
                <Link
                  href="/org/billing"
                  className="px-8 py-3 bg-brand-green text-white font-medium rounded-lg hover:bg-green-800 transition-colors shadow-sm"
                >
                  Buy Credits
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="px-8 py-3 bg-gray-300 text-gray-600 font-medium rounded-lg cursor-not-allowed"
                >
                  Insufficient Credits
                </button>
              )}
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
