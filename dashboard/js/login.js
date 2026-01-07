document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");
  const statusBox = document.getElementById("loginStatus");

  if (!form) return;
  const submitBtn = form.querySelector("button[type=\"submit\"]");

  if (errorBox) errorBox.style.display = "none";
  if (statusBox) statusBox.style.display = "none";

  const inputs = Array.from(form.querySelectorAll("input, select, textarea"));

  const passwordInput = document.getElementById("password");
  const passwordToggle = document.querySelector(".password-toggle");
  if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      passwordToggle.setAttribute("aria-pressed", isHidden ? "true" : "false");
      passwordToggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      const icon = passwordToggle.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-eye", !isHidden);
        icon.classList.toggle("fa-eye-slash", isHidden);
      }
    });
  }

  const setStatus = (message, type = "info") => {
    if (!statusBox) return;
    statusBox.classList.remove("alert-info", "alert-success", "alert-error");
    statusBox.classList.add(`alert-${type}`);
    statusBox.textContent = message || "";
    statusBox.style.display = message ? "block" : "none";
  };

  const getCore = () => window.BXCore;

  const setLoading = (isLoading, message) => {
    const core = getCore();
    if (!core) {
      setStatus("Login system not ready. Please refresh the page.", "error");
      return;
    }
    if (submitBtn) core.setButtonLoading(submitBtn, isLoading, message || "Signing in...");
    inputs.forEach((input) => {
      input.disabled = isLoading;
    });
    form.setAttribute("aria-busy", isLoading ? "true" : "false");
    if (isLoading) {
      core.showPageLoader(message || "Signing you in...");
    } else {
      core.hidePageLoader();
    }
    if (message) setStatus(message, "info");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorBox) errorBox.style.display = "none";
    setStatus("", "info");

    const core = getCore();
    if (!core) {
      setStatus("Login system not ready. Please refresh the page.", "error");
      return;
    }

    const fd = new FormData(form);
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "");
    setLoading(true, "Signing in...");

    try {
      const resp = await core.apiPost({
        action: "login",
        username,
        password,
      });

      if (!resp || resp.ok === false) {
        const message = resp?.error || "Invalid credentials";
        if (errorBox) {
          errorBox.textContent = message;
          errorBox.style.display = "block";
        }
        setLoading(false);
        setStatus("", "info");
        return;
      }

      if (resp.user) {
        core.saveSession({
          username: resp.user.username || username,
          role: resp.user.role || "client",
          client_id: resp.user.client_id || null,
          clientId: resp.user.client_id || null,
        });

        const stored = core.getLocalSession();
        if (stored?.username) {
          const supabase = core.getSupabaseClient();
          const verify = await supabase
            .from("accounts")
            .select("*")
            .eq("username", stored.username)
            .maybeSingle();
          console.log("LOGIN VERIFY", { data: verify.data, error: verify.error });
        }

        if (resp.user.role === "admin") {
          setStatus("Signed in. Redirecting to your dashboard...", "success");
          core.showPageLoader("Redirecting...");
          setTimeout(() => {
            window.location.href = "dashboard-overview.html";
          }, 350);
          return;
        }

        setStatus("Signed in. Redirecting to your dashboard...", "success");
        core.showPageLoader("Redirecting...");
        setTimeout(() => {
          window.location.href = "client-dashboard-overview.html";
        }, 350);
        return;
      }

      if (errorBox) {
        errorBox.textContent = "Invalid credentials";
        errorBox.style.display = "block";
      }
      setLoading(false);
      setStatus("", "info");
    } catch (err) {
      console.error(err);
      if (errorBox) {
        errorBox.textContent = "Login failed. Please try again.";
        errorBox.style.display = "block";
      }
      setLoading(false);
      setStatus("", "info");
    }
  });
});
