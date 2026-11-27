import { json, getUser, deployPagesFiles } from "../../_lib/billing.js";
export async function onRequestPost({request,env}) {
  if(request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Request origin rejected."},403);
  try {
    const user=await getUser(request,env);
    if(!user?.id)return json({error:"Please sign in."},401);
    const body=await request.json();
    const domainId=String(body.domain_id||"");
    const files=body.files;
    if(!Array.isArray(files)||!files.length||files.length>1000)return json({error:"Upload one website ZIP file (maximum 1,000 files after extraction)."},400);
    let total=0;
    for(const file of files) {
      if(!file||typeof file.path!=="string"||typeof file.content!=="string"||file.content.length>11*1024*1024)return json({error:"One or more files are invalid or too large."},400);
      const path=file.path.replace(/^\/+/, "");
      if(!path||path.split("/").some(p=>p===".."||p===".")||path.startsWith("_worker.")||path==="functions"||path.startsWith("functions/"))return json({error:"Invalid or unsupported website file path. Pages Functions and custom Workers are not supported by ZIP publishing yet."},400);
      total+=file.content.length;
    }
    if(total>18*1024*1024)return json({error:"Your website ZIP is too large. Maximum uncompressed upload is 13 MB."},413);
    const domain=await env.DB.prepare("SELECT id,user_id,project_name,hostname,status,cloudflare_account_id,expires_at FROM managed_domains WHERE id=? AND user_id=?").bind(domainId,user.id).first();
    if(!domain)return json({error:"Domain not found."},404);
    if(!["active","provisioning"].includes(domain.status))return json({error:"Your domain must be active before publishing. Complete setup payment first."},409);
    if(domain.expires_at && Date.parse(domain.expires_at)<=Date.now())return json({error:"This hosting period has expired. Renew the domain before publishing."},409);

    // Add a DEVPAGES developer credit only when the site has no existing attribution.
    // Profile details are read through the signed-in user's Supabase session; no service key is exposed.
    try {
      const accessToken=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
      const profileUrl=new URL(env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/developer_profiles");
      profileUrl.searchParams.set("id","eq."+user.id);
      profileUrl.searchParams.set("select","slug,display_name,website_url,show_credit");
      profileUrl.searchParams.set("limit","1");
      const profileResponse=await fetch(profileUrl.toString(),{
        headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+accessToken}
      });
      if(profileResponse.ok) {
        const profiles=await profileResponse.json();
        const profile=profiles?.[0];
        if(profile && profile.show_credit !== false && profile.display_name && profile.slug) {
          const htmlFiles=files.filter(file=>/\.html?$/i.test(file.path));
          const existingCredit=htmlFiles.some(file=>{
            try {
              const bytes=Uint8Array.from(atob(file.content),ch=>ch.charCodeAt(0));
              const html=new TextDecoder().decode(bytes);
              return /(?:developed|built|designed|created|crafted)\s+by\b/i.test(html);
            } catch { return false; }
          });
          if(!existingCredit && htmlFiles.length) {
            const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
            const destination=profile.website_url && /^https?:\/\//i.test(profile.website_url)
              ? profile.website_url
              : "https://devpagesdomain.pages.dev/developer.html?u="+encodeURIComponent(profile.slug);
            const credit='<div class="devpages-developer-credit" style="padding:14px 12px;text-align:center;font:500 12px/1.5 Arial,sans-serif;color:#8794a8"><span>Developed by </span><a href="'+escapeHtml(destination)+'" target="_blank" rel="noopener noreferrer" style="color:#258cff;text-decoration:none;font-weight:700">'+escapeHtml(profile.display_name)+'</a></div>';
            for(const file of htmlFiles) {
              try {
                const bytes=Uint8Array.from(atob(file.content),ch=>ch.charCodeAt(0));
                let html=new TextDecoder().decode(bytes);
                if(/<\/footer\s*>/i.test(html)) html=html.replace(/<\/footer\s*>/i,credit+"</footer>");
                else if(/<\/body\s*>/i.test(html)) html=html.replace(/<\/body\s*>/i,credit+"</body>");
                else html+=credit;
                const encoded=new TextEncoder().encode(html);
                let binary="";
                for(let i=0;i<encoded.length;i+=0x8000) binary+=String.fromCharCode(...encoded.subarray(i,i+0x8000));
                file.content=btoa(binary);
              } catch {}
            }
          }
        }
      }
    } catch {
      // A temporary profile lookup failure must not block an otherwise valid website publish.
    }
    const result=await deployPagesFiles(env,domain,files);
    return json({success:true,hostname:domain.hostname,deployment_url:result.url||"https://"+domain.hostname,files:files.length});
  } catch(error) { return json({error:error.message||"Website deployment failed."},400); }
}