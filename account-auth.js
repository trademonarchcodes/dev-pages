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
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = signupForm.querySelector("button[type=submit]");
    const name = $("full-name").value.trim();
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;
    setBusy(button, true, "Creating account…");
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${location.origin}/login.html?verified=1`,
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
      }
    } catch (error) {
      showMessage(friendlyError(error), "error");
    } finally {
      setBusy(button, false);
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
