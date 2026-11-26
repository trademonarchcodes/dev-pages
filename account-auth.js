/* DEVPAGES authentication — native Fetch implementation.
   No remote ES-module/CDN dependency is required for sign-up or login. */
(function () {
  "use strict";

  const SUPABASE_URL = "https://xkkczzhjffocfywjlukr.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rOIFM2e5DRVSIN-dhFfqkQ_YOIqlGZN";
  const PRODUCTION_URL = "https://devpagesdomain.pages.dev";

  const $ = (selector, root) => (root || document).querySelector(selector);
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
  let recoveryToken = "";

  function messageText(value, kind) {
    if (!message) return;
    message.textContent = value;
    message.classList.toggle("error", kind === "error");
    message.classList.toggle("success", kind === "success");
  }

  function setBusy(value, label) {
    busy = value;
    if (!button) return;
    if (value) {
      if (!button.dataset.label) button.dataset.label = button.textContent;
      button.disabled = true;
      button.textContent = label;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.label || button.textContent;
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

  function renderRules() {
    const result = passwordRules(passwordInput ? passwordInput.value : "");
    Object.keys(result).forEach(function (key) {
      const node = $('[data-rule="' + key + '"]');
      if (!node) return;
      node.classList.toggle("passed", result[key]);
      const mark = $("span", node);
      if (mark) mark.textContent = result[key] ? "✓" : "○";
    });
    if (confirmInput && passwordInput && confirmInput.value) {
      const matches = confirmInput.value === passwordInput.value;
      confirmInput.classList.toggle("input-invalid", !matches);
      const error = $("#confirm-error");
      if (error) error.textContent = matches ? "" : "Passwords do not match.";
    }
  }

  function clearErrors() {
    ["name-error", "email-error", "password-error", "confirm-error"].forEach(function (id) {
      const node = document.getElementById(id);
      if (node) node.textContent = "";
    });
    [nameInput, emailInput, passwordInput, confirmInput].filter(Boolean).forEach(function (node) {
      node.classList.remove("input-invalid");
    });
  }

  function validateSignup() {
    clearErrors();
    const values = {
      name: nameInput ? nameInput.value.trim() : "",
      email: emailInput ? emailInput.value.trim().toLowerCase() : "",
      password: passwordInput ? passwordInput.value : "",
      confirm: confirmInput ? confirmInput.value : ""
    };
    let valid = true;
    function fail(id, input, text) {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
      if (input) input.classList.add("input-invalid");
      valid = false;
    }
    if (values.name.length < 2) fail("name-error", nameInput, "Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) fail("email-error", emailInput, "Enter a valid email address.");
    if (Object.values(passwordRules(values.password)).some(function (ok) { return !ok; })) {
      fail("password-error", passwordInput, "Your password must meet all five requirements.");
    }
    if (!values.confirm || values.confirm !== values.password) fail("confirm-error", confirmInput, "Your passwords do not match.");
    return valid ? values : null;
  }

  function authErrorMessage(error) {
    const raw = String((error && (error.message || error.msg || error.error_description || error.error)) || "");
    if (/email address not authorized|not authorized/i.test(raw)) {
      return "Supabase has blocked email delivery. Its default email service only sends to approved project-team addresses. Public sign-up needs custom SMTP configured.";
    }
    if (/already registered|already exists|user already/i.test(raw)) return "An account may already exist with this email. Try signing in.";
    if (/invalid login credentials/i.test(raw)) return "Email or password is incorrect.";
    if (/email not confirmed/i.test(raw)) return "Please verify your email using the link sent to your inbox.";
    if (/password should be|weak password|at least/i.test(raw)) return "Choose a stronger password that meets all five requirements.";
    if (/rate limit|too many requests/i.test(raw)) return "Too many attempts. Please wait a little and try again.";
    if (/captcha|recaptcha/i.test(raw)) return "A security check blocked this request. Please contact DEVPAGES support.";
    if (/failed to fetch|networkerror|load failed/i.test(raw)) return "Connection problem. The authentication service could not be reached. Check your internet and try again.";
    return raw || "Something went wrong. Please try again.";
  }

  async function supabaseRequest(endpoint, method, body, accessToken) {
    const headers = {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    const response = await fetch(SUPABASE_URL + endpoint, {
      method: method || "POST",
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store"
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      const error = new Error(data.msg || data.message || data.error_description || data.error || "Authentication request failed (" + response.status + ").");
      error.status = response.status;
      error.code = data.code || data.error_code || "";
      throw error;
    }
    return data;
  }

  async function createServerSession(accessToken) {
    const response = await fetch("/api/auth/supabase-session", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ accessToken: accessToken })
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Your account was verified, but DEVPAGES could not open your secure session.");
    }
    return data;
  }

  async function signup() {
    if (busy) return;
    const values = validateSignup();
    if (!values) {
      messageText("Please correct the highlighted fields.", "error");
      return;
    }
    setBusy(true, "Creating...");
    messageText("Creating your DEVPAGES account…");
    try {
      const result = await supabaseRequest("/auth/v1/signup", "POST", {
        email: values.email,
        password: values.password,
        data: { full_name: values.name }
      });
      if (!result.access_token || !result.user) {
        throw new Error("Your account was created, but email confirmation is still enabled in the authentication settings. Turn off Confirm email in Supabase, then try again.");
      }
      messageText("Account created. Taking you to login…", "success");
      form.reset();
      renderRules();
      location.assign("/login.html?created=1");
    } catch (error) {
      console.error("DEVPAGES sign-up:", error);
      messageText(authErrorMessage(error), "error");
      setBusy(false, "Create my account ↗");
    }
  }

  async function login() {
    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const password = passwordInput ? passwordInput.value : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      messageText("Enter a valid email address.", "error");
      if (emailInput) emailInput.focus();
      return;
    }
    if (!password) {
      messageText("Enter your password.", "error");
      if (passwordInput) passwordInput.focus();
      return;
    }
    setBusy(true, "Signing in…");
    messageText("Verifying your account…");
    try {
      const session = await supabaseRequest("/auth/v1/token?grant_type=password", "POST", {
        email: email,
        password: password
      });
      if (!session.access_token) throw new Error("The authentication service did not return a valid session.");
      await createServerSession(session.access_token);
      messageText("Signed in. Opening your workspace…", "success");
      location.assign("/account.html");
    } catch (error) {
      console.error("DEVPAGES sign-in:", error);
      messageText(authErrorMessage(error), "error");
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      messageText("Enter your email address first.", "error");
      if (emailInput) emailInput.focus();
      return;
    }
    const resetButton = $("#reset-password");
    if (busy) return;
    busy = true;
    if (resetButton) resetButton.disabled = true;
    try {
      const redirect = encodeURIComponent(PRODUCTION_URL + "/reset-password.html");
      await supabaseRequest("/auth/v1/recover?redirect_to=" + redirect, "POST", { email: email });
      messageText("If an account exists for that email, a password reset link has been requested. Check your inbox and spam folder.", "success");
    } catch (error) {
      messageText(authErrorMessage(error), "error");
    } finally {
      busy = false;
      if (resetButton) resetButton.disabled = false;
    }
  }

  async function saveNewPassword() {
    const password = passwordInput ? passwordInput.value : "";
    const confirm = confirmInput ? confirmInput.value : "";
    if (Object.values(passwordRules(password)).some(function (ok) { return !ok; })) {
      messageText("Your new password must meet all five requirements.", "error");
      return;
    }
    if (password !== confirm) {
      messageText("Your passwords do not match.", "error");
      return;
    }
    if (!recoveryToken) {
      const params = new URLSearchParams(location.hash.replace(/^#/, ""));
      recoveryToken = params.get("access_token") || "";
    }
    if (!recoveryToken) {
      messageText("This password-reset link is missing or has expired. Return to login and request a new one.", "error");
      return;
    }
    setBusy(true, "Updating password…");
    try {
      await supabaseRequest("/auth/v1/user", "PUT", { password: password }, recoveryToken);
      try {
        await supabaseRequest("/auth/v1/logout", "POST", {}, recoveryToken);
      } catch (_) {}
      messageText("Password updated. You can now sign in with your new password.", "success");
      form.reset();
      history.replaceState(null, "", location.pathname);
      setTimeout(function () { location.assign("/login.html?password=updated"); }, 1200);
    } catch (error) {
      console.error("DEVPAGES password reset:", error);
      messageText(authErrorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAuthRedirect() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const token = hash.get("access_token");
    const type = hash.get("type") || "";
    const error = hash.get("error_description") || hash.get("error");
    if (error) {
      messageText(decodeURIComponent(error.replace(/\+/g, " ")), "error");
      return;
    }
    if (page === "reset") {
      if (token && type === "recovery") {
        recoveryToken = token;
        messageText("Your reset link is valid. Choose your new password below.", "success");
      } else if (!token) {
        messageText("Open the password-reset link from your email on this page. If it has expired, request another link.", "info");
      }
      return;
    }
    if (token && (type === "signup" || type === "magiclink" || type === "")) {
      try {
        messageText("Email verified. Preparing your DEVPAGES workspace…", "success");
        await createServerSession(token);
        history.replaceState(null, "", location.pathname);
        location.replace("/account.html");
        return;
      } catch (sessionError) {
        console.error("DEVPAGES email verification:", sessionError);
        messageText(sessionError.message || "Email verified, but your DEVPAGES session could not be created. Please sign in.", "error");
        return;
      }
    }
    const params = new URLSearchParams(location.search);
    if (params.get("created") === "1") {
      messageText("Your account has been created. Log in with your email and password to continue.", "success");
    } else if (params.get("password") === "updated") {
      messageText("Your password has been updated. Sign in with your new password.", "success");
    }
  }

  function bindPasswordButtons() {
    document.querySelectorAll("[data-toggle-password]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const input = document.getElementById(btn.dataset.togglePassword);
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.setAttribute("aria-pressed", String(show));
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    });
  }

  function escapeText(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  async function loadDashboard() {
    const alertBox = $(".workspace-alert");
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Account session check failed.");
      if (!data.authenticated || !data.user) {
        if (alertBox) {
          alertBox.hidden = false;
          alertBox.textContent = "You are not signed in. Please sign in to view your private workspace.";
          const link = document.createElement("a");
          link.href = "/login.html";
          link.className = "text-link";
          link.textContent = " Go to login →";
          alertBox.append(link);
        }
        return;
      }
      const panel = $("#signed-in-panel");
      if (panel) {
        panel.hidden = false;
        const email = $("[data-user-email]", panel);
        const role = $("[data-user-role]", panel);
        if (email) email.textContent = data.user.email || "";
        if (role) role.textContent = data.user.role === "admin" ? "Administrator account" : "Customer account";
      }
      if (alertBox) alertBox.hidden = true;
      const heading = $(".workspace-heading .preview-pill");
      if (heading) {
        heading.textContent = "ACCOUNT ACTIVE";
        heading.classList.add("active-pill");
      }
      const dashboardResponse = await fetch("/api/dashboard", { credentials: "same-origin", cache: "no-store" });
      const result = await dashboardResponse.json().catch(function () { return {}; });
      if (!dashboardResponse.ok) throw new Error(result.message || "Your account is signed in, but dashboard information could not be loaded.");
      const cards = document.querySelectorAll(".metric-card strong");
      if (cards[0]) cards[0].textContent = (result.sites || []).length;
      if (cards[1]) cards[1].textContent = (result.domains || []).filter(function (item) {
        return ["paid", "registered"].includes(item.status);
      }).length;
      if (cards[2]) cards[2].textContent = (result.domains || []).length + (result.payments || []).length;

      const hosting = $("#hosting-connections-list");
      if (hosting) {
        const connections = result.hostingConnections || [];
        hosting.replaceChildren();
        if (connections.length) {
          connections.forEach(function (connection) {
            const row = document.createElement("div");
            row.className = "connection-row";
            const title = document.createElement("strong");
            title.textContent = "Cloudflare account";
            const value = document.createElement("span");
            value.textContent = connection.provider_account_id || connection.accountId || "";
            row.append(title, value);
            hosting.append(row);
          });
        } else {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "No Cloudflare account connected yet.";
          hosting.append(empty);
        }
      }

      const activity = $("#activity-list");
      if (activity && Array.isArray(result.activity) && result.activity.length) {
        activity.replaceChildren();
        result.activity.forEach(function (item) {
          const row = document.createElement("p");
          row.textContent = String(item.event_type || "Account update").replace(/[._]/g, " ") + " · " + (item.created_at || "");
          activity.append(row);
        });
      }
      const websites = $("#websites-list");
      if (websites && result.sites && result.sites.length) {
        websites.replaceChildren();
        result.sites.forEach(function (site) {
          const row = document.createElement("p");
          row.textContent = (site.project_name || "Website") + " · " + (site.status || "pending");
          websites.append(row);
        });
      }
      const domains = $("#domains-list");
      if (domains && result.domains && result.domains.length) {
        domains.replaceChildren();
        result.domains.forEach(function (domain) {
          const row = document.createElement("p");
          row.textContent = (domain.domain_name || "pages.dev") + " · " + (domain.status || "pending");
          domains.append(row);
        });
      }
    } catch (error) {
      console.error("DEVPAGES dashboard:", error);
      if (alertBox) {
        alertBox.hidden = false;
        alertBox.textContent = error.message || "Dashboard information could not be loaded. Please refresh.";
      }
    }
  }

  function start() {
    bindPasswordButtons();
    if (passwordInput) passwordInput.addEventListener("input", renderRules);
    if (confirmInput) confirmInput.addEventListener("input", renderRules);
    // The form submit event is the single signup/login entry point.
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (busy) return;
        if (page === "signup") void signup();
        else if (page === "login") void login();
        else if (page === "reset") void saveNewPassword();
      });
    }
    const resetButton = $("#reset-password");
    if (resetButton) resetButton.addEventListener("click", function () { void sendPasswordReset(); });
    const signOut = $("#sign-out");
    if (signOut) {
      signOut.addEventListener("click", async function () {
        signOut.disabled = true;
        try {
          await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
        } catch (error) {
          console.warn("DEVPAGES sign-out:", error);
        }
        location.assign("/login.html");
      });
    }
    if (page === "signup" || page === "reset") renderRules();
    if (page === "login" || page === "reset") void handleAuthRedirect();
    if (page === "dashboard") void loadDashboard();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();