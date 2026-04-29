'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import { htmlToPlainText } from '@/lib/sanitize-html';
import { ApplicationCommentRecord, JobApplicationRecord, UserRecord } from '@/types';
import { canReviewApplications, getDefaultOrgPath } from '@/lib/access';
import { getCurrentOrgMembership } from '@/lib/org-membership';
import { hydrateApplications } from '@/lib/pb-hydration';
import { formatCandidateFullName } from '@/lib/candidate-name';

// --- Interfaces ---

interface CommentRecord {
  id: string;
  created: string;
  message: string;
  author: string;
}

interface VideoSubmission {
  id: string;
  video_file: string;
  video_url: string;
}

interface FullApplication {
  id: string;
  stage: string;
  cover_letter: string;
  resume_file: string;
  created: string;
  expand: {
    job: {
      role: string;
      organization: string;
      description: string;
      benefits: string;
      type: string;
      salary: number;
      currency: string;
      paymentType: string;
    };
    applicant: {
      firstName: string;
      lastName: string;
      headline?: string;
      email?: string;
      linkedin?: string;
      portfolio?: string;
      skills?: string[] | string;
      id: string;
      user: string;
    };
  };
}

export default function ApplicationReviewPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.id as string;

  const [app, setApp] = useState<FullApplication | null>(null);
  const [video, setVideo] = useState<VideoSubmission | null>(null);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserRecord | null>(null);
  
  // UI State: 'comments' or 'job'
  const [activeTab, setActiveTab] = useState<'comments' | 'job'>('comments');
  
  // Actions
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const STAGES = [
    'Applied', 'Review', 'Invited', 'Send Video', 
    'Interview', 'Rejected', 'Accepted', 'Completed', 'Invite'
  ];

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = pb.authStore.model as unknown as UserRecord;
        if (!currentUser) {
          router.replace('/login');
          return;
        }

        const membership = await getCurrentOrgMembership(currentUser.id);
        if (membership?.role && !canReviewApplications(membership.role)) {
          router.replace(getDefaultOrgPath(membership.role));
          return;
        }

        setUser(currentUser);

        // 1. Fetch Application Details (Job expanded)
        const appRes = await pb.collection('applications').getOne(appId, {
          requestKey: null,
        });
        const [hydratedApplication] = await hydrateApplications([appRes as unknown as JobApplicationRecord]);
        setApp(hydratedApplication as unknown as FullApplication);

        // 2. Fetch Video
        try {
          const videoRes = await pb.collection('videos').getList(1, 1, {
            filter: `application = "${appId}"`,
          });
          if (videoRes.items.length > 0) {
            setVideo(videoRes.items[0] as unknown as VideoSubmission);
          }
        } catch (e) { /* No video */ }

        // 3. Fetch Comments
        await fetchComments();

      } catch (err) {
        console.error("Error loading application:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [appId, router]);

  const fetchComments = async () => {
    try {
      const res = await pb.collection('comments').getList(1, 100, {
        filter: `application = "${appId}"`,
        sort: '-created',
        requestKey: null,
      });
      setComments(res.items as unknown as ApplicationCommentRecord[] as unknown as CommentRecord[]);
    } catch (e) { console.error(e); }
  };

  const handleStatusChange = async (newStage: string) => {
    if (!app) return;
    setUpdatingStatus(true);
    try {
      await pb.collection('applications').update(appId, { stage: newStage });
      setApp({ ...app, stage: newStage });
    } catch (err) { alert("Failed to update status"); } 
    finally { setUpdatingStatus(false); }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmittingComment(true);
    try {
      await pb.collection('comments').create({
        application: appId,
        author: user.id,
        message: newComment,
      });
      setNewComment('');
      await fetchComments();
    } catch (err) { alert("Failed to post comment"); } 
    finally { setSubmittingComment(false); }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">Loading application...</div>;
  if (!app) return <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">Application not found.</div>;

  const applicant = app.expand?.applicant;
  const job = app.expand?.job;
  const fullName = applicant
    ? formatCandidateFullName(applicant.firstName, applicant.lastName, 'Unknown Candidate')
    : 'Unknown Candidate';
  
  let skillsList: string[] = [];
  if (Array.isArray(applicant?.skills)) skillsList = applicant.skills;
  else if (typeof applicant?.skills === 'string') skillsList = (applicant.skills as string).split(',');

  const resumeUrl = app.resume_file 
    ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/applications/${app.id}/${app.resume_file}`
    : null;
  const coverLetterText = htmlToPlainText(app.cover_letter);
  const jobDescriptionText = htmlToPlainText(app.expand?.job?.description);
  const jobBenefitsText = htmlToPlainText(app.expand?.job?.benefits);

  const videoFileUrl = video?.video_file 
    ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/videos/${video.id}/${video.video_file}`
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/org/applications" className="text-sm text-gray-500 hover:text-brand-dark font-medium flex items-center group">
          <svg className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Applications
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Main Info (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Header Card */}
          <div className="bg-white border border-brand-green/10 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-brand-dark">{fullName}</h1>
                <p className="text-gray-600">Applied for <span className="font-semibold text-gray-800">{job?.role}</span></p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {skillsList.map((skill, i) => (
                    <span key={i} className="px-2 py-1 bg-brand-green/10 text-brand-green text-xs rounded-full border border-brand-green/10">
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status Dropdown */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Current Stage</label>
                <div className="relative">
                  <select
                    value={app.stage}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="appearance-none w-48 pl-4 pr-10 py-2 bg-white border border-gray-300 text-gray-900 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green shadow-sm cursor-pointer"
                  >
                    {STAGES.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
                {updatingStatus && <p className="text-xs text-brand-green mt-1 absolute right-0">Updating...</p>}
              </div>
            </div>
          </div>

          {/* 2. Video Submission */}
          <div className="bg-white border border-brand-green/10 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-dark uppercase tracking-wide mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Video Introduction
            </h3>
            
            {video ? (
              <div className="space-y-4">
                {videoFileUrl && (
                  <div className="rounded-lg overflow-hidden bg-black aspect-video shadow-md">
                    <video controls className="w-full h-full" src={videoFileUrl}>
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}
                {video.video_url && (
                  <div className="p-4 bg-brand-green/5 rounded-lg flex items-center justify-between border border-brand-green/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-full border border-brand-green/10 shadow-sm">
                        <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-gray-900">External Video Link</p>
                        <a href={video.video_url} target="_blank" className="text-xs text-brand-green hover:text-green-800 truncate block">{video.video_url}</a>
                      </div>
                    </div>
                    <a href={video.video_url} target="_blank" className="px-4 py-2 bg-white border border-brand-green/20 rounded-lg text-sm font-medium hover:bg-brand-green/5 text-brand-dark transition-colors">
                      Open
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 bg-brand-green/5 rounded-lg border border-dashed border-brand-green/20 text-center">
                <p className="text-gray-500 text-sm">No video introduction submitted yet.</p>
                {app.stage !== 'Send Video' && (
                  <button 
                    onClick={() => handleStatusChange('Send Video')}
                    className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg border border-brand-green/20 bg-white px-3 py-2 text-sm font-medium text-brand-green hover:bg-brand-green/5"
                  >
                    Request Video Interview
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. Contact & Links */}
          <div className="bg-white border border-brand-green/10 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-dark uppercase tracking-wide mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
              Contact & Resume
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block mb-1">Headline</span>
                <span className="font-medium text-gray-900">{applicant?.headline || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Resume</span>
                {resumeUrl ? (
                  <a href={resumeUrl} target="_blank" className="text-brand-green hover:text-green-800 flex items-center gap-1 font-medium">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Download PDF
                  </a>
                ) : (
                  <span className="text-gray-400 italic">No resume attached</span>
                )}
              </div>
              {applicant?.linkedin && (
                <div>
                  <span className="text-gray-500 block mb-1">LinkedIn</span>
                  <a href={applicant.linkedin} target="_blank" className="text-brand-green hover:text-green-800 truncate block">{applicant.linkedin}</a>
                </div>
              )}
              {applicant?.portfolio && (
                <div>
                  <span className="text-gray-500 block mb-1">Portfolio</span>
                  <a href={applicant.portfolio} target="_blank" className="text-brand-green hover:text-green-800 truncate block">{applicant.portfolio}</a>
                </div>
              )}
            </div>
          </div>

          {/* 4. Cover Letter */}
          <div className="bg-white border border-brand-green/10 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-dark uppercase tracking-wide mb-4">Cover Letter</h3>
            {coverLetterText ? (
              <div className="whitespace-pre-wrap text-gray-600 text-sm leading-relaxed">
                {coverLetterText}
              </div>
            ) : (
              <p className="italic text-gray-400">No cover letter provided.</p>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Tabbed Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-brand-green/10 rounded-2xl shadow-sm flex flex-col h-[600px] sticky top-6 overflow-hidden">
            
            {/* TABS */}
            <div className="flex border-b border-brand-green/10 bg-brand-green/5">
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'comments' ? 'text-brand-green border-b-2 border-brand-green bg-brand-green/5' : 'text-gray-500 hover:text-brand-dark'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Discussion
              </button>
              <button
                onClick={() => setActiveTab('job')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'job' ? 'text-brand-green border-b-2 border-brand-green bg-brand-green/5' : 'text-gray-500 hover:text-brand-dark'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Job Details
              </button>
            </div>

            {/* TAB CONTENT: Comments */}
            {activeTab === 'comments' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {comments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                      <p>No comments yet.</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green text-xs font-bold border border-brand-green/10">
                          {comment.author === user?.id ? 'Y' : 'T'}
                        </div>
                        <div className="bg-brand-green/5 p-3 rounded-lg rounded-tl-none text-sm w-full border border-brand-green/10">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-gray-900">{comment.author === user?.id ? 'You' : 'Team member'}</span>
                            <span className="text-[10px] text-gray-400">{new Date(comment.created).toLocaleDateString()}</span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{comment.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t border-brand-green/10 bg-white">
                  <form onSubmit={handlePostComment}>
                    <div className="relative">
                      <textarea
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg p-3 pr-10 text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none resize-none"
                        placeholder="Leave a note for the team..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                      ></textarea>
                      <button 
                        type="submit" 
                        disabled={submittingComment || !newComment.trim()}
                        className="absolute bottom-2 right-2 p-1.5 bg-brand-green text-white rounded-md hover:bg-green-800 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}

            {/* TAB CONTENT: Job Specs */}
            {activeTab === 'job' && app?.expand?.job && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
                <div>
                  <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Compensation</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-brand-green/10 text-brand-green border border-brand-green/10 rounded font-medium">
                      {app.expand.job.salary > 0 ? `${app.expand.job.currency} ${app.expand.job.salary.toLocaleString()}` : 'Negotiable'}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded">
                      {app.expand.job.type}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded">
                      {app.expand.job.paymentType}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Description</h4>
                  {jobDescriptionText ? (
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {jobDescriptionText}
                    </div>
                  ) : (
                    <p className="text-gray-400">No description provided.</p>
                  )}
                </div>

                {jobBenefitsText && (
                  <div>
                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Benefits</h4>
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {jobBenefitsText}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
