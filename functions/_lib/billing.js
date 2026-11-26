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
export function isPaystackKeyAllowed(env) {
  const mode=(env.PAYSTACK_MODE||"test").toLowerCase();
  if(mode!=="test"&&mode!=="live")return false;
  return Boolean(env.PAYSTACK_SECRET_KEY&&env.PAYSTACK_SECRET_KEY.startsWith(mode==="live"?"sk_live_":"sk_test_"));
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

const BLAKE3_IV=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const BLAKE3_PERM=[2,6,3,10,7,0,4,13,1,11,12,5,9,14,15,8];
function b3rotr(x,n){return (x>>>n)|(x<<(32-n));}
function b3g(s,a,b,c,d,mx,my){
  s[a]=(s[a]+s[b]+mx)>>>0;s[d]=b3rotr(s[d]^s[a],16);
  s[c]=(s[c]+s[d])>>>0;s[b]=b3rotr(s[b]^s[c],12);
  s[a]=(s[a]+s[b]+my)>>>0;s[d]=b3rotr(s[d]^s[a],8);
  s[c]=(s[c]+s[d])>>>0;s[b]=b3rotr(s[b]^s[c],7);
}
function b3round(s,m){
  b3g(s,0,4,8,12,m[0],m[1]);b3g(s,1,5,9,13,m[2],m[3]);b3g(s,2,6,10,14,m[4],m[5]);b3g(s,3,7,11,15,m[6],m[7]);
  b3g(s,0,5,10,15,m[8],m[9]);b3g(s,1,6,11,12,m[10],m[11]);b3g(s,2,7,8,13,m[12],m[13]);b3g(s,3,4,9,14,m[14],m[15]);
}
function b3compress(cv,block,counter,blockLen,flags){
  const s=new Uint32Array(16);s.set(cv,0);s.set(BLAKE3_IV.slice(0,4),8);
  s[12]=counter>>>0;s[13]=Math.floor(counter/0x100000000);s[14]=blockLen;s[15]=flags;
  let m=block;
  for(let r=0;r<7;r++){b3round(s,m);m=BLAKE3_PERM.map(i=>m[i]);}
  const out=new Uint32Array(16);
  for(let i=0;i<8;i++){out[i]=s[i]^s[i+8];out[i+8]=s[i+8]^cv[i];}
  return out;
}
function b3words(bytes){
  const w=new Uint32Array(16);
  for(let i=0;i<bytes.length;i++)w[i>>>2]|=bytes[i]<<((i&3)*8);
  return w;
}
function b3output(cv,block,counter,blockLen,flags){
  return {
    chainingValue(){return b3compress(cv,block,counter,blockLen,flags).slice(0,8);},
    rootHex(){
      const out=b3compress(cv,block,0,blockLen,flags|8);let hex="";
      for(let i=0;i<8;i++)hex+=out[i].toString(16).padStart(8,"0").match(/../g).reverse().join("");
      return hex;
    }
  };
}
function b3chunk(chunk,counter){
  let cv=BLAKE3_IV;const blocks=Math.max(1,Math.ceil(chunk.length/64));
  for(let i=0;i<blocks;i++){
    const part=chunk.subarray(i*64,Math.min((i+1)*64,chunk.length));
    const flags=(i===0?1:0)|(i===blocks-1?2:0);const block=b3words(part);
    if(i===blocks-1)return b3output(cv,block,counter,part.length,flags);
    cv=b3compress(cv,block,counter,64,flags).slice(0,8);
  }
}
function b3parent(left,right){
  const block=new Uint32Array(16);block.set(left,0);block.set(right,8);
  return b3output(BLAKE3_IV,block,0,64,4);
}
function blake3Hex(value){
  const bytes=new TextEncoder().encode(value);const count=Math.max(1,Math.ceil(bytes.length/1024));const stack=[];
  for(let i=0;i<count-1;i++){
    let cv=b3chunk(bytes.subarray(i*1024,(i+1)*1024),i).chainingValue();let total=i+1;
    while((total&1)===0){cv=b3parent(stack.pop(),cv).chainingValue();total=Math.floor(total/2);}
    stack.push(cv);
  }
  let out=b3chunk(bytes.subarray((count-1)*1024),count-1);
  while(stack.length)out=b3parent(stack.pop(),out.chainingValue());
  return out.rootHex();
}
export function blake3SelfTest(){return blake3Hex("abc")==="6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85";}

export async function deployPagesFiles(env,domain,files,options={}) {
  const {tokens}=await getCloudflareAccessToken(env,domain.user_id);
  const base="https://api.cloudflare.com/client/v4";
  const auth={Authorization:"Bearer "+tokens.access_token};
  const projectPath="/accounts/"+encodeURIComponent(domain.cloudflare_account_id)+"/pages/projects/"+encodeURIComponent(domain.project_name);
  const uploadTokenResponse=await fetch(base+projectPath+"/upload-token",{headers:auth});
  const uploadTokenData=await uploadTokenResponse.json();
  const uploadToken=uploadTokenData.result?.jwt;
  if(!uploadTokenResponse.ok||!uploadToken)throw new Error("Could not authorize website upload: "+(uploadTokenData.errors?.[0]?.message||"Cloudflare upload token unavailable."));
  const specialNames=new Set(["_headers","_redirects","_routes.json"]);
  const assetFiles=files.filter(file=>!specialNames.has(file.path));
  const specialFiles=files.filter(file=>specialNames.has(file.path));
  const manifest={};
  const uploadItems=[];
  for(const file of assetFiles) {
    const path="/"+file.path.replace(/^\/+/, "");
    const dot=path.lastIndexOf("."),slash=path.lastIndexOf("/");
    const extension=dot>slash?path.slice(dot+1):"";
    const hash=blake3Hex(file.content+extension).slice(0,32);
    const mime=file.content_type||"application/octet-stream";
    manifest[path]=hash;
    uploadItems.push({key:hash,value:file.content,base64:true,metadata:{contentType:mime}});
  }
  for(let i=0;i<uploadItems.length;i+=100) {
    const uploaded=await fetch(base+"/pages/assets/upload",{method:"POST",headers:{Authorization:"Bearer "+uploadToken,"Content-Type":"application/json"},body:JSON.stringify(uploadItems.slice(i,i+100))});
    const data=await uploaded.json();
    if(!uploaded.ok||!data.success)throw new Error(data.errors?.[0]?.message||"Cloudflare rejected one or more website files.");
  }
  const registered=await fetch(base+"/pages/assets/upsert-hashes",{method:"POST",headers:{Authorization:"Bearer "+uploadToken,"Content-Type":"application/json"},body:JSON.stringify({hashes:Object.values(manifest)})});
  const registeredData=await registered.json();
  if(!registered.ok||!registeredData.success)throw new Error(registeredData.errors?.[0]?.message||"Cloudflare could not register uploaded website assets.");
  const form=new FormData();
  form.set("manifest",JSON.stringify(manifest));
  for(const file of specialFiles) {
    const bytes=Uint8Array.from(atob(file.content),ch=>ch.charCodeAt(0));
    form.set(file.path,new Blob([bytes],{type:file.content_type||"text/plain"}),file.path);
  }
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
  const already = await env.DB.prepare("SELECT status FROM domain_payments WHERE reference = ?").bind(payment.reference).first();
  if (already?.status === "success") return { already_processed: true };
  const lockId="payment:"+payment.reference;
  const lock=await env.DB.prepare("INSERT OR IGNORE INTO billing_webhook_events(event_id,event_type) VALUES(?,?)").bind(lockId,"payment_processing").run();
  if(!lock.meta?.changes) {
    const latest=await env.DB.prepare("SELECT status FROM domain_payments WHERE reference=?").bind(payment.reference).first();
    if(latest?.status==="success")return {already_processed:true};
    const held=await env.DB.prepare("SELECT processed_at FROM billing_webhook_events WHERE event_id=?").bind(lockId).first();
    const heldAt=held?.processed_at?Date.parse(held.processed_at.replace(" ","T")+"Z"):NaN;
    if(!Number.isFinite(heldAt)||Date.now()-heldAt<120000)throw new Error("This payment is already being processed. Wait a moment and refresh your dashboard.");
    const takeover=await env.DB.prepare("UPDATE billing_webhook_events SET processed_at=CURRENT_TIMESTAMP WHERE event_id=? AND processed_at=?").bind(lockId,held.processed_at).run();
    if(!takeover.meta?.changes)throw new Error("This payment is already being processed. Wait a moment and refresh your dashboard.");
  }
  try {
    const now = new Date();
    const domain = await env.DB.prepare("SELECT id, user_id, status, expires_at, project_name, cloudflare_account_id, original_deployment_id FROM managed_domains WHERE id = ? AND user_id = ?").bind(payment.domain_id, payment.user_id).first();
    if (!domain) throw new Error("Domain record not found.");
    if(payment.purpose === "setup") await provisionPagesProject(env,domain);
    if(payment.purpose === "renewal" && domain.status === "suspended") {
      if(!domain.original_deployment_id)throw new Error("The original website deployment could not be found. Contact DEVPAGES support before retrying renewal.");
      const {tokens}=await getCloudflareAccessToken(env,domain.user_id);
      const restore=await fetch("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(domain.cloudflare_account_id)+"/pages/projects/"+encodeURIComponent(domain.project_name)+"/deployments/"+encodeURIComponent(domain.original_deployment_id)+"/rollback",{method:"POST",headers:{Authorization:"Bearer "+tokens.access_token}});
      const restored=await restore.json();
      if(!restore.ok||!restored.success)throw new Error(restored.errors?.[0]?.message||"Payment was verified, but website restoration failed. Please contact support.");
    }
    const base = payment.purpose === "renewal" && domain.expires_at && new Date(domain.expires_at).getTime() > now.getTime() ? new Date(domain.expires_at) : now;
    const expiry = new Date(base.getTime() + 30 * 86400000).toISOString();
    const nextStatus = payment.purpose === "setup" ? "provisioning" : "active";
    await env.DB.batch([
      env.DB.prepare("UPDATE domain_payments SET status='success', paid_at=CURRENT_TIMESTAMP WHERE reference=? AND status='pending'").bind(payment.reference),
      env.DB.prepare("UPDATE managed_domains SET status=?, activated_at=COALESCE(activated_at, ?), expires_at=?, suspended_deployment_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(nextStatus, now.toISOString(), expiry, payment.domain_id, payment.user_id),
      env.DB.prepare("DELETE FROM billing_webhook_events WHERE event_id=?").bind(lockId)
    ]);
    return { already_processed: false, expires_at: expiry, status: nextStatus };
  } catch(error) {
    await env.DB.prepare("DELETE FROM billing_webhook_events WHERE event_id=?").bind(lockId).run();
    throw error;
  }
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