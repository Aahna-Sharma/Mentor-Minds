// header-dropdown-robust.js
// Robust dropdown + avatar/email syncing. Works with Firebase if present.
// Place AFTER firebase init and after account-ui.js so it can override placeholders.

(function(){
  const UPLOADED_FALLBACK = '/mnt/data/04e98284-8520-4447-8743-9882b6946b53.png'; // last-resort fallback
  const IGNORE_MS_AFTER_TOGGLE = 220;
  let lastToggleTime = 0;

  function qs(id){ return document.getElementById(id); }
  function now(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  function log(...a){ console.log('[hdr]', ...a); }
  function warn(...a){ console.warn('[hdr]', ...a); }

  // generate initials avatar (data URL)
  function generateInitialsDataURL(name, size = 128) {
    const initials = (name || 'U').split(' ').map(s=>s.charAt(0)).filter(Boolean).slice(0,2).join('').toUpperCase() || 'U';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#e6e9ef';
      ctx.fillRect(0,0,size,size);
      ctx.fillStyle = '#111827';
      ctx.font = Math.floor(size * 0.45) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, size/2, size/2 + (size*0.02));
      return canvas.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  }

  // Apply avatar/name/email to DOM (single function so we can re-apply on mutation)
  function applyUserToDOM({ name, email, photoURL }) {
    const userAvatar = qs('userAvatar');
    const menuAvatar = (qs('userMenu') && qs('userMenu').querySelector('.user-menu-avatar')) || null;
    const menuName = qs('menuName');
    const menuEmail = qs('menuEmail');
    const userNameSpan = qs('userName');

    // Decide avatar: prefer photoURL, else initials data URL, else fallback image
    let avatarSrc = '';
    if (photoURL) avatarSrc = photoURL;
    else if (name) avatarSrc = generateInitialsDataURL(name, 128);
    else if (UPLOADED_FALLBACK) avatarSrc = UPLOADED_FALLBACK;

    if (userAvatar && avatarSrc) {
      try { userAvatar.src = avatarSrc; userAvatar.setAttribute('data-avatar-set', '1'); } catch(e){}
    }
    if (menuAvatar && avatarSrc) {
      try { menuAvatar.src = avatarSrc; menuAvatar.setAttribute('data-avatar-set', '1'); } catch(e){}
    }

    if (menuName && name) menuName.textContent = name;
    if (menuEmail && email) menuEmail.textContent = email;
    if (userNameSpan && name) userNameSpan.textContent = name;
  }

  // Try to get firebase user or fallback to immediately reading DOM names (if any)
  async function resolveUserInfo(timeout = 1200) {
    // returns {name, email, photoURL}
    try {
      if (window.firebase && firebase.auth) {
        const current = firebase.auth().currentUser;
        if (current) {
          return { name: current.displayName || (current.email ? current.email.split('@')[0] : ''), email: current.email || '', photoURL: current.photoURL || '' };
        }
        // wait briefly for onAuthStateChanged (for redirect flows)
        return await new Promise((resolve) => {
          let done = false;
          const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeout);
          const unsub = firebase.auth().onAuthStateChanged((u) => {
            if (!done) {
              done = true; clearTimeout(t); unsub();
              if (!u) return resolve(null);
              resolve({ name: u.displayName || (u.email ? u.email.split('@')[0] : ''), email: u.email || '', photoURL: u.photoURL || '' });
            }
          });
        });
      }
    } catch(e){
      console.warn('[hdr] firebase read error', e);
    }
    // fallback: try read existing DOM values if any (maybe other script already set them)
    const possibleName = (qs('userName') && qs('userName').textContent) || (qs('menuName') && qs('menuName').textContent) || '';
    const possibleEmail = (qs('menuEmail') && qs('menuEmail').textContent) || '';
    if (possibleName || possibleEmail) return { name: possibleName, email: possibleEmail, photoURL: '' };
    return null;
  }

  // Observe possible overrides and re-apply our desired values
  function observeAndReapply(desired) {
    const nodesToWatch = [];
    const uA = qs('userAvatar'); if (uA) nodesToWatch.push(uA);
    const mA = (qs('userMenu') && qs('userMenu').querySelector('.user-menu-avatar')) || null; if (mA) nodesToWatch.push(mA);
    const mName = qs('menuName'); if (mName) nodesToWatch.push(mName);
    const mEmail = qs('menuEmail'); if (mEmail) nodesToWatch.push(mEmail);
    if (!nodesToWatch.length) return null;

    const mo = new MutationObserver((mutations) => {
      // If someone else changed src/text, re-apply our values (debounced)
      let changed = false;
      for (const mut of mutations) {
        changed = true; break;
      }
      if (changed) {
        setTimeout(() => applyUserToDOM(desired), 20);
      }
    });
    nodesToWatch.forEach(n => mo.observe(n, { attributes: true, attributeFilter: ['src', 'alt'], childList: true, subtree: true, characterData: true }));
    // Return observer so caller may disconnect if desired
    return mo;
  }

  // Dropdown open/close with aggressive defense against other listeners
  function initDropdown() {
    const userToggle = qs('userToggle');
    const userMenu = qs('userMenu');
    const userPanel = qs('userPanel');

    if (!userToggle || !userMenu || !userPanel) {
      warn('[hdr] missing DOM for dropdown (userToggle/userMenu/userPanel)');
      return;
    }

    userToggle.setAttribute('aria-haspopup','true');
    userToggle.setAttribute('aria-expanded','false');
    userMenu.setAttribute('aria-hidden','true');

    function openMenu() {
      userMenu.classList.add('open');
      userMenu.setAttribute('aria-hidden','false');
      userToggle.setAttribute('aria-expanded','true');
      // focus first item
      const first = userMenu.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
      if (first) first.focus();
    }
    function closeMenu() {
      userMenu.classList.remove('open');
      userMenu.setAttribute('aria-hidden','true');
      userToggle.setAttribute('aria-expanded','false');
      try { userToggle.focus(); } catch(e){}
    }

    function toggleFromPointer(ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (userMenu.classList.contains('open')) closeMenu(); else openMenu();
      lastToggleTime = now();
    }

    function toggleFromClick(ev) {
      const elapsed = now() - lastToggleTime;
      if (elapsed < IGNORE_MS_AFTER_TOGGLE) { ev.preventDefault(); ev.stopPropagation(); return; }
      if (userMenu.classList.contains('open')) closeMenu(); else openMenu();
      lastToggleTime = now();
    }

    // Add a capturing document listener that blocks other handlers for events that occur inside userPanel.
    // This ensures other scripts that close menus won't see the event we use to open it.
    const captureGuard = (ev) => {
      try {
        if (userPanel.contains(ev.target)) {
          // if the target is inside our panel/menu, stop other handlers (but only for a short time)
          ev.stopImmediatePropagation();
          // allow default for target node itself to receive event normally by not calling preventDefault here
        }
      } catch(e){}
    };
    // install capture guard for pointerdown and click — this runs before other capture/bubble handlers added later
    document.addEventListener('pointerdown', captureGuard, true);
    document.addEventListener('click', captureGuard, true);

    // Attach toggle handlers on the button
    userToggle.addEventListener('pointerdown', toggleFromPointer, { passive: false });
    userToggle.addEventListener('click', toggleFromClick);

    // Close when clicking outside — but respect our timing guard
    document.addEventListener('pointerdown', (ev) => {
      if (userPanel.contains(ev.target)) return;
      const elapsed = now() - lastToggleTime;
      if (elapsed < IGNORE_MS_AFTER_TOGGLE) return;
      if (userMenu.classList.contains('open')) closeMenu();
    }, { passive: true });

    // Keyboard accessibility
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && userMenu.classList.contains('open')) { ev.preventDefault(); closeMenu(); }
      if ((ev.key === 'ArrowDown' || ev.key === 'Enter' || ev.key === ' ') && document.activeElement === userToggle) {
        ev.preventDefault(); openMenu(); lastToggleTime = now();
      }
      if (ev.key === 'Tab' && userMenu.classList.contains('open')) {
        const focusables = Array.from(userMenu.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')).filter(x=>!x.disabled);
        if (focusables.length === 0) { ev.preventDefault(); return; }
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    });
  }

  // Boot sequence
  async function init() {
    // 1) init dropdown behavior immediately
    initDropdown();

    // 2) attempt to resolve user info and apply to DOM; retry if necessary
    let resolved = await resolveUserInfo(1200);
    if (!resolved) {
      // As a fallback, try again a couple times (some flows have slight delays)
      for (let i=0;i<3 && !resolved;i++){
        await new Promise(r => setTimeout(r, 250));
        resolved = await resolveUserInfo(400);
      }
    }
    const desired = resolved || { name: '', email: '', photoURL: '' };
    applyUserToDOM(desired);

    // 3) watch for changes from other scripts and re-apply if necessary
    const mo = observeAndReapply(desired);

    // 4) keep listening to Firebase auth changes to update live
    try {
      if (window.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged(async (u) => {
          const info = u ? { name: u.displayName || (u.email ? u.email.split('@')[0] : ''), email: u.email || '', photoURL: u.photoURL || '' } : { name:'', email:'', photoURL:'' };
          applyUserToDOM(info);
          // update desired and rehook observer with new desired values
          if (mo) mo.disconnect();
          observeAndReapply(info);
        });
      }
    } catch(e){ console.warn('[hdr] auth listener warn', e); }

    log('header-dropdown-robust initialized');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else setTimeout(init, 0);

})();
