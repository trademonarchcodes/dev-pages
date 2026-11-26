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
function slugify(value){return value.toLowerCase().trim().replace(/^https?:\\/\\//,"").replace(/\\s+/g,"").replace(/\\.pages\\.dev$/i,"").replace(/\\.[a-z]{2,}$/i,"").replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40)}
const form=document.getElementById("name-form"),input=document.getElementById("name-input"),note=document.getElementById("search-note"),results=document.getElementById("domain-results");
form?.addEventListener("submit",e=>{
 e.preventDefault();
 const base=slugify(input.value);
 results.replaceChildren();
 if(!base){note.textContent="Enter a name using letters or numbers to begin.";return;}
 const card=document.createElement("article");card.className="domain-result pages-domain-result";
 const name=document.createElement("strong");name.textContent=base+".pages.dev";
 const status=document.createElement("span");status.className="domain-status unknown";
 const detail=document.createElement("small");
 const valid=/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(base)&&base.length<=40;
 if(valid){
  status.className="domain-status available";
  status.textContent="Name format looks valid";
  detail.textContent="This is a format check only. The name has not been checked against Cloudflare, is not reserved, and may already be in use.";
  note.textContent="Format validated: "+base+".pages.dev. Cloudflare confirms availability when a Pages project is created.";
 }else{
  status.textContent="Choose another name";
  detail.textContent="Use 1–40 lowercase letters, numbers or hyphens. The name cannot start or end with a hyphen.";
  note.textContent=detail.textContent;
 }
 card.append(name,status,detail);results.append(card);
});
 
const sharedReviewApi="https://script.google.com/macros/s/AKfycbxDZFklxGHXDh-kNwVO10IeIMMLLLz99H_5K5dTsgVnuaO5Xd_OLJGX-w0Deryliy5nYA/exec";
const header=document.querySelector(".topbar");
if(header&&!document.getElementById("shared-rating-badge")){
 const ratingRow=document.createElement("div");ratingRow.className="shared-rating-row";
 const badge=document.createElement("button");badge.type="button";badge.id="shared-rating-badge";badge.className="shared-rating-badge";
 badge.innerHTML='<span class="shared-rating-stars">★★★★★</span><span class="shared-rating-score">Loading…</span><span class="shared-rating-meta">Shared customer rating</span>';
 ratingRow.append(badge);header.insertAdjacentElement("afterend",ratingRow);
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
 const cacheKey="devpages-shared-rating-v1",badge=document.getElementById("shared-rating-badge");
 const paint=data=>{
  const list=Array.isArray(data?.reviews)?data.reviews:[],count=list.length,avg=count?list.reduce((sum,r)=>sum+Number(r.rating||0),0)/count:0;
  if(badge){badge.querySelector(".shared-rating-stars").textContent="★".repeat(Math.round(avg))+"☆".repeat(5-Math.round(avg));badge.querySelector(".shared-rating-score").textContent=count?avg.toFixed(1)+"/5":"—";badge.querySelector(".shared-rating-meta").textContent=count?count+" shared reviews":"Be the first to review";}
 };
 try{const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");if(cached?.savedAt&&Date.now()-cached.savedAt<15*60*1000)paint(cached.data);}catch(_){}
 const callback="devpagesSharedRatingLoaded";
 window[callback]=data=>{paint(data);try{localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),data}));}catch(_){}delete window[callback];};
 const feed=document.createElement("script");feed.async=true;feed.src=sharedReviewApi+"?action=list&callback="+callback;feed.onerror=()=>{const m=document.querySelector(".shared-rating-meta");if(m)m.textContent="Shared customer rating";};document.head.append(feed);
}
loadSharedRating();
function loadSharedReviewList(){
 const listNode=document.getElementById("shared-reviews-list");if(!listNode)return;
 const callback="devpagesSharedReviewsLoaded";
 window[callback]=data=>{
  const reviews=Array.isArray(data?.reviews)?data.reviews:[];
  const count=reviews.length,avg=count?reviews.reduce((sum,r)=>sum+Number(r.rating||0),0)/count:0;
  const avgNode=document.getElementById("shared-reviews-average"),starsNode=document.getElementById("shared-reviews-stars"),countNode=document.getElementById("shared-reviews-count");
  if(avgNode)avgNode.textContent=count?avg.toFixed(1)+"/5":"—";
  if(starsNode)starsNode.textContent="★".repeat(Math.round(avg))+"☆".repeat(5-Math.round(avg));
  if(countNode)countNode.textContent=count+" shared public reviews";
  listNode.replaceChildren();
  if(!count){const p=document.createElement("p");p.textContent="No reviews have been submitted yet.";listNode.append(p);return;}
  reviews.slice().reverse().forEach(item=>{
   const card=document.createElement("article");card.className="shared-public-review";
   const top=document.createElement("div");top.className="shared-public-review-top";
   const name=document.createElement("strong");name.textContent=item.name||"Customer";
   const rating=document.createElement("span");rating.className="shared-rating-stars";rating.textContent="★".repeat(Number(item.rating||0))+"☆".repeat(5-Number(item.rating||0));
   const body=document.createElement("p");body.textContent=item.review||"";
   const date=document.createElement("small");date.textContent=item.date||"";
   top.append(name,rating);card.append(top,body,date);listNode.append(card);
  });
  delete window[callback];
 };
 const feed=document.createElement("script");feed.src=sharedReviewApi+"?action=list&callback="+callback+"&_="+Date.now();feed.onerror=()=>{listNode.textContent="Reviews could not load right now. Please refresh.";};document.head.append(feed);
}
loadSharedReviewList();
document.getElementById("open-shared-review")?.addEventListener("click",()=>dialog.showModal());
const sharedForm=document.getElementById("shared-review-form");
if(sharedForm) sharedForm.addEventListener("submit",e=>{
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
