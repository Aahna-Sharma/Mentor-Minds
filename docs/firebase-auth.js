// docs/firebase-auth.js
// Loads Firebase compat SDK from CDN (attach dynamically)

(function () {
  // Load Firebase compat SDKs if not already loaded
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function initFirebase() {
    // Load Firebase compat scripts
    await loadScript(
      "https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"
    );
    await loadScript(
      "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"
    );

    // Replace this config with your actual Firebase config
    const firebaseConfig = {
      apiKey: "AIzaSyAYjBkpsYgljPkNaDEbr8cwkzVvNMzLfDc",
      authDomain: "the-mentor-minds-46f88.firebaseapp.com",
      projectId: "the-mentor-minds-46f88",
    };

    if (!window.firebaseAppInitialized) {
      firebase.initializeApp(firebaseConfig);
      window.firebaseAppInitialized = true;
    }

    const auth = firebase.auth();

    // Persist login across reloads
    auth
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(console.warn);

    // Expose globally
    window.mentorAuth = { auth, firebase };
  }

  // Start initialization
  initFirebase().catch(console.error);
})();
