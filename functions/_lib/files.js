// CV upload validation + R2 key generation (spec items 17-19).
// The CV file itself is only ever stored in private R2 (binding CV_BUCKET)
// — never in D1, never as Base64, never behind a public URL.

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_FILENAME_LENGTH = 180;

export function validateResumeFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    return { code: 'validation_error', message: 'A CV file is required.' };
  }
  if (file.size <= 0) {
    return { code: 'validation_error', message: 'CV file appears to be empty.' };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { code: 'too_large', message: 'CV file must be 5MB or smaller.' };
  }
  if (!file.name || file.name.length > MAX_FILENAME_LENGTH) {
    return { code: 'validation_error', message: 'CV file name is missing or too long.' };
  }
  const lowerName = file.name.toLowerCase();
  const extOk = ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
  const typeOk = ALLOWED_RESUME_TYPES.includes(file.type);
  if (!extOk || !typeOk) {
    return { code: 'unsupported_type', message: 'CV must be a PDF or Word document (.pdf, .doc, .docx).' };
  }
  return null;
}

function extensionFor(filename) {
  const match = /\.(pdf|docx?|)$/i.exec(filename || '');
  return match ? match[0].toLowerCase() : '.pdf';
}

export function buildResumeKey(applicationId, filename) {
  const ext = extensionFor(filename);
  return `applications/${applicationId}/${crypto.randomUUID()}${ext}`;
}

export async function storeResume(env, key, file) {
  const buffer = await file.arrayBuffer();
  await env.CV_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  });
}

export async function deleteResume(env, key) {
  if (!key) return;
  try {
    await env.CV_BUCKET.delete(key);
  } catch (err) {
    console.error('Failed to delete orphaned R2 object:', err && err.message);
  }
}
