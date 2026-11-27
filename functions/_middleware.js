export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  const path = new URL(context.request.url).pathname;
  if (path.startsWith("/api/") || path === "/account.html" || path === "/account-auth.js" || path === "/admin.html" || path === "/admin.js" || path === "/payment-return.html" || path === "/payment-return.js" || path === "/login.html" || path === "/signup.html" || path === "/reset-password.html") {
    headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
