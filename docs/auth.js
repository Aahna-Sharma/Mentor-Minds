// docs/auth.js
(function () {
  // Wait until mentorAuth is ready
  function waitFor(fn, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (fn()) return resolve();
        if (Date.now() - start > timeout)
          return reject(new Error("mentorAuth timeout"));
        setTimeout(check, 100);
      })();
    });
  }

  async function init() {
    await waitFor(() => window.mentorAuth && window.mentorAuth.auth);

    const auth = window.mentorAuth.auth;
    const firebase = window.mentorAuth.firebase;

    const status = (msg) => {
      const el = document.getElementById("status");
      if (el) el.textContent = msg;
      console.log("[STATUS]", msg);
    };

    // --- Auth Functions ---
    async function googleLogin() {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        status("Signing in with Google...");
        const result = await auth.signInWithPopup(provider);
        status(`Signed in as ${result.user.email}`);
          window.location.href = "index.html";
      } catch (e) {
        console.error(e);
        status("Google sign-in failed: " + e.message);
      }
    }

    async function githubLogin() {
      const provider = new firebase.auth.GithubAuthProvider();
      provider.addScope("user:email");
      try {
        status("Signing in with GitHub...");
        const result = await auth.signInWithPopup(provider);
        status(`Signed in as ${result.user.email}`);
          window.location.href = "index.html";
      } catch (e) {
        console.error(e);
        status("GitHub sign-in failed: " + e.message);
      }
    }

    async function emailLogin() {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      try {
        status("Signing in with email...");
        await auth.signInWithEmailAndPassword(email, password);
        status("Signed in with email");
          window.location.href = "index.html";
      } catch (e) {
        console.error(e);
        status("Email login failed: " + e.message);
      }
    }

    async function emailSignup() {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      try {
        status("Creating account...");
        const result = await auth.createUserWithEmailAndPassword(
          email,
          password
        );
        status("Account created: " + result.user.email);
      } catch (e) {
        console.error(e);
        status("Signup failed: " + e.message);
      }
    }

    // Attach buttons
    document.getElementById("googleBtn").onclick = googleLogin;
    document.getElementById("githubBtn").onclick = githubLogin;
    document.getElementById("loginBtn").onclick = emailLogin;
    document.getElementById("signupBtn").onclick = emailSignup;

    // Auth state updates
    auth.onAuthStateChanged((user) => {
      if (user) status("Signed in: " + (user.email || user.displayName));
      else status("Not signed in");
    });

    status("Auth ready — you can sign in now");
  }

  init();
})();
