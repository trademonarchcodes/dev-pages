import { reply, currentUser } from "../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const user = await currentUser(request, env);
  if (!user) return reply({ ok:false, message:"Sign in with the administrator account." }, 401);
  if (user.role !== "admin") return reply({ ok:false, message:"Administrator access required." }, 403);
  const [customers, sites, orders, payments, recent] = await Promise.all([
    env.DEVPAGES_DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='customer'").first(),
    env.DEVPAGES_DB.prepare("SELECT COUNT(*) AS n FROM sites").first(),
    env.DEVPAGES_DB.prepare("SELECT COUNT(*) AS n FROM domain_orders").first(),
    env.DEVPAGES_DB.prepare("SELECT COUNT(*) AS n FROM payments WHERE status='succeeded'").first(),
    env.DEVPAGES_DB.prepare("SELECT event_type,created_at FROM audit_events ORDER BY created_at DESC LIMIT 12").all()
  ]);
  return reply({ ok:true, totals:{ customers:customers?.n||0, sites:sites?.n||0, orders:orders?.n||0, successfulPayments:payments?.n||0 }, recent:recent.results||[] });
}
