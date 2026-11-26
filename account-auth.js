import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";

const supabase = createClient("https://xkkczzhjffocfywjlukr.supabase.co", "sb_publishable_rOIFM2e5DRVSIN-dhFfqkQ_YOIqlGZN", {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

const $ = (s, root=document) => root.querySelector(s);
const path = location.pathname;
const page = path.endsWith("/signup.html") ? "signup" :
             path.endsWith("/login.html") ? "login" :
             path.endsWith("/reset-password.html") ? "reset" : "dashboard";
const form = $("#account-auth-form");
const message = $("#auth-message");
const button = $("#create-account") || $("#sign-in") || $("#save-password");
const emailInput = $("#account-email");
const passwordInput = $("#account-password");
const nameInput = $("#account-name");
const confirmInput = $("#confirm-password");
let busy = false;

function messageText(text, kind="info") {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("error", kind==="error");
  message.classList.toggle("success", kind==="success");
}
function setBusy(value, label) {
  busy = value;
  if (!button) return;
  if (value) {
    button.dataset.label ||= button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.label || button.textContent;
  }
}
function rules(value) {
  return {
    length:value.length>=8, upper:/[A-Z]/.test(value), lower:/[a-z]/.test(value),
    number:/[0-9]/.test(value), special:/[^A-Za-z0-9]/.test(value)
  };
}
function renderRules() {
  const result = rules(passwordInput?.value || "");
  Object.entries(result).forEach(([key,ok]) => {
    const node = $('[data-rule="'+key+'"]');
    if (!node) return;
    node.classList.toggle("passed",ok);
    const mark=$("span",node); if(mark) mark.textContent=ok?"✓":"○";
  });
  if (confirmInput && passwordInput && confirmInput.value) {
    const match=confirmInput.value===passwordInput.value;
    confirmInput.classList.toggle("input-invalid",!match);
    const error=$("#confirm-error"); if(error) error.textContent=match?"":"Passwords do not match.";
  }
}
function clearErrors() {
  ["name-error","email-error","password-error","confirm-error"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent="";
  });
  [nameInput,emailInput,passwordInput,confirmInput].filter(Boolean)
    .forEach(el=>el.classList.remove("input-invalid"));
}
function validateSignup() {
  clearErrors();
  const values={
    name:nameInput?.value.trim()||"",
    email:emailInput?.value.trim().toLowerCase()||"",
    password:passwordInput?.value||"",
    confirm:confirmInput?.value||""
  };
  let valid=true;
  const fail=(id,input,text)=>{
    const el=document.getElementById(id); if(el) el.textContent=text;
    input?.classList.add("input-invalid"); valid=false;
  };
  if(values.name.length<2) fail("name-error",nameInput,"Enter your full name.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) fail("email-error",emailInput,"Enter a valid email address.");
  if(Object.values(rules(values.password)).some(v=>!v)) fail("password-error",passwordInput,"Your password must meet all five requirements.");
  if(!values.confirm||values.confirm!==values.password) fail("confirm-error",confirmInput,"Your passwords do not match.");
  return valid?values:null;
}
function explain(error) {
  const text=String(error?.message||"");
  if(/already registered|already exists|user already/i.test(text)) return "An account may already exist with this email. Try signing in.";
  if(/invalid login credentials/i.test(text)) return "Email or password is incorrect.";
  if(/email not confirmed/i.test(text)) return "Please verify your email address using the link we sent you.";
  if(/password should be|weak password|at least/i.test(text)) return "Choose a stronger password that meets all five requirements.";
  if(/rate limit|too many requests/i.test(text)) return "Too many attempts. Please wait a little and try again.";
  if(/network|fetch/i.test(text)) return "Connection problem. Check your internet and try again.";
  return text || "Something went wrong. Please try again.";
}
async function createServerSession(accessToken) {
  const response=await fetch("/api/auth/supabase-session",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({accessToken})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok) throw new Error(data.message||"DEVPAGES could not create your secure session.");
  return data;
}
async function signup() {
  const data=validateSignup();
  if(!data){messageText("Please correct the highlighted fields.","error");return;}
  setBusy(true,"Creating account…"); messageText("Creating your secure account…");
  try {
    const {data:result,error}=await supabase.auth.signUp({
      email:data.email,
      password:data.password,
      options:{
        data:{full_name:data.name},
        emailRedirectTo:location.origin+"/login.html?verified=1"
      }
    });
    if(error) throw error;
    form.reset(); renderRules();
    if(result.session?.access_token) {
      await createServerSession(result.session.access_token);
      messageText("Your account is ready. Opening your workspace…","success");
      location.assign("/account.html");
      return;
    }
    messageText("Account created. Check your inbox (and spam folder) and tap the Supabase verification link. Then return here to sign in.","success");
  } catch(error) {
    console.error("DEVPAGES Supabase signup:",error);
    messageText(explain(error),"error");
  } finally { setBusy(false); }
}
async function login() {
  const email=emailInput?.value.trim().toLowerCase()||"";
  const password=passwordInput?.value||"";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){messageText("Enter a valid email address.","error");emailInput?.focus();return;}
  if(!password){messageText("Enter your password.","error");passwordInput?.focus();return;}
  setBusy(true,"Signing in…"); messageText("Verifying your account…");
  try {
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    if(!data.session?.access_token) throw new Error("Supabase did not return a secure session. Please try again.");
    await createServerSession(data.session.access_token);
    messageText("Signed in. Opening your workspace…","success");
    location.assign("/account.html");
  } catch(error) {
    console.error("DEVPAGES Supabase login:",error);
    messageText(explain(error),"error");
    setBusy(false);
  }
}
async function sendPasswordReset() {
  const email=emailInput?.value.trim().toLowerCase()||"";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){messageText("Enter your email address first.","error");emailInput?.focus();return;}
  const reset=$("#reset-password"); if(busy)return;
  busy=true;if(reset)reset.disabled=true;
  try {
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/reset-password.html"});
    if(error) throw error;
    messageText("If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.","success");
  } catch(error){messageText(explain(error),"error");}
  finally{busy=false;if(reset)reset.disabled=false;}
}
async function saveNewPassword() {
  const password=passwordInput?.value||"";
  const confirm=confirmInput?.value||"";
  if(Object.values(rules(password)).some(v=>!v)){messageText("Your new password must meet all five requirements.","error");return;}
  if(password!==confirm){messageText("Your passwords do not match.","error");return;}
  setBusy(true,"Updating password…");
  try {
    const {data,error}=await supabase.auth.updateUser({password});
    if(error) throw error;
    if(!data.user) throw new Error("The password was not updated. Please request a new reset link.");
    await supabase.auth.signOut();
    messageText("Password updated successfully. You can now sign in with your new password.","success");
    form.reset();
    setTimeout(()=>location.assign("/login.html?password=updated"),1800);
  } catch(error){messageText(explain(error),"error");}
  finally{setBusy(false);}
}
async function syncEmailConfirmation() {
  const params=new URLSearchParams(location.search);
  if(params.get("verified")!=="1" && !params.has("code")) return;
  try {
    const {data,error}=await supabase.auth.getSession();
    if(error) throw error;
    if(data.session?.access_token && data.session.user?.email_confirmed_at) {
      messageText("Email verified. Preparing your DEVPAGES workspace…","success");
      await createServerSession(data.session.access_token);
      location.replace("/account.html");
    } else {
      messageText("Email verification complete. Please sign in with your email and password.","success");
    }
  } catch(error){messageText(explain(error),"error");}
}
function bindPasswordButtons() {
  document.querySelectorAll("[data-toggle-password]").forEach(btn=>btn.addEventListener("click",()=>{
    const input=document.getElementById(btn.dataset.togglePassword);if(!input)return;
    const show=input.type==="password";input.type=show?"text":"password";
    btn.setAttribute("aria-pressed",String(show));btn.setAttribute("aria-label",show?"Hide password":"Show password");
  }));
}
function start() {
  bindPasswordButtons();
  passwordInput?.addEventListener("input",renderRules);
  confirmInput?.addEventListener("input",renderRules);
  form?.addEventListener("submit",event=>{
    event.preventDefault();if(busy)return;
    if(page==="signup")void signup();
    else if(page==="login")void login();
    else if(page==="reset")void saveNewPassword();
  });
  $("#reset-password")?.addEventListener("click",()=>void sendPasswordReset());
  $("#sign-out")?.addEventListener("click",async()=>{
    const out=$("#sign-out");if(out)out.disabled=true;
    try { await supabase.auth.signOut(); } catch(error) { console.warn("Supabase sign-out:",error); }
    try { await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin",cache:"no-store"}); }
    catch(error){console.warn("DEVPAGES sign-out request:",error);}
    location.assign("/login.html");
  });
  if(page==="signup" || page==="reset")renderRules();
  if(page==="login")void syncEmailConfirmation();
  if(page==="dashboard")void loadDashboard();
}
async function loadDashboard() {
  const alertBox=$(".workspace-alert");
  try {
    const response=await fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message||"Account session check failed.");
    if(!data.authenticated||!data.user) {
      if(alertBox){alertBox.hidden=false;alertBox.innerHTML='<strong>You are not signed in yet.</strong><p>Sign in to view your private workspace. <a class="text-link" href="/login.html">Go to login →</a></p>';}
      return;
    }
    const panel=$("#signed-in-panel");
    if(panel){
      panel.hidden=false;
      const email=$("[data-user-email]",panel),role=$("[data-user-role]",panel);
      if(email)email.textContent=data.user.email||"";
      if(role)role.textContent=data.user.role==="admin"?"Administrator account":"Customer account";
    }
    if(alertBox)alertBox.hidden=true;
    const heading=$(".workspace-heading .preview-pill");
    if(heading){heading.textContent="ACCOUNT ACTIVE";heading.classList.add("active-pill");}
    const dashboard=await fetch("/api/dashboard",{credentials:"same-origin",cache:"no-store"});
    if(!dashboard.ok) throw new Error("Your account is signed in, but dashboard information could not be loaded.");
    const result=await dashboard.json();
    const cards=document.querySelectorAll(".metric-card strong");
    if(cards[0])cards[0].textContent=(result.sites||[]).length;
    if(cards[1])cards[1].textContent=(result.domains||[]).filter(x=>["paid","registered"].includes(x.status)).length;
    if(cards[2])cards[2].textContent=(result.domains||[]).length+(result.payments||[]).length;
    const hosting=$("#hosting-connections-list");
    if(hosting){
      const connections=result.hostingConnections||[];
      if(connections.length){
        hosting.innerHTML=connections.map(c=>'<div class="connection-row"><strong>Cloudflare account</strong><span>'+String(c.provider_account_id).replace(/[&<>"']/g,'')+'</span></div>').join("");
      }
    }
  } catch(error) {
    console.error("DEVPAGES dashboard:",error);
    if(alertBox){alertBox.hidden=false;alertBox.textContent=error.message+" Please refresh or sign in again.";}
  }
}
if(page==="dashboard") start();
else start();
