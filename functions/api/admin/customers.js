import { reply, currentUser } from "../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const user = await currentUser(request, env);
  if (!user) return reply({ ok:false, message:"Sign in with the administrator account." }, 401);
  if (user.role !== "admin") return reply({ ok:false, message:"Administrator access required." }, 403);
  const customers = await env.DEVPAGES_DB.prepare(
    "SELECT u.id,u.email,u.email_verified_at,u.created_at,(SELECT COUNT(*) FROM sites s WHERE s.user_id=u.id) AS websites,(SELECT COUNT(*) FROM domain_orders d WHERE d.user_id=u.id) AS orders FROM users u WHERE u.role='customer' ORDER BY u.created_at DESC LIMIT 50"
  ).all();
  return reply({ ok:true, customers:customers.results || [] });
}
