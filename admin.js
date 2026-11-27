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
  const d=await res.json();
  if(!res.ok)throw new Error(d.error||"Admin access denied.");
  $("admin-email").textContent="Signed in as "+d.admin.email;
  $("stat-customers").textContent=d.stats.customers;
  $("stat-websites").textContent=d.stats.websites;
  $("stat-payments").textContent=d.stats.successful_payments;
  $("stat-revenue").textContent=money(d.stats.revenue_kobo);

  $("devcloud-list").innerHTML=(d.devcloud||[]).map(a=>{
   const connected=a.status==="active";
   const state=connected?"Connected":a.status==="disabled"?"Disconnected":"Not connected";
   const menuItems=[
    ...(!connected?["<button type='button' data-action='activate' data-id='"+esc(a.id)+"'>Connect Hosting</button>"]:[]),
    "<button type='button' data-action='reconnect' data-id='"+esc(a.id)+"'>Reconnect Hosting</button>",
    ...(connected?["<button type='button' data-action='deactivate' data-id='"+esc(a.id)+"'>Disconnect Hosting</button>"]:[])
   ].join("");
   return "<article class='devcloud-card'>"+
    "<div class='devcloud-main'><p class='devcloud-name'>"+esc(a.label)+"</p>"+
    "<div class='devcloud-id'>Account ID: "+esc(a.account_id)+"</div>"+
    "<div class='devcloud-meta'><span class='devcloud-state "+(connected?"connected":"")+"'>"+state+"</span>"+
    (a.is_default?"<span class='devcloud-default'>Default for new websites</span>":"")+
    (a.source==="environment"?"<span class='admin-muted'>Platform account</span>":"")+
    "</div></div>"+
    "<details class='devcloud-menu'><summary aria-label='Options for "+esc(a.label)+"' title='Hosting options'>⋮</summary>"+
    "<div class='devcloud-menu-items'>"+menuItems+"</div></details></article>";
  }).join("")||"<p class='admin-muted'>No DevCloud accounts have been added.</p>";

  $("websites-table").innerHTML="<table class='admin-table'><thead><tr><th>Website</th><th>Customer ID</th><th>DevCloud account</th><th>Status</th><th>Expires</th></tr></thead><tbody>"+(d.websites||[]).map(w=>"<tr><td>"+esc(w.hostname)+"</td><td>"+esc(w.user_id)+"</td><td>"+esc(w.cloudflare_account_id||"—")+"</td><td>"+esc(w.status)+"</td><td>"+esc(w.expires_at||"—")+"</td></tr>").join("")+"</tbody></table>";
  $("payments-table").innerHTML="<table class='admin-table'><thead><tr><th>Reference</th><th>Customer ID</th><th>Website</th><th>Purpose</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>"+(d.payments||[]).map(p=>"<tr><td>"+esc(p.reference)+"</td><td>"+esc(p.user_id)+"</td><td>"+esc(p.hostname||"—")+"</td><td>"+esc(p.purpose)+"</td><td>"+money(p.amount_kobo)+"</td><td>"+esc(p.status)+"</td><td>"+new Date(p.created_at).toLocaleString()+"</td></tr>").join("")+"</tbody></table>";
  $("settlements-table").innerHTML="<table class='admin-table'><thead><tr><th>Settlement ID</th><th>Status</th><th>Amount</th><th>Settlement date</th></tr></thead><tbody>"+(d.settlements||[]).map(s=>"<tr><td>"+esc(s.id)+"</td><td>"+esc(s.status)+"</td><td>"+money(s.total_amount)+"</td><td>"+esc(s.settlement_date||"—")+"</td></tr>").join("")+"</tbody></table>";
  $("activity-table").innerHTML="<table class='admin-table'><thead><tr><th>Admin</th><th>Action</th><th>Details</th><th>Date</th></tr></thead><tbody>"+(d.activity||[]).map(a=>"<tr><td>"+esc(a.admin_email)+"</td><td>"+esc(a.action)+"</td><td>"+esc(a.details_json)+"</td><td>"+new Date(a.created_at).toLocaleString()+"</td></tr>").join("")+"</tbody></table>";
 }
 try{await load();}catch(e){$("admin-error").textContent=e.message;}
 $("admin-refresh").addEventListener("click",()=>load().catch(e=>$("admin-error").textContent=e.message));

 $("devcloud-list").addEventListener("click",async e=>{
  const b=e.target.closest("[data-action]");
  if(!b)return;
  const details=b.closest("details");
  if(details)details.open=false;
  let extra={};
  if(b.dataset.action==="reconnect"){
   const token=prompt("Enter the replacement hosting credential. It will be encrypted and never displayed again.");
   if(!token)return;
   extra.token=token;
  }
  b.disabled=true;
  $("admin-error").textContent="";
  try{
   const r=await fetch("/api/admin/devcloud",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({action:b.dataset.action,id:b.dataset.id,...extra})});
   const x=await r.json();
   if(!r.ok)throw new Error(x.error||"Hosting account update failed.");
   await load();
  }catch(err){$("admin-error").textContent=err.message;}
  finally{b.disabled=false;}
 });

 document.addEventListener("click",e=>{
  if(!e.target.closest(".devcloud-menu"))document.querySelectorAll(".devcloud-menu[open]").forEach(menu=>menu.open=false);
 });

 $("devcloud-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const f=e.currentTarget;
  const accountId=f.elements.namedItem("account_id");
  const tokenField=f.elements.namedItem("token");
  const b=f.querySelector("button");
  b.disabled=true;b.textContent="Verifying…";
  $("admin-error").textContent="";
  try{
   const r=await fetch("/api/admin/devcloud",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({action:"add",account_id:accountId.value.trim(),token:tokenField.value.trim()})});
   const x=await r.json();
   if(!r.ok)throw new Error(x.error||"Could not add this DevCloud account.");
   f.reset();
   $("admin-error").textContent=x.label+" added as not connected. Open its ⋮ menu and choose Connect Hosting when ready.";
   await load();
  }catch(err){$("admin-error").textContent=err.message;}
  finally{b.disabled=false;b.textContent="Add DevCloud Account →";}
 });
}
