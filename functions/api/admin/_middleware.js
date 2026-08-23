import { requireStaffUser } from '../../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const { staffUser, payload, error } = await requireStaffUser(request, env);
  if (error) return error;

  context.data.staffUser = staffUser;
  context.data.firebasePayload = payload;
  return context.next();
}
