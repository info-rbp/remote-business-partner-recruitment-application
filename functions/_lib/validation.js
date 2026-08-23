const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function requiredString(value, label, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string' || !value.trim()) return `${label} is required.`;
  const len = value.trim().length;
  if (len < min) return `${label} must be at least ${min} characters.`;
  if (value.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

export function optionalString(value, label, { max = 5000 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return `${label} must be text.`;
  if (value.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

export function email(value, label = 'Email', { max = 254 } = {}) {
  const req = requiredString(value, label, { min: 3, max });
  if (req) return req;
  if (!EMAIL_RE.test(value)) return `${label} must be a valid email address.`;
  return null;
}

export function oneOf(value, options, label) {
  if (!options.includes(value)) return `${label} must be one of: ${options.join(', ')}.`;
  return null;
}

export function optionalUrl(value, label, { max = 500 } = {}) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > max) return `${label} must be ${max} characters or fewer.`;
  let parsed;
  try { parsed = new URL(value); } catch { return `${label} must be a valid URL.`; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return `${label} must start with http:// or https://.`;
  return null;
}

export function optionalDate(value, label) {
  if (!value) return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) return `${label} must be a valid date (YYYY-MM-DD).`;
  const d = new Date(value + 'T00:00:00Z');
  if (isNaN(d.getTime())) return `${label} must be a valid date.`;
  return null;
}

export function boolTrue(value, label) {
  if (value !== true && value !== 'true' && value !== 1 && value !== '1') {
    return `${label} must be acknowledged before submitting.`;
  }
  return null;
}

export function firstError(...results) {
  return results.find(Boolean) || null;
}

export const EMPLOYMENT_TYPES_VACANCY = ['Full-Time', 'Part-Time', 'Casual', 'Contract', 'Temporary'];
export const EMPLOYMENT_TYPES_REQUEST = ['Casual', 'Part-Time', 'Full-Time'];
export const APPLICATION_STATUSES = ['Applied', 'Screening', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected', 'Withdrawn'];
export const REQUEST_STATUSES = ['New', 'Contacted', 'Engaged', 'Closed'];
export const INTEREST_STATUSES = ['New', 'Contacted', 'Archived'];
export const VACANCY_STATUSES = ['Draft', 'Open', 'Closed'];
export const STAFF_ROLES = ['admin', 'recruiter'];

export function validateApplicationFields({ vacancy_id, candidate_name, email: candidateEmail, phone, linkedin_url, cover_note, privacy_acknowledged }) {
  return firstError(
    requiredString(vacancy_id, 'Vacancy', { min: 1, max: 100 }),
    requiredString(candidate_name, 'Full name', { min: 2, max: 120 }),
    email(candidateEmail, 'Email', { max: 254 }),
    requiredString(phone, 'Phone number', { min: 6, max: 30 }),
    optionalUrl(linkedin_url, 'LinkedIn URL', { max: 500 }),
    optionalString(cover_note, 'Cover note', { max: 5000 }),
    boolTrue(privacy_acknowledged, 'Privacy acknowledgement')
  );
}

export function validateRecruitmentRequestFields({ company_name, contact_name, email: contactEmail, phone, position_title, employment_type, location, remuneration, preferred_start_date, requirements, privacy_acknowledged }) {
  return firstError(
    requiredString(company_name, 'Company name', { min: 2, max: 200 }),
    requiredString(contact_name, 'Contact name', { min: 2, max: 120 }),
    email(contactEmail, 'Email', { max: 254 }),
    optionalString(phone, 'Phone number', { max: 30 }),
    requiredString(position_title, 'Position title', { min: 2, max: 200 }),
    oneOf(employment_type, EMPLOYMENT_TYPES_REQUEST, 'Employment type'),
    optionalString(location, 'Location', { max: 200 }),
    optionalString(remuneration, 'Remuneration', { max: 200 }),
    optionalDate(preferred_start_date, 'Preferred start date'),
    optionalString(requirements, 'Requirements', { max: 10000 }),
    boolTrue(privacy_acknowledged, 'Privacy acknowledgement')
  );
}

export function validateCandidateInterestFields({ name, email: candidateEmail, phone, linkedin_url, preferred_roles, preferred_location, message, privacy_acknowledged }) {
  return firstError(
    requiredString(name, 'Full name', { min: 2, max: 120 }),
    email(candidateEmail, 'Email', { max: 254 }),
    optionalString(phone, 'Phone number', { max: 30 }),
    optionalUrl(linkedin_url, 'LinkedIn URL', { max: 500 }),
    optionalString(preferred_roles, 'Preferred roles', { max: 300 }),
    optionalString(preferred_location, 'Preferred location', { max: 200 }),
    optionalString(message, 'Message', { max: 5000 }),
    boolTrue(privacy_acknowledged, 'Privacy acknowledgement')
  );
}
