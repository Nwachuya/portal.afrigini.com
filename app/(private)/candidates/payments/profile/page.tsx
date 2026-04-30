'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CandidatePaymentsShell from '@/components/candidates/payments/CandidatePaymentsShell';
import PayoutProfileForm from '@/components/candidates/payments/PayoutProfileForm';
import { Edit2, Eye, Landmark, Smartphone } from 'lucide-react';
import type { CandidatePayoutProfileRecord } from '@/types';

export default function CandidatePayoutProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockedMessage, setBlockedMessage] = useState('');
  const [profile, setProfile] = useState<CandidatePayoutProfileRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/candidates/payments?view=profile', { credentials: 'include' });
      if (response.status === 401) return router.replace('/login');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to load payout profile');
      setProfile((payload?.data || null) as CandidatePayoutProfileRecord | null);
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load payout profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [router]);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-500">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green mx-auto mb-4"></div>
      <p>Loading payout configuration...</p>
    </div>
  );

  return (
    <CandidatePaymentsShell
      title="Payout Profile"
      subtitle="Manage your primary destination for receiving salary payments."
      rightLabel="Verification"
      rightValue={profile?.status || 'No Profile'}
    >
      <div className="max-w-4xl mx-auto">
        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center text-red-700 font-medium">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Toggle Actions */}
            <div className="flex justify-end">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                  isEditing 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                    : 'bg-brand-green text-white hover:bg-green-700 hover:shadow-brand-green/20'
                }`}
              >
                {isEditing ? (
                  <>
                    <Eye size={18} />
                    View Current Details
                  </>
                ) : (
                  <>
                    <Edit2 size={18} />
                    Update Payout Details
                  </>
                )}
              </button>
            </div>

            {isEditing ? (
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <PayoutProfileForm 
                  initialData={profile} 
                  onSuccess={() => {
                    setIsEditing(false);
                    loadProfile();
                  }} 
                />
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {!profile ? (
                  <div className="p-12 text-center">
                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Landmark className="text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No profile configured</h3>
                    <p className="text-gray-500 mt-1 mb-6">Click update to add your bank or mobile money details.</p>
                  </div>
                ) : (
                  <div className="p-8">
                    {/* Status Banner */}
                    <div className={`mb-8 p-4 rounded-2xl flex items-center gap-4 border ${
                      profile.status === 'verified' 
                        ? 'bg-green-50 border-green-100 text-green-800' 
                        : 'bg-yellow-50 border-yellow-100 text-yellow-800'
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                         profile.status === 'verified' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
                      }`}>
                        {profile.method === 'bank' ? <Landmark size={20} /> : <Smartphone size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold capitalize">{profile.status} {profile.method} Profile</p>
                        <p className="text-xs opacity-80">
                          {profile.status === 'verified' 
                            ? 'Ready for incoming transfers.' 
                            : 'Awaiting manual verification by our compliance team.'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2">Basic Info</p>
                        <div className="space-y-4">
                           <InfoRow label="Method" value={profile.method} />
                           <InfoRow label="Country" value={profile.country} />
                           <InfoRow label="Currency" value={profile.currency} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2">Account Details</p>
                        <div className="space-y-4">
                          {Object.entries(profile.details || {}).map(([key, val]) => (
                            <InfoRow key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </CandidatePaymentsShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-gray-50 pb-2">
      <p className="text-xs text-gray-500 capitalize">{label}</p>
      <p className="text-sm font-bold text-brand-dark uppercase">{value}</p>
    </div>
  );
}
