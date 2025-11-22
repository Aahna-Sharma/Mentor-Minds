// docs/account-ui.js
// Merged account UI + dropdown wiring
// - uses cached snapshot for instant UI
// - waits for window.mentorAuth.auth (Firebase wrapper) before wiring auth & signout
// - dropdown open/close, outside click, ESC, arrow/enter keyboard support
// - defaultAvatar uses the local uploaded file path you provided

(function () {
  // === CONFIG ===
  const defaultAvatar = "/mnt/data/a3d89637-c4ed-470e-a102-98e746a5abad.png";

  // === Helpers: cached UI for instant load ===
  function showCachedUserIfAny() {
    try {
      const cached = localStorage.getItem("mm_user_snapshot");
      if (!cached) return;
      const u = JSON.parse(cached);
      if (!u) return;
      const avatar = document.getElementById("userAvatar");
      const name = document.getElementById("userName");
      const panel = document.getElementById("userPanel");
      const loginLink = document.getElementById("loginLink");
      if (avatar) avatar.src = u.photoURL || u.defaultAvatar || defaultAvatar;
      if (name) name.textContent = u.displayName || u.email || "User";
      if (panel && loginLink) {
        loginLink.style.display = "none";
        panel.style.display = "flex";
      }
      // fill dropdown info if present
      const menuName = document.getElementById("menuName");
      const menuEmail = document.getElementById("menuEmail");
      const menuAvatar = document.querySelector(".user-menu-avatar");
      if (menuName) menuName.textContent = u.displayName || u.email || "";
      if (menuEmail) menuEmail.textContent = u.email || "";
      if (menuAvatar)
        menuAvatar.src = u.photoURL || u.defaultAvatar || defaultAvatar;
    } catch (e) {
      // ignore corrupted cache
      console.warn("mm: cached user read error", e);
    }
  }

  // === Wait for mentorAuth to be available ===
  async function waitForMentorAuth(timeout = 8000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (window.mentorAuth && window.mentorAuth.auth)
          return resolve(window.mentorAuth.auth);
        if (Date.now() - start > timeout)
          return reject(new Error("mentorAuth timeout"));
        setTimeout(check, 100);
      })();
    });
  }

  // === Dropdown open/close helpers ===
  function openMenu(menu, btn) {
    if (!menu || !btn) return;
    menu.classList.add("open");
    menu.setAttribute("aria-hidden", "false");
    btn.setAttribute("aria-expanded", "true");

    // outside click
    menu.__outside = function (e) {
      if (!menu.contains(e.target) && e.target !== btn) closeMenu(menu, btn);
    };
    document.addEventListener("click", menu.__outside);

    // ESC to close
    menu.__esc = function (e) {
      if (e.key === "Escape") closeMenu(menu, btn);
    };
    document.addEventListener("keydown", menu.__esc);

    // focus first actionable item
    const first = menu.querySelector(".menu-item, button, a");
    if (first) first.focus();
  }

  function closeMenu(menu, btn) {
    if (!menu || !btn) return;
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    btn.setAttribute("aria-expanded", "false");

    if (menu.__outside) {
      document.removeEventListener("click", menu.__outside);
      delete menu.__outside;
    }
    if (menu.__esc) {
      document.removeEventListener("keydown", menu.__esc);
      delete menu.__esc;
    }
    // return focus to button for accessibility
    try {
      btn.focus();
    } catch (e) {}
  }

  // === Initialize auth-driven UI (caching + state change) ===
  async function initAccountUI() {
    // show cached user quickly while waiting for auth
    showCachedUserIfAny();

    let auth;
    try {
      auth = await waitForMentorAuth();
    } catch (err) {
      console.warn(
        "mm: auth init timeout - dropdown will still wire but auth features unavailable",
        err
      );
      // We still continue wiring dropdown even if auth isn't available
    }

    // DOM refs (may be null if elements not present on the page)
    const loginLink = document.getElementById("loginLink");
    const userPanel = document.getElementById("userPanel");
    const userAvatar = document.getElementById("userAvatar");
    const userName = document.getElementById("userName");
    const signOutBtn = document.getElementById("signOutBtn"); // legacy id, may not exist
    const signOutMenuBtn = document.getElementById("menuSignOut"); // new id in menu

    function showSignedOut() {
      if (loginLink) loginLink.style.display = "";
      if (userPanel) userPanel.style.display = "none";
      localStorage.removeItem("mm_user_snapshot");
    }

    function showSignedIn(user) {
      if (!userPanel || !userAvatar || !userName || !loginLink) return;
      loginLink.style.display = "none";
      userPanel.style.display = "flex";
      const photo = user.photoURL || defaultAvatar;
      userAvatar.src = photo;
      userName.textContent = user.displayName || user.email || "User";

      // populate dropdown info
      const menuName = document.getElementById("menuName");
      const menuEmail = document.getElementById("menuEmail");
      const menuAvatar = document.querySelector(".user-menu-avatar");
      if (menuName) menuName.textContent = user.displayName || user.email || "";
      if (menuEmail) menuEmail.textContent = user.email || "";
      if (menuAvatar) menuAvatar.src = photo;

      // Cache a small snapshot for instant UI on next page
      const snap = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        defaultAvatar: defaultAvatar,
      };
      try {
        localStorage.setItem("mm_user_snapshot", JSON.stringify(snap));
      } catch (e) {
        console.warn("mm: unable to write cache", e);
      }
    }

    // Wire auth state changes if auth is available
    if (auth && typeof auth.onAuthStateChanged === "function") {
      auth.onAuthStateChanged((user) => {
        if (user) showSignedIn(user);
        else showSignedOut();
      });
    } else {
      // auth not ready — keep cached UI until page reload/login happens
    }

    // Wire sign out buttons (either id)
    const wireSignOut = (el) => {
      if (!el) return;
      el.addEventListener("click", async () => {
        try {
          // if you have a wrapper around signOut (MentorAuth) use it, otherwise use firebase auth
          if (
            window.MentorAuth &&
            typeof window.MentorAuth.signOutUser === "function"
          ) {
            await window.MentorAuth.signOutUser();
          } else if (auth && typeof auth.signOut === "function") {
            await auth.signOut();
          } else {
            console.warn(
              "mm: signOut unavailable — implement sign out logic here"
            );
          }
          // After sign out, redirect to login page (adjust as needed)
          closeDropdownIfOpen();
          window.location.href = "Loginpage.html";
        } catch (err) {
          console.error("sign out failed", err);
          alert("Sign out failed: " + (err.message || err));
        }
      });
    };

    wireSignOut(signOutBtn);
    wireSignOut(signOutMenuBtn);
  }

  // Helper to close dropdown if open (used on signout redirect)
  function closeDropdownIfOpen() {
    const btn = document.getElementById("userToggle");
    const menu = document.getElementById("userMenu");
    if (menu && btn && menu.getAttribute("aria-hidden") === "false") {
      closeMenu(menu, btn);
    }
  }

  // === Dropdown wiring (independent of auth) ===
  (function dropdownInit() {
    // If auth is heavy to initialize, still wire dropdown immediately
    const btn = document.getElementById("userToggle");
    const menu = document.getElementById("userMenu");
    const signout = document.getElementById("menuSignOut");

    if (!btn || !menu) {
      // Elements missing — nothing to wire here
      return;
    }

    // Ensure aria attributes default
    if (!menu.hasAttribute("aria-hidden"))
      menu.setAttribute("aria-hidden", "true");
    if (!btn.hasAttribute("aria-expanded"))
      btn.setAttribute("aria-expanded", "false");

    // Click toggles
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const isOpen = menu.getAttribute("aria-hidden") === "false";
      if (isOpen) closeMenu(menu, btn);
      else openMenu(menu, btn);
    });

    // Keyboard support on the button
    btn.addEventListener("keydown", (e) => {
      if (["Enter", " ", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        openMenu(menu, btn);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        openMenu(menu, btn);
        // focus last item
        const items = menu.querySelectorAll(".menu-item, button, a");
        if (items.length) items[items.length - 1].focus();
      }
    });

    // Menu-level keyboard navigation (when open)
    menu.addEventListener("keydown", (e) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End", "Escape"].includes(e.key))
        return;
      const items = Array.from(
        menu.querySelectorAll(".menu-item, button, a")
      ).filter(Boolean);
      if (!items.length) return;

      let idx = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        idx = (idx + 1) % items.length;
        items[idx].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        idx = (idx - 1 + items.length) % items.length;
        items[idx].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeMenu(menu, btn);
      }
    });

    // Ensure clicking any menu item closes the menu (good UX)
    menu.addEventListener("click", (e) => {
      const target = e.target.closest(".menu-item, a, button");
      if (target) {
        // allow the action to proceed, but close the menu
        // small timeout so links/buttons can process naturally
        setTimeout(() => closeMenu(menu, btn), 10);
      }
    });

    // If signout button exists in dropdown, wire it (fallback signout handled in initAccountUI)
    if (signout) {
      signout.addEventListener("click", (ev) => {
        // don't double-run; actual signout logic is in initAccountUI wiring
        // but keep this as a no-op to allow immediate close
        // closeMenu will be triggered by initAccountUI's signout handler after signout
      });
    }
  })();

  // === Run initialization ===
  initAccountUI().catch((err) => console.error("mm: initAccountUI error", err));
})();

// === avatar + user menu fixer ===
// Paste this into account-ui.js or at the end of your loginpage script
(function(){
  const FALLBACK_AVATAR = '/mnt/data/f15ad739-f107-4016-8c83-9df750f95f93.png';

  function initialsFrom(nameOrEmail){
    if(!nameOrEmail) return 'U';
    const s = (nameOrEmail.displayName || nameOrEmail.email || nameOrEmail).toString();
    const parts = s.split(/[.\s_\-@]+/).filter(Boolean);
    if(parts.length === 0) return (s.slice(0,2)||'U').toUpperCase();
    if(parts.length === 1) return (parts[0].slice(0,2) || parts[0][0]).toUpperCase();
    return ((parts[0][0]||'') + (parts[1] && parts[1][0]||'')).toUpperCase();
  }

  function hueFrom(seed){
    let h = 0;
    if(seed) for(let i=0;i<seed.length;i++) h = (h<<5) - h + seed.charCodeAt(i);
    return Math.abs(h) % 360;
  }

  function svgDataUrl(initials, hue, size=128){
    const bg = `hsl(${hue} 60% 55%)`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
      <rect width='100%' height='100%' rx='20' fill='${bg}'/>
      <text x='50%' y='50%' font-family='Inter, system-ui, Arial' font-weight='700' font-size='52' fill='#fff' dominant-baseline='middle' text-anchor='middle'>${initials}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function applySnapshotToUI(snapshot){
    try {
      if(!snapshot) return;
      // ensure a photoURL exists; generate one if missing
      if(!snapshot.photoURL){
        const initials = initialsFrom(snapshot.displayName || snapshot.email || snapshot.uid);
        const hue = hueFrom(snapshot.uid || snapshot.email || initials);
        snapshot.photoURL = svgDataUrl(initials, hue, 128);
      }

      // store updated snapshot back to localStorage
      localStorage.setItem('mm_user_snapshot', JSON.stringify(snapshot));

      // update header avatar / menu avatar / name / email
      const avatarEl = document.getElementById('userAvatar');
      const menuAvatar = document.querySelector('.user-menu-avatar');
      const nameEl = document.getElementById('userName');
      const menuName = document.getElementById('menuName');
      const menuEmail = document.getElementById('menuEmail');

      if(avatarEl){
        avatarEl.src = snapshot.photoURL || FALLBACK_AVATAR;
        avatarEl.onerror = function(){ this.onerror = null; this.src = FALLBACK_AVATAR; };
      }
      if(menuAvatar){
        menuAvatar.src = snapshot.photoURL || FALLBACK_AVATAR;
        menuAvatar.onerror = function(){ this.onerror = null; this.src = FALLBACK_AVATAR; };
      }
      if(nameEl) nameEl.textContent = snapshot.displayName || snapshot.email || 'User';
      if(menuName) menuName.textContent = snapshot.displayName || snapshot.email || 'User';
      if(menuEmail) menuEmail.textContent = snapshot.email || '';

      // small visual fix: ensure avatars are square and show nicely
      [avatarEl, menuAvatar].forEach(img=>{
        if(!img) return;
        img.style.width = img.style.width || '36px';
        img.style.height = img.style.height || '36px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = img.style.borderRadius || '999px';
      });
    } catch(e){ console.warn('applySnapshotToUI error', e); }
  }

  // read mm_user_snapshot and apply
  function applyCachedUserIfAny(){
    try {
      const cached = localStorage.getItem('mm_user_snapshot');
      if(!cached) return;
      const snap = JSON.parse(cached);
      applySnapshotToUI(snap);
    } catch(e){ console.warn('applyCachedUserIfAny parse error', e); }
  }

  // call on load
  applyCachedUserIfAny();

  // expose helper for other scripts (auth watcher should call this after sign-in)
  window.MM = window.MM || {};
  window.MM.applyUserSnapshot = function(userLike){
    // userLike can be firebase user object or small snapshot
    const snapshot = {
      uid: userLike.uid || (userLike.uid === 0 ? 0 : ''),
      displayName: userLike.displayName || userLike.displayName === null ? userLike.displayName : (userLike.displayName||''),
      email: userLike.email || userLike.email === null ? userLike.email : (userLike.email||''),
      photoURL: userLike.photoURL || ''
    };
    applySnapshotToUI(snapshot);
  };

  // Convenience: if you have auth.onAuthStateChanged, call this in the handler:
  // auth.onAuthStateChanged(user => { if(user) window.MM.applyUserSnapshot(user); });

})();
// === Defensive avatar keeper (paste at end of account-ui.js) ===
(function(){
  const FALLBACK = '/mnt/data/f15ad739-f107-4016-8c83-9df750f95f93.png';
  const SNAP_KEY = 'mm_user_snapshot';

  function readSnapshot(){
    try { return JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); }
    catch(e){ return null; }
  }

  function writeSnapshot(snap){
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(snap || {})); } catch(e){}
  }

  function ensureGeneratedAvatar(snapshot){
    try {
      if(!snapshot) return snapshot;
      if(!snapshot.photoURL || snapshot.photoURL === '') {
        // generate deterministic avatar (simple initials SVG)
        const name = snapshot.displayName || snapshot.email || snapshot.uid || 'U';
        const initials = (name.split(/[\s._@-]+/).filter(Boolean).map(s=>s[0]).slice(0,2).join('') || name.slice(0,2)).toUpperCase();
        let h=0; for(let i=0;i<name.length;i++) h=(h<<5)-h+name.charCodeAt(i);
        const hue = Math.abs(h) % 360;
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect rx='20' width='100%' height='100%' fill='hsl(${hue} 60% 55%)'/><text x='50%' y='50%' font-family='Inter,system-ui,Arial' font-size='52' font-weight='700' fill='#fff' dominant-baseline='middle' text-anchor='middle'>${initials}</text></svg>`;
        snapshot.photoURL = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        writeSnapshot(snapshot);
      }
    } catch(e){ console.warn('ensureGeneratedAvatar', e); }
    return snapshot;
  }

  function applySnapshotToImgs(snapshot){
    if(!snapshot) return;
    const hdr = document.getElementById('userAvatar');
    const menu = document.querySelector('.user-menu-avatar');
    const elems = [hdr, menu].filter(Boolean);
    elems.forEach(img=>{
      try {
        const before = img.src;
        img.src = snapshot.photoURL || FALLBACK;
        img.onerror = function(){ this.onerror=null; this.src = FALLBACK; };
        // tag img so we know it's our applied avatar
        img.dataset.mmApplied = '1';
        if(before !== img.src) {
          console.log('[MM-avatar] applied', img, 'oldSrc:', before, 'newSrc:', img.src);
        }
      } catch(e){ console.warn('applySnapshotToImgs err', e); }
    });
  }

  // short helper to restore snapshot from localStorage and apply it
  function reapplyFromSnapshot(){
    const snap = ensureGeneratedAvatar(readSnapshot());
    if(snap) applySnapshotToImgs(snap);
    return snap;
  }

  // attempt immediate apply (in case snapshot already exists)
  reapplyFromSnapshot();

  // reapply repeatedly for a short period to out-race other scripts that may overwrite
  (function stormApply(){
    let attempts = 0;
    const iv = setInterval(()=>{
      attempts++;
      const snap = reapplyFromSnapshot();
      if(attempts > 10) clearInterval(iv); // ~10 * 150ms = 1.5s
    }, 150);
  })();

  // watch for changes to the avatar image (someone else might set src later) and reapply
  function observeImg(img){
    if(!img) return;
    const mo = new MutationObserver((records)=>{
      records.forEach(rec=>{
        if(rec.type === 'attributes' && rec.attributeName === 'src'){
          // if another script changed src to falsy or to a broken value, restore ours
          const s = img.getAttribute('src') || '';
          const applied = img.dataset.mmApplied === '1';
          const snap = readSnapshot();
          const desired = snap && snap.photoURL ? snap.photoURL : FALLBACK;
          if(!s || s === 'null' || s === 'undefined' || s === desired) {
            // ok
            return;
          }
          // log who changed it (stack)
          try {
            const stack = new Error().stack;
            console.warn('[MM-avatar] detected external src change on', img, 'new src:', s, 'restoring desired:', desired, '\nstack:', stack);
          } catch(e){}
          // restore after tiny delay to avoid infinite loop with some scripts
          setTimeout(()=> { img.src = desired; img.dataset.mmApplied = '1'; }, 40);
        }
      });
    });
    mo.observe(img, { attributes: true, attributeFilter: ['src'] });
    // if the node is removed and re-added, re-run apply
    const parent = img.parentNode;
    if(parent){
      const parentMo = new MutationObserver((recs)=>{
        recs.forEach(r => {
          if(r.type === 'childList' && !document.contains(img)) {
            // reselect and reapply
            setTimeout(()=> { const hdr = document.getElementById('userAvatar'); const menu = document.querySelector('.user-menu-avatar'); if(hdr) observeImg(hdr); if(menu) observeImg(menu); reapplyFromSnapshot(); }, 80);
          }
        });
      });
      parentMo.observe(parent, { childList: true });
    }
  }

  // attach observers to current avatar image elements
  (function attachObserversNow(){
    const hdr = document.getElementById('userAvatar');
    const menu = document.querySelector('.user-menu-avatar');
    if(hdr) observeImg(hdr);
    if(menu) observeImg(menu);
    // also watch for future insertion of these elements (in case UI constructs them later)
    const docMo = new MutationObserver((recs)=>{
      recs.forEach(r=>{
        if(r.addedNodes && r.addedNodes.length){
          r.addedNodes.forEach(node=>{
            if(node.nodeType === 1){
              if(node.id === 'userAvatar' || node.querySelector && node.querySelector('#userAvatar')) {
                const el = document.getElementById('userAvatar');
                if(el) { observeImg(el); reapplyFromSnapshot(); }
              }
              if(node.classList && node.classList.contains('user-menu-avatar') || (node.querySelector && node.querySelector('.user-menu-avatar'))){
                const el = document.querySelector('.user-menu-avatar');
                if(el) { observeImg(el); reapplyFromSnapshot(); }
              }
            }
          });
        }
      });
    });
    docMo.observe(document.body || document.documentElement, { childList: true, subtree: true });
  })();

  // Expose a tiny helper to force-set avatar if you want to call it after auth updates:
  window.MM = window.MM || {};
  window.MM.forceApplyAvatar = function(){
    const snap = ensureGeneratedAvatar(readSnapshot());
    applySnapshotToImgs(snap);
  };

  // DEBUG: if avatar still disappears, run this in console to see who changes it:
  // (console-only helper)
  window.MM.logAvatarChange = function(){
    const hdr = document.getElementById('userAvatar');
    const menu = document.querySelector('.user-menu-avatar');
    console.log('snapshot:', localStorage.getItem(SNAP_KEY), 'hdr.src:', hdr && hdr.src, 'menu.src:', menu && menu.src);
    // you can also track object property descriptor
  };
})();
