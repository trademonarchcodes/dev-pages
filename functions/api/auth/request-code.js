import { reply } from "../_lib/auth.js";

// Retired legacy email-code flow. All customer authentication now uses Supabase Auth.
export async function onRequestPost() {
  return reply({ ok:false, code:"AUTH_PROVIDER_CHANGED", message:"The legacy email-code sign-in has been retired. Please use the DEVPAGES sign-in page." }, 410);
}
