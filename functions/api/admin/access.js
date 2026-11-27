import { json } from "../../_lib/billing.js";

export async function onRequestGet({env}) {
  const email=String(env.DEVPAGES_ADMIN_EMAIL||"devlyonofficial@gmail.com").trim().toLowerCase();
  return json({admin_email:email,registration_restricted:true});
}
