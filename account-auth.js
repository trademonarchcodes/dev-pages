import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBo8SJlX8gLdXe3hzBaa3q3I_2pAC9IKLo",
  authDomain: "devpagesdomain.firebaseapp.com",
  projectId: "devpagesdomain",
  storageBucket: "devpagesdomain.firebasestorage.app",
  messagingSenderId: "972778411264",
  appId: "1:972778411264:web:f14661c077767046da0fe5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const $ = selector => document.querySelector(selector);
const form = $("#account-auth-form");
const message = $("#auth-message");
const signedIn = $("#signed-in-panel");
const alertBox = $(".workspace-alert");
const preview = $(".workspace-heading .preview-pill");
const emailInput = $("#account-email");
const passwordInput = $("#account-password");
const nameInput = $("#account-name");
const confirmInput = $("#confirm-password");
const createButton = $("#create-account");
const signInButton = $("#sign-in");
let busy = false;

const authPage = location.pathname.endsWith("/signup.html") ? "signup" : location.pathname.endsWith("/login.html") ? "login" : "dashboard";

function note(text, error = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("error", error);
}
function setBusy(value) {
  busy = value;
  [createButton, signInButton, $("#reset-password")].filter(Boolean).forEach(button => button.disabled = value);
}
async function establishServerSession(user) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/firebase-session", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message || "Could not establish your DEVPAGES session.");
  note("You're signed in securely.");
  location.replace("/account.html");
}
async function refresh() {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json();
    if (data.authenticated && data.user) {
      if (!signedIn) { location.replace("/account.html"); return; }
      if (signedIn) signedIn.hidden = false;
      if (form) form.hidden = true;
      if (alertBox) alertBox.hidden = true;
      signedIn.querySelector("[data-user-email]").textContent = data.user.email;
      signedIn.querySelector("[data-user-role]").textContent = data.user.role === "admin" ? "Administrator account" : "Customer account";
      if (preview) { preview.textContent = "ACCOUNT ACTIVE"; preview.classList.add("active-pill"); }
      await loadDashboard();
    } else if (signedIn) {
      location.replace("/login.html");
    }
  } catch {
    note("Unable to check account status. Please refresh.", true);
  }
}
async function loadDashboard() {
  const response = await fetch("/api/dashboard", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return;
  const data = await response.json();
  const cards = document.querySelectorAll(".metric-card strong");
  if (cards[0]) cards[0].textContent = data.sites.length;
  if (cards[1]) cards[1].textContent = data.domains.filter(item => ["paid", "registered"].includes(item.status)).length;
  if (cards[2]) cards[2].textContent = data.domains.length + data.payments.length;
  const render = (id, items, formatter) => {
    const box = document.getElementById(id);
    if (!box || !items?.length) return;
    box.replaceChildren();
    items.forEach(item => {
      const row = document.createElement("div"); row.className = "account-data-row";
      const left = document.createElement("div");
      const strong = document.createElement("strong"); strong.textContent = formatter(item).title;
      const small = document.createElement("small"); small.textContent = formatter(item).detail;
      left.append(strong, small);
      const status = document.createElement("span"); status.textContent = formatter(item).status;
      row.append(left, status); box.append(row);
    });
  };
  render("websites-list", data.sites, item => ({title:item.project_name,detail:item.public_url || "Website address pending",status:item.status}));
  render("domains-list", data.domains, item => ({title:item.domain_name,detail:item.currency+" · "+(item.registration_price_minor == null ? "Price pending" : ((item.registration_price_minor+item.markup_minor)/100).toFixed(2)),status:item.status}));
  render("payments-list", data.payments, item => ({title:item.provider+" payment",detail:item.currency+" "+(item.amount_minor/100).toFixed(2),status:item.status}));
  render("activity-list", data.activity, item => ({title:item.event_type.replaceAll("_"," "),detail:new Date(item.created_at+"Z").toLocaleString(),status:"Activity"}));
  const hostingBox = $("#hosting-connections-list");
  if (!hostingBox) return;
  hostingBox.replaceChildren();
  if (data.hostingConnections?.length) {
    data.hostingConnections.forEach(item => {
      const row=document.createElement("div"); row.className="account-data-row";
      const left=document.createElement("div");
      const strong=document.createElement("strong"); strong.textContent="Cloudflare account";
      const small=document.createElement("small"); small.textContent="Account ID: "+item.provider_account_id;
      left.append(strong,small);
      const disconnect=document.createElement("button"); disconnect.type="button"; disconnect.className="text-link"; disconnect.textContent="Disconnect";
      disconnect.addEventListener("click", async () => {
        if (!confirm("Disconnect this Cloudflare account from DEVPAGES? You should also revoke its API token in Cloudflare.")) return;
        disconnect.disabled=true; disconnect.textContent="Disconnecting…";
        try {
          const result=await fetch("/api/hosting/disconnect",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({accountId:item.provider_account_id})});
          const json=await result.json(); if(!result.ok||!json.ok) throw new Error(json.message||"Could not disconnect.");
          await loadDashboard();
        } catch(error) { alert(error.message || "Could not disconnect."); disconnect.disabled=false; disconnect.textContent="Disconnect"; }
      });
      row.append(left,disconnect); hostingBox.append(row);
    });
    $("#hosting-empty-copy")?.setAttribute("hidden","");
  } else {
    $("#hosting-empty-copy")?.removeAttribute("hidden");
    const empty=document.createElement("div"); empty.className="empty-state";
    empty.innerHTML="<span>◎</span><strong>No hosting account connected</strong><small>Connect your own Cloudflare account to prepare for Pages hosting.</small><a class='text-link' href='/connect-hosting.html'>Connect hosting →</a>";
    hostingBox.append(empty);
  }
}
function passwordChecks(value) {
  return {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value)
  };
}
function updatePasswordRules() {
  if (!passwordInput) return;
  const checks = passwordChecks(passwordInput.value);
  Object.entries(checks).forEach(([key, passed]) => {
    const row = document.querySelector('[data-rule="' + key + '"]');
    if (!row) return;
    row.classList.toggle("passed", passed);
    row.querySelector("span").textContent = passed ? "✓" : "○";
  });
  if (confirmInput && confirmInput.value) {
    const matches = confirmInput.value === passwordInput.value;
    confirmInput.classList.toggle("input-invalid", !matches);
    confirmInput.classList.toggle("input-valid", matches);
    $("#confirm-error").textContent = matches ? "" : "Passwords do not match.";
  }
}
function clearFieldErrors() {
  ["name","email","password","confirm"].forEach(key => {
    const node = $("#" + key + "-error");
    if (node) node.textContent = "";
  });
  [nameInput,emailInput,passwordInput,confirmInput].filter(Boolean).forEach(input => input.classList.remove("input-invalid"));
}
async function register() {
  clearFieldErrors();
  const name = nameInput?.value.trim() || "";
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const confirm = confirmInput?.value || "";
  let valid = true;
  if (name.length < 2) { $("#name-error").textContent = "Please enter your full name."; nameInput?.classList.add("input-invalid"); valid = false; }
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { $("#email-error").textContent = "Enter a valid email address."; emailInput.classList.add("input-invalid"); valid = false; }
  const checks = passwordChecks(password);
  if (Object.values(checks).some(passed => !passed)) { $("#password-error").textContent = "Your password must meet every requirement above."; passwordInput.classList.add("input-invalid"); valid = false; }
  if (confirm !== password || !confirm) { $("#confirm-error").textContent = "Passwords do not match."; confirmInput?.classList.add("input-invalid"); valid = false; }
  if (!valid) throw new Error("Please correct the highlighted fields.");
  const credential=await createUserWithEmailAndPassword(auth,email,password);
  await updateProfile(credential.user, { displayName: name });
  await sendEmailVerification(credential.user);
  await signOut(auth);
  form.reset();
  updatePasswordRules();
  note("Account created for " + name + ". Check your inbox and verify your email, then return to log in.");
}
async function login() {
  const email=emailInput.value.trim().toLowerCase(), password=passwordInput.value;
  const credential=await signInWithEmailAndPassword(auth,email,password);
  if (!credential.user.emailVerified) {
    await sendEmailVerification(credential.user);
    await signOut(auth);
    throw new Error("Please verify your email first. We've sent you a new verification link.");
  }
  await establishServerSession(credential.user);
}
passwordInput?.addEventListener("input", updatePasswordRules);
confirmInput?.addEventListener("input", updatePasswordRules);
document.querySelectorAll("[data-toggle-password]").forEach(button => {
  button.addEventListener("click", () => {
    const field = document.getElementById(button.dataset.togglePassword);
    if (!field) return;
    const reveal = field.type === "password";
    field.type = reveal ? "text" : "password";
    button.setAttribute("aria-pressed", String(reveal));
    button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    button.classList.toggle("is-visible", reveal);
  });
});
form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  if (authPage === "signup") {
    setBusy(true); note("Creating your DEVPAGES account…");
    try { await register(); } catch(error) { note(error.message || "Could not create your account.", true); }
    finally { setBusy(false); }
  } else if (signInButton) signInButton.click();
});
signInButton?.addEventListener("click", async () => {
  if (busy) return;
  setBusy(true); note("Signing you in…");
  try { await login(); } catch(error) { note(error.message || "Could not sign in.", true); }
  finally { setBusy(false); }
});
$("#reset-password")?.addEventListener("click", async () => {
  if (busy) return;
  const email=emailInput.value.trim().toLowerCase();
  if (!email) { note("Enter your email address first, then tap Reset password.", true); return; }
  setBusy(true);
  try { await sendPasswordResetEmail(auth,email); note("If an account exists for that email, a password reset email has been sent."); }
  catch(error) { note(error.message || "Could not send the reset email.", true); }
  finally { setBusy(false); }
});
$("#sign-out")?.addEventListener("click", async () => {
  try { await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"}); await signOut(auth); }
  finally { location.reload(); }
});
await refresh();
