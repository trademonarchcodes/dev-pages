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
    let selectedCloud = cloudMenu?.dataset.selected || "all";
    const cloudTrigger = cloudMenu?.querySelector("summary");
    const applyCloudFilter = (selected, label) => {
      selectedCloud = selected;
      if (cloudTrigger) cloudTrigger.innerHTML = "";
      if (cloudTrigger) {
        cloudTrigger.textContent = label + "  ⌄";
      }
      if (cloudMenu) cloudMenu.dataset.selected = selected;
      list.querySelectorAll("[data-cloud-account]").forEach(card => {
        card.hidden = selected !== "all" && card.dataset.cloudAccount !== selected;
      });
      if (cloudMenu) cloudMenu.open = false;
    };
    if (cloudOptions) {
      cloudOptions.replaceChildren();
      const addCloudOption = (value, label, countText = "") => {
        const option = document.createElement("button");
        option.type = "button";
        option.textContent = label + countText;
        option.style.cssText = "width:100%;text-align:left;padding:12px 14px;border:0;border-radius:9px;background:transparent;color:#edf3ff;font:500 14px 'Space Grotesk',sans-serif;cursor:pointer;transition:background .18s";
        option.addEventListener("mouseenter",()=>option.style.background="#1b3150");
        option.addEventListener("mouseleave",()=>option.style.background="transparent");
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
      const countdown = document.createElement("button");
      countdown.type = "button";
      countdown.disabled = true;
      countdown.setAttribute("aria-live","polite");
      countdown.style.cssText = "display:block;width:100%;margin:13px 0 8px;padding:13px 12px;border:1px solid #3b506b;border-radius:12px;background:#263447;color:#fff;font:700 14px 'Space Grotesk',sans-serif;text-align:center;letter-spacing:.2px;box-shadow:inset 0 1px 0 #ffffff12;opacity:1;cursor:default";
      card.append(heading,cloudLine,status);

      const siteActions = document.createElement("div");
      siteActions.style.cssText = "display:flex;gap:9px;flex-wrap:wrap;margin:12px 0 4px";
      const copyDomain = document.createElement("button");
      copyDomain.type = "button";
      copyDomain.textContent = "▢  Copy domain";
      copyDomain.style.cssText = "flex:1;min-width:125px;padding:10px 13px;border:1px solid #365078;border-radius:10px;background:#14243b;color:#eaf2ff;font:600 13px 'Space Grotesk',sans-serif;cursor:pointer";
      copyDomain.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(domain.hostname);
          copyDomain.textContent = "✓  Copied";
          showMessage(domain.hostname + " copied to clipboard.");
          setTimeout(() => { copyDomain.textContent = "▢  Copy domain"; }, 1800);
        } catch {
          const field = document.createElement("textarea");
          field.value = domain.hostname;
          field.style.position = "fixed";
          field.style.opacity = "0";
          document.body.append(field);
          field.select();
          const copied = document.execCommand("copy");
          field.remove();
          if (copied) {
            copyDomain.textContent = "✓  Copied";
            showMessage(domain.hostname + " copied to clipboard.");
            setTimeout(() => { copyDomain.textContent = "▢  Copy domain"; }, 1800);
          } else {
            showMessage("Could not copy automatically. Domain: " + domain.hostname, "error");
          }
        }
      });
      const visitSite = document.createElement("a");
      visitSite.href = "https://" + domain.hostname;
      visitSite.target = "_blank";
      visitSite.rel = "noopener noreferrer";
      visitSite.textContent = "↗  Visit site";
      visitSite.style.cssText = "flex:1;min-width:125px;display:flex;align-items:center;justify-content:center;padding:10px 13px;border:1px solid #2878ff;border-radius:10px;background:linear-gradient(110deg,#1765df,#168fc4);color:#fff;text-decoration:none;font:600 13px 'Space Grotesk',sans-serif";
      siteActions.append(copyDomain,visitSite);
      card.append(siteActions);

      if (domain.expires_at && domain.status === "active") {
        const expiresAt = new Date(domain.expires_at).getTime();
        const cycleMs = 30 * 86400000;
        const updateCountdown = () => {
          const remaining = Math.max(0, expiresAt - Date.now());
          const elapsed = Math.min(100, Math.max(0, ((cycleMs - remaining) / cycleMs) * 100));
          countdown.style.background = "linear-gradient(90deg,#176fe8 0%,#258cff " + elapsed + "%,#263447 " + elapsed + "%,#263447 100%)";
          countdown.style.borderColor = elapsed > 0 ? "#2878ff" : "#3b506b";
          if (remaining <= 0) {
            countdown.textContent = "30-day period complete · Hosting suspension processing";
            countdown.style.background = "linear-gradient(90deg,#176fe8 100%,#263447 100%)";
          } else {
            const days = Math.floor(remaining / 86400000);
            const hours = Math.floor((remaining % 86400000) / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            countdown.textContent = days + "d " + String(hours).padStart(2,"0") + "h " + String(minutes).padStart(2,"0") + "m " + String(seconds).padStart(2,"0") + "s remaining · renews every 30 days";
          }
        };
        updateCountdown();
        const countdownTimer = setInterval(updateCountdown, 1000);
        window.addEventListener("pagehide", () => clearInterval(countdownTimer), { once:true });
        card.append(countdown);
      } else if (domain.status === "suspended") {
        countdown.textContent = "Subscription expired · Website suspended";
        countdown.textContent = "Subscription expired · Renew for ₦5,500 →";
        countdown.disabled = false;
        countdown.style.cursor = "pointer";
        countdown.style.background = "linear-gradient(90deg,#176fe8,#258cff)";
        countdown.style.borderColor = "#2878ff";
        countdown.addEventListener("click", () => card.querySelector(".auth-submit")?.click());
        card.append(countdown);
      } else if (domain.expires_at) {
        countdown.textContent = (domain.is_expired ? "Subscription expired" : domain.days_remaining + " day(s) remaining") + " · Expires " + new Date(domain.expires_at).toLocaleDateString();
        card.append(countdown);
      } else {
        countdown.textContent = "Awaiting setup payment";
        card.append(countdown);
      }
      const cardActions = document.createElement("details");
      cardActions.style.cssText = "position:absolute;top:14px;right:14px;z-index:5";
      card.style.position = "relative";
      const actionToggle = document.createElement("summary");
      actionToggle.textContent = "⋯";
      actionToggle.setAttribute("aria-label","Website options");
      actionToggle.title = "Website options";
      actionToggle.style.cssText = "list-style:none;cursor:pointer;display:grid;place-items:center;width:36px;height:36px;border:1px solid #304563;border-radius:11px;background:#111f33;color:#dceaff;font-size:23px;line-height:1";
      const actionMenu = document.createElement("div");
      actionMenu.style.cssText = "position:absolute;right:0;top:43px;min-width:190px;padding:6px;border:1px solid #304563;border-radius:13px;background:#101c2d;box-shadow:0 16px 38px #0009;display:grid;gap:4px";
      const reconnect = document.createElement("button");
      reconnect.type = "button";
      reconnect.textContent = "↻  Reconnect Hosting";
      reconnect.style.cssText = "width:100%;text-align:left;padding:11px 12px;border:0;border-radius:8px;background:transparent;color:#e8f1ff;font:500 14px 'Space Grotesk',sans-serif;cursor:pointer";
      reconnect.addEventListener("mouseenter",()=>reconnect.style.background="#1b3150");
      reconnect.addEventListener("mouseleave",()=>reconnect.style.background="transparent");
      reconnect.addEventListener("click", async () => {
        cardActions.open = false;
        reconnect.disabled = true;
        reconnect.textContent = "Reconnecting…";
        try {
          const session = await supabase.auth.getSession();
          const accessToken = session.data.session?.access_token;
          const response = await fetch("/api/hosting/reconnect", {
            method: "POST",
            headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
            body: JSON.stringify({ domain_id: domain.id })
          });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || "Hosting could not be reconnected.");
          showMessage(result.message || "Hosting connection restored.");
          await loadBillingStatus(user);
        } catch (error) {
          showMessage(error.message || "Hosting could not be reconnected. Please contact DEVPAGES support.", "error");
        } finally {
          reconnect.disabled = false;
          reconnect.textContent = "↻  Reconnect Hosting";
        }
      });
      actionMenu.append(reconnect);
      const deleteDomain = document.createElement("button");
      deleteDomain.type = "button";
      deleteDomain.textContent = "⌫  Delete Domain";
      deleteDomain.style.cssText = "width:100%;text-align:left;padding:11px 12px;border:0;border-radius:8px;background:transparent;color:#ff8b94;font:500 14px 'Space Grotesk',sans-serif;cursor:pointer";
      deleteDomain.addEventListener("mouseenter",()=>deleteDomain.style.background="#3a202b");
      deleteDomain.addEventListener("mouseleave",()=>deleteDomain.style.background="transparent");
      deleteDomain.addEventListener("click", async () => {
        cardActions.open = false;
        const confirmed = window.confirm(
          "Delete " + domain.hostname + "?\n\nThis permanently removes the website from DEVPAGES hosting and takes it offline. Other domains will not be affected. Payment history will be kept. This cannot be undone."
        );
        if (!confirmed) return;
        deleteDomain.disabled = true;
        deleteDomain.textContent = "Deleting…";
        try {
          const session = await supabase.auth.getSession();
          const accessToken = session.data.session?.access_token;
          const response = await fetch("/api/domains/delete", {
            method: "POST",
            headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
            body: JSON.stringify({ domain_id: domain.id })
          });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || "Domain could not be deleted.");
          showMessage(result.message || "Domain deleted successfully.");
          await loadBillingStatus(user);
        } catch (error) {
          showMessage(error.message || "Could not delete this domain. Please try again.", "error");
          deleteDomain.disabled = false;
          deleteDomain.textContent = "⌫  Delete Domain";
        }
      });
      actionMenu.append(deleteDomain);
      cardActions.append(actionToggle,actionMenu);
      card.append(cardActions);
      if (domain.status === "pending_payment" || domain.status === "suspended") {
        const button = document.createElement("button"); button.className = "auth-submit";
        const purpose = domain.status === "pending_payment" ? "setup" : "renewal";
        button.textContent = purpose === "setup" ? "Pay ₦16,000 setup →" : "Renew for ₦5,500 →";
        if (purpose === "renewal") button.style.display = "none";
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
const domainNameInput = $("new-domain-name");
const suggestionPanel = $("domain-suggestions");
if (domainForm && domainNameInput && suggestionPanel) {
  let lastSuggestionBase = "";
  let dismissedSuggestions = new Set();
  const normalizeSuggestionBase = (value) => value.trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.pages\.dev$/, "")
    .replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 50);
  const renderDomainSuggestions = () => {
    const base = normalizeSuggestionBase(domainNameInput.value);
    if (base !== lastSuggestionBase) {
      lastSuggestionBase = base;
      dismissedSuggestions = new Set();
    }
    suggestionPanel.replaceChildren();
    if (!base || !/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(base)) {
      suggestionPanel.hidden = true;
      return;
    }
    const ideas = [base + "-web", base + "-digital", base + "-studio", base + "-online", "get-" + base]
      .filter((name, index, all) => name !== base && all.indexOf(name) === index && name.length <= 50 && /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(name) && !dismissedSuggestions.has(name));
    if (!ideas.length) {
      suggestionPanel.hidden = true;
      return;
    }
    suggestionPanel.hidden = false;
    const heading = document.createElement("p");
    heading.textContent = "More name ideas · pages.dev";
    heading.style.cssText = "margin:12px 0 8px;color:#9eb5d3;font-size:12px;font-weight:600;letter-spacing:.04em";
    suggestionPanel.append(heading);
    for (const idea of ideas) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0;padding:8px 10px;border:1px solid #263b58;border-radius:10px;background:#0d1829";
      const choose = document.createElement("button");
      choose.type = "button";
      choose.textContent = idea + ".pages.dev";
      choose.style.cssText = "flex:1;min-width:0;text-align:left;border:0;background:transparent;color:#e8f2ff;font:500 13px 'Space Grotesk',sans-serif;cursor:pointer;overflow-wrap:anywhere";
      choose.addEventListener("click", () => {
        domainNameInput.value = idea + ".pages.dev";
        domainNameInput.focus();
        renderDomainSuggestions();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Remove this suggestion";
      remove.setAttribute("aria-label", "Remove " + idea + ".pages.dev from suggestions");
      remove.style.cssText = "flex:0 0 30px;width:30px;height:30px;border:1px solid #354b68;border-radius:8px;background:#14243a;color:#a9bdd7;font-size:20px;line-height:1;cursor:pointer";
      remove.addEventListener("click", () => {
        dismissedSuggestions.add(idea);
        renderDomainSuggestions();
      });
      row.append(choose, remove);
      suggestionPanel.append(row);
    }
  };
  domainNameInput.addEventListener("input", renderDomainSuggestions);
  renderDomainSuggestions();
}
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
    if(result.name_changed || (result.domain?.hostname && result.domain.hostname !== name + ".pages.dev")) {
      const accepted=window.confirm(
        "Your requested address " + (result.requested_hostname || name + ".pages.dev") +
        " is not available exactly as entered.\\n\\nDEVPAGES can offer this address instead:\\n" +
        result.domain.hostname +
        "\\n\\nNo payment has been taken. Continue with this address?"
      );
      if(!accepted) {
        const removal=await fetch("/api/domains/delete",{method:"POST",headers:{Authorization:"Bearer "+sessionData.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({domain_id:result.domain.id})});
        const removed=await removal.json();
        if(!removal.ok) throw new Error("No payment was taken, but DEVPAGES could not cancel the alternate address. You can remove it from your dashboard. " + (removed.error||""));
        showMessage("No payment was taken. The alternate address was cancelled. You can choose another name.");
        const {data:currentUser}=await supabase.auth.getUser();
        await loadBillingStatus(currentUser.user);
        return;
      }
      showMessage("Address confirmed: " + result.domain.hostname + ". Continue with setup.");
    }
    if(result.promo){showMessage("Your promotional domain " + result.domain.hostname + " has been created. Website publishing is the next step.");}
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
