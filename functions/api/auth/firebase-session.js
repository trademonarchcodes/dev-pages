import { reply } from "../_lib/auth.js";

// Firebase session exchange has been retired. All new account sessions use Supabase.
export async function onRequestPost() {
  return reply({ok:false,code:"AUTH_PROVIDER_CHANGED",message:"Firebase sign-in has been retired. Please use the DEVPAGES Supabase sign-in page."},410);
}
