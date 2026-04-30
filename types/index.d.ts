import PocketBase from 'pocketbase';

// 1. Define specific Role types
export type OrgRole = 'recruiter' | 'billing' | 'owner';
export type UserRole = 'Applicant' | 'Company' | OrgRole;

// 2. Base Record Interface (Common fields for all PB records)
export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

// 3. Collection Interfaces

export interface UserRecord extends BaseRecord {
  email: string;
  name?: string;
  avatar?: string;
  role: UserRole;
  is_super_admin?: boolean;
  emailVisibility: boolean;
  verified: boolean;
}

export interface CandidateProfileRecord extends BaseRecord {
  user: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  bio?: string;
  headshot?: string;
  resume?: string;
  resume_generated?: string;
  resume_generated_redacted?: string;
  resume_generated_pdf?: string;
  skills?: string[] | string; // Can be JSON array or string depending on parsing
  is_open_to_work: boolean;
  location?: any; // JSON or string
  preference?: string[];
  emailAlert?: boolean;
  country?: string;
  level?: string;
  linkedin?: string;
  portfolio?: string;
  gender?: 'Male' | 'Female' | 'Non Binary';
  work_experience?: any;
  languages?: any;
  education?: any;
  certifications?: any;
}

export interface OrganizationRecord extends BaseRecord {
  name?: string;
  about?: string;
  website?: string;
  logo?: string;
  industry?: string;
  location?: string;
  linkedin_url?: string;
  size?: string;
}

export interface OrgAdminRecord extends BaseRecord {
  org: string;
  stripe_cus_id?: string;
  is_personal?: boolean;
  tier?: number;
  job_credit?: number;
}

export interface JobRecord extends BaseRecord {
  role: string;
  department?: string | string[];
  organization: string;
  description?: string;
  benefits?: string;
  stage: 'Open' | 'Draft' | 'Filled' | 'Archived';
  expires?: string;
  type?: 'Full Time' | 'Part Time' | 'Contract';
  salary?: number;
  currency?: 'USD' | 'EUR' | 'GBP';
  paymentType?: 'Monthly' | 'Hourly' | 'Annually';
  scope?: 'Listing Only' | 'Full Recruitment';
  wp_post_id?: number;
  question_one: string;
  question_two: string;
  question_three: string;
  question_four: string;
  question_five: string;
  // Expanded fields helper
  expand?: {
    organization?: OrganizationRecord;
    department?: DepartmentRecord[];
  };
}

export interface JobApplicationRecord extends BaseRecord {
  job: string;
  applicant: string; // User ID
  stage: 'Applied' | 'Review' | 'Invited' | 'Send Video' | 'Interview' | 'Rejected' | 'Accepted' | 'Completed' | 'Invite';
  cover_letter?: string;
  resume_file?: string;
  cover_letter_file?: string;
  earliest_start_date?: string;
  answer_one: string;
  answer_two: string;
  answer_three: string;
  answer_four: string;
  answer_five: string; 
  expand?: {
    job?: JobRecord;
    applicant?: CandidateProfileRecord;
  };
}

export interface DepartmentRecord extends BaseRecord {
  department: string;
}

export interface OrgInviteRecord extends BaseRecord {
  organization: string;
  email: string;
  open?: boolean;
  invited_by: string;
  role: OrgRole;
}

export interface OrgMemberRecord extends BaseRecord {
  organization: string;
  user: string;
  role: OrgRole;
  expand?: {
    user?: UserRecord;
    organization?: OrganizationRecord;
  };
}

export interface VideoSubmissionRecord extends BaseRecord {
  application: string;
  video_file?: string;
  video_url?: string;
}

export interface ApplicationCommentRecord extends BaseRecord {
  application: string;
  author: string;
  message: string;
  expand?: {
    author?: UserRecord;
  };
}

export interface JobInvitationRecord extends BaseRecord {
  organization?: string;
  job?: string;
  candidate_profile?: string;
  message?: string;
  status?: 'pending' | 'accepted' | 'declined';
  expand?: {
    job?: JobRecord;
    organization?: OrganizationRecord;
  };
}

export interface PlacementRecord extends BaseRecord {
  org_id: string;
  job_id: string;
  application_id: string;
  candidate_id: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'paused' | 'ended';
  created_by_user: string;
}

export interface SalaryScheduleRecord extends BaseRecord {
  org_id: string;
  placement_id: string;
  candidate_id: string;
  amount_usd: number;
  cadence: 'monthly';
  day_of_month: number;
  effective_from: string;
  effective_to?: string;
  status: 'active' | 'paused' | 'ended';
}

export interface SalaryPaymentRequestRecord extends BaseRecord {
  org_id: string;
  placement_id: string;
  salary_schedule_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  salary_amount_usd: number;
  platform_fee_usd: number;
  provider_fee_usd: number;
  total_due_usd: number;
  status: 'draft' | 'pending_payment' | 'paid' | 'overdue' | 'canceled';
  payment_method?: 'stablecoin' | 'stripe';
  stripe_session_id?: string;
  stablecoin_deposit_id?: string;
  paid_at?: string;
}

export interface StablecoinDepositRecord extends BaseRecord {
  org_id: string;
  salary_payment_request_id: string;
  asset: 'USDC' | 'USDT';
  chain: 'base';
  provider: 'bridge';
  deposit_address: string;
  amount_expected_usd: number;
  amount_received_usd?: number;
  tx_hash?: string;
  status: 'awaiting_payment' | 'confirming' | 'confirmed' | 'failed' | 'expired';
  raw_provider_event?: any;
}

export interface CandidatePayoutProfileRecord extends BaseRecord {
  candidate_id: string;
  user_id: string;
  method: 'bank' | 'momo';
  country: string;
  currency: string;
  details: any;
  status: 'draft' | 'verified' | 'disabled';
}

export interface CandidatePayoutRecord extends BaseRecord {
  org_id: string;
  placement_id: string;
  salary_payment_request_id: string;
  candidate_id: string;
  payout_profile_id: string;
  amount_usd: number;
  currency_local: string;
  amount_local: number;
  fx_rate?: number;
  status: 'queued' | 'processing' | 'paid' | 'failed' | 'canceled';
  provider: 'bridge';
  provider_ref?: string;
  error_message?: string;
  executed_at?: string;
}

export interface CandidatePlacementEligibility {
  eligible: boolean;
  candidateId?: string;
  placementId?: string;
  orgId?: string;
  reason?: string;
}

export interface PlacedPaymentsOverview {
  pendingRequests: number;
  fundedRequests: number;
  queuedPayouts: number;
  completedPayouts: number;
  latestRequestAt?: string;
  latestPayoutAt?: string;
}

export interface CandidatePaymentRequestRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  totalDueUsd: number;
  salaryAmountUsd: number;
  paymentMethod: 'stablecoin' | 'stripe';
  requestStatus: SalaryPaymentRequestRecord['status'];
  depositStatus: StablecoinDepositRecord['status'] | 'paid' | null;
  depositId: string | null;
}

export interface CandidateDepositRow {
  id: string;
  requestId: string;
  asset: StablecoinDepositRecord['asset'];
  chain: StablecoinDepositRecord['chain'];
  provider: StablecoinDepositRecord['provider'];
  expectedUsd: number;
  receivedUsd: number | null;
  txHash: string | null;
  status: StablecoinDepositRecord['status'];
  created: string;
}

export interface CandidatePayoutRow {
  id: string;
  salaryPaymentRequestId: string;
  amountUsd: number;
  amountLocal: number;
  currencyLocal: string;
  status: CandidatePayoutRecord['status'];
  provider: CandidatePayoutRecord['provider'];
  providerRef: string | null;
  executedAt: string | null;
  created: string;
}
