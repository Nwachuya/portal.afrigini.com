'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import { OrgRole, OrganizationRecord, UserRecord } from '@/types';
import { canManageOrganization, getDefaultOrgPath } from '@/lib/access';
import { getCurrentOrgMembership } from '@/lib/org-membership';

type BannerState = {
  text: string;
  type: '' | 'success' | 'error' | 'info';
};

type OrganizationForm = {
  about: string;
  industry: string;
  linkedin_url: string;
  location: string;
  name: string;
  size: string;
  website: string;
};

const EMPTY_FORM: OrganizationForm = {
  about: '',
  industry: '',
  linkedin_url: '',
  location: '',
  name: '',
  size: '',
  website: '',
};

function getOrganizationLogoUrl(orgId: string, logo?: string) {
  if (!logo) return null;
  return `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/orgs/${orgId}/${logo}`;
}

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<BannerState>({ text: '', type: '' });
  const [orgId, setOrgId] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<OrgRole | null>(null);
  const [form, setForm] = useState<OrganizationForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<OrganizationForm>(EMPTY_FORM);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedLogoName, setSelectedLogoName] = useState('');
  const [selectedLogoPreview, setSelectedLogoPreview] = useState<string | null>(null);

  const canEdit = canManageOrganization(memberRole);

  useEffect(() => {
    const loadOrg = async () => {
      try {
        const user = pb.authStore.model as unknown as UserRecord;
        if (!user) {
          router.push('/login');
          return;
        }

        const memberRes = await getCurrentOrgMembership(user.id, 'organization');
        setMemberRole((memberRes?.role as OrgRole | null) ?? null);

        if (!memberRes?.organization) {
          setBanner({
            text: 'No organization profile is attached to your account.',
            type: 'error',
          });
          return;
        }

        const organizationId = memberRes.organization;
        setOrgId(organizationId);

        let organization = memberRes.expand?.organization as OrganizationRecord | undefined;
        if (!organization?.id) {
          organization = await pb.collection('orgs').getOne<OrganizationRecord>(organizationId, {
            requestKey: null,
          });
        }

        const nextForm: OrganizationForm = {
          about: organization.about || '',
          industry: organization.industry || '',
          linkedin_url: organization.linkedin_url || '',
          location: organization.location || '',
          name: organization.name || '',
          size: organization.size || '',
          website: organization.website || '',
        };

        setForm(nextForm);
        setInitialForm(nextForm);
        setLogoUrl(getOrganizationLogoUrl(organization.id, organization.logo));
      } catch (error) {
        console.error('Error loading settings:', error);
        setBanner({
          text: 'We could not load your organization settings right now.',
          type: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    void loadOrg();
  }, [router]);

  useEffect(() => {
    return () => {
      if (selectedLogoPreview) {
        URL.revokeObjectURL(selectedLogoPreview);
      }
    };
  }, [selectedLogoPreview]);

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(form) !== JSON.stringify(initialForm) ||
      !!fileInputRef.current?.files?.length
    );
  }, [form, initialForm]);

  const profileCompleteness = useMemo(() => {
    const fields = [
      form.name,
      form.website,
      form.about,
      form.industry,
      form.location,
      form.linkedin_url,
      form.size,
      logoUrl || selectedLogoPreview,
    ];
    const completed = fields.filter((value) => Boolean(value)).length;
    return Math.round((completed / fields.length) * 100);
  }, [form, logoUrl, selectedLogoPreview]);

  const updateField = (field: keyof OrganizationForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedLogoName('');
      setSelectedLogoPreview(null);
      return;
    }

    if (selectedLogoPreview) {
      URL.revokeObjectURL(selectedLogoPreview);
    }

    setSelectedLogoName(file.name);
    setSelectedLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId || !canEdit) {
      return;
    }

    if (!form.name.trim()) {
      setBanner({ text: 'Company name is required.', type: 'error' });
      return;
    }

    setSaving(true);
    setBanner({ text: '', type: '' });

    try {
      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('website', form.website.trim());
      formData.append('about', form.about.trim());
      formData.append('industry', form.industry.trim());
      formData.append('location', form.location.trim());
      formData.append('linkedin_url', form.linkedin_url.trim());
      formData.append('size', form.size.trim());

      if (fileInputRef.current?.files?.length) {
        formData.append('logo', fileInputRef.current.files[0]);
      }

      const updatedOrg = await pb.collection('orgs').update<OrganizationRecord>(orgId, formData);
      const nextForm: OrganizationForm = {
        about: updatedOrg.about || '',
        industry: updatedOrg.industry || '',
        linkedin_url: updatedOrg.linkedin_url || '',
        location: updatedOrg.location || '',
        name: updatedOrg.name || '',
        size: updatedOrg.size || '',
        website: updatedOrg.website || '',
      };

      setForm(nextForm);
      setInitialForm(nextForm);
      setLogoUrl(getOrganizationLogoUrl(updatedOrg.id, updatedOrg.logo) ? `${getOrganizationLogoUrl(updatedOrg.id, updatedOrg.logo)}?t=${Date.now()}` : null);
      setSelectedLogoName('');
      if (selectedLogoPreview) {
        URL.revokeObjectURL(selectedLogoPreview);
      }
      setSelectedLogoPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setBanner({
        text: 'Organization profile updated successfully.',
        type: 'success',
      });
    } catch (error: any) {
      console.error('Save error:', error);
      setBanner({
        text: error?.message || 'Failed to save organization settings.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500">
        Loading organization settings...
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          {banner.text || 'No organization profile is available for this account.'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-green/10 bg-white px-6 py-7 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-brand-green font-bold tracking-[0.2em] uppercase text-xs">Organization</span>
          <h1 className="mt-2 text-3xl font-bold text-brand-dark">Settings</h1>
          <p className="mt-1 text-gray-500">
            Manage the company profile candidates and team members rely on.
          </p>
          {memberRole && (
            <p className="mt-3 inline-flex rounded-full border border-brand-green/15 bg-brand-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
              {memberRole} access
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-brand-green/10 bg-brand-green/5 px-4 py-3 text-sm text-gray-600">
          <p className="font-semibold text-brand-dark">Profile completeness</p>
          <p className="mt-1">{profileCompleteness}% complete</p>
        </div>
      </div>

      {banner.text && (
        <div
          className={`rounded-xl border px-5 py-4 text-sm font-medium ${
            banner.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : banner.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-brand-green/15 bg-brand-green/5 text-brand-dark'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="rounded-2xl border border-brand-green/10 bg-white shadow-sm">
            <div className="border-b border-brand-green/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-brand-dark">Brand & Identity</h2>
              <p className="mt-1 text-sm text-gray-500">
                These details shape how your organization appears across hiring and candidate views.
              </p>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-brand-green/10 bg-brand-green/5">
                  {selectedLogoPreview || logoUrl ? (
                    <img
                      src={selectedLogoPreview || logoUrl || ''}
                      alt="Organization logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-4xl text-brand-green">A</span>
                  )}
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-semibold text-brand-dark">Company logo</label>
                  <p className="mt-1 text-sm text-gray-500">
                    Recommended: square PNG or JPG with a clean transparent or white background.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className={`rounded-lg border px-4 py-2 text-sm font-medium ${canEdit ? 'cursor-pointer border-brand-green/20 text-brand-dark hover:bg-brand-green/5' : 'border-gray-200 text-gray-400'}`}>
                      Upload Logo
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                        disabled={!canEdit}
                      />
                    </label>
                    {selectedLogoName && (
                      <span className="text-sm text-gray-500">{selectedLogoName}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Field
                  label="Company name"
                  value={form.name}
                  onChange={(value) => updateField('name', value)}
                  placeholder="Afrigini"
                  disabled={!canEdit}
                  required
                />
                <Field
                  label="Website"
                  value={form.website}
                  onChange={(value) => updateField('website', value)}
                  placeholder="https://company.com"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-brand-green/10 bg-white shadow-sm">
            <div className="border-b border-brand-green/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-brand-dark">Company Profile</h2>
              <p className="mt-1 text-sm text-gray-500">
                Candidate-facing profile details used across job listings and applications.
              </p>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Field
                  label="Industry"
                  value={form.industry}
                  onChange={(value) => updateField('industry', value)}
                  placeholder="Fintech"
                  disabled={!canEdit}
                />
                <Field
                  label="Location"
                  value={form.location}
                  onChange={(value) => updateField('location', value)}
                  placeholder="Lagos, Nigeria"
                  disabled={!canEdit}
                />
                <Field
                  label="LinkedIn"
                  value={form.linkedin_url}
                  onChange={(value) => updateField('linkedin_url', value)}
                  placeholder="https://linkedin.com/company/your-company"
                  disabled={!canEdit}
                />
                <Field
                  label="Company size"
                  value={form.size}
                  onChange={(value) => updateField('size', value)}
                  placeholder="11-50 employees"
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-brand-dark">About the company</label>
                <textarea
                  rows={6}
                  value={form.about}
                  onChange={(event) => updateField('about', event.target.value)}
                  placeholder="Tell candidates what your organization does, who it serves, and what makes the team worth joining."
                  disabled={!canEdit}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-brand-green focus:bg-white focus:ring-2 focus:ring-brand-green/30 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {!canEdit && (
              <p className="text-sm text-gray-500">
                Only organization owners can edit this profile.
              </p>
            )}
            <button
              type="submit"
              disabled={!canEdit || saving || !hasChanges}
              className="inline-flex items-center justify-center rounded-xl bg-brand-green px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border border-brand-green/10 bg-white shadow-sm">
            <div className="border-b border-brand-green/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-brand-dark">Visibility Notes</h2>
            </div>
            <div className="space-y-3 p-6 text-sm text-gray-600">
              <p>
                Recruiters and billing users can reach this page, but only owners can update the organization profile.
              </p>
              <p>
                Platform fields like billing internals, credits, and tiering stay outside this page by design.
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-brand-green/10 bg-white shadow-sm">
            <div className="border-b border-brand-green/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-brand-dark">Candidate Preview</h2>
              <p className="mt-1 text-sm text-gray-500">
                A quick view of how your company profile reads together.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-brand-green/10 bg-brand-green/5">
                  {selectedLogoPreview || logoUrl ? (
                    <img
                      src={selectedLogoPreview || logoUrl || ''}
                      alt={form.name || 'Organization logo'}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-brand-green">
                      {(form.name || 'A').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-lg font-semibold text-brand-dark">{form.name || 'Your Organization'}</p>
                  <p className="text-sm text-gray-500">
                    {[form.industry, form.location].filter(Boolean).join(' • ') || 'Industry and location not added yet'}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 text-gray-600">
                {form.about || 'Your company description will appear here once you add it.'}
              </p>

              <div className="space-y-2 text-sm">
                <PreviewRow label="Website" value={form.website || 'Not provided'} link={form.website} />
                <PreviewRow label="LinkedIn" value={form.linkedin_url || 'Not provided'} link={form.linkedin_url} />
                <PreviewRow label="Size" value={form.size || 'Not provided'} />
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({
  disabled,
  label,
  onChange,
  placeholder,
  required,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-brand-dark">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-brand-green focus:bg-white focus:ring-2 focus:ring-brand-green/30 disabled:cursor-not-allowed disabled:bg-gray-100"
      />
    </div>
  );
}

function PreviewRow({
  label,
  link,
  value,
}: {
  label: string;
  link?: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-right font-medium text-brand-green hover:text-green-800">
          {value}
        </a>
      ) : (
        <span className="text-right font-medium text-brand-dark">{value}</span>
      )}
    </div>
  );
}
