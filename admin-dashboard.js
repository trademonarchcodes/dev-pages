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
  const cr=await fetch("/api/admin/customers",{cache:"no-store"});const cd=await cr.json();if(!cr.ok)throw new Error(cd.message||"Customer list unavailable.");
  const list=document.querySelector("#admin-customer-list");if(list){list.replaceChildren();if(!cd.customers.length){list.textContent="No customer accounts have registered yet.";}else{const table=document.createElement("table");table.className="admin-table";const head=document.createElement("tr");["EMAIL","WEBSITES","ORDERS","JOINED"].forEach(t=>{const th=document.createElement("th");th.textContent=t;head.append(th)});const thead=document.createElement("thead");thead.append(head);const tbody=document.createElement("tbody");cd.customers.forEach(c=>{const tr=document.createElement("tr");[c.email,String(c.websites),String(c.orders),new Date(c.created_at+"Z").toLocaleDateString()].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td)});tbody.append(tr)});table.append(thead,tbody);list.append(table);}}
 }catch(e){show(e.message||"Could not load the administrator dashboard.");}
})();
