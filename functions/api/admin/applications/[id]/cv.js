import { first } from '../../../../_lib/database.js';
import { notFound, safeHandler } from '../../../../_lib/responses.js';

export async function onRequestGet({ env, params }) {
  return safeHandler(async () => {
    const application = await first(env, 'SELECT * FROM applications WHERE id = ?', [params.id]);
    if (!application || !application.resume_key) return notFound('CV not found.');

    const object = await env.CV_BUCKET.get(application.resume_key);
    if (!object) return notFound('CV file not found in storage.');

    return new Response(object.body, {
      headers: {
        'Content-Type': application.resume_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${(application.resume_filename || 'cv').replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store'
      }
    });
  });
}
