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
