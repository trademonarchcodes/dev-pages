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

const form=document.getElementById("name-form");
const input=document.getElementById("name-input");
const note=document.getElementById("search-note");
const results=document.getElementById("domain-results");
const extensions=[".com",".net",".org",".co",".io",".dev",".app"];
function slugify(value){return value.toLowerCase().trim().replace(/^https?:\/\//,"").replace(/\s+/g,"").replace(/\.[a-z]{2,}$/i,"").replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40)}
function suggestNames(value){
 const base=slugify(value);
 if(!base)return [];
 const candidates=[base,...["get","try","use","join","go","my"].map(p=>p+base),...["hq","hub","online","studio","works","world"].map(s=>base+s)];
 return [...new Set(candidates)].slice(0,8).map((name,i)=>name+extensions[i%extensions.length]);
}
function renderResults(items){
 results.replaceChildren();
 for(const item of items){
  const card=document.createElement("article");card.className="domain-result";
  const name=document.createElement("strong");name.textContent=item.domain;
  const status=document.createElement("span");status.className="domain-status "+(item.status==="not_found"?"available":item.status==="registered"?"taken":"unknown");
  status.textContent=item.status==="not_found"?"No record found — may be available":item.status==="registered"?"Registered":"Could not verify";
  const detail=document.createElement("small");detail.textContent=item.status==="not_found"?"Confirm final availability and price with a registrar before purchase.":item.status==="registered"?"This name has a registration record.":"The registry did not return a reliable result. Try again later.";
  card.append(name,status,detail);results.append(card);
 }
}
form?.addEventListener("submit",async e=>{
 e.preventDefault();
 const value=input.value.trim(),base=slugify(value);
 results.replaceChildren();
 if(!base){note.textContent="Enter a name using letters or numbers to begin.";return;}
 const domains=suggestNames(value);
 note.textContent="Generating brand ideas and checking registry records…";
 form.querySelector("button").disabled=true;
 try{
  const response=await fetch("/api/domain-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domains})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"Lookup is temporarily unavailable.");
  renderResults(data.results||[]);
  note.textContent="Results for “"+value+"”. RDAP checks registration records, not guaranteed purchasability; confirm with a registrar.";
 }catch(error){note.textContent=error.message||"Could not complete the lookup. Please try again."}
 finally{form.querySelector("button").disabled=false}
});