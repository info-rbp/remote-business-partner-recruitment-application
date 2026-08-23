import { ok, safeHandler } from '../../_lib/responses.js';

export async function onRequestGet({ data }) {
  return safeHandler(async () => {
    const { staffUser } = data;
    return ok({
      email: staffUser.email,
      displayName: staffUser.display_name || '',
      role: staffUser.role
    });
  });
}
