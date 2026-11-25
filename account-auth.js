const $ = (s) => document.querySelector(s);
const form = $("#account-auth-form");
const message = $("#auth-message");
const codeWrap = $("#code-wrap");
const signedIn = $("#signed-in-panel");
const alertBox = $(".workspace-alert");
const preview = $(".workspace-heading .preview-pill");
let email = "";
function note(text, error=false){ if(message){message.textContent=text;message.classList.toggle("error",error);} }
async function refresh(){
 try{
  const r=await fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"});
  const data=await r.json();
  if(data.authenticated && data.user){
   signedIn.hidden=false; form.hidden=true; if(alertBox) alertBox.hidden=true;
   signedIn.querySelector("[data-user-email]").textContent=data.user.email;
   signedIn.querySelector("[data-user-role]").textContent=data.user.role==="admin"?"Administrator account":"Customer account";
   if(preview){preview.textContent="ACCOUNT ACTIVE";preview.classList.add("active-pill");}
   const d=await fetch("/api/dashboard",{credentials:"same-origin",cache:"no-store"});
   if(d.ok){const x=await d.json(); const cards=document.querySelectorAll(".metric-card strong");if(cards[0])cards[0].textContent=x.sites.length;if(cards[1])cards[1].textContent=x.domains.filter(v=>["paid","registered"].includes(v.status)).length;if(cards[2])cards[2].textContent=x.domains.length+x.payments.length;}
  }
 }catch(e){note("Unable to check account status. Please refresh.",true);}
}
if(form){
 form.addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=form.querySelector("[type=submit]"); email=$("#account-email").value.trim().toLowerCase();
  btn.disabled=true; note("Sending your secure sign-in code…");
  try{const r=await fetch("/api/auth/request-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Email sign-in is not ready.");codeWrap.hidden=false;note(d.message||"Check your inbox for the code.");}
  catch(err){note(err.message,true);}finally{btn.disabled=false;}
 });
 $("#verify-code").addEventListener("click",async()=>{
  const btn=$("#verify-code");btn.disabled=true;note("Verifying your code…");
  try{const r=await fetch("/api/auth/verify-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code:$("#account-code").value.trim()})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Verification failed.");note("You're signed in.");await refresh();}
  catch(err){note(err.message,true);}finally{btn.disabled=false;}
 });
 $("#resend-code").addEventListener("click",()=>form.requestSubmit());
}
$("#sign-out")?.addEventListener("click",async()=>{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});location.reload();});
refresh();
