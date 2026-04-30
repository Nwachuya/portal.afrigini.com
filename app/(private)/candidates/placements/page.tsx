'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Building2, Calendar, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';

interface Placement {
  id: string;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'paused' | 'ended';
  expand?: {
    org_id?: {
      name: string;
      logo?: string;
    };
    job_id?: {
      role: string;
      location?: string;
      type?: string;
    };
  };
}

export default function MyPlacementsPage() {
  const router = useRouter();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlacements = async () => {
      try {
        const response = await fetch('/api/candidates/placements');
        if (response.status === 401) return router.push('/login');
        if (!response.ok) throw new Error('Failed to load placements');
        const { data } = await response.json();
        setPlacements(data);
      } catch (err) {
        setError('Could not retrieve your placement history.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlacements();
  }, [router]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green mx-auto mb-4"></div>
        <p className="animate-pulse">Loading your career journey...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Briefcase size={120} />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-brand-green mb-2">Management</p>
          <h1 className="text-3xl font-bold text-gray-900">My Placements</h1>
          <p className="text-gray-500 mt-1 max-w-2xl">
            View your active roles, contract details, and employment history with Afrigini partners.
          </p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center text-red-700">
          {error}
        </div>
      ) : placements.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No placements found</h3>
          <p className="text-gray-500 mt-1 max-w-sm mx-auto">
            Your career history will appear here once you are successfully placed with one of our partners.
          </p>
          <Link 
            href="/candidates/jobs" 
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-brand-green/20"
          >
            Browse Open Jobs
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {placements.map((placement) => (
            <div 
              key={placement.id}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-brand-green/30 transition-all duration-300 overflow-hidden"
            >
              <div className="flex flex-col md:flex-row">
                {/* Left: Role & Company */}
                <div className="flex-grow p-6 sm:p-8">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-brand-green/5 flex items-center justify-center border border-brand-green/10">
                        <Building2 className="text-brand-green" size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 group-hover:text-brand-green transition-colors">
                          {placement.expand?.job_id?.role || 'Placed Role'}
                        </h2>
                        <p className="text-gray-500 font-medium">
                          {placement.expand?.org_id?.name || 'Afrigini Partner'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      placement.status === 'active' ? 'bg-green-100 text-green-700' : 
                      placement.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {placement.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 border-t border-gray-50 pt-6">
                    <div className="flex items-center gap-3 text-gray-600">
                      <Calendar size={18} className="text-gray-400" />
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Start Date</p>
                        <p className="text-sm font-semibold">{formatDate(placement.start_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <MapPin size={18} className="text-gray-400" />
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Location</p>
                        <p className="text-sm font-semibold">{placement.expand?.job_id?.location || 'Remote'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <Briefcase size={18} className="text-gray-400" />
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Type</p>
                        <p className="text-sm font-semibold">{placement.expand?.job_id?.type || 'Full-time'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="bg-gray-50/50 border-t md:border-t-0 md:border-l border-gray-100 p-6 flex items-center justify-center md:w-48">
                   <Link 
                    href={`/candidates/payments`}
                    className="flex items-center gap-2 text-sm font-bold text-brand-green hover:text-green-800 transition-colors"
                   >
                     View Payouts
                     <ChevronRight size={16} />
                   </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
