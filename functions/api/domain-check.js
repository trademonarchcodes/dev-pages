const REGISTRAR_BASE = "https://api.cloudflare.com/client/v4";
const ALLOWED_TLDS = new Set(["com", "net", "org", "io"]);
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const DEVPAGES_FEE_USD = 3;

async function checkWithCloudflare(domain, env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_REGISTRAR_API_TOKEN;
  if (!accountId || !token) return null;
  const response = await fetch(`${REGISTRAR_BASE}/accounts/${accountId}/registrar/domain-check`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ domains: [domain] })
  });
  if (!response.ok) throw new Error("Registrar availability service is unavailable.");
  const payload = await response.json();
  const item = payload?.result?.domains?.find(entry => entry.name?.toLowerCase() === domain);
  if (!item) return { domain, status: "unknown", reason: "no_result" };
  const price = item.pricing || {};
  const registrationCost = price.registration_cost == null ? NaN : Number(price.registration_cost);
  const renewalCost = price.renewal_cost == null ? NaN : Number(price.renewal_cost);
  return {
    domain,
    status: item.registrable === true ? "available" : item.reason === "domain_unavailable" ? "registered" : "unsupported",
    reason: item.reason || null,
    currency: price.currency || "USD",
    registrationCost: Number.isFinite(registrationCost) ? registrationCost : null,
    renewalCost: Number.isFinite(renewalCost) ? renewalCost : null,
    customerPrice: Number.isFinite(registrationCost) ? Number((registrationCost + DEVPAGES_FEE_USD).toFixed(2)) : null,
    customerRenewalEstimate: Number.isFinite(renewalCost) ? Number((renewalCost + DEVPAGES_FEE_USD).toFixed(2)) : null,
    devpagesFee: DEVPAGES_FEE_USD
  };
}
async function getRdapBootstrap() {
  const response = await fetch("https://data.iana.org/rdap/dns.json", { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("RDAP bootstrap is unavailable.");
  return response.json();
}
function findRdapServer(domain, data) {
  const labels = domain.toLowerCase().split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const suffix = labels.slice(i).join(".");
    const entry = (data.services || []).find(service => Array.isArray(service[0]) && service[0].some(tld => String(tld).toLowerCase() === suffix));
    if (entry && Array.isArray(entry[1]) && entry[1].length) return entry[1][0].replace(/\/$/, "");
  }
  return null;
}
async function checkWithRdap(domain, bootstrap) {
  const server = findRdapServer(domain, bootstrap);
  if (!server) return { domain, status: "unknown", registrarConfirmed: false };
  try {
    const response = await fetch(server + "/domain/" + encodeURIComponent(domain), { headers: { "Accept": "application/rdap+json, application/json" } });
    if (response.status === 404) return { domain, status: "unconfirmed", registrarConfirmed: false, note: "No RDAP record found; a registrar must confirm availability." };
    if (response.ok) return { domain, status: "registered", registrarConfirmed: false };
    return { domain, status: "unknown", registrarConfirmed: false };
  } catch { return { domain, status: "unknown", registrarConfirmed: false }; }
}
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Send a valid JSON request." }, { status: 400 }); }
  const domains = Array.isArray(body?.domains) ? body.domains : [];
  if (!domains.length || domains.length > 8) return Response.json({ error: "Check between 1 and 8 domain names at a time." }, { status: 400 });
  const clean = [...new Set(domains.map(value => String(value).trim().toLowerCase()))];
  if (clean.some(domain => !DOMAIN_RE.test(domain) || !ALLOWED_TLDS.has(domain.split(".").pop()))) {
    return Response.json({ error: "Only .com, .net, .org and .io names are currently supported." }, { status: 400 });
  }
  try {
    const registrarConnected = Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_REGISTRAR_API_TOKEN);
    let results;
    if (registrarConnected) results = await Promise.all(clean.map(domain => checkWithCloudflare(domain, env)));
    else {
      const bootstrap = await getRdapBootstrap();
      results = await Promise.all(clean.map(domain => checkWithRdap(domain, bootstrap)));
    }
    return Response.json({
      results, registrarConnected,
      pricing: { currency: "USD", devpagesFee: DEVPAGES_FEE_USD },
      disclaimer: "Registrar checks are time-sensitive. Confirm final availability and price immediately before purchase. DEVPAGES adds $3 to the registrar's registration price."
    }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "The domain lookup service is temporarily unavailable. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
