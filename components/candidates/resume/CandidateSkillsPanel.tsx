export default function CandidateSkillsPanel({
  skills,
  languages,
}: {
  skills: string[];
  languages: string[];
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[24px] border border-brand-green/10 bg-white p-6 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold text-brand-dark">Skills and Languages</h2>

      <div className="mt-5 space-y-5">
        <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <h3 className="text-sm font-semibold text-gray-600">Skills</h3>
          {skills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="max-w-full break-words rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No skills listed yet.</p>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <h3 className="text-sm font-semibold text-gray-600">Languages</h3>
          {languages.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {languages.map((language) => (
                <span key={language} className="max-w-full break-words rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700">
                  {language}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No languages listed yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
