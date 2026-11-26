import { reply } from "./_lib/auth.js";

export async function onRequestPost() {
  return reply({
    ok: false,
    code: "PAGES_ONLY",
    message: "DEVPAGES supports pages.dev addresses only. Custom-domain registration checks are not offered."
  }, 410);
}
