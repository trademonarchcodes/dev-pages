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
 const pagesName=base+".pages.dev";const pagesCard=document.createElement("article");pagesCard.className="domain-result pages-domain-result";const pagesTitle=document.createElement("strong");pagesTitle.textContent=pagesName;const pagesStatus=document.createElement("span");pagesStatus.className="domain-status unknown";pagesStatus.textContent="Suggested Pages.dev name";const pagesDetail=document.createElement("small");pagesDetail.textContent="Main DEVPAGES offer. Cloudflare Pages must confirm the project name before creation; this suggestion does not reserve it.";pagesCard.append(pagesTitle,pagesStatus,pagesDetail);results.append(pagesCard);const domains=suggestNames(value);note.textContent="Your featured address is "+pagesName+". Checking optional .com, .net, .org and .io alternatives…";
 const button=form.querySelector("button");button.disabled=true;
 try{
  const response=await fetch("/api/domain-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domains})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Lookup is temporarily unavailable.");
  const secondaryTitle=document.createElement("div");secondaryTitle.className="section-kicker";secondaryTitle.textContent="OPTIONAL CUSTOM DOMAIN IDEAS";results.append(secondaryTitle);renderResults(data.results||[],data.registrarConnected);
  note.textContent=data.registrarConnected?`Live registrar results for “${value}”. DEVPAGES adds $3 to the registrar's price.`:`Indicative results for “${value}”. These results do not confirm availability or reserve a domain.`;
 }catch(error){note.textContent=error.message||"Could not complete the lookup. Please try again."}
 finally{button.disabled=false}
});


const sharedReviewApi="https://script.google.com/macros/s/AKfycbxDZFklxGHXDh-kNwVO10IeIMMLLLz99H_5K5dTsgVnuaO5Xd_OLJGX-w0Deryliy5nYA/exec";
const header=document.querySelector(".topbar");
if(header&&!document.getElementById("shared-rating-badge")){
 const badge=document.createElement("button");badge.type="button";badge.id="shared-rating-badge";badge.className="shared-rating-badge";
 badge.innerHTML='<span class="shared-rating-stars">★★★★★</span><span class="shared-rating-score">—</span><span class="shared-rating-meta">Loading reviews</span>';
 header.insertBefore(badge,header.querySelector(".nav")||null);
 badge.addEventListener("click",()=>document.getElementById("shared-review-dialog")?.showModal());
}
const dialog=document.createElement("dialog");dialog.id="shared-review-dialog";dialog.className="shared-review-dialog";
dialog.innerHTML='<div class="shared-review-shell"><button type="button" class="shared-review-close" aria-label="Close">×</button><p class="section-kicker">DEVLYON × DEVPAGES / SHARED REVIEWS</p><h2>How was your experience?</h2><p class="shared-review-copy">Your review appears on both DEVLYON and DEVPAGES.</p><form id="shared-review-form"><label for="shared-review-name">Your name</label><input id="shared-review-name" name="name" maxlength="60" required placeholder="Your name"><label>Your rating</label><div class="shared-review-stars" role="group" aria-label="Choose a star rating"><button type="button" data-star="1">★</button><button type="button" data-star="2">★</button><button type="button" data-star="3">★</button><button type="button" data-star="4">★</button><button type="button" data-star="5">★</button></div><input type="hidden" id="shared-review-rating"><label for="shared-review-text">Your review</label><textarea id="shared-review-text" name="review" rows="4" maxlength="800" required placeholder="Tell us about your experience..."></textarea><input name="website" class="shared-review-honeypot" tabindex="-1" autocomplete="off"><button class="button primary" id="shared-review-submit" type="submit">Submit review ↗</button><p id="shared-review-status" role="status">One review is shared across both websites.</p></form></div>';
document.body.append(dialog);
dialog.querySelector(".shared-review-close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
let selectedSharedRating=0;
dialog.querySelectorAll("[data-star]").forEach(btn=>btn.addEventListener("click",()=>{selectedSharedRating=Number(btn.dataset.star);dialog.querySelectorAll("[data-star]").forEach(s=>s.classList.toggle("selected",Number(s.dataset.star)<=selectedSharedRating))}));
function loadSharedRating(){
 const callback="devpagesSharedRatingLoaded";
 window[callback]=data=>{
  const list=Array.isArray(data?.reviews)?data.reviews:[],count=list.length,avg=count?list.reduce((sum,r)=>sum+Number(r.rating||0),0)/count:0;
  const badge=document.getElementById("shared-rating-badge");
  if(badge){badge.querySelector(".shared-rating-stars").textContent="★".repeat(Math.round(avg))+"☆".repeat(5-Math.round(avg));badge.querySelector(".shared-rating-score").textContent=count?avg.toFixed(1)+"/5":"—";badge.querySelector(".shared-rating-meta").textContent=count?count+" shared reviews":"Be the first to review";}
  delete window[callback];
 };
 const feed=document.createElement("script");feed.src=sharedReviewApi+"?action=list&callback="+callback+"&_="+Date.now();feed.onerror=()=>{const m=document.querySelector(".shared-rating-meta");if(m)m.textContent="Reviews";};document.head.append(feed);
}
loadSharedRating();
const sharedForm=document.getElementById("shared-review-form");
sharedForm.addEventListener("submit",e=>{
 e.preventDefault();const status=document.getElementById("shared-review-status"),submit=document.getElementById("shared-review-submit");
 if(!selectedSharedRating){status.textContent="Please choose a star rating.";return;}
 if(!sharedForm.reportValidity())return;
 const data=new FormData(sharedForm);if(String(data.get("website")||"").trim())return;
 const frame=document.createElement("iframe");frame.name="devpages-review-post";frame.hidden=true;document.body.append(frame);
 const post=document.createElement("form");post.method="POST";post.action=sharedReviewApi;post.target=frame.name;post.hidden=true;
 [["action","add"],["name",data.get("name")],["rating",selectedSharedRating],["review",data.get("review")],["website",""]].forEach(([k,v])=>{const x=document.createElement("input");x.name=k;x.value=String(v||"");post.append(x)});
 document.body.append(post);submit.disabled=true;status.textContent="Submitting your review...";
 const done=event=>{if(event.data?.type!=="devlyon-review-submitted")return;window.removeEventListener("message",done);submit.disabled=false;status.textContent=event.data.ok?"Thank you! Your review is now shared on both websites.":"We couldn't submit your review. Please try again.";if(event.data.ok){sharedForm.reset();selectedSharedRating=0;dialog.close();loadSharedRating()}post.remove();frame.remove()};
 window.addEventListener("message",done);post.submit();
 setTimeout(()=>{if(submit.disabled){submit.disabled=false;status.textContent="Submission may still be processing. Please check the reviews page shortly.";post.remove();frame.remove()}},12000);
});
try{const key="shared-review-prompt-dismissed-until";if(Number(localStorage.getItem(key)||0)<Date.now())setTimeout(()=>{if(!dialog.open){dialog.showModal();localStorage.setItem(key,String(Date.now()+7*24*60*60*1000))}},18000)}catch(_){}
