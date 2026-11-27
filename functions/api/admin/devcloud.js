import { requireAdmin, json, logAdmin } from "../../_lib/admin.js";
import { encryptConnection } from "../../_lib/billing.js";
const ACCOUNT_ID=/^[a-f0-9]{32}$/i;
async function verifyToken(token,accountId) {
  const checked=await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify",{headers:{Authorization:"Bearer "+token}});
  const verify=await checked.json();
  if(!checked.ok||!verify.success||verify.result?.status!=="active")throw new Error("The hosting credential could not be verified.");
  const account=await fetch("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(accountId),{headers:{Authorization:"Bearer "+token}});
  const result=await account.json();
  if(!account.ok||!result.success||result.result?.id!==accountId)throw new Error("The account ID does not match this hosting credential.");
  return result.result;
}
export async function onRequestPost({request,env}) {
  const admin=await requireAdmin(request,env);
  if(!admin)return json({error:"Administrator access required."},403);
  if(!env.DB||!env.CF_TOKEN_ENCRYPTION_KEY)return json({error:"Secure hosting storage is not configured."},503);
  if(request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Request origin rejected."},403);
  try {
    const body=await request.json();
    const action=String(body.action||"");
    if(action==="add") {
      const accountId=String(body.account_id||"").trim();
      const token=String(body.token||"").trim();
      if(!ACCOUNT_ID.test(accountId)||!token||token.length>4096)return json({error:"Enter a valid account ID and hosting credential."},400);
      const account=await verifyToken(token,accountId);
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM devcloud_accounts").first();
      const label="DevCloud "+(Number(count?.total||1)+1);
      const encrypted=await encryptConnection({access_token:token},env.CF_TOKEN_ENCRYPTION_KEY);
      await env.DB.prepare("INSERT INTO devcloud_accounts(id,label,account_id,status,is_default,source,token_ciphertext,token_iv) VALUES(?,?,?,'inactive',0,'encrypted',?,?)")
        .bind(crypto.randomUUID(),label,accountId,encrypted.ciphertext,encrypted.iv).run();
      await logAdmin(env,admin,"devcloud_added",{label,account_id:accountId,account_name:account.name});
      return json({success:true,label,account_name:account.name,status:"inactive"});
    }
    if(action==="activate"||action==="deactivate") {
      const id=String(body.id||"");
      const row=await env.DB.prepare("SELECT id,label,account_id FROM devcloud_accounts WHERE id=?").bind(id).first();
      if(!row)return json({error:"DevCloud account not found."},404);
      if(action==="activate") {
        await env.DB.batch([
          env.DB.prepare("UPDATE devcloud_accounts SET is_default=0,updated_at=CURRENT_TIMESTAMP WHERE is_default=1"),
          env.DB.prepare("UPDATE devcloud_accounts SET status='active',is_default=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id)
        ]);
      } else {
        await env.DB.prepare("UPDATE devcloud_accounts SET status='disabled',is_default=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
      }
      await logAdmin(env,admin,"devcloud_"+action,{label:row.label,account_id:row.account_id});
      return json({success:true});
    }
    return json({error:"Unsupported DevCloud action."},400);
  } catch(error) { return json({error:error.message||"DevCloud operation failed."},400); }
}
