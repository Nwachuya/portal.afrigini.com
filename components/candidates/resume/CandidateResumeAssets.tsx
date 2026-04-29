export default function CandidateResumeAssets({
  uploadedResumeUrl,
  uploadedResumeName,
  generatedPdfUrl,
  generatedMarkdown,
}: {
  uploadedResumeUrl: string | null;
  uploadedResumeName: string | null;
  generatedPdfUrl: string | null;
  generatedMarkdown: string | null;
}) {
  const generatedPreview = generatedMarkdown
    ? generatedMarkdown.split('\n').slice(0, 10).join('\n')
    : '';

  const handleDownloadMarkdown = () => {
    if (!generatedMarkdown) {
      return;
    }

    const blob = new Blob([generatedMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'generated-resume.md';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-[24px] border border-brand-green/10 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-dark">Resume Assets</h2>
          <p className="mt-1 text-sm text-gray-500">Preview the files and generated content attached to your candidate profile.</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
          <h3 className="text-sm font-semibold text-gray-600">Uploaded Resume</h3>
          {uploadedResumeUrl ? (
            <div className="mt-4 space-y-3">
              <p className="break-all text-sm text-gray-700">{uploadedResumeName || 'Current resume file'}</p>
              <div className="pt-1">
                <a
                  href={uploadedResumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border border-brand-green/20 px-4 py-2 text-sm font-semibold text-brand-green transition-colors hover:bg-green-50"
                >
                  View uploaded resume
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No uploaded resume attached yet.</p>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
          <h3 className="text-sm font-semibold text-gray-600">Generated PDF</h3>
          {generatedPdfUrl ? (
            <div className="mt-4 space-y-3">
              <div className="pt-1">
                <a
                  href={generatedPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border border-brand-green/20 px-4 py-2 text-sm font-semibold text-brand-green transition-colors hover:bg-green-50"
                >
                  View generated PDF
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No generated PDF available yet.</p>
          )}
        </div>
      </div>

      <div className="mt-4 min-w-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-600">Generated Resume Content</h3>
            <p className="mt-1 text-sm text-gray-500">Generated from your saved profile fields.</p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              disabled={!generatedMarkdown}
              className="inline-flex w-full items-center justify-center rounded-xl bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Download .md
            </button>
          </div>
        </div>

        {generatedMarkdown ? (
          <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-gray-200 bg-white p-4 text-xs leading-6 text-gray-700">
            {generatedPreview}
          </pre>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Generated resume content will appear here after your profile has enough data to produce one.</p>
        )}
      </div>
    </section>
  );
}
