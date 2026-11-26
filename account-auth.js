import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  initializeAuth, browserLocalPersistence, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBo8SJxL8XgLdXe3hzBaa3q3I_2pAC9IKLo",
  authDomain: "devpagesdomain.firebaseapp.com",
  projectId: "devpagesdomain",
  storageBucket: "devpagesdomain.firebasestorage.app",
  messagingSenderId: "972778411264",
  appId: "1:972778411264:web:f14661c077767046da0fe5"
};
const $ = (s, root=document) => root.querySelector(s);
const page = location.pathname.endsWith("/signup.html") ? "signup" :
             location.pathname.endsWith("/login.html") ? "login" : "dashboard";
const form = $("#account-auth-form");
const message = $("#auth-message");
const button = $("#create-account") || $("#sign-in");
const emailInput = $("#account-email");
const passwordInput = $("#account-password");
const nameInput = $("#account-name");
const confirmInput = $("#confirm-password");
let auth = null;
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
  const messages={
    "auth/email-already-in-use":"An account already exists with this email. Please sign in.",
    "auth/invalid-email":"That email address is not valid.",
    "auth/weak-password":"Choose a stronger password.",
    "auth/operation-not-allowed":"Email/password sign-up is disabled. Please contact DEVPAGES support.",
    "auth/network-request-failed":"Network connection failed. Check your internet and try again.",
    "auth/too-many-requests":"Too many attempts. Please wait and try again.",
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/user-disabled":"This account has been disabled. Contact support.",
    "auth/user-not-found":"No account was found with that email."
  };
  return messages[error?.code] || error?.message || "Something went wrong. Please try again.";
}
async function signup() {
  const data=validateSignup();
  if(!data){messageText("Please correct the highlighted fields.","error");return;}
  setBusy(true,"Creating account…");
  messageText("Creating your secure account…");
  try {
    const credential=await createUserWithEmailAndPassword(auth,data.email,data.password);
    await updateProfile(credential.user,{displayName:data.name});
    await sendEmailVerification(credential.user);
    form.reset(); renderRules();
    messageText("Account created. Check your inbox or spam folder and verify your email before signing in.","success");
  } catch(error) {
    console.error("DEVPAGES signup:",error); messageText(explain(error),"error");
  } finally { setBusy(false); }
}
async function createServerSession(user) {
  const token=await user.getIdToken(true);
  const response=await fetch("/api/auth/firebase-session",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({idToken:token})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok) throw new Error(data.message||"DEVPAGES could not create your secure session.");
}
async function login() {
  const email=emailInput?.value.trim().toLowerCase()||"";
  const password=passwordInput?.value||"";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){messageText("Enter a valid email address.","error");emailInput?.focus();return;}
  if(!password){messageText("Enter your password.","error");passwordInput?.focus();return;}
  setBusy(true,"Signing in…"); messageText("Verifying your account…");
  try {
    const credential=await signInWithEmailAndPassword(auth,email,password);
    if(!credential.user.emailVerified){
      try { await sendEmailVerification(credential.user); } catch(_) {}
      throw new Error("Please verify your email first. We have requested a new verification email.");
    }
    await createServerSession(credential.user);
    location.assign("/account.html");
  } catch(error) {
    console.error("DEVPAGES login:",error); messageText(explain(error),"error");
    setBusy(false);
  }
}
async function resetPassword() {
  const email=emailInput?.value.trim().toLowerCase()||"";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){messageText("Enter your email address first.","error");emailInput?.focus();return;}
  const reset=$("#reset-password"); if(busy)return;
  busy=true;if(reset)reset.disabled=true;
  try { await sendPasswordResetEmail(auth,email);messageText("If an account exists for that email, a password reset email has been sent.","success"); }
  catch(error){messageText(explain(error),"error");}
  finally{busy=false;if(reset)reset.disabled=false;}
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
  } catch(error) {
    console.error("DEVPAGES dashboard:",error);
    if(alertBox){alertBox.hidden=false;alertBox.textContent=error.message+" Please refresh or sign in again.";}
  }
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
  // One and only one authentication action: the form submit event.
  form?.addEventListener("submit",event=>{
    event.preventDefault();if(busy)return;
    if(page==="signup")void signup();
    if(page==="login")void login();
  });
  $("#reset-password")?.addEventListener("click",()=>void resetPassword());
  $("#sign-out")?.addEventListener("click",async()=>{
    const out=$("#sign-out");if(out)out.disabled=true;
    try { await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin",cache:"no-store"}); }
    catch(error){console.warn("Sign-out request:",error);}
    location.assign("/login.html");
  });
  if(page==="signup")renderRules();
  if(page==="dashboard")void loadDashboard();
}
if(page==="dashboard") {
  start();
} else {
  try {
    const app = initializeApp(firebaseConfig);
    // Explicitly create the browser Auth instance with local persistence.
    // This avoids relying on getAuth's implicit component initialization.
    auth = initializeAuth(app, { persistence: browserLocalPersistence });
    if (!auth || typeof auth._getRecaptchaConfig !== "function") {
      throw new Error("Firebase Auth did not initialize correctly. Please refresh and try again.");
    }
    start();
  }
  catch(error) {
    console.error("DEVPAGES authentication startup:",error);
    messageText("Secure sign-in could not start. Refresh the page and check your internet connection.","error");
    if(button)button.disabled=true;
  }
}
