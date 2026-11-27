import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/+esm";

const supabase = createClient(
  "https://xkkczzhjffocfywjlukr.supabase.co",
  "sb_publishable_rOIFM2e5DRVSIN-dhFfqkQ_YOIqlGZN",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const $ = (id) => document.getElementById(id);
const message = $("auth-message");
function showMessage(text, type = "success") {
  if (!message) return;
  message.textContent = text;
  message.className = `auth-message show ${type}`;
}
function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (!button.dataset.original) button.dataset.original = button.textContent;
  button.textContent = busy ? label : button.dataset.original;
}
function friendlyError(error) {
  const text = String(error?.message || "Something went wrong.");
  if (/invalid login credentials/i.test(text)) return "Email or password is incorrect. Check your details and try again.";
  if (/email not confirmed/i.test(text)) return "Please confirm your email using the link we sent before signing in.";
  if (/password should be at least/i.test(text)) return "Choose a stronger password with at least 8 characters.";
  if (/rate limit|too many requests/i.test(text)) return "Too many attempts. Please wait a little and try again.";
  if (/fetch|network/i.test(text)) return "Connection problem. Check your internet connection and try again.";
  return text;
}

const signupForm = $("signup-form");
if (signupForm) {
  const nameInput = $("full-name");
  const emailInput = $("email");
  const passwordInput = $("password");
  const confirmInput = $("confirm-password");
  const submitButton = signupForm.querySelector("button[type=submit]");
  const passwordRules = {
    length: (value) => value.length >= 8,
    upper: (value) => /[A-Z]/.test(value),
    lower: (value) => /[a-z]/.test(value),
    number: (value) => /[0-9]/.test(value),
    special: (value) => /[^A-Za-z0-9]/.test(value)
  };

  function setFieldError(input, errorId, text) {
    const error = $(errorId);
    if (error) error.textContent = text;
    if (input) {
      input.classList.toggle("input-invalid", Boolean(text));
      input.setAttribute("aria-invalid", text ? "true" : "false");
    }
  }

  function checkPasswordRules() {
    const value = passwordInput.value;
    let valid = true;
    for (const [rule, test] of Object.entries(passwordRules)) {
      const passed = test(value);
      const item = signupForm.querySelector('[data-rule="' + rule + '"]');
      if (item) {
        item.classList.toggle("passed", passed);
        const icon = item.querySelector(".rule-icon");
        if (icon) icon.textContent = passed ? "✓" : "○";
      }
      if (!passed) valid = false;
    }
    setFieldError(passwordInput, "password-error", value && !valid ? "Your password does not meet all the requirements above." : "");
    return valid;
  }

  function checkConfirmPassword() {
    const value = confirmInput.value;
    const matches = value.length > 0 && value === passwordInput.value;
    const hint = $("confirm-hint");
    if (hint) hint.textContent = matches ? "Passwords match ✓" : "Re-enter the same password to confirm it.";
    if (hint) hint.classList.toggle("hint-passed", matches);
    setFieldError(confirmInput, "confirm-error", value && !matches ? "Passwords do not match. Please check again." : "");
    return matches;
  }

  function validateSignup() {
    const nameValid = nameInput.value.trim().length >= 2;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
    setFieldError(nameInput, "name-error", nameValid ? "" : "Please enter your full name.");
    setFieldError(emailInput, "email-error", emailValid ? "" : "Please enter a valid email address.");
    const passwordValid = checkPasswordRules();
    const confirmValid = checkConfirmPassword();
    return nameValid && emailValid && passwordValid && confirmValid;
  }

  passwordInput.addEventListener("input", () => {
    checkPasswordRules();
    if (confirmInput.value) checkConfirmPassword();
  });
  confirmInput.addEventListener("input", checkConfirmPassword);
  nameInput.addEventListener("blur", () => {
    if (nameInput.value.trim()) setFieldError(nameInput, "name-error", nameInput.value.trim().length >= 2 ? "" : "Please enter your full name.");
  });
  emailInput.addEventListener("blur", () => {
    if (emailInput.value.trim()) setFieldError(emailInput, "email-error", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim()) ? "" : "Please enter a valid email address.");
  });

  document.querySelectorAll("[data-toggle-password]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const target = $(toggle.dataset.togglePassword);
      const show = target.type === "password";
      target.type = show ? "text" : "password";
      toggle.classList.toggle("is-visible", show);
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", String(show));
    });
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateSignup()) {
      showMessage("Please correct the highlighted fields before creating your account.", "error");
      return;
    }
    const name = nameInput.value.trim().replace(/\s+/g, " ");
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    setBusy(submitButton, true, "Creating account…");
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: location.origin + "/login.html?verified=1",
          data: { full_name: name }
        }
      });
      if (error) throw error;
      if (data.session) {
        showMessage("Your DEVPAGES account is ready. Opening your dashboard…");
        location.replace("/account.html");
      } else {
        showMessage("Account request received. Check your inbox for the DEVPAGES email confirmation link. After confirming, return here to sign in.");
        signupForm.reset();
        signupForm.querySelectorAll(".password-rules li").forEach((item) => {
          item.classList.remove("passed");
          const icon = item.querySelector(".rule-icon");
          if (icon) icon.textContent = "○";
        });
        $("confirm-hint").textContent = "Re-enter the same password to confirm it.";
        $("confirm-hint").classList.remove("hint-passed");
        document.querySelectorAll(".password-toggle").forEach((toggle) => {
          toggle.classList.remove("is-visible");
          toggle.setAttribute("aria-pressed", "false");
          toggle.setAttribute("aria-label", "Show password");
        });
      }
    } catch (error) {
      showMessage(friendlyError(error), "error");
    } finally {
      setBusy(submitButton, false);
    }
  });
}
const loginForm = $("login-form");
if (loginForm) {
  if (new URLSearchParams(location.search).has("verified")) {
    showMessage("Email confirmed. You can now sign in to DEVPAGES.");
  }
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;
    setBusy(button, true, "Signing in…");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      location.replace("/account.html");
    } catch (error) {
      showMessage(friendlyError(error), "error");
    } finally {
      setBusy(button, false);
    }
  });
}

const resetForm = $("reset-form");
if (resetForm) {
  const params = new URLSearchParams(location.hash.slice(1));
  const recoveryMode = params.get("type") === "recovery";
  const emailField = $("reset-email-field");
  const passwordField = $("new-password-field");
  const submit = $("reset-submit");
  if (recoveryMode) {
    emailField.hidden = true;
    $("email").required = false;
    passwordField.hidden = false;
    $("new-password").required = true;
    $("reset-copy").textContent = "Choose a new password for your DEVPAGES account.";
    submit.textContent = "Save new password →";
  }
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(submit, true, recoveryMode ? "Saving password…" : "Sending email…");
    try {
      if (recoveryMode) {
        const { error } = await supabase.auth.updateUser({ password: $("new-password").value });
        if (error) throw error;
        showMessage("Password updated. You can now sign in with your new password.");
        resetForm.reset();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail($("email").value.trim().toLowerCase(), {
          redirectTo: `${location.origin}/reset-password.html`
        });
        if (error) throw error;
        showMessage("If an account exists for that email, a password reset link has been sent. Check your inbox.");
        resetForm.reset();
      }
    } catch (error) {
      showMessage(friendlyError(error), "error");
    } finally {
      setBusy(submit, false);
    }
  });
}

const signout = $("signout-button");
if (signout) {
  signout.addEventListener("click", async () => {
    setBusy(signout, true, "Signing out…");
    const { error } = await supabase.auth.signOut();
    if (error) {
      showMessage(friendlyError(error), "error");
      setBusy(signout, false);
      return;
    }
    location.replace("/login.html");
  });
}

if ($("account-name")) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    location.replace("/signup.html");
  } else {
    const dashboard = $("private-dashboard");
    if (dashboard) dashboard.hidden = false;
    const user = data.user;
    const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";
    $("account-name").textContent = displayName;
    $("account-email").textContent = user.email || "Email unavailable";
    $("account-status").textContent = user.email_confirmed_at ? "Email verified" : "Email confirmation pending";
    await loadBillingStatus(data.user);
  }
}

async function loadBillingStatus(user) {
  const summary = $("billing-summary");
  const list = $("domain-list");
  if (!summary || !list) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch("/api/billing/status", { headers: { Authorization: "Bearer " + token } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Billing details unavailable.");
    const money = (value) => "₦" + Number(value).toLocaleString("en-NG");
    const domainForm = $("domain-create-form");
    const connectButton = $("cloudflare-connect-button");
    const hostingReady = Boolean(payload.account?.hosting_connected);
    const setupScreen = $("hosting-setup-screen");
    const retryHosting = $("retry-hosting-check");
    const connectionStatus = $("hosting-connection-status");
    const overviewGrid = $("account-overview-grid");
    const welcome = document.querySelector(".dash-welcome");
    const header = document.querySelector(".dash-header");
    const dashNote = document.querySelector(".dash-note");
    const authMessage = $("auth-message");
    if (setupScreen) setupScreen.hidden = hostingReady;
    if (connectionStatus) connectionStatus.textContent = hostingReady ? "DEVPAGES managed hosting is connected" : "DEVPAGES is still preparing the hosting connection";
    if (retryHosting && !retryHosting.dataset.bound) {
      retryHosting.dataset.bound = "1";
      retryHosting.addEventListener("click", async () => {
        retryHosting.disabled = true;
        retryHosting.textContent = "Checking…";
        await loadBillingStatus(user);
        if (retryHosting.isConnected) {
          retryHosting.disabled = false;
          retryHosting.textContent = "Check connection again ↻";
        }
      });
    }
    if (overviewGrid) overviewGrid.hidden = !hostingReady;
    if (welcome) welcome.hidden = !hostingReady;
    if (header) header.hidden = !hostingReady;
    if (dashNote) dashNote.hidden = !hostingReady;
    if (authMessage) authMessage.hidden = !hostingReady;
    for (const sectionId of ["projects-card","domains-section","payments-section"]) {
      const section = $(sectionId);
      if (section) section.hidden = !payload.account.hosting_connected;
    }
    if (domainForm) {
      for (const control of domainForm.elements) control.disabled = !payload.account.hosting_connected;
      domainForm.style.opacity = payload.account.hosting_connected ? "1" : ".45";
    }
    const cloudflareStatus = $("cloudflare-status");
    if (cloudflareStatus) cloudflareStatus.textContent = payload.account.hosting_connected ? "DEVPAGES hosting is connected" : "Hosting setup in progress";
    const projectStatus = $("project-status");
    if (projectStatus) projectStatus.textContent = payload.account.hosting_connected ? "Hosting access enabled" : "Hosting access locked";
    summary.textContent = !payload.account.hosting_connected
      ? "DEVPAGES hosting is temporarily unavailable. Please try again later."
      : payload.account.promo_eligible && payload.promotion.active
        ? "Launch promotion active until 16 January 2027. Each eligible domain has its own countdown."
        : "Per domain: " + money(payload.pricing.setup_ngn) + " setup + " + money(payload.pricing.renewal_ngn) + " every 30 days.";
    const cloudMenu = $("member-cloud-menu");
    const cloudOptions = $("member-cloud-options");
    const cloudSummary = $("member-cloud-summary");
    let selectedCloud = cloudMenu?.dataset.selected || "all";
    const applyCloudFilter = (selected, label) => {
      selectedCloud = selected;
      if (cloudMenu) cloudMenu.dataset.selected = selected;
      list.querySelectorAll("[data-cloud-account]").forEach(card => {
        card.hidden = selected !== "all" && card.dataset.cloudAccount !== selected;
      });
      if (cloudSummary) cloudSummary.textContent = selected === "all"
        ? "Showing websites across all your DevCloud accounts."
        : "Showing websites assigned to " + label + ". They remain connected to their original hosting account.";
      if (cloudMenu) cloudMenu.open = false;
    };
    if (cloudOptions) {
      cloudOptions.replaceChildren();
      const addCloudOption = (value, label, countText = "") => {
        const option = document.createElement("button");
        option.type = "button";
        option.textContent = label + countText;
        option.style.cssText = "width:100%;text-align:left;padding:11px 12px;border:0;border-radius:8px;background:transparent;color:#edf3ff;cursor:pointer";
        option.addEventListener("click", () => applyCloudFilter(value, label));
        cloudOptions.append(option);
      };
      addCloudOption("all", "All DevClouds");
      for (const account of (payload.hosting_accounts || [])) {
        addCloudOption(account.account_id, account.label, " · " + account.websites + " website(s)");
      }
      applyCloudFilter(selectedCloud, selectedCloud === "all" ? "All DevClouds" : (payload.hosting_accounts || []).find(a => a.account_id === selectedCloud)?.label || "selected DevCloud");
    }
    list.replaceChildren();
    if (!payload.domains.length) {
      const empty = document.createElement("p"); empty.textContent = "No domains yet. Add your first domain above."; list.append(empty);
    }
    for (const domain of payload.domains) {
      const card = document.createElement("article"); card.className = "dash-card";
      card.dataset.cloudAccount = domain.cloudflare_account_id || "";
      const heading = document.createElement("h3"); heading.textContent = domain.hostname;
      const cloudName = (payload.hosting_accounts || []).find(a => a.account_id === domain.cloudflare_account_id)?.label || "Assigned DevCloud";
      const cloudLine = document.createElement("p"); cloudLine.textContent = "Hosted on: " + cloudName;
      const status = document.createElement("p"); status.textContent = "Status: " + domain.status.replaceAll("_", " ");
      const countdown = document.createElement("p");
      countdown.textContent = domain.expires_at ? (domain.is_expired ? "Subscription expired" : domain.days_remaining + " day(s) remaining") + " · Expires " + new Date(domain.expires_at).toLocaleDateString() : "Awaiting setup payment";
      card.append(heading,cloudLine,status,countdown);
      if (domain.status === "pending_payment" || domain.status === "suspended" || domain.status === "active") {
        const button = document.createElement("button"); button.className = "auth-submit";
        const purpose = domain.status === "pending_payment" ? "setup" : "renewal";
        button.textContent = purpose === "setup" ? "Pay ₦16,000 setup →" : "Renew for ₦5,500 →";
        button.addEventListener("click", async () => {
          button.disabled = true; button.textContent = "Opening secure checkout…";
          try {
            const res = await fetch("/api/paystack/initialize", { method:"POST", headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"}, body:JSON.stringify({domain_id:domain.id,purpose}) });
            const data = await res.json(); if (!res.ok || !data.authorization_url) throw new Error(data.error || "Checkout could not start.");
            location.assign(data.authorization_url);
          } catch(error) { showMessage(error.message,"error"); button.disabled=false; button.textContent=purpose==="setup"?"Pay ₦16,000 setup →":"Renew for ₦5,500 →"; }
        });
        card.append(button);
      }
      if (domain.status === "active" || domain.status === "provisioning") {
        const upload = document.createElement("input");
        upload.type = "file"; upload.accept = ".zip,application/zip"; upload.setAttribute("aria-label","Choose website ZIP");
        upload.style.cssText = "display:block;margin-top:12px;max-width:100%";
        upload.addEventListener("change", async () => {
          const archive = upload.files?.[0]; if (!archive) return;
          if (archive.size > 12 * 1024 * 1024) { showMessage("ZIP must be 12 MB or smaller.","error"); upload.value=""; return; }
          try {
            showMessage("Preparing website files…");
            const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
            const zip = await JSZip.loadAsync(archive);
            const files = [];
            let totalBytes = 0;
            for (const [path, entry] of Object.entries(zip.files)) {
              const parts = path.split("/");
              if (entry.dir || path.startsWith("__MACOSX/") || path.endsWith(".DS_Store") || parts.some(part => [".git","node_modules",".wrangler","__MACOSX"].includes(part))) continue;
              if (parts.some(part => part === ".." || part === ".")) throw new Error("ZIP contains an unsafe file path.");
              if (path === "_worker.js" || path === "_worker.bundle" || path === "functions" || path.startsWith("functions/")) throw new Error("This ZIP contains a custom Worker or Pages Functions. DEVPAGES ZIP publishing currently supports static websites only.");
              const blob = await entry.async("blob");
              if (blob.size > 8 * 1024 * 1024) throw new Error("A website file is larger than 8 MB.");
              totalBytes += blob.size;
              if (totalBytes > 13 * 1024 * 1024) throw new Error("Your website files exceed the 13 MB total upload limit.");
              const base64 = await new Promise((resolve,reject) => {
                const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result).split(",")[1]); reader.onerror=reject; reader.readAsDataURL(blob);
              });
              const ext = path.split(".").pop().toLowerCase();
              const mimeMap = {html:"text/html; charset=utf-8",htm:"text/html; charset=utf-8",css:"text/css; charset=utf-8",js:"text/javascript; charset=utf-8",mjs:"text/javascript; charset=utf-8",json:"application/json",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif",ico:"image/x-icon",txt:"text/plain; charset=utf-8",xml:"application/xml",pdf:"application/pdf",woff:"font/woff",woff2:"font/woff2"};
              files.push({path,content:base64,content_type:mimeMap[ext]||blob.type||"application/octet-stream"});
              if (files.length > 1000) throw new Error("ZIP contains more than 1,000 files.");
            }
            if (!files.some(file => file.path.toLowerCase() === "index.html")) {
              const nestedIndex = files.find(file => file.path.toLowerCase().endsWith("/index.html"));
              const prefix = nestedIndex?.path.split("/")[0];
              if (!prefix || !files.every(file => file.path.startsWith(prefix + "/"))) throw new Error("Place index.html at the root of your website ZIP, or ZIP one single website folder.");
              for (const file of files) file.path = file.path.slice(prefix.length + 1);
            }
            const homepage = files.find(file => file.path.toLowerCase() === "index.html");
            if (homepage) homepage.path = "index.html";
            if (!homepage) throw new Error("Your ZIP must contain an index.html homepage at its root.");
            const response = await fetch("/api/domains/deploy", {method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({domain_id:domain.id,files})});
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Website publishing failed.");
            showMessage("Website files uploaded. Your website is being prepared for launch.");
            await loadBillingStatus(user);
          } catch(error) { showMessage(error.message || "Could not publish website.","error"); }
          finally { upload.value=""; }
        });
        const uploadLabel=document.createElement("p"); uploadLabel.textContent="Publish or update your website (ZIP, max 12 MB):";
        card.append(uploadLabel,upload);
      }
      list.append(card);
    }
    if (cloudMenu) {
      const selectedLabel = selectedCloud === "all" ? "All DevClouds" : (payload.hosting_accounts || []).find(a => a.account_id === selectedCloud)?.label || "selected DevCloud";
      applyCloudFilter(selectedCloud, selectedLabel);
    }
    const history = $("payment-history");
    if (history) {
      history.replaceChildren();
      if (!payload.payment_history?.length) {
        const empty = document.createElement("p"); empty.textContent = "No payments recorded yet."; history.append(empty);
      } else {
        for (const payment of payload.payment_history) {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap";
          const details = document.createElement("span");
          details.textContent = money(payment.amount_kobo / 100) + " · " + payment.purpose + " · " + payment.status + " · " + new Date(payment.created_at).toLocaleDateString();
          row.append(details);
          if (payment.status === "pending") {
            const verify = document.createElement("button");
            verify.type = "button"; verify.className = "auth-submit"; verify.textContent = "Verify payment";
            verify.addEventListener("click", async () => {
              verify.disabled = true; verify.textContent = "Verifying…";
              try {
                const res = await fetch("/api/paystack/verify", {method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({reference:payment.reference})});
                const checked = await res.json();
                if (!res.ok || !checked.success) throw new Error(checked.error || "Payment is not confirmed yet.");
                showMessage("Payment confirmed. Your hosting record has been updated.");
                await loadBillingStatus(user);
              } catch(error) { showMessage(error.message || "Could not verify payment.","error"); verify.disabled=false; verify.textContent="Verify payment"; }
            });
            row.append(verify);
          }
          history.append(row);
        }
      }
    }
  } catch (error) { summary.textContent = error.message || "Could not load billing details."; }
}
const domainForm = $("domain-create-form");
if (domainForm) domainForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = domainForm.querySelector("button[type=submit]");
  const enteredName = $("new-domain-name").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const name = enteredName.endsWith(".pages.dev") ? enteredName.slice(0, -".pages.dev".length) : enteredName;
  setBusy(button,true,"Creating domain…");
  try {
    const {data:sessionData}=await supabase.auth.getSession();
    const response=await fetch("/api/domains/create",{method:"POST",headers:{Authorization:"Bearer "+sessionData.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({name})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Could not create domain.");
    if(result.promo){showMessage("Your promotional domain has been created. Website publishing is the next step.");}
    else {
      const payment=await fetch("/api/paystack/initialize",{method:"POST",headers:{Authorization:"Bearer "+sessionData.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({domain_id:result.domain.id,purpose:"setup"})});
      const checkout=await payment.json(); if(!payment.ok||!checkout.authorization_url)throw new Error(checkout.error||"Could not start setup payment.");
      location.assign(checkout.authorization_url); return;
    }
    $("new-domain-name").value="";
    await loadBillingStatus();
  }catch(error){showMessage(error.message,"error");}
  finally{setBusy(button,false);}
});

if (signupForm || loginForm) {
  const { data } = await supabase.auth.getSession();
  if (data.session) location.replace("/account.html");
}
