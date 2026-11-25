const end=new Date("2027-01-16T00:00:00+01:00").getTime();
const parts=["days","hours","minutes","seconds"];
function updateCountdown(){
 const left=Math.max(0,end-Date.now());
 const values=[Math.floor(left/86400000),Math.floor(left/3600000)%24,Math.floor(left/60000)%60,Math.floor(left/1000)%60];
 parts.forEach((id,i)=>{const el=document.getElementById(id);if(el)el.textContent=String(values[i]).padStart(2,"0")});
 if(left===0)document.querySelector(".promo-strip")?.remove();
}
updateCountdown();setInterval(updateCountdown,1000);
const year=document.getElementById("year");if(year)year.textContent=new Date().getFullYear();
const menu=document.querySelector(".menu-toggle"),nav=document.querySelector(".nav");
menu?.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open))});
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu?.setAttribute("aria-expanded","false")}));
const form=document.getElementById("name-form"),input=document.getElementById("name-input"),note=document.getElementById("search-note"),results=document.getElementById("domain-results");
const extensions=[".com",".net",".org",".io"];
function slugify(value){return value.toLowerCase().trim().replace(/^https?:\/\//,"").replace(/\s+/g,"").replace(/\.[a-z]{2,}$/i,"").replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40)}
function suggestNames(value){
 const base=slugify(value);if(!base)return [];
 return [...new Set([...extensions.map(ext=>base+ext),`get${base}.com`,`try${base}.com`,`${base}hq.com`,`${base}hub.com`])].slice(0,8);
}
function renderResults(items,registrarConnected){
 results.replaceChildren();
 for(const item of items){
  const card=document.createElement("article");card.className="domain-result";
  const name=document.createElement("strong");name.textContent=item.domain;
  const status=document.createElement("span");status.className="domain-status "+(item.status==="available"?"available":item.status==="registered"?"taken":"unknown");
  status.textContent=item.status==="available"?"Available — unconfirmed price":item.status==="registered"?"Registered":item.status==="unsupported"?"Not supported":"Unconfirmed";
  const detail=document.createElement("small");
  if(item.status==="available"&&item.customerPrice!==null&&item.customerPrice!==undefined){
   const renewal=item.customerRenewalEstimate!==null&&item.customerRenewalEstimate!==undefined?` · renewal estimate $${item.customerRenewalEstimate.toFixed(2)}`:"";
   detail.textContent=`First year $${item.customerPrice.toFixed(2)} (includes $3 DEVPAGES fee)${renewal}. Final price is checked again at checkout.`;
  }else if(item.status==="available"){
   detail.textContent="A registry record was not found. Connect the registrar for confirmed availability and live pricing.";
  }else if(item.status==="registered"){
   detail.textContent="The registrar reports that this name cannot currently be registered.";
  }else{
   detail.textContent=registrarConnected?"This extension or name could not be confirmed by the registrar.":"No definitive availability result. RDAP is indicative only; registrar confirmation and live pricing are not connected yet.";
  }
  card.append(name,status,detail);results.append(card);
 }
}
form?.addEventListener("submit",async e=>{
 e.preventDefault();const value=input.value.trim(),base=slugify(value);results.replaceChildren();
 if(!base){note.textContent="Enter a name using letters or numbers to begin.";return;}
 const domains=suggestNames(value);note.textContent="Generating brand ideas and checking .com, .net, .org and .io…";
 const button=form.querySelector("button");button.disabled=true;
 try{
  const response=await fetch("/api/domain-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domains})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Lookup is temporarily unavailable.");
  renderResults(data.results||[],data.registrarConnected);
  note.textContent=data.registrarConnected?`Live registrar results for “${value}”. DEVPAGES adds $3 to the registrar's price.`:`Indicative results for “${value}”. These results do not confirm availability or reserve a domain.`;
 }catch(error){note.textContent=error.message||"Could not complete the lookup. Please try again."}
 finally{button.disabled=false}
});
