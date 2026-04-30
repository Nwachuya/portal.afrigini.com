'use client';

import { useState } from 'react';
import { CreditCard, Smartphone, ShieldCheck, AlertCircle, Save } from 'lucide-react';

interface PayoutProfileFormProps {
  initialData?: any;
  onSuccess: () => void;
}

export default function PayoutProfileForm({ initialData, onSuccess }: PayoutProfileFormProps) {
  const [method, setMethod] = useState<'bank' | 'momo'>(initialData?.method || 'bank');
  const [country, setCountry] = useState(initialData?.country || 'NG');
  const [currency, setCurrency] = useState(initialData?.currency || 'NGN');
  const [details, setDetails] = useState(initialData?.details || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/candidates/payments?view=profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          country,
          currency,
          details,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to update payout profile');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDetailChange = (key: string, value: string) => {
    setDetails((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Method Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setMethod('bank')}
          className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${
            method === 'bank' 
              ? 'border-brand-green bg-brand-green/5 ring-4 ring-brand-green/5' 
              : 'border-gray-100 bg-white hover:border-gray-200'
          }`}
        >
          <div className={`p-3 rounded-xl ${method === 'bank' ? 'bg-brand-green text-white' : 'bg-gray-100 text-gray-500'}`}>
            <CreditCard size={24} />
          </div>
          <div className="text-left">
            <p className={`font-bold ${method === 'bank' ? 'text-brand-dark' : 'text-gray-900'}`}>Bank Transfer</p>
            <p className="text-xs text-gray-500">Direct to your local bank</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMethod('momo')}
          className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${
            method === 'momo' 
              ? 'border-brand-green bg-brand-green/5 ring-4 ring-brand-green/5' 
              : 'border-gray-100 bg-white hover:border-gray-200'
          }`}
        >
          <div className={`p-3 rounded-xl ${method === 'momo' ? 'bg-brand-green text-white' : 'bg-gray-100 text-gray-500'}`}>
            <Smartphone size={24} />
          </div>
          <div className="text-left">
            <p className={`font-bold ${method === 'momo' ? 'text-brand-dark' : 'text-gray-900'}`}>Mobile Money</p>
            <p className="text-xs text-gray-500">Fast wallet transfers</p>
          </div>
        </button>
      </div>

      {/* Region Settings */}
      <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Country</label>
          <select 
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-green outline-none transition-all"
          >
            <option value="NG">Nigeria</option>
            <option value="GH">Ghana</option>
            <option value="KE">Kenya</option>
            <option value="RW">Rwanda</option>
            <option value="UG">Uganda</option>
            <option value="ZA">South Africa</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Currency</label>
          <select 
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-green outline-none transition-all"
          >
            <option value="NGN">NGN - Nigerian Naira</option>
            <option value="GHS">GHS - Ghanaian Cedi</option>
            <option value="KES">KES - Kenyan Shilling</option>
            <option value="RWF">RWF - Rwandan Franc</option>
            <option value="UGX">UGX - Ugandan Shilling</option>
            <option value="ZAR">ZAR - South African Rand</option>
          </select>
        </div>
      </div>

      {/* Detail Fields */}
      <div className="space-y-6">
        {method === 'bank' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Bank Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Access Bank"
                  value={details.bank_name || ''}
                  onChange={(e) => handleDetailChange('bank_name', e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-green outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Account Number</label>
                <input 
                  type="text"
                  placeholder="10-digit number"
                  value={details.account_number || ''}
                  onChange={(e) => handleDetailChange('account_number', e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-green outline-none transition-all"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Account Holder Name</label>
              <input 
                type="text"
                placeholder="Full name as it appears on account"
                value={details.account_name || ''}
                onChange={(e) => handleDetailChange('account_name', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-green outline-none transition-all"
                required
              />
            </div>
          </>
        ) : (
          <>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Provider</label>
                <select 
                  value={details.provider || ''}
                  onChange={(e) => handleDetailChange('provider', e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-green outline-none transition-all"
                  required
                >
                  <option value="">Select Provider</option>
                  <option value="MTN">MTN MoMo</option>
                  <option value="Vodafone">Vodafone Cash</option>
                  <option value="AirtelTigo">AirtelTigo Money</option>
                  <option value="MPesa">M-Pesa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Phone Number</label>
                <input 
                  type="tel"
                  placeholder="+234..."
                  value={details.phone_number || ''}
                  onChange={(e) => handleDetailChange('phone_number', e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-green outline-none transition-all"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Account Holder Name</label>
              <input 
                type="text"
                placeholder="Name registered with mobile money"
                value={details.account_name || ''}
                onChange={(e) => handleDetailChange('account_name', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-green outline-none transition-all"
                required
              />
            </div>
          </>
        )}
      </div>

      {/* Security Note */}
      <div className="flex gap-4 p-5 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800">
        <ShieldCheck className="flex-shrink-0" size={20} />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">Security & Verification</p>
          <p>Changing your payout details will put your profile into <span className="font-bold underline">Draft</span> status. Our compliance team will verify the new details before your next scheduled payout to ensure funds are sent securely.</p>
        </div>
      </div>

      {/* Error / Success Feedback */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm">
          <ShieldCheck size={18} />
          Profile updated successfully! Refreshing...
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={loading || success}
          className="flex items-center gap-2 px-8 py-4 bg-brand-green text-white font-bold rounded-2xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-green/20"
        >
          {loading ? 'Saving Changes...' : (
            <>
              <Save size={20} />
              Save Payout Profile
            </>
          )}
        </button>
      </div>
    </form>
  );
}
