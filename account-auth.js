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
    location.replace("/login.html");
  } else {
    const user = data.user;
    const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";
    $("account-name").textContent = displayName;
    $("account-email").textContent = user.email || "Email unavailable";
    $("account-status").textContent = user.email_confirmed_at ? "Email verified" : "Email confirmation pending";
  }
}

if (signupForm || loginForm) {
  const { data } = await supabase.auth.getSession();
  if (data.session) location.replace("/account.html");
}
