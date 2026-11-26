import { json, deployPagesFiles } from "../../_lib/billing.js";
const maintenance = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Website temporarily unavailable</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080d18;color:#edf3ff;font:16px system-ui,sans-serif;padding:24px}.card{max-width:560px;text-align:center;border:1px solid #243653;border-radius:22px;padding:42px 30px;background:#0d1626}h1{font-size:clamp(28px,6vw,42px);margin:0 0 14px}p{color:#aab8cc;line-height:1.7}.mark{color:#58a6ff;font-weight:800;letter-spacing:.18em;font-size:13px;margin-bottom:24px}</style></head><body><main class="card"><div class="mark">DEVPAGES HOSTING</div><h1>Website temporarily unavailable</h1><p>This website's hosting period has ended. The website owner can restore access by renewing the hosting service.</p></main></body></html>`;
export async function onRequestPost({env}) {
  if(!env.DB||!env.CF_TOKEN_ENCRYPTION_KEY)return json({error:"Expiry service is not configured."},503);
  const now=new Date().toISOString();
  const due=await env.DB.prepare("SELECT id,user_id,project_name,hostname,status,cloudflare_account_id,original_deployment_id FROM managed_domains WHERE status='active' AND expires_at IS NOT NULL AND expires_at<=? AND original_deployment_id IS NOT NULL ORDER BY expires_at LIMIT 10").bind(now).all();
  let suspended=0,failed=0;
  for(const domain of due.results||[]) {
    const lock=await env.DB.prepare("UPDATE managed_domains SET status='provisioning',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active' AND expires_at<=?").bind(domain.id,now).run();
    if(!lock.meta?.changes)continue;
    try {
      const deployed=await deployPagesFiles(env,domain,[{path:"index.html",content:btoa(unescape(encodeURIComponent(maintenance))),content_type:"text/html; charset=utf-8"}],{suspension:true});
      suspended++;
    } catch(error) {
      await env.DB.prepare("UPDATE managed_domains SET status='active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='provisioning'").bind(domain.id).run();
      failed++;
    }
  }
  return json({success:true,checked:(due.results||[]).length,suspended,failed});
}
