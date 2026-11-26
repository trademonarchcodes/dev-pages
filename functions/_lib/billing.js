export const PROMO_START = "2026-10-15T00:00:00.000Z";
export const PROMO_END = "2026-11-16T00:00:00.000Z";
export const PROMO_ACCESS_END = "2027-01-16T00:00:00.000Z";
export const SETUP_AMOUNT = 1600000;
export const RENEWAL_AMOUNT = 550000;
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
export async function getUser(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token } });
  if (!response.ok) return null;
  return response.json();
}
export function isPromoUser(user) {
  const created = new Date(user.created_at).getTime();
  return created >= Date.parse(PROMO_START) && created < Date.parse(PROMO_END);
}
export async function verifyPaystack(reference, secret) {
  const response = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), { headers: { Authorization: "Bearer " + secret, Accept: "application/json" } });
  const data = await response.json();
  if (!response.ok || !data.status || data.data?.status !== "success") throw new Error("Paystack has not confirmed this payment.");
  return data.data;
}
async function decryptConnection(row, keyText) {
  const raw=Uint8Array.from(atob(keyText),c=>c.charCodeAt(0));
  if(raw.length!==32)throw new Error("Cloudflare token encryption key is invalid.");
  const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:row.token_iv},key,row.token_ciphertext);
  return JSON.parse(new TextDecoder().decode(plain));
}
async function encryptConnection(tokens,keyText) {
  const raw=Uint8Array.from(atob(keyText),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(tokens)));
  return {iv,ciphertext:new Uint8Array(ciphertext)};
}
export async function getCloudflareAccessToken(env, userId) {
  const row=await env.DB.prepare("SELECT accounts_json,token_ciphertext,token_iv FROM cloudflare_connections WHERE user_id=?").bind(userId).first();
  if(!row)throw new Error("Connect your Cloudflare account first.");
  let tokens=await decryptConnection(row,env.CF_TOKEN_ENCRYPTION_KEY);
  if(tokens.expires_at && tokens.expires_at < Date.now()+60000) {
    if(!tokens.refresh_token)throw new Error("Cloudflare authorization expired. Reconnect your Cloudflare account.");
    const refresh=await fetch("https://dash.cloudflare.com/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:tokens.refresh_token,client_id:env.CF_OAUTH_CLIENT_ID,client_secret:env.CF_OAUTH_CLIENT_SECRET})});
    const fresh=await refresh.json();
    if(!refresh.ok||!fresh.access_token)throw new Error("Cloudflare authorization expired. Reconnect your Cloudflare account.");
    tokens={...tokens,access_token:fresh.access_token,refresh_token:fresh.refresh_token||tokens.refresh_token,expires_at:fresh.expires_in?Date.now()+Number(fresh.expires_in)*1000:null};
    const encrypted=await encryptConnection(tokens,env.CF_TOKEN_ENCRYPTION_KEY);
    await env.DB.prepare("UPDATE cloudflare_connections SET token_ciphertext=?,token_iv=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(encrypted.ciphertext,encrypted.iv,userId).run();
  }
  return {tokens,accounts:JSON.parse(row.accounts_json||"[]")};
}
export async function provisionPagesProject(env, domain) {
  if(!domain.cloudflare_account_id)throw new Error("The connected Cloudflare account is missing.");
  const {tokens}=await getCloudflareAccessToken(env,domain.user_id);
  const endpoint="https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(domain.cloudflare_account_id)+"/pages/projects/"+encodeURIComponent(domain.project_name);
  const existing=await fetch(endpoint,{headers:{Authorization:"Bearer "+tokens.access_token}});
  if(existing.ok)return true;
  const response=await fetch("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(domain.cloudflare_account_id)+"/pages/projects",{method:"POST",headers:{Authorization:"Bearer "+tokens.access_token,"Content-Type":"application/json"},body:JSON.stringify({name:domain.project_name,production_branch:"main"})});
  const result=await response.json();
  if(!response.ok||!result.success)throw new Error(result.errors?.[0]?.message||"Could not create the Pages project.");
  return true;
}
export async function deployPagesFiles(env,domain,files,options={}) {
  const {tokens}=await getCloudflareAccessToken(env,domain.user_id);
  const base="https://api.cloudflare.com/client/v4";
  const auth={Authorization:"Bearer "+tokens.access_token};
  const projectPath="/accounts/"+encodeURIComponent(domain.cloudflare_account_id)+"/pages/projects/"+encodeURIComponent(domain.project_name);
  const uploadTokenResponse=await fetch(base+projectPath+"/upload-token",{headers:auth});
  const uploadTokenData=await uploadTokenResponse.json();
  const uploadToken=uploadTokenData.result?.jwt;
  if(!uploadTokenResponse.ok||!uploadToken)throw new Error("Could not authorize website upload: "+(uploadTokenData.errors?.[0]?.message||"Cloudflare upload token unavailable."));
  const manifest={};
  const uploadItems=[];
  for(const file of files) {
    const path="/" + file.path.replace(/^\/+/, "");
    const bytes=Uint8Array.from(atob(file.content),ch=>ch.charCodeAt(0));
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
    const mime=file.content_type||"application/octet-stream";
    manifest[path]=hash;
    uploadItems.push({key:hash,value:file.content,base64:true,metadata:{contentType:mime}});
  }
  for(let i=0;i<uploadItems.length;i+=100) {
    const uploaded=await fetch(base+"/pages/assets/upload",{method:"POST",headers:{Authorization:"Bearer "+uploadToken,"Content-Type":"application/json"},body:JSON.stringify(uploadItems.slice(i,i+100))});
    const data=await uploaded.json();
    if(!uploaded.ok||!data.success)throw new Error(data.errors?.[0]?.message||"Cloudflare rejected one or more website files.");
  }
  const form=new FormData();
  form.set("manifest",JSON.stringify(manifest));
  form.set("branch","main");
  form.set("commit_message","Published through DEVPAGES");
  const deployment=await fetch(base+projectPath+"/deployments",{method:"POST",headers:auth,body:form});
  const result=await deployment.json();
  if(!deployment.ok||!result.success)throw new Error(result.errors?.[0]?.message||"Cloudflare could not publish this website.");
  if(options.suspension) {
    await env.DB.prepare("UPDATE managed_domains SET status='suspended', suspended_deployment_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='provisioning'").bind(result.result?.id||null,domain.id).run();
  } else {
    await env.DB.prepare("UPDATE managed_domains SET status='active', original_deployment_id=?, suspended_deployment_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(result.result?.id||null,domain.id).run();
  }
  return result.result||{};
}
export async function applyPayment(env, payment, transaction) {
  if (transaction.status !== "success" || transaction.reference !== payment.reference || transaction.amount !== payment.amount_kobo || transaction.currency !== "NGN") throw new Error("Payment details do not match the pending DEVPAGES invoice.");
  const now = new Date();
  const domain = await env.DB.prepare("SELECT id, user_id, status, expires_at, project_name, cloudflare_account_id, original_deployment_id FROM managed_domains WHERE id = ? AND user_id = ?").bind(payment.domain_id, payment.user_id).first();
  if (!domain) throw new Error("Domain record not found.");
  const already = await env.DB.prepare("SELECT status FROM domain_payments WHERE reference = ?").bind(payment.reference).first();
  if (already?.status === "success") return { already_processed: true };
  if(payment.purpose === "setup") await provisionPagesProject(env,domain);
  if(payment.purpose === "renewal" && domain.status === "suspended") {
    if(!domain.original_deployment_id)throw new Error("The original website deployment could not be found. Contact DEVPAGES support before retrying renewal.");
    const {tokens}=await getCloudflareAccessToken(env,domain.user_id);
    const restore=await fetch("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(domain.cloudflare_account_id)+"/pages/projects/"+encodeURIComponent(domain.project_name)+"/deployments/"+encodeURIComponent(domain.original_deployment_id)+"/rollback",{method:"POST",headers:{Authorization:"Bearer "+tokens.access_token,"Content-Type":"application/json"},body:JSON.stringify({})});
    const restored=await restore.json();
    if(!restore.ok||!restored.success)throw new Error(restored.errors?.[0]?.message||"Payment was verified, but website restoration failed. Please contact support.");
  }
  const base = payment.purpose === "renewal" && domain.expires_at && new Date(domain.expires_at).getTime() > now.getTime() ? new Date(domain.expires_at) : now;
  const expiry = new Date(base.getTime() + 30 * 86400000).toISOString();
  const nextStatus = payment.purpose === "setup" ? "provisioning" : "active";
  await env.DB.batch([
    env.DB.prepare("UPDATE domain_payments SET status='success', paid_at=CURRENT_TIMESTAMP WHERE reference=? AND status='pending'").bind(payment.reference),
    env.DB.prepare("UPDATE managed_domains SET status=?, activated_at=COALESCE(activated_at, ?), expires_at=?, suspended_deployment_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(nextStatus, now.toISOString(), expiry, payment.domain_id, payment.user_id)
  ]);
  return { already_processed: false, expires_at: expiry, status: nextStatus };
}
export async function hmacHex(secret, bytes) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, bytes);
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, "0")).join("");
}
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}