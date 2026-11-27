import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/+esm";
const supabase=createClient("https://xkkczzhjffocfywjlukr.supabase.co","sb_publishable_rOIFM2e5DRVSIN-dhFfqkQ_YOIqlGZN",{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id);
let mode="login",approvedEmail="";
const form=$("admin-auth-form");
const show=(message,error=false)=>{$("auth-message").textContent=message;$("auth-message").className="admin-auth-message "+(error?"is-error":"is-success");};
try{const cfg=await fetch("/api/admin/access",{cache:"no-store"}).then(r=>r.json());approvedEmail=String(cfg.admin_email||"").toLowerCase();}catch{}
const current=await supabase.auth.getSession();
if(current.data.session?.user){
 const check=await fetch("/api/admin/overview",{headers:{Authorization:"Bearer "+current.data.session.access_token},cache:"no-store"});
 if(check.ok)location.replace("/admin.html");
}
$("switch-mode").addEventListener("click",()=>{
 mode=mode==="login"?"signup":"login";
 $("auth-title").innerHTML=mode==="login"?"Welcome back<span>.</span>":"Create admin access<span>.</span>";
 $("auth-description").textContent=mode==="login"?"Sign in to manage DEVPAGES operations and hosting infrastructure.":"Register the approved administrator email. Public/member accounts cannot become administrators.";
 $("auth-submit").innerHTML=mode==="login"?'Sign in securely <span>→</span>':'Create administrator account <span>→</span>';
 $("switch-copy").textContent=mode==="login"?"New administrator?":"Already registered?";
 $("switch-mode").textContent=mode==="login"?"Create admin account":"Back to sign in";
 form.elements.password.autocomplete=mode==="login"?"current-password":"new-password";
 show("");
});
form.addEventListener("submit",async event=>{
 event.preventDefault();
 const button=$("auth-submit"),email=form.elements.email.value.trim().toLowerCase(),password=form.elements.password.value;
 button.disabled=true;button.textContent=mode==="login"?"Checking secure access…":"Creating secure account…";show("");
 try{
  if(mode==="signup"){
   if(!approvedEmail||email!==approvedEmail)throw new Error("Administrator registration is restricted to the approved DEVPAGES owner email.");
   const result=await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin+"/admin-login.html"}});
   if(result.error)throw result.error;
   if(result.data.session){const check=await fetch("/api/admin/overview",{headers:{Authorization:"Bearer "+result.data.session.access_token},cache:"no-store"});if(!check.ok)throw new Error("Account created, but administrator access is not yet confirmed. Verify the approved email address.");location.replace("/admin.html");return;}
   mode="login";
   $("auth-title").innerHTML="Welcome back<span>.</span>";
   $("auth-description").textContent="Sign in to manage DEVPAGES operations and hosting infrastructure.";
   $("auth-submit").innerHTML="Sign in securely <span>→</span>";
   $("switch-copy").textContent="New administrator?";
   $("switch-mode").textContent="Create admin account";
   form.elements.password.autocomplete="current-password";
   show("Registration received. Check the approved email inbox to confirm the account, then sign in here.");
   return;
  }
  const result=await supabase.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  const check=await fetch("/api/admin/overview",{headers:{Authorization:"Bearer "+result.data.session.access_token},cache:"no-store"});
  const payload=await check.json();
  if(!check.ok){await supabase.auth.signOut();throw new Error(payload.error||"This account is not authorised for the admin control room.");}
  location.replace("/admin.html");
 }catch(error){show(error.message||"Could not complete administrator authentication.",true);}
 finally{button.disabled=false;button.innerHTML=mode==="login"?'Sign in securely <span>→</span>':'Create administrator account <span>→</span>';}
});
