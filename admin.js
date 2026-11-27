import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/+esm";
const supabase=createClient("https://xkkczzhjffocfywjlukr.supabase.co","sb_publishable_rOIFM2e5DRVSIN-dhFfqkQ_YOIqlGZN",{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const money=k=>"₦"+(Number(k||0)/100).toLocaleString("en-NG");
const {data,error}=await supabase.auth.getUser();
if(error||!data.user){location.replace("/login.html");}
else{
 const session=(await supabase.auth.getSession()).data.session;
 const headers={Authorization:"Bearer "+session.access_token};
 async function load(){
  const res=await fetch("/api/admin/overview",{headers,cache:"no-store"});
  const d=await res.json();if(!res.ok)throw new Error(d.error||"Admin access denied.");
  $("admin-email").textContent="Signed in as "+d.admin.email;
  $("stat-customers").textContent=d.stats.customers;$("stat-websites").textContent=d.stats.websites;
  $("stat-payments").textContent=d.stats.successful_payments;$("stat-revenue").textContent=money(d.stats.revenue_kobo);
  $("devcloud-list").innerHTML="<table class='admin-table'><thead><tr><th>Account</th><th>Account ID</th><th>Status</th><th>Default</th><th>Action</th></tr></thead><tbody>"+d.devcloud.map(a=>"<tr><td>"+esc(a.label)+"</td><td>"+esc(a.account_id)+"</td><td>"+esc(a.status)+"</td><td>"+(a.is_default?"Yes":"No")+"</td><td>"+(a.source==="environment"?"Platform default · ": (a.status==="active"?"<button class='admin-action' data-action='deactivate' data-id='"+esc(a.id)+"'>Disconnect Hosting</button>":"<button class='admin-action' data-action='activate' data-id='"+esc(a.id)+"'>Connect Hosting</button>")+" <button class='admin-action' data-action='reconnect' data-id='"+esc(a.id)+"'>Reconnect Hosting</button>")+"</td></tr>").join("")+"</tbody></table>";
  $("payments-table").innerHTML="<table class='admin-table'><thead><tr><th>Reference</th><th>Customer ID</th><th>Website</th><th>Purpose</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>"+d.payments.map(p=>"<tr><td>"+esc(p.reference)+"</td><td>"+esc(p.user_id)+"</td><td>"+esc(p.hostname||"—")+"</td><td>"+esc(p.purpose)+"</td><td>"+money(p.amount_kobo)+"</td><td>"+esc(p.status)+"</td><td>"+new Date(p.created_at).toLocaleString()+"</td></tr>").join("")+"</tbody></table>";
  $("settlements-table").innerHTML="<table class='admin-table'><thead><tr><th>Settlement ID</th><th>Status</th><th>Amount</th><th>Settlement date</th></tr></thead><tbody>"+(d.settlements||[]).map(s=>"<tr><td>"+esc(s.id)+"</td><td>"+esc(s.status)+"</td><td>"+money(s.total_amount)+"</td><td>"+esc(s.settlement_date||"—")+"</td></tr>").join("")+"</tbody></table>";
  $("activity-table").innerHTML="<table class='admin-table'><thead><tr><th>Admin</th><th>Action</th><th>Details</th><th>Date</th></tr></thead><tbody>"+d.activity.map(a=>"<tr><td>"+esc(a.admin_email)+"</td><td>"+esc(a.action)+"</td><td>"+esc(a.details_json)+"</td><td>"+new Date(a.created_at).toLocaleString()+"</td></tr>").join("")+"</tbody></table>";
 }
 try{await load();}catch(e){$("admin-error").textContent=e.message;}
 $("admin-refresh").addEventListener("click",()=>load().catch(e=>$("admin-error").textContent=e.message));
 $("devcloud-list").addEventListener("click",async e=>{
  const b=e.target.closest("[data-action]");if(!b)return;let extra={};
  if(b.dataset.action==="reconnect"){const token=prompt("Enter the replacement hosting credential. It will be encrypted and never displayed again.");if(!token)return;extra.token=token;}
  b.disabled=true;
  try{const r=await fetch("/api/admin/devcloud",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({action:b.dataset.action,id:b.dataset.id,...extra})});const x=await r.json();if(!r.ok)throw new Error(x.error);await load();}
  catch(err){$("admin-error").textContent=err.message;}finally{b.disabled=false;}
 });
 $("devcloud-form").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget;const b=f.querySelector("button");b.disabled=true;b.textContent="Verifying…";
  try{const r=await fetch("/api/admin/devcloud",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({action:"add",account_id:f.account_id.value.trim(),token:f.token.value.trim()})});const x=await r.json();if(!r.ok)throw new Error(x.error);f.reset();$("admin-error").textContent=x.label+" added inactive. Connect Hosting when ready.";await load();}
  catch(err){$("admin-error").textContent=err.message;}finally{b.disabled=false;b.textContent="Connect Hosting →";}
 });
}