// firebase-auth.js — robust initializer (paste into /firebase-auth.js)
(function () {
  // === EDIT THIS: put your real firebase config here ===
  const firebaseConfig = {
    apiKey: "AIzaSyAYjBkpsYgljPkNaDEbr8cwkzVvNMzLfDc",
    authDomain: "the-mentor-minds-46f88.firebaseapp.com",
    projectId: "the-mentor-minds-46f88",
    storageBucket: "the-mentor-minds-46f88.firebasestorage.app",
    messagingSenderId: "19125411333",
    appId: "1:19125411333:web:a3e274b5830d6cad07466c",
    measurementId: "G-QKNJFEY8X4",
    // ... add other keys from your Firebase console
  };
  // =====================================================

  function safeLog(...args) {
    try {
      console.log.apply(console, args);
    } catch (e) {}
  }

  // Wait until firebase SDK is loaded (timeout if not)
  function waitForFirebaseSDK(timeout = 3000) {
    return new Promise((resolve) => {
      if (window.firebase && firebase.initializeApp) return resolve(true);
      const start = Date.now();
      const iv = setInterval(() => {
        if (window.firebase && firebase.initializeApp) {
          clearInterval(iv);
          resolve(true);
          return;
        }
        if (Date.now() - start > timeout) {
          clearInterval(iv);
          resolve(false);
        }
      }, 100);
    });
  }

  (async function initFirebase() {
    const ok = await waitForFirebaseSDK(4000);
    if (!ok) {
      safeLog(
        "[firebase-auth] Firebase SDK not found within timeout. Ensure the SDK <script> tags are included BEFORE firebase-auth.js"
      );
      return;
    }

    try {
      // Avoid double-init
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
        safeLog("[firebase-auth] firebase.initializeApp called");
      } else {
        safeLog(
          "[firebase-auth] firebase app already initialized (skipping initializeApp)"
        );
      }

      // Expose mentorAuth on window for other scripts that wait for it
      window.mentorAuth = window.mentorAuth || {};
      window.mentorAuth.firebase = firebase;
      try {
        window.mentorAuth.auth = firebase.auth();
      } catch (e) {
        safeLog("[firebase-auth] firebase.auth() failed:", e && e.message);
        // don't throw — other code should handle missing auth gracefully
      }

      // Set persistence so redirect flows persist across reloads
      try {
        if (
          window.mentorAuth &&
          window.mentorAuth.auth &&
          firebase.auth.Auth &&
          firebase.auth.Auth.Persistence
        ) {
          await window.mentorAuth.auth.setPersistence(
            firebase.auth.Auth.Persistence.LOCAL
          );
          safeLog("[firebase-auth] auth persistence set to LOCAL");
        }
      } catch (e) {
        safeLog("[firebase-auth] could not set persistence:", e && e.message);
      }

      safeLog(
        "[firebase-auth] initialized — apps.length=",
        (firebase.apps && firebase.apps.length) || 0
      );
    } catch (err) {
      safeLog("[firebase-auth] init error", err && err.message);
    }
  })();
})();
