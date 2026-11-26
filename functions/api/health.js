export async function onRequest({ env }) {
  let database = false;
  if (env.DEVPAGES_DB) {
    try { await env.DEVPAGES_DB.prepare("SELECT 1 AS ok").first(); database = true; } catch {}
  }
  const cryptoConfigured = Boolean(env.AUTH_PEPPER && env.SESSION_SECRET);
  const hostingEncryptionConfigured = /^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY || "");
  const firebaseAuthConfigured = true;
  const signInReady = database && cryptoConfigured && firebaseAuthConfigured;
  return Response.json({
    ok: true,
    service: "DEVPAGES",
    status: signInReady ? "firebase-auth-configured-awaiting-live-test" : "foundation",
    capabilities: {
      database,
      firebaseAuthConfigured,
      emailVerificationRequired: true,
      sessionSecurityConfigured: cryptoConfigured,
      customerSignInReady: signInReady,
      customerHostingEncryptionConfigured: hostingEncryptionConfigured,
      customerHostingConnectionReady: signInReady && hostingEncryptionConfigured,
      cloudflareCustomerOAuthReady: false,
      registrarCheckoutReady: false,
      paystackReady: false
    }
  }, { headers: { "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" } });
}
