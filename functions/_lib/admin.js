import { json, getUser } from "./billing.js";
export async function requireAdmin(request, env) {
  const user = await getUser(request, env);
  const allowed = "devlyonofficial@gmail.com";
  if (!user?.id || !user.email || !user.email_confirmed_at || !allowed || user.email.toLowerCase() !== allowed) return null;
  return user;
}
export async function logAdmin(env, user, action, details = {}) {
  if (!env.DB) return;
  await env.DB.prepare("INSERT INTO admin_activity(id,admin_email,action,details_json) VALUES(?,?,?,?)")
    .bind(crypto.randomUUID(), user.email, action, JSON.stringify(details)).run();
}
export { json };
