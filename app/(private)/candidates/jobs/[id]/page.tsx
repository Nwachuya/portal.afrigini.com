'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import { htmlToPlainText } from '@/lib/sanitize-html';
import { JobRecord, UserRecord, CandidateProfileRecord } from '@/types';
import { hydrateJobs } from '@/lib/pb-hydration';

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // Data State
  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [profile, setProfile] = useState<CandidateProfileRecord | null>(null);
  
  // Application Form State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form Fields
  const [resumeChoice, setResumeChoice] = useState<'existing' | 'new' | 'generated'>('existing');
  const [coverLetterType, setCoverLetterType] = useState<'text' | 'file'>('text');
  const [coverLetterText, setCoverLetterText] = useState('');
  const [startDate, setStartDate] = useState('');
  
  // Answer Fields
  const [answerOne, setAnswerOne] = useState('');
  const [answerTwo, setAnswerTwo] = useState('');
  const [answerThree, setAnswerThree] = useState('');
  const [answerFour, setAnswerFour] = useState('');
  const [answerFive, setAnswerFive] = useState('');
  
  // File Refs
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const coverLetterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = pb.authStore.model as unknown as UserRecord;
        setUser(currentUser);

        // 1. Fetch Job
        const jobRes = await pb.collection('jobs').getOne(id, {
          requestKey: null,
        });
        const [hydratedJob] = await hydrateJobs([jobRes as unknown as JobRecord]);
        setJob(hydratedJob ?? null);

        // 2. Check User Status
        if (currentUser) {
          try {
            const profileRes = await pb.collection('candidates').getFirstListItem(
              `user = "${currentUser.id}"`
            );
            setProfile(profileRes as unknown as CandidateProfileRecord);

            if (profileRes) {
              const applications = await pb.collection('applications').getList(1, 1, {
                filter: `job = "${id}" && applicant = "${currentUser.id}"`,
                requestKey: null,
              });
              if (applications.totalItems > 0) setHasApplied(true);
            }
          } catch (e) {
            // No profile or not applied
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const openApplicationModal = () => {
    if (!user) {
      router.push('/login?redirect=/candidates/jobs/' + id);
      return;
    }
    if (user.role !== 'Applicant') {
      setError("Company accounts cannot apply to jobs.");
      return;
    }
    if (!profile) {
      setError("Please create your candidate profile in the Dashboard before applying.");
      return;
    }
    
    // Reset form and open
    setError('');
    if (profile.resume_generated_pdf) {
      setResumeChoice('generated');
    } else {
      setResumeChoice(profile.resume ? 'existing' : 'new');
    }
    setStartDate('');
    setCoverLetterText('');
    setAnswerOne('');
    setAnswerTwo('');
    setAnswerThree('');
    setAnswerFour('');
    setAnswerFive('');
    setShowModal(true);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !job || !user) return;
    
    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('job', id);
      formData.append('applicant', user.id);
      formData.append('stage', 'Applied');
      
      // Earliest Start Date
      if (startDate) {
        formData.append('earliest_start_date', new Date(startDate).toISOString());
      }

      // Handle Resume
      if (resumeChoice === 'new') {
        if (resumeInputRef.current?.files?.length) {
          formData.append('resume_file', resumeInputRef.current.files[0]);
        } else {
          throw new Error("Please select a resume file to upload.");
        }
      } else if (resumeChoice === 'generated') {
        if (!profile.resume_generated_pdf) {
          throw new Error("Generated resume PDF is not available yet.");
        }
        const pdfUrl = `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/candidates/${profile.id}/${profile.resume_generated_pdf}`;
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
          throw new Error("Failed to fetch generated resume PDF.");
        }
        const pdfBlob = await pdfResponse.blob();
        formData.append('resume_file', new File([pdfBlob], 'generated-resume.pdf', { type: 'application/pdf' }));
      } 

      // Handle Cover Letter
      if (coverLetterType === 'text' && coverLetterText) {
        formData.append('cover_letter', coverLetterText);
      } else if (coverLetterType === 'file' && coverLetterInputRef.current?.files?.length) {
        formData.append('cover_letter_file', coverLetterInputRef.current.files[0]);
      }

      // Handle Answers
      if (job.question_one && answerOne) {
        formData.append('answer_one', answerOne);
      }
      if (job.question_two && answerTwo) {
        formData.append('answer_two', answerTwo);
      }
      if (job.question_three && answerThree) {
        formData.append('answer_three', answerThree);
      }
      if (job.question_four && answerFour) {
        formData.append('answer_four', answerFour);
      }
      if (job.question_five && answerFive) {
        formData.append('answer_five', answerFive);
      }

      await pb.collection('applications').create(formData);
      
      setHasApplied(true);
      setShowModal(false);
    } catch (err: any) {
      console.error("Application error:", err);
      setError(err.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  // Check if job has any screening questions
  const hasQuestions = job && (
    job.question_one || 
    job.question_two || 
    job.question_three || 
    job.question_four || 
    job.question_five
  );

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500">Loading...</div>;
  if (!job) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500">Job not found.</div>;

  const org = job.expand?.organization;
  const orgName = org?.name || 'Confidential Company';
  const logoUrl = org?.logo 
    ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/orgs/${org.id}/${org.logo}`
    : null;
  const descriptionText = htmlToPlainText(job.description);
  const benefitsText = htmlToPlainText(job.benefits);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link */}
      <div className="mb-6">
        <Link href="/candidates/jobs" className="text-sm text-gray-500 hover:text-gray-900 font-medium flex items-center group">
          <svg className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Jobs
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="h-20 w-20 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100 overflow-hidden text-gray-400">
                {logoUrl ? (
                  <img src={logoUrl} alt={orgName} className="h-full w-full object-contain" />
                ) : (
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
              </div>
              <div className="flex-grow">
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">{job.role}</h1>
                <p className="text-lg text-gray-600 font-medium mt-1">{orgName}</p>
                <div className="flex flex-wrap gap-3 mt-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full">
                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {job.type}
                  </span>
                  {(job.salary ?? 0) > 0 && (
                    <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100">
                      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {job.currency} {(job.salary ?? 0).toLocaleString()} / {job.paymentType}
                    </span>
                  )}
                  {job.expand?.department?.map((dept: any) => (
                     <span key={dept.id} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                       <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                       </svg>
                       {dept.department}
                     </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-8">
            {descriptionText && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">About the Role</h2>
                <div className="whitespace-pre-wrap text-gray-600 leading-relaxed">
                  {descriptionText}
                </div>
              </section>
            )}
            {benefitsText && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Benefits & Perks</h2>
                <div className="whitespace-pre-wrap text-gray-600 leading-relaxed">
                  {benefitsText}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm sticky top-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Interested?</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {error}
              </div>
            )}

            {user?.role === 'Company' ? (
              <div className="p-4 bg-gray-50 text-gray-600 text-center rounded-lg text-sm border border-gray-100">
                <span className="block text-2xl mb-2">🏢</span>
                Logged in as Company. <br/> Switch to an Applicant account to apply.
              </div>
            ) : hasApplied ? (
              <div className="w-full py-4 bg-green-50 text-green-700 font-bold rounded-lg border border-green-200 flex flex-col items-center justify-center text-center">
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Application Sent!</span>
              </div>
            ) : (
              <button 
                onClick={openApplicationModal}
                className="w-full py-3.5 bg-brand-green text-white font-bold rounded-lg hover:bg-brand-green/90 transition-all shadow-md hover:shadow-lg"
              >
                Apply Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* APPLICATION MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-900">Apply for {job.role}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <form onSubmit={handleSubmitApplication} className="p-6 space-y-6">
              
              {/* 1. Resume Selection */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Resume</h4>
                <div className="space-y-3">
                  <label className={`flex items-start p-3 border rounded-lg transition-colors w-full ${
                    profile?.resume_generated_pdf ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'
                  }`}>
                    <input
                      type="radio"
                      name="resume"
                      checked={resumeChoice === 'generated'}
                      onChange={() => profile?.resume_generated_pdf && setResumeChoice('generated')}
                      disabled={!profile?.resume_generated_pdf}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 mt-1 flex-shrink-0"
                    />
                    <div className="ml-3 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">Use generated resume</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                          Recommended
                        </span>
                        {profile?.resume_generated_pdf && (
                          <a
                            href={`${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/candidates/${profile.id}/${profile.resume_generated_pdf}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs"
                          >
                            View generated PDF
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {profile?.resume_generated_pdf
                          ? 'Auto-generated from your profile.'
                          : 'Not available yet — complete your profile to generate it.'}
                      </p>
                    </div>
                  </label>
                  {profile?.resume && (
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors w-full">
                      <input 
                        type="radio" 
                        name="resume" 
                        checked={resumeChoice === 'existing'} 
                        onChange={() => setResumeChoice('existing')}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 flex-shrink-0" 
                      />
                      <div className="ml-3 text-sm text-gray-700 flex items-center min-w-0">
                        <span className="whitespace-nowrap mr-1">Use existing resume</span>
                        <span className="text-gray-400 text-xs truncate" title={profile.resume}>
                          ({profile.resume})
                        </span>
                      </div>
                    </label>
                  )}
                  
                  <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input 
                      type="radio" 
                      name="resume" 
                      checked={resumeChoice === 'new'} 
                      onChange={() => setResumeChoice('new')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 mt-1" 
                    />
                    <div className="ml-3 w-full">
                      <span className="block text-sm text-gray-700 mb-2">Upload new resume</span>
                      {resumeChoice === 'new' && (
                        <input 
                          type="file" 
                          ref={resumeInputRef}
                          accept=".pdf,.doc,.docx"
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Cover Letter */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Cover Letter <span className="text-gray-400 font-normal text-sm">(Optional)</span></h4>
                <div className="flex gap-4 mb-3 text-sm">
                  <button 
                    type="button"
                    onClick={() => setCoverLetterType('text')}
                    className={`pb-1 border-b-2 ${coverLetterType === 'text' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Write Note
                  </button>
                  <button 
                    type="button"
                    onClick={() => setCoverLetterType('file')}
                    className={`pb-1 border-b-2 ${coverLetterType === 'file' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Upload File
                  </button>
                </div>

                {coverLetterType === 'text' ? (
                  <textarea 
                    rows={4}
                    value={coverLetterText}
                    onChange={(e) => setCoverLetterText(e.target.value)}
                    placeholder="Introduce yourself and explain why you're a good fit..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  ></textarea>
                ) : (
                  <input 
                    type="file" 
                    ref={coverLetterInputRef}
                    accept=".pdf,.doc,.docx"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                )}
              </div>

              {/* 3. Earliest Start Date */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Availability</h4>
                <label className="block text-sm text-gray-600 mb-1">Earliest Start Date</label>
                <input 
                  type="date" 
                  min={new Date().toISOString().split("T")[0]} // 👈 This line adds the restriction
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* 4. Screening Questions */}
              {hasQuestions && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Screening Questions</h4>
                  <div className="space-y-4">
                    {job.question_one && (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">{job.question_one}</label>
                        <textarea
                          rows={2}
                          value={answerOne}
                          onChange={(e) => setAnswerOne(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          placeholder="Your answer..."
                        />
                      </div>
                    )}
                    {job.question_two && (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">{job.question_two}</label>
                        <textarea
                          rows={2}
                          value={answerTwo}
                          onChange={(e) => setAnswerTwo(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          placeholder="Your answer..."
                        />
                      </div>
                    )}
                    {job.question_three && (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">{job.question_three}</label>
                        <textarea
                          rows={2}
                          value={answerThree}
                          onChange={(e) => setAnswerThree(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          placeholder="Your answer..."
                        />
                      </div>
                    )}
                    {job.question_four && (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">{job.question_four}</label>
                        <textarea
                          rows={2}
                          value={answerFour}
                          onChange={(e) => setAnswerFour(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          placeholder="Your answer..."
                        />
                      </div>
                    )}
                    {job.question_five && (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">{job.question_five}</label>
                        <textarea
                          rows={2}
                          value={answerFive}
                          onChange={(e) => setAnswerFive(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          placeholder="Your answer..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-brand-green text-white font-medium rounded-lg hover:bg-brand-green/90 disabled:opacity-70 transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
