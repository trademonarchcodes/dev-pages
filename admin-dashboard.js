const notice=document.querySelector("#admin-notice");
const metrics=document.querySelectorAll("[data-admin-metric]");
function show(text){if(notice)notice.textContent=text;}
(async()=>{
 try{
  const auth=await fetch("/api/auth/me",{cache:"no-store"});const a=await auth.json();
  if(!a.authenticated){show("Sign in through My Space using the verified administrator email to access platform data.");return;}
  if(a.user.role!=="admin"){show("Access denied. This account does not have administrator privileges.");return;}
  const r=await fetch("/api/admin/overview",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.message||"Admin data unavailable.");
  show("Administrator session verified. Live platform overview connected.");
  metrics.forEach(el=>{const key=el.dataset.adminMetric;const map={customers:d.totals.customers,sites:d.totals.sites,orders:d.totals.orders,payments:d.totals.successfulPayments};el.textContent=map[key]??"—";});
 }catch(e){show(e.message||"Could not load the administrator dashboard.");}
})();
