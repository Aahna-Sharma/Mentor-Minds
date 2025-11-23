// header-dropdown-final.js
// Final, robust dropdown + avatar sync.
// Load this AFTER firebase init and account-ui.js.

// For traceability/debug only (NOT used as fallback). You can use or ignore.
// Uploaded test image path (debug): /mnt/data/0729f8f0-c7fc-4de7-893b-fc200e2e3e0c.png
const UPLOADED_TEST_URL = "";

(function () {
  // ---- CONFIG ----
  // No uploaded-file fallback by default (you asked not to use uploaded images).
  const UPLOADED_FALLBACK = ""; // set to UPLOADED_TEST_URL if you later want to use the uploaded file
  const IGNORE_MS_AFTER_TOGGLE = 220;
  let lastToggleTime = 0;

  // ---- HELPERS ----
  const qs = (id) => document.getElementById(id);
  const now = () =>
    performance && performance.now ? performance.now() : Date.now();

  function genInitialsDataURL(name, size = 128) {
    const initials =
      (name || "")
        .trim()
        .split(" ")
        .map((s) => s.charAt(0))
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "U";
    try {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#e6e9ef";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#111827";
      ctx.font = Math.floor(size * 0.45) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, size / 2, size / 2 + size * 0.03);
      return c.toDataURL("image/png");
    } catch (e) {
      return "";
    }
  }

  // Apply user info to DOM (avatar/name/email)
  function applyUserToDOM({ name = "", email = "", photoURL = "" }) {
    const avatarEl = qs("userAvatar");
    const menuAvatar =
      (qs("userMenu") && qs("userMenu").querySelector(".user-menu-avatar")) ||
      null;
    const menuName = qs("menuName");
    const menuEmail = qs("menuEmail");
    const headerName = qs("userName");

    // prefer photoURL, else initials, else no fallback
    let avatarSrc =
      photoURL ||
      (name ? genInitialsDataURL(name) : "") ||
      UPLOADED_FALLBACK ||
      "";

    if (avatarEl && avatarSrc) {
      avatarEl.src = avatarSrc;
      avatarEl.setAttribute("data-avatar-set", "1");
    }
    if (menuAvatar && avatarSrc) {
      menuAvatar.src = avatarSrc;
      menuAvatar.setAttribute("data-avatar-set", "1");
    }
    if (menuName && name) menuName.textContent = name;
    if (menuEmail && email) menuEmail.textContent = email;
    if (headerName && name) headerName.textContent = name;
  }

  // Watch elements for external overwrites and reapply user info
  function observeAndReapply(desired) {
    const targets = [];
    const a = qs("userAvatar");
    if (a) targets.push(a);
    const ma =
      (qs("userMenu") && qs("userMenu").querySelector(".user-menu-avatar")) ||
      null;
    if (ma) targets.push(ma);
    const mn = qs("menuName");
    if (mn) targets.push(mn);
    const me = qs("menuEmail");
    if (me) targets.push(me);
    if (!targets.length) return null;
    const mo = new MutationObserver((muts) => {
      // reapply shortly if anything changed
      setTimeout(() => applyUserToDOM(desired), 20);
    });
    targets.forEach((n) =>
      mo.observe(n, {
        attributes: true,
        attributeFilter: ["src", "alt"],
        childList: true,
        subtree: true,
        characterData: true,
      })
    );
    return mo;
  }

  // Resolve user info from Firebase (wait briefly for auth to restore)
  async function resolveUserInfo(timeout = 1200) {
    try {
      if (window.firebase && firebase.auth) {
        const current = firebase.auth().currentUser;
        if (current)
          return {
            name:
              current.displayName ||
              (current.email ? current.email.split("@")[0] : ""),
            email: current.email || "",
            photoURL: current.photoURL || "",
          };
        // wait briefly if auth is restoring
        return await new Promise((resolve) => {
          let done = false;
          const t = setTimeout(() => {
            if (!done) {
              done = true;
              resolve(null);
            }
          }, timeout);
          const unsub = firebase.auth().onAuthStateChanged((u) => {
            if (!done) {
              done = true;
              clearTimeout(t);
              unsub();
              if (!u) return resolve(null);
              resolve({
                name: u.displayName || (u.email ? u.email.split("@")[0] : ""),
                email: u.email || "",
                photoURL: u.photoURL || "",
              });
            }
          });
        });
      }
    } catch (e) {
      console.warn("resolveUserInfo error", e);
    }
    // fallback to DOM
    const dName =
      (qs("userName") && qs("userName").textContent) ||
      (qs("menuName") && qs("menuName").textContent) ||
      "";
    const dEmail = (qs("menuEmail") && qs("menuEmail").textContent) || "";
    if (dName || dEmail) return { name: dName, email: dEmail, photoURL: "" };
    return null;
  }

  // ---- DROPDOWN BEHAVIOR ----
  function initDropdownBehavior() {
    const userToggle = qs("userToggle");
    const userMenu = qs("userMenu");
    const userPanel = qs("userPanel");
    if (!userToggle || !userMenu || !userPanel) {
      console.warn("dropdown DOM missing");
      return;
    }

    userToggle.setAttribute("aria-haspopup", "true");
    userToggle.setAttribute("aria-expanded", "false");
    userMenu.setAttribute("aria-hidden", "true");

    function openMenu() {
      userMenu.classList.add("open");
      userMenu.setAttribute("aria-hidden", "false");
      userToggle.setAttribute("aria-expanded", "true");
      const first = userMenu.querySelector(
        'a,button,[tabindex]:not([tabindex="-1"])'
      );
      if (first) first.focus();
    }
    function closeMenu() {
      userMenu.classList.remove("open");
      userMenu.setAttribute("aria-hidden", "true");
      userToggle.setAttribute("aria-expanded", "false");
      try {
        userToggle.focus();
      } catch (e) {}
    }

    function toggleFromPointer(ev) {
      // pointerdown may be suppressed; we still handle it if present
      ev && ev.preventDefault && ev.preventDefault();
      ev && ev.stopPropagation && ev.stopPropagation();
      if (userMenu.classList.contains("open")) closeMenu();
      else openMenu();
      lastToggleTime = now();
    }
    function toggleFromUpClick(ev) {
      const elapsed = now() - lastToggleTime;
      if (elapsed < IGNORE_MS_AFTER_TOGGLE) {
        ev && ev.preventDefault && ev.preventDefault();
        ev && ev.stopPropagation && ev.stopPropagation();
        return;
      }
      if (userMenu.classList.contains("open")) closeMenu();
      else openMenu();
      lastToggleTime = now();
    }

    // capture guard: stop other scripts' handlers for events that originate inside our panel
    // but allow clicks originating from explicit allow-list (e.g., sign-out) to proceed.
    const captureGuard = (ev) => {
      try {
        if (!userPanel.contains(ev.target)) return;

        // Allow certain selectors (sign-out etc) to pass through so their handlers run.
        // Adjust this list if your sign-out element uses a different selector.
        const allowSelectors = [
          "#menuSignOut",
          ".menu-item.signout",
          "[data-signout]",
        ];
        for (const sel of allowSelectors) {
          if (ev.target.closest && ev.target.closest(sel)) {
            // Allow event to propagate for allowed controls
            return;
          }
        }

        // For everything else inside the panel, stop other listeners to avoid interference
        ev.stopImmediatePropagation();
      } catch (e) {}
    };
    document.addEventListener("pointerdown", captureGuard, true);
    document.addEventListener("click", captureGuard, true);

    // attach both pointerdown and pointerup/click handlers (pointerup handles envs where pointerdown is suppressed)
    userToggle.addEventListener(
      "pointerdown",
      (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        // record interaction before toggle to reduce race
        lastToggleTime = now();
        if (userMenu.classList.contains("open")) closeMenu();
        else openMenu();
      },
      { passive: false }
    );

    userToggle.addEventListener("pointerup", toggleFromUpClick, {
      passive: false,
    });
    userToggle.addEventListener("click", toggleFromUpClick, { passive: false });

    // outside click closes menu (respect timing guard)
    document.addEventListener(
      "pointerdown",
      (ev) => {
        if (userPanel.contains(ev.target)) return;
        const elapsed = now() - lastToggleTime;
        if (elapsed < IGNORE_MS_AFTER_TOGGLE) return;
        if (userMenu.classList.contains("open")) closeMenu();
      },
      { passive: true }
    );

    // keyboard handling
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && userMenu.classList.contains("open")) {
        ev.preventDefault();
        closeMenu();
      }
      if (
        (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") &&
        document.activeElement === userToggle
      ) {
        ev.preventDefault();
        openMenu();
        lastToggleTime = now();
      }
      if (ev.key === "Tab" && userMenu.classList.contains("open")) {
        const focusables = Array.from(
          userMenu.querySelectorAll('a,button,[tabindex]:not([tabindex="-1"])')
        ).filter((x) => !x.disabled);
        if (focusables.length === 0) {
          ev.preventDefault();
          return;
        }
        const first = focusables[0],
          last = focusables[focusables.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    });

    // Attach sign-out handler (robust)
    (function attachSignOut() {
      const signOutBtn =
        qs("menuSignOut") ||
        (qs("userMenu") &&
          qs("userMenu").querySelector(".menu-item.signout")) ||
        (qs("userMenu") && qs("userMenu").querySelector("[data-signout]"));
      if (!signOutBtn) return;
      try {
        signOutBtn.removeEventListener(
          "__hdr_signout",
          signOutBtn._hdr_signout_handler
        );
      } catch (e) {}
      signOutBtn._hdr_signout_handler = async function (ev) {
        ev && ev.preventDefault && ev.preventDefault();
        ev && ev.stopPropagation && ev.stopPropagation();
        try {
          // sign out via firebase
          if (window.firebase && firebase.auth) {
            await firebase.auth().signOut();
          } else {
            console.warn("firebase.auth missing — signOut cannot complete");
          }
          // visually close & redirect
          userMenu.classList.remove("open");
          userMenu.setAttribute("aria-hidden", "true");
          userToggle.setAttribute("aria-expanded", "false");
          window.location.replace("index.html");
        } catch (err) {
          console.error("Sign out failed", err);
        }
      };
      // attach in bubble phase so captureGuard allow-list doesn't block it
      signOutBtn.addEventListener("click", signOutBtn._hdr_signout_handler, {
        passive: false,
      });
      // mark element so captureGuard recognizes and allows it
      try {
        signOutBtn.setAttribute("data-signout", "1");
      } catch (e) {}
    })();
  }

  // ---- INIT ----
  async function init() {
    initDropdownBehavior();

    // resolve user and apply
    let resolved = await resolveUserInfo(1200);
    if (!resolved) {
      for (let i = 0; i < 3 && !resolved; i++) {
        await new Promise((r) => setTimeout(r, 250));
        resolved = await resolveUserInfo(400);
      }
    }
    const desired = resolved || { name: "", email: "", photoURL: "" };
    applyUserToDOM(desired);

    // watch for overwrites and reapply
    const mo = observeAndReapply(desired);

    // listen to future auth state changes
    try {
      if (window.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged((u) => {
          const info = u
            ? {
                name: u.displayName || (u.email ? u.email.split("@")[0] : ""),
                email: u.email || "",
                photoURL: u.photoURL || "",
              }
            : { name: "", email: "", photoURL: "" };
          applyUserToDOM(info);
          if (mo) mo.disconnect();
          observeAndReapply(info);
        });
      }
    } catch (e) {
      console.warn("auth listener error", e);
    }

    console.log("[header-dropdown-final] initialized");
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else setTimeout(init, 0);
})();
