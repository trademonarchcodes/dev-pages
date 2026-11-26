import { json, getUser, deployPagesFiles } from "../../_lib/billing.js";
export async function onRequestPost({request,env}) {
  if(request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Request origin rejected."},403);
  try {
    const user=await getUser(request,env);
    if(!user?.id)return json({error:"Please sign in."},401);
    const body=await request.json();
    const domainId=String(body.domain_id||"");
    const files=body.files;
    if(!Array.isArray(files)||!files.length||files.length>1000)return json({error:"Upload a ZIP containing your website files (maximum 1,000 files)."},400);
    let total=0;
    for(const file of files) {
      if(!file||typeof file.path!=="string"||typeof file.content!=="string"||file.content.length>8*1024*1024)return json({error:"One or more files are invalid or too large."},400);
      const path=file.path.replace(/^\/+/, "");
      if(!path||path.split("/").some(p=>p===".."||p===".")||path.startsWith("_worker.")||path==="functions"||path.startsWith("functions/"))return json({error:"Invalid or unsupported website file path. Pages Functions and custom Workers are not supported by ZIP publishing yet."},400);
      total+=file.content.length;
    }
    if(total>18*1024*1024)return json({error:"Your website ZIP is too large. Maximum uncompressed upload is 13 MB."},413);
    const domain=await env.DB.prepare("SELECT id,user_id,project_name,hostname,status,cloudflare_account_id FROM managed_domains WHERE id=? AND user_id=?").bind(domainId,user.id).first();
    if(!domain)return json({error:"Domain not found."},404);
    if(!["active","provisioning"].includes(domain.status))return json({error:"Your domain must be active before publishing. Complete setup payment first."},409);
    if(domain.expires_at && Date.parse(domain.expires_at)<=Date.now())return json({error:"This hosting period has expired. Renew the domain before publishing."},409);
    const result=await deployPagesFiles(env,domain,files);
    return json({success:true,hostname:domain.hostname,deployment_url:result.url||"https://"+domain.hostname,files:files.length});
  } catch(error) { return json({error:error.message||"Website deployment failed."},400); }
}