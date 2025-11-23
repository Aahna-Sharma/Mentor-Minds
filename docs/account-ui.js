// account-ui.js (fixed)
// Waits for DOM ready, robust element lookup, debug logging, works if script placed in head or before body.

(function () {
  const DEBUG = true; // set to false to reduce console noise

  function log(...args) {
    if (DEBUG) console.log("[account-ui]", ...args);
  }
  function warn(...args) {
    if (DEBUG) console.warn("[account-ui]", ...args);
  }

  function initOnce() {
    // Ensure firebase is available
    if (typeof firebase === "undefined") {
      warn(
        "Firebase SDK not found. Make sure firebase-app-compat.js and firebase-auth-compat.js are loaded BEFORE this script."
      );
      // we do not return here because you might initialize Firebase later; still try to bind UI
    }

    // DOM refs (try direct IDs first; fallback to selectors)
    const getEl = (id, selectorFallback) =>
      document.getElementById(id) ||
      (selectorFallback ? document.querySelector(selectorFallback) : null);

    const accountBtn = getEl("accountBtn", "[data-account-btn]");
    const dropdown = getEl("dropdown", "[data-account-dropdown]");
    const avatarImg =
      getEl("avatarImg", "[data-account-avatar]") ||
      (getEl("accountBtn") ? getEl("accountBtn").querySelector("img") : null);
    const displayName = getEl("displayName", "[data-account-name]");
    const emailSmall = getEl("emailSmall", "[data-account-email-small]");
    const ddName = getEl("ddName", "[data-account-dd-name]");
    const ddEmail = getEl("ddEmail", "[data-account-dd-email]");
    const signOutBtn = getEl("signOut", "[data-signout]");

    // If crucial elements missing, warn but do not bail forever; try again shortly (useful during SPA loads)
    if (!accountBtn || !dropdown) {
      warn(
        "Core account UI elements not found yet. accountBtn/dropdown missing. Will retry once after 300ms."
      );
      // Retry once after short delay in case of late DOM insertion (SPAs)
      setTimeout(() => {
        const retryAccountBtn = document.getElementById("accountBtn");
        const retryDropdown = document.getElementById("dropdown");
        if (retryAccountBtn && retryDropdown) {
          log("Retry succeeded — initializing handlers.");
          // avoid duplicate initialization by calling initHandlers with found elements
          initHandlers({
            accountBtn: retryAccountBtn,
            dropdown: retryDropdown,
            avatarImg: document.getElementById("avatarImg"),
            displayName: document.getElementById("displayName"),
            emailSmall: document.getElementById("emailSmall"),
            ddName: document.getElementById("ddName"),
            ddEmail: document.getElementById("ddEmail"),
            signOutBtn: document.getElementById("signOut"),
          });
        } else {
          warn(
            "Retry failed — account UI still not present. Check HTML element IDs."
          );
        }
      }, 300);
      return;
    }

    // If we have the elements on first try, init now:
    initHandlers({
      accountBtn,
      dropdown,
      avatarImg,
      displayName,
      emailSmall,
      ddName,
      ddEmail,
      signOutBtn,
    });
  }

  function initHandlers(els) {
    const {
      accountBtn,
      dropdown,
      avatarImg,
      displayName,
      emailSmall,
      ddName,
      ddEmail,
      signOutBtn,
    } = els;

    // Safety checks:
    if (!accountBtn || !dropdown) {
      console.error("[account-ui] fatal: missing required elements.");
      return;
    }

    // Toggle helper
    function setDropdown(open) {
      if (open) {
        dropdown.classList.add("show");
        accountBtn.setAttribute("aria-expanded", "true");
        dropdown.setAttribute("aria-hidden", "false");
      } else {
        dropdown.classList.remove("show");
        accountBtn.setAttribute("aria-expanded", "false");
        dropdown.setAttribute("aria-hidden", "true");
      }
    }

    // Use pointerdown for quicker response and better mobile compatibility, but also support click
    const toggleHandler = (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle("show");
      accountBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      dropdown.setAttribute("aria-hidden", isOpen ? "false" : "true");
    };

    // Remove duplicate handlers if any (idempotent)
    accountBtn.replaceWith(accountBtn.cloneNode(true));
    const newAccountBtn =
      document.getElementById("accountBtn") ||
      document.querySelector("[data-account-btn]") ||
      accountBtn;

    // attach both pointerdown and click to be resilient
    newAccountBtn.addEventListener("pointerdown", toggleHandler);
    newAccountBtn.addEventListener("click", (e) => {
      // pointerdown may fire first on many browsers; ensure click toggles only if pointerdown didn't
      if (!e.defaultPrevented) {
        toggleHandler(e);
      }
    });

    // Close dropdown if clicking anywhere else
    document.addEventListener("pointerdown", (e) => {
      if (!newAccountBtn.contains(e.target) && !dropdown.contains(e.target)) {
        setDropdown(false);
      }
    });

    // Close on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setDropdown(false);
    });

    // Optional: Improve hit area for small avatars by ensuring accountBtn has padding (can be done via CSS)
    if (newAccountBtn && getComputedStyle(newAccountBtn).cursor !== "pointer") {
      newAccountBtn.style.cursor = "pointer";
    }

    // Attach sign-out handler if available
    if (signOutBtn) {
      signOutBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        try {
          if (typeof firebase !== "undefined" && firebase.auth) {
            await firebase.auth().signOut();
            // onAuthStateChanged or manual redirect should handle the rest
            log("Signed out.");
          } else {
            log("firebase.auth() not available at sign-out time.");
          }
        } catch (err) {
          console.error("[account-ui] signOut error", err);
          alert(
            "Sign out failed: " + (err && err.message ? err.message : "unknown")
          );
        }
      });
    }

    // Avatar error fallback
    if (avatarImg) {
      avatarImg.addEventListener("error", () => {
        const fallback = generateInitialsAvatar(
          displayName ? displayName.textContent : "User"
        );
        if (fallback) avatarImg.src = fallback;
      });
    }

    log("Account UI initialized.");
  }

  // Utility: generate initials avatar as data URL fallback
  function generateInitialsAvatar(name) {
    const initials = (name || "U")
      .split(" ")
      .map((s) => s.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#e6e9ef";
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "#111827";
      ctx.font = "60px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, 64, 72);
      return canvas.toDataURL();
    } catch (e) {
      return "";
    }
  }

  // Run init on DOM ready. Also support immediate run if already ready.
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(initOnce, 0); // run async to allow other scripts to finish
  } else {
    document.addEventListener("DOMContentLoaded", initOnce, { once: true });
  }
})();
