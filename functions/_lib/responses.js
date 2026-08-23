// Standard API response helpers. This application operates same-origin only.

export function ok(data, extra = {}, status = 200) {
  return new Response(JSON.stringify({ success: true, data, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function created(data) {
  return ok(data, {}, 201);
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function fail(error, message, status = 400) {
  return new Response(JSON.stringify({ success: false, error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const validationError = (message = 'Please check the information submitted.') =>
  fail('validation_error', message, 400);
export const unauthorized = (message = 'Authentication required.') =>
  fail('unauthorized', message, 401);
export const forbidden = (message = 'You do not have access to this resource.') =>
  fail('forbidden', message, 403);
export const notFound = (message = 'Not found.') =>
  fail('not_found', message, 404);
export const conflict = (error, message) =>
  fail(error || 'conflict', message || 'This request conflicts with the current state of the resource.', 409);
export const tooLarge = (message = 'File is too large.') =>
  fail('payload_too_large', message, 413);
export const unsupportedMediaType = (message = 'Unsupported file type.') =>
  fail('unsupported_media_type', message, 415);
export const internalError = (message = 'Something went wrong. Please try again shortly.') =>
  fail('internal_error', message, 500);

export async function safeHandler(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error('Unhandled API error:', err && err.message ? err.message : err);
    return internalError();
  }
}
