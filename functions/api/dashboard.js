import { reply, currentUser } from "./_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const user = await currentUser(request, env);
  if (!user) return reply({ ok:false, message:"Please sign in to view your dashboard." }, 401);
  const [sites, domains, payments, activity] = await Promise.all([
    env.DEVPAGES_DB.prepare("SELECT id,project_name,public_url,status,created_at FROM sites WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
    env.DEVPAGES_DB.prepare("SELECT id,domain_name,currency,registration_price_minor,markup_minor,status,created_at FROM domain_orders WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
    env.DEVPAGES_DB.prepare("SELECT id,provider,amount_minor,currency,status,created_at FROM payments WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
    env.DEVPAGES_DB.prepare("SELECT event_type,created_at FROM audit_events WHERE target_user_id=? OR actor_user_id=? ORDER BY created_at DESC LIMIT 10").bind(user.id,user.id).all()
  ]);
  return reply({ ok:true, user, sites:sites.results || [], domains:domains.results || [], payments:payments.results || [], activity:activity.results || [] });
}
