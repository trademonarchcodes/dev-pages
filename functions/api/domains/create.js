import { json, getUser, isPromoUser, PROMO_ACCESS_END, getCloudflareAccessToken } from "../../_lib/billing.js";
export async function onRequestPost({request,env}) {
  if(request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Request origin rejected."},403);
  if(!env.DB||!env.CF_TOKEN_ENCRYPTION_KEY)return json({error:"Hosting connection is not configured."},503);
  try {
    const user=await getUser(request,env);
    if(!user?.id)return json({error:"Please sign in."},401);
    const body=await request.json();
    const name=String(body.name||"").trim().toLowerCase();
    if(!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(name))return json({error:"Use 1–50 lowercase letters, numbers or hyphens. Do not start or end with a hyphen."},400);
    const connection=await env.DB.prepare("SELECT accounts_json,token_ciphertext,token_iv FROM cloudflare_connections WHERE user_id=?").bind(user.id).first();
    if(!connection)return json({error:"Connect your Cloudflare account before adding a domain."},409);
    const accounts=JSON.parse(connection.accounts_json||"[]");
    if(!accounts.length)return json({error:"No Cloudflare account is connected."},409);
    const promo=isPromoUser(user)&&Date.now()<Date.parse(PROMO_ACCESS_END);
    const id=crypto.randomUUID();
    const expiry=promo?PROMO_ACCESS_END:null;
    await env.DB.prepare("INSERT INTO managed_domains(id,user_id,project_name,hostname,status,promo_eligible,activated_at,expires_at,cloudflare_account_id) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id,user.id,name,name+".pages.dev",promo?"provisioning":"pending_payment",promo?1:0,promo?new Date().toISOString():null,expiry,accounts[0].id).run();
    if(promo) {
      const {tokens}=await getCloudflareAccessToken(env,user.id);
      const accountId=accounts[0].id;
      const cf=await fetch("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(accountId)+"/pages/projects",{
        method:"POST",headers:{Authorization:"Bearer "+tokens.access_token,"Content-Type":"application/json"},
        body:JSON.stringify({name,production_branch:"main",deployment_configs:{production:{compatibility_date:"2026-11-26"}}})
      });
      const result=await cf.json();
      if(!cf.ok||!result.success) {
        await env.DB.prepare("UPDATE managed_domains SET status='failed' WHERE id=?").bind(id).run();
        return json({error:result.errors?.[0]?.message||"Could not create Pages project."},400);
      }
      await env.DB.prepare("UPDATE managed_domains SET status='provisioning' WHERE id=?").bind(id).run();
      return json({domain:{id,hostname:name+".pages.dev",status:"provisioning",expires_at:expiry},promo:true});
    }
    return json({domain:{id,hostname:name+".pages.dev",status:"pending_payment",expires_at:null},promo:false,setup_fee_ngn:16000});
  }catch(error){return json({error:error.message||"Could not create domain."},400);}
}