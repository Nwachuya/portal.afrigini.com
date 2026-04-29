'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import { htmlToPlainText } from '@/lib/sanitize-html';
import { UserRecord, JobApplicationRecord } from '@/types';
import { hydrateApplications } from '@/lib/pb-hydration';

// Local Interface Definitions
interface ExpandedJob {
  id: string;
  role: string;
  description: string;
  type: string;
  salary: number;
  currency: string;
  paymentType: string;
  benefits: string;
  stage: string;
  expires: string;
  expand: {
    organization: { id: string; name: string; logo: string; about: string; website: string };
    department: Array<{ id: string; department: string }>;
  };
}

interface ExpandedApplication extends Omit<JobApplicationRecord, 'expand'> {
  expand: {
    job: ExpandedJob;
    applicant?: { id: string; firstName: string; lastName: string; user: string };
  };
}

interface VideoSubmission {
  id: string;
  application: string;
  video_file: string;
  video_url: string;
  created: string;
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ExpandedApplication | null>(null);
  const [videoSubmission, setVideoSubmission] = useState<VideoSubmission | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'record' | 'url'>('record');

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>('video/webm');

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_RECORDING_TIME = 180; // 3 minutes

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = pb.authStore.model as unknown as UserRecord;
        if (!user || user.role !== 'Applicant') { router.push('/login'); return; }
        if (!applicationId) { router.push('/candidates/my-applications'); return; }

        // 1. Fetch Application
        const result = await pb.collection('applications').getOne(applicationId, {
          requestKey: null
        });

        if ((result as unknown as JobApplicationRecord).applicant !== user.id) {
          router.push('/candidates/my-applications');
          return;
        }
        const [expandedResult] = await hydrateApplications([result as unknown as JobApplicationRecord]);
        setApplication(expandedResult as unknown as ExpandedApplication);

        // 2. Fetch Video
        try {
          const videoRes = await pb.collection('videos').getList(1, 1, {
            filter: `application = "${applicationId}"`,
            requestKey: null
          });

          if (videoRes.items.length > 0) {
            setVideoSubmission(videoRes.items[0] as unknown as VideoSubmission);
          }
        } catch (videoErr) {
          console.warn("Video check failed (ignoring):", videoErr);
        }

      } catch (err: any) {
        console.error("Critical Error loading application:", err);
        setError(err.message || "Failed to load application details.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [applicationId, router]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setCameraReady(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError("Could not access camera. Please ensure you have granted permission.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    
    // Determine supported mime type
    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      mimeType = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4'; // Safari support
    }
    
    setRecordedMimeType(mimeType);
    
    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType });
    } catch (e) {
      // Fallback
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
    }

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = () => {
      // Create blob with the actual mime type used
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'video/webm' });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      stopCamera();
    };

    mediaRecorderRef.current.start(1000);
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= MAX_RECORDING_TIME - 1) {
          stopRecording();
          return MAX_RECORDING_TIME;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const resetRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingTime(0);
    startCamera();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoUpload = async () => {
    if (!application) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('application', application.id);

      if (uploadMethod === 'record' && recordedBlob) {
        // Determine extension based on mime type
        const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([recordedBlob], `video-intro.${ext}`, { type: recordedBlob.type });
        formData.append('video_file', file);
      } else if (uploadMethod === 'url' && videoUrl.trim()) {
        formData.append('video_url', videoUrl.trim());
      } else {
        setError('Please record a video or provide a URL');
        setUploading(false);
        return;
      }

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await pb.collection('videos').create(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);

      setVideoSubmission(result as unknown as VideoSubmission);
      setSuccess('Video submitted successfully! Your application is now under review.');

      const updatedApp = await pb.collection('applications').getOne(applicationId, {
        requestKey: null,
      });
      const [hydratedApplication] = await hydrateApplications([updatedApp as unknown as JobApplicationRecord]);
      setApplication(hydratedApplication as unknown as ExpandedApplication);

      setRecordedBlob(null);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setVideoUrl('');
    } catch (err: any) {
      console.error("Error uploading video:", err);
      // Show detailed error if available
      const msg = err?.data?.data?.video_file?.message || err?.message || 'Failed to upload video. Check file size limits.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const getStatusInfo = (stage: string) => {
    const statuses: Record<string, { text: string; bgClass: string; textClass: string; borderClass: string }> = {
      'Applied': { text: 'Application Sent', bgClass: 'bg-blue-50', textClass: 'text-blue-700', borderClass: 'border-blue-200' },
      'Review': { text: 'Under Review', bgClass: 'bg-yellow-50', textClass: 'text-yellow-700', borderClass: 'border-yellow-200' },
      'Send Video': { text: 'Video Requested', bgClass: 'bg-orange-50', textClass: 'text-orange-700', borderClass: 'border-orange-200' },
      'Interview': { text: 'Interview Stage', bgClass: 'bg-purple-50', textClass: 'text-purple-700', borderClass: 'border-purple-200' },
      'Invited': { text: 'Invited', bgClass: 'bg-indigo-50', textClass: 'text-indigo-700', borderClass: 'border-indigo-200' },
      'Accepted': { text: 'Offer Extended', bgClass: 'bg-green-50', textClass: 'text-green-700', borderClass: 'border-green-200' },
      'Completed': { text: 'Completed', bgClass: 'bg-emerald-50', textClass: 'text-emerald-700', borderClass: 'border-emerald-200' },
      'Rejected': { text: 'Not Selected', bgClass: 'bg-red-50', textClass: 'text-red-700', borderClass: 'border-red-200' },
    };
    return statuses[stage] || { text: stage, bgClass: 'bg-gray-50', textClass: 'text-gray-700', borderClass: 'border-gray-200' };
  };

  const formatSalary = (salary: number, currency: string, paymentType: string) => {
    if (!salary) return null;
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 });
    const period = paymentType === 'Hourly' ? '/hr' : paymentType === 'Monthly' ? '/mo' : '/yr';
    return `${formatter.format(salary)}${period}`;
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">Loading application details...</div>;

  if (!application) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Application not found.</p>
        <Link href="/candidates/my-applications" className="text-blue-600 hover:underline mt-4 inline-block">Back to My Applications</Link>
      </div>
    );
  }

  const job = application.expand?.job;
  const org = job?.expand?.organization;
  const orgName = org?.name || 'Confidential Company';
  const departments = job?.expand?.department || [];
  const status = getStatusInfo(application.stage);
  const showVideoUpload = application.stage === 'Send Video' && !videoSubmission;
  const hasSubmittedVideo = !!videoSubmission;
  const descriptionText = htmlToPlainText(job?.description);
  const benefitsText = htmlToPlainText(job?.benefits);
  const coverLetterText = htmlToPlainText(application.cover_letter);

  const logoUrl = org?.logo ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/orgs/${org.id}/${org.logo}` : null;
  const videoFileUrl = videoSubmission?.video_file ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/videos/${videoSubmission.id}/${videoSubmission.video_file}` : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Link href="/candidates/my-applications" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to My Applications
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 flex-shrink-0 text-gray-400">
              {logoUrl ? (
                <img src={logoUrl} alt={orgName} className="h-full w-full object-contain p-2" />
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{job?.role}</h1>
              <p className="text-lg text-gray-600">{orgName}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {job?.type && <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">{job.type}</span>}
                {departments.map(dept => <span key={dept.id} className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">{dept.department}</span>)}
                {job?.salary && <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">{formatSalary(job.salary, job.currency, job.paymentType)}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-4 py-2 text-sm font-bold rounded-full border ${status.bgClass} ${status.textClass} ${status.borderClass}`}>{status.text}</span>
            <p className="text-xs text-gray-400">Applied {new Date(application.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-green-800">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Video Upload */}
          {showVideoUpload && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-orange-900">Video Introduction Requested</h2>
                  <p className="text-orange-700 text-sm mt-1">{orgName} has reviewed your application and would like to see a short video introduction from you. (Max 3 minutes)</p>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <button onClick={() => { setUploadMethod('record'); if (!cameraReady && !recordedUrl) startCamera(); }} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${uploadMethod === 'record' ? 'bg-orange-600 text-white' : 'bg-white text-orange-700 border border-orange-300 hover:bg-orange-100'}`}>Record Video</button>
                <button onClick={() => { setUploadMethod('url'); stopCamera(); }} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${uploadMethod === 'url' ? 'bg-orange-600 text-white' : 'bg-white text-orange-700 border border-orange-300 hover:bg-orange-100'}`}>Paste URL</button>
              </div>

              {uploadMethod === 'record' ? (
                <div className="space-y-4">
                  {cameraError && (
                    <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-red-800 text-sm">
                      {cameraError}
                      <button onClick={startCamera} className="ml-2 underline">Try again</button>
                    </div>
                  )}

                  {/* Recording UI */}
                  {!recordedUrl ? (
                    <div className="space-y-4">
                      {/* Camera Preview */}
                      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                        <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        {!cameraReady && !cameraError && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
                            <svg className="w-12 h-12 mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            <button onClick={startCamera} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">Enable Camera</button>
                          </div>
                        )}
                        {isRecording && (
                          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            REC {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                          </div>
                        )}
                      </div>

                      {/* Recording Controls */}
                      {cameraReady && (
                        <div className="flex justify-center gap-4">
                          {!isRecording ? (
                            <button onClick={startRecording} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-medium">
                              <span className="w-4 h-4 bg-white rounded-full"></span>
                              Start Recording
                            </button>
                          ) : (
                            <button onClick={stopRecording} className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-full hover:bg-gray-900 transition-colors font-medium">
                              <span className="w-4 h-4 bg-red-500 rounded"></span>
                              Stop Recording
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Review Recording */
                    <div className="space-y-4">
                      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                        <video ref={videoPlaybackRef} src={recordedUrl} controls className="w-full h-full object-contain" />
                      </div>
                      <div className="flex justify-center gap-4">
                        <button onClick={resetRecording} className="flex items-center gap-2 px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Re-record
                        </button>
                      </div>
                      <p className="text-center text-sm text-orange-700">Review your video above, then click Submit when ready.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-orange-900 mb-2">Video URL</label>
                  <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..." className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white" />
                  <p className="text-sm text-orange-600 mt-1">Paste a link to your video (YouTube, Vimeo, Loom, etc.)</p>
                </div>
              )}

              {uploading && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-orange-700 mb-1"><span>Uploading...</span><span>{uploadProgress}%</span></div>
                  <div className="w-full bg-orange-200 rounded-full h-2"><div className="bg-orange-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div></div>
                </div>
              )}

              <button onClick={handleVideoUpload} disabled={uploading || (uploadMethod === 'record' && !recordedBlob) || (uploadMethod === 'url' && !videoUrl.trim())} className="mt-4 w-full px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-orange-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {uploading ? (<><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Uploading...</>) : (<><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Submit Video</>)}
              </button>
            </div>
          )}

          {/* Video Submitted */}
          {hasSubmittedVideo && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg"><svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-green-900">Video Submitted</h2>
                  <p className="text-green-700 text-sm mt-1">Your video introduction was submitted on {new Date(videoSubmission.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
                  {videoFileUrl && <div className="mt-4"><video controls className="w-full max-w-md rounded-lg border border-green-200" src={videoFileUrl}>Your browser does not support the video tag.</video></div>}
                  {videoSubmission.video_url && !videoSubmission.video_file && (
                    <a href={videoSubmission.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-3 text-green-700 hover:text-green-900 font-medium">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      View Your Submitted Video
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Job Description */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Job Description</h2>
            {descriptionText ? <div className="whitespace-pre-wrap text-gray-600 leading-relaxed">{descriptionText}</div> : <p className="text-gray-500">No description provided.</p>}
          </div>

          {/* Benefits */}
          {benefitsText && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Benefits</h2>
              <div className="whitespace-pre-wrap text-gray-600 leading-relaxed">{benefitsText}</div>
            </div>
          )}

          {/* Your Submission */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Your Application</h2>
            <div className="space-y-4">
              {coverLetterText && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Cover Letter</h3>
                  <div className="whitespace-pre-wrap text-gray-600 bg-gray-50 rounded-lg p-4 leading-relaxed">{coverLetterText}</div>
                </div>
              )}
              {application.resume_file && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Resume</h3>
                  <a href={`${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/applications/${application.id}/${application.resume_file}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>View Resume
                  </a>
                </div>
              )}
              {application.cover_letter_file && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Cover Letter File</h3>
                  <a href={`${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/applications/${application.id}/${application.cover_letter_file}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>View Cover Letter
                  </a>
                </div>
              )}
              {!application.cover_letter && !application.resume_file && !application.cover_letter_file && <p className="text-gray-500">No additional materials submitted with this application.</p>}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Application Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full mt-1.5"></div>
                <div><p className="font-medium text-gray-900">Application Submitted</p><p className="text-sm text-gray-500">{new Date(application.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
              </div>
              {application.stage !== 'Applied' && (
                <div className="flex items-start gap-3">
                  <div className={`w-3 h-3 rounded-full mt-1.5 ${application.stage === 'Rejected' ? 'bg-red-500' : application.stage === 'Accepted' || application.stage === 'Completed' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <div><p className="font-medium text-gray-900">{status.text}</p><p className="text-sm text-gray-500">Current Status</p></div>
                </div>
              )}
              {hasSubmittedVideo && (
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5"></div>
                  <div><p className="font-medium text-gray-900">Video Submitted</p><p className="text-sm text-gray-500">{new Date(videoSubmission.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">About {orgName}</h2>
            {org?.about ? <p className="text-gray-600 text-sm mb-4">{org.about}</p> : <p className="text-gray-500 text-sm mb-4">Organization details are not available on this view.</p>}
            {org?.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>Visit Website
              </a>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <Link href={`/candidates/jobs/${job?.id}`} className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>View Original Job Posting
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
