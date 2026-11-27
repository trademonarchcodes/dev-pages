import { requireAdmin, json } from "../../_lib/admin.js";
export async function onRequestGet({request,env}) {
  const admin=await requireAdmin(request,env);
  if(!admin)return json({error:"Administrator access required."},403);
  if(!env.DB)return json({error:"Admin data store is unavailable."},503);
  try {
    const [customers,websites,payments,revenue,devcloud,recent,activity]=await Promise.all([
      env.DB.prepare("SELECT COUNT(DISTINCT user_id) AS total FROM managed_domains").first(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM managed_domains").first(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM domain_payments WHERE status='success'").first(),
      env.DB.prepare("SELECT COALESCE(SUM(amount_kobo),0) AS total FROM domain_payments WHERE status='success'").first(),
      env.DB.prepare("SELECT label,account_id,status,is_default,source,created_at FROM devcloud_accounts ORDER BY created_at ASC").all(),
      env.DB.prepare("SELECT p.reference,p.user_id,p.domain_id,p.purpose,p.amount_kobo,p.currency,p.status,p.paid_at,p.created_at,d.hostname FROM domain_payments p LEFT JOIN managed_domains d ON d.id=p.domain_id ORDER BY p.created_at DESC LIMIT 100").all(),
      env.DB.prepare("SELECT admin_email,action,details_json,created_at FROM admin_activity ORDER BY created_at DESC LIMIT 30").all()
    ]);
    const platformAccount=env.CF_API_TOKEN?{label:"DevCloud 1",account_id:"94f36f03ea5e3bdba6ca60c32b024936",status:"active",is_default:1,source:"environment"}:null;
    const accounts=devcloud.results||[];
    if(platformAccount&&!accounts.some(x=>x.account_id===platformAccount.account_id))accounts.unshift(platformAccount);
    return json({admin:{email:admin.email},stats:{customers:customers?.total||0,websites:websites?.total||0,successful_payments:payments?.total||0,revenue_kobo:revenue?.total||0},devcloud:accounts,payments:recent.results||[],activity:activity.results||[]});
  } catch(error) { return json({error:"Could not load administrator overview."},500); }
}
