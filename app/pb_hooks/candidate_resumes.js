/// <reference path="../pb_data/types.d.ts" />
// PocketBase JS hook for generating resumes from candidate profile fields.
// PB version: v0.36.1

const PDFDocument = (() => {
  try {
    return require('pdfkit');
  } catch (err) {
    return null;
  }
})();

const SOURCE_FIELDS = [
  'firstName',
  'lastName',
  'headline',
  'bio',
  'country',
  'level',
  'linkedin',
  'portfolio',
  'skills',
  'languages',
  'work_experience',
  'education',
  'certifications',
];

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function sanitizeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function formatDateRange(start, end, isCurrent) {
  const startText = sanitizeText(start);
  const endText = isCurrent ? 'Present' : sanitizeText(end);
  if (startText && endText) return `${startText} - ${endText}`;
  if (startText) return startText;
  if (endText) return endText;
  return '';
}

function buildMarkdown(record) {
  const firstName = sanitizeText(record.get('firstName'));
  const lastName = sanitizeText(record.get('lastName'));
  const headline = sanitizeText(record.get('headline'));
  const bio = sanitizeText(record.get('bio'));
  const country = sanitizeText(record.get('country'));
  const level = sanitizeText(record.get('level'));
  const linkedin = sanitizeText(record.get('linkedin'));
  const portfolio = sanitizeText(record.get('portfolio'));

  const skills = toArray(record.get('skills'));
  const languages = toArray(record.get('languages'));
  const workExperience = toArray(record.get('work_experience'));
  const education = toArray(record.get('education'));
  const certifications = toArray(record.get('certifications'));

  const lines = [];

  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (fullName) lines.push(`# ${fullName}`);
  if (headline) lines.push(`**${headline}**`);
  if (country || level) {
    const meta = [country, level].filter(Boolean).join(' · ');
    if (meta) lines.push(meta);
  }
  if (linkedin || portfolio) {
    const links = [linkedin, portfolio].filter(Boolean).join(' | ');
    if (links) lines.push(links);
  }
  if (lines.length) lines.push('');

  if (bio) {
    lines.push('## Summary');
    lines.push(bio);
    lines.push('');
  }

  if (skills.length) {
    lines.push('## Skills');
    skills.forEach((skill) => lines.push(`- ${sanitizeText(skill)}`));
    lines.push('');
  }

  if (languages.length) {
    lines.push('## Languages');
    languages.forEach((lang) => lines.push(`- ${sanitizeText(lang)}`));
    lines.push('');
  }

  if (workExperience.length) {
    lines.push('## Work Experience');
    workExperience.forEach((item) => {
      const role = sanitizeText(item.role);
      const company = sanitizeText(item.company);
      const dateRange = formatDateRange(item.startDate, item.endDate, item.isCurrent);
      const header = [role, company].filter(Boolean).join(' — ');
      if (header) lines.push(`**${header}**`);
      if (dateRange) lines.push(dateRange);
      if (item.description) lines.push(sanitizeText(item.description));
      lines.push('');
    });
  }

  if (education.length) {
    lines.push('## Education');
    education.forEach((item) => {
      const school = sanitizeText(item.school);
      const degree = sanitizeText(item.degree);
      const field = sanitizeText(item.fieldOfStudy);
      const dateRange = formatDateRange(item.startDate, item.endDate, item.isCurrent);
      const header = [degree, field].filter(Boolean).join(' — ');
      if (school) lines.push(`**${school}**`);
      if (header) lines.push(header);
      if (dateRange) lines.push(dateRange);
      if (item.description) lines.push(sanitizeText(item.description));
      lines.push('');
    });
  }

  if (certifications.length) {
    lines.push('## Certifications');
    certifications.forEach((item) => {
      const name = sanitizeText(item.name);
      const issuer = sanitizeText(item.issuer);
      const issuedDate = sanitizeText(item.issuedDate);
      const credentialUrl = sanitizeText(item.credentialUrl);
      const header = [name, issuer].filter(Boolean).join(' — ');
      if (header) lines.push(`- ${header}${issuedDate ? ` (${issuedDate})` : ''}`);
      if (credentialUrl) lines.push(`  ${credentialUrl}`);
    });
    lines.push('');
  }

  return lines.join('\n').trim();
}

function redactMarkdown(markdown, record) {
  let output = markdown || '';

  const firstName = sanitizeText(record.get('firstName'));
  const lastName = sanitizeText(record.get('lastName'));
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (fullName) {
    const nameRegex = new RegExp(fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(nameRegex, '[REDACTED]');
  }

  if (firstName) {
    const firstRegex = new RegExp(firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(firstRegex, '[REDACTED]');
  }
  if (lastName) {
    const lastRegex = new RegExp(lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(lastRegex, '[REDACTED]');
  }

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  output = output.replace(emailRegex, '[REDACTED]');

  const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/g;
  output = output.replace(phoneRegex, '[REDACTED]');

  const urlRegex = /(https?:\/\/[^\s)]+)/gi;
  output = output.replace(urlRegex, '[REDACTED]');

  const country = sanitizeText(record.get('country'));
  if (country) {
    const countryRegex = new RegExp(country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(countryRegex, '[REDACTED]');
  }

  return output;
}

function hasSourceChanges(record) {
  if (!record.original) return true;
  const original = record.original();
  if (!original) return true;
  return SOURCE_FIELDS.some((field) => {
    const prev = original.get(field);
    const next = record.get(field);
    return JSON.stringify(prev) !== JSON.stringify(next);
  });
}

async function generateAndSaveResume(e) {
  const record = e.record;

  const hasGenerated =
    !!record.get('resume_generated') ||
    !!record.get('resume_generated_redacted') ||
    !!record.get('resume_generated_pdf');

  const shouldGenerate = hasSourceChanges(record) || !hasGenerated;
  if (!shouldGenerate) return;

  const markdown = buildMarkdown(record);
  if (!markdown) return;

  const redacted = redactMarkdown(markdown, record);

  record.set('resume_generated', markdown);
  record.set('resume_generated_redacted', redacted);

  if (PDFDocument) {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', () => {});
      doc.fontSize(12).text(markdown);
      doc.end();

      await new Promise((resolve) => doc.on('end', resolve));
      const buffer = Buffer.concat(chunks);
      if (buffer.length) {
        const file = new File([buffer], 'generated-resume.pdf', { type: 'application/pdf' });
        record.set('resume_generated_pdf', file);
      }
    } catch (err) {
      // PDF generation failure should not block markdown updates.
    }
  }

  await e.dao.saveRecord(record);
}

onRecordAfterCreateRequest((e) => generateAndSaveResume(e), 'candidates');
onRecordAfterUpdateRequest((e) => generateAndSaveResume(e), 'candidates');
