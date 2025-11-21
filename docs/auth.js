/* docs/auth.js
   Email/password auth + session (access token in memory, refresh cookie via httpOnly cookie)
   IMPORTANT: set BACKEND_URL below to your backend HTTPS URL (ngrok or hosted)
*/
const BACKEND_URL = "https://page-supermolten-tobias.ngrok-free.dev"; // <-- replace with your ngrok HTTPS URL

let accessToken = null;
function setAccessToken(t) {
  accessToken = t;
}

async function authFetch(path, opts = {}) {
  opts.headers = opts.headers || {};
  if (accessToken) opts.headers["Authorization"] = `Bearer ${accessToken}`;
  opts.credentials = "include";
  let res = await fetch(BACKEND_URL + path, opts);
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (!ok) return res;
    opts.headers["Authorization"] = `Bearer ${accessToken}`;
    res = await fetch(BACKEND_URL + path, opts);
  }
  return res;
}

async function tryRefresh() {
  try {
    const r = await fetch(BACKEND_URL + "/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!r.ok) return false;
    const data = await r.json();
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      await fetchProfile();
      return true;
    }
    return false;
  } catch (e) {
    console.error("refresh error", e);
    return false;
  }
}

async function registerUser(name, email, password) {
  const res = await fetch(BACKEND_URL + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  setAccessToken(data.accessToken);
  localStorage.setItem("mm_user", JSON.stringify(data.user));
  renderUserUI();
  return data.user;
}

async function loginUser(email, password) {
  const res = await fetch(BACKEND_URL + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  setAccessToken(data.accessToken);
  localStorage.setItem("mm_user", JSON.stringify(data.user));
  renderUserUI();
  return data.user;
}

async function logoutUser() {
  await fetch(BACKEND_URL + "/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  setAccessToken(null);
  localStorage.removeItem("mm_user");
  renderUserUI();
}

async function fetchProfile() {
  const r = await authFetch("/api/auth/me", { method: "GET" });
  if (!r.ok) return null;
  const data = await r.json();
  localStorage.setItem("mm_user", JSON.stringify(data.user));
  renderUserUI();
  return data.user;
}

function renderUserUI() {
  const el = document.getElementById("userName");
  const u = JSON.parse(localStorage.getItem("mm_user") || "null");
  if (el) el.textContent = u ? `Welcome, ${u.name || u.email}` : "";
}

// Attach to forms if they exist
function attachFormHandlers() {
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name =
        signupForm.querySelector('input[name="name"], #su_name')?.value || "";
      const email =
        signupForm.querySelector('input[name="email"], #su_email')?.value || "";
      const password =
        signupForm.querySelector('input[name="password"], #su_password')
          ?.value || "";
      try {
        await registerUser(name, email, password);
        alert("Registered successfully");
      } catch (err) {
        alert("Signup error: " + (err.error || JSON.stringify(err)));
      }
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email =
        loginForm.querySelector('input[name="email"], #in_email')?.value || "";
      const password =
        loginForm.querySelector('input[name="password"], #in_password')
          ?.value || "";
      try {
        await loginUser(email, password);
        alert("Login successful");
      } catch (err) {
        alert("Login error: " + (err.error || JSON.stringify(err)));
      }
    });
  }

  const logoutBtn = document.getElementById("btnLogout");
  if (logoutBtn)
    logoutBtn.addEventListener("click", async () => {
      await logoutUser();
      alert("Logged out");
    });
}

document.addEventListener("DOMContentLoaded", async () => {
  attachFormHandlers();
  await tryRefresh();
  renderUserUI();
});
