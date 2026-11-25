import { reply, currentUser } from "../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  if (!env.DEVPAGES_DB) return reply({ ok:false, authenticated:false, message:"Account services are being configured." }, 503);
  const user = await currentUser(request, env);
  return reply({ ok:true, authenticated:!!user, user:user || null });
}
