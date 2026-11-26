import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBo8SJlX8gLdXe3hzBaa3q3I_2pAC9IKLo",
  authDomain: "devpagesdomain.firebaseapp.com",
  projectId: "devpagesdomain",
  storageBucket: "devpagesdomain.firebasestorage.app",
  messagingSenderId: "972778411264",
  appId: "1:972778411264:web:f14661c077767046da0fe5"
};

const $ = (selector) => document.querySelector(selector);
const form = $("#account-auth-form");
const message = $("#auth-message");
const submitButton = $("#create-account") || $("#sign-in");
const emailInput = $("#account-email");
const passwordInput = $("#account-password");
const nameInput = $("#account-name");
const confirmInput = $("#confirm-password");
const page = location.pathname.endsWith("/signup.html") ? "signup" :
             location.pathname.endsWith("/login.html") ? "login" : "dashboard";
let auth;
let busy = false;

function showMessage(text, type = "info") {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("error", type === "error");
  message.classList.toggle("success", type === "success");
}
function setBusy(value, label) {
  busy = value;
  if (!submitButton) return;
  submitButton.disabled = value;
  if (value) {
    submitButton.dataset.originalText ||= submitButton.textContent;
    submitButton.textContent = label;
  } else {
    submitButton.textContent = submitButton.dataset.originalText || submitButton.textContent;
  }
}
function passwordRules(value) {
  return {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value)
  };
}
function renderPasswordRules() {
  if (!passwordInput) return;
  const rules = passwordRules(passwordInput.value);
  Object.entries(rules).forEach(([key, passed]) => {
    const item = document.querySelector('[data-rule="' + key + '"]');
    if (!item) return;
    item.classList.toggle("passed", passed);
    const mark = item.querySelector("span");
    if (mark) mark.textContent = passed ? "✓" : "○";
  });
  if (confirmInput && confirmInput.value) {
    const matches = confirmInput.value === passwordInput.value;
    confirmInput.classList.toggle("input-invalid", !matches);
    confirmInput.classList.toggle("input-valid", matches);
    const error = $("#confirm-error");
    if (error) error.textContent = matches ? "" : "Passwords do not match.";
  }
}
function clearErrors() {
  ["name-error", "email-error", "password-error", "confirm-error"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
  [nameInput, emailInput, passwordInput, confirmInput].filter(Boolean)
    .forEach(el => el.classList.remove("input-invalid"));
}
function validateSignup() {
  clearErrors();
  let valid = true;
  const name = nameInput?.value.trim() || "";
  const email = emailInput?.value.trim().toLowerCase() || "";
  const password = passwordInput?.value || "";
  const confirmation = confirmInput?.value || "";
  const fail = (id, input, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
    if (input) input.classList.add("input-invalid");
    valid = false;
  };
  if (name.length < 2) fail("name-error", nameInput, "Enter your full name (at least 2 characters).");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("email-error", emailInput, "Enter a valid email address.");
  if (Object.values(passwordRules(password)).some(ok => !ok)) fail("password-error", passwordInput, "Your password must meet all five requirements.");
  if (!confirmation || confirmation !== password) fail("confirm-error", confirmInput, "Your passwords do not match.");
  return valid ? { name, email, password } : null;
}
function firebaseMessage(error) {
  const messages = {
    "auth/email-already-in-use": "An account already exists with this email. Please log in.",
    "auth/invalid-email": "That email address is not valid.",
    "auth/weak-password": "Choose a stronger password.",
    "auth/operation-not-allowed": "Email/password sign-up is disabled in Firebase Authentication.",
    "auth/network-request-failed": "Network connection failed. Check your internet connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-disabled": "This account has been disabled. Contact support.",
    "auth/user-not-found": "No account was found with that email. Create an account first.",
    "auth/wrong-password": "Email or password is incorrect."
  };
  return messages[error?.code] || error?.message || "Something went wrong. Please try again.";
}
async function createAccount() {
  const details = validateSignup();
  if (!details) {
    showMessage("Please correct the highlighted fields.", "error");
    return;
  }
  setBusy(true, "Creating account…");
  showMessage("Connecting securely to DEVPAGES…");
  try {
    const credential = await createUserWithEmailAndPassword(auth, details.email, details.password);
    await updateProfile(credential.user, { displayName: details.name });
    await sendEmailVerification(credential.user);
    await signOut(auth);
    form.reset();
    renderPasswordRules();
    showMessage("Your account has been created. Check your email inbox (and spam folder) and verify your email before logging in.", "success");
  } catch (error) {
    console.error("DEVPAGES sign-up error", error);
    showMessage(firebaseMessage(error), "error");
  } finally {
    setBusy(false);
  }
}
async function establishSession(user) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/firebase-session", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.message || "Your DEVPAGES session could not be created. Please try again.");
  location.replace("/account.html");
}
async function login() {
  const email = emailInput?.value.trim().toLowerCase() || "";
  const password = passwordInput?.value || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showMessage("Enter a valid email address.", "error"); emailInput?.focus(); return;
  }
  if (!password) { showMessage("Enter your password.", "error"); passwordInput?.focus(); return; }
  setBusy(true, "Signing in…");
  showMessage("Checking your account…");
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (!credential.user.emailVerified) {
      await sendEmailVerification(credential.user);
      await signOut(auth);
      throw new Error("Please verify your email first. A fresh verification email has been sent.");
    }
    await establishSession(credential.user);
  } catch (error) {
    console.error("DEVPAGES login error", error);
    showMessage(firebaseMessage(error), "error");
  } finally {
    setBusy(false);
  }
}
async function resetPassword() {
  const email = emailInput?.value.trim().toLowerCase() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showMessage("Enter your email address above first.", "error"); emailInput?.focus(); return;
  }
  const button = $("#reset-password");
  if (busy) return;
  busy = true; if (button) button.disabled = true;
  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("If an account exists for that email, a password reset message has been sent.", "success");
  } catch (error) {
    showMessage(firebaseMessage(error), "error");
  } finally {
    busy = false; if (button) button.disabled = false;
  }
}
async function checkDashboardSession() {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json();
    if (!data.authenticated || !data.user) { location.replace("/login.html"); return; }
    const panel = $("#signed-in-panel");
    if (panel) {
      panel.hidden = false;
      const email = panel.querySelector("[data-user-email]");
      const role = panel.querySelector("[data-user-role]");
      if (email) email.textContent = data.user.email;
      if (role) role.textContent = data.user.role === "admin" ? "Administrator account" : "Customer account";
    }
    const alert = $(".workspace-alert"); if (alert) alert.hidden = true;
    const heading = $(".workspace-heading .preview-pill");
    if (heading) { heading.textContent = "ACCOUNT ACTIVE"; heading.classList.add("active-pill"); }
    await loadDashboard();
  } catch (error) {
    console.error("DEVPAGES dashboard session error", error);
    showMessage("We couldn't check your account session. Refresh the page or sign in again.", "error");
  }
}
async function loadDashboard() {
  const response = await fetch("/api/dashboard", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return;
  const data = await response.json();
  const cards = document.querySelectorAll(".metric-card strong");
  if (cards[0]) cards[0].textContent = (data.sites || []).length;
  if (cards[1]) cards[1].textContent = (data.domains || []).filter(x => ["paid", "registered"].includes(x.status)).length;
  if (cards[2]) cards[2].textContent = (data.domains || []).length + (data.payments || []).length;
  const render = (id, items, format) => {
    const box = document.getElementById(id);
    if (!box || !items?.length) return;
    box.replaceChildren();
    items.forEach(item => {
      const info = format(item);
      const row = document.createElement("div"); row.className = "account-data-row";
      const left = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = info.title;
      const detail = document.createElement("small"); detail.textContent = info.detail;
      const status = document.createElement("span"); status.textContent = info.status;
      left.append(title, detail); row.append(left, status); box.append(row);
    });
  };
  render("websites-list", data.sites, x => ({ title:x.project_name, detail:x.public_url || "Website address pending", status:x.status }));
  render("domains-list", data.domains, x => ({ title:x.domain_name, detail:x.currency + " · " + (x.registration_price_minor == null ? "Price pending" : ((x.registration_price_minor + x.markup_minor) / 100).toFixed(2)), status:x.status }));
  render("payments-list", data.payments, x => ({ title:x.provider + " payment", detail:x.currency + " " + (x.amount_minor / 100).toFixed(2), status:x.status }));
  render("activity-list", data.activity, x => ({ title:x.event_type.replaceAll("_", " "), detail:new Date(x.created_at + "Z").toLocaleString(), status:"Activity" }));
  const hosting = $("#hosting-connections-list");
  if (hosting) {
    hosting.replaceChildren();
    if (data.hostingConnections?.length) {
      data.hostingConnections.forEach(item => {
        const row = document.createElement("div"); row.className = "account-data-row";
        const left = document.createElement("div");
        const title = document.createElement("strong"); title.textContent = "Cloudflare account";
        const detail = document.createElement("small"); detail.textContent = "Account ID: " + item.provider_account_id;
        left.append(title, detail);
        const disconnect = document.createElement("button"); disconnect.type = "button"; disconnect.className = "text-link"; disconnect.textContent = "Disconnect";
        disconnect.addEventListener("click", async () => {
          if (!confirm("Disconnect this Cloudflare account? Also revoke its API token in Cloudflare.")) return;
          disconnect.disabled = true;
          try {
            const r = await fetch("/api/hosting/disconnect", { method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ accountId:item.provider_account_id }) });
            const result = await r.json();
            if (!r.ok || !result.ok) throw new Error(result.message || "Disconnect failed.");
            await loadDashboard();
          } catch (error) { alert(error.message); disconnect.disabled = false; }
        });
        row.append(left, disconnect); hosting.append(row);
      });
    } else {
      const empty = document.createElement("div"); empty.className = "empty-state";
      empty.innerHTML = "<span>◎</span><strong>No hosting account connected</strong><small>Connect your own Cloudflare account to prepare for Pages hosting.</small><a class='text-link' href='/connect-hosting.html'>Connect hosting →</a>";
      hosting.append(empty);
    }
  }
}
function bindControls() {
  passwordInput?.addEventListener("input", renderPasswordRules);
  confirmInput?.addEventListener("input", renderPasswordRules);
  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.setAttribute("aria-pressed", String(visible));
      button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    });
  });
  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (busy) return;
    if (page === "signup") createAccount();
    else if (page === "login") login();
  });
  $("#reset-password")?.addEventListener("click", resetPassword);
  $("#sign-out")?.addEventListener("click", async () => {
    const button = $("#sign-out"); if (button) button.disabled = true;
    try {
      await fetch("/api/auth/logout", { method:"POST", credentials:"same-origin" });
      if (auth) await signOut(auth);
    } finally { location.replace("/login.html"); }
  });
}

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  bindControls();
  if (page === "signup") renderPasswordRules();
  if (page === "dashboard") await checkDashboardSession();
  else {
    const response = await fetch("/api/auth/me", { credentials:"same-origin", cache:"no-store" });
    const data = await response.json().catch(() => ({}));
    if (data.authenticated) location.replace("/account.html");
  }
} catch (error) {
  console.error("DEVPAGES authentication startup failed", error);
  showMessage("The secure sign-in service could not start. Check your connection, refresh the page, and try again.", "error");
  if (submitButton) submitButton.disabled = true;
}
