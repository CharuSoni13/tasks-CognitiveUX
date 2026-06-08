/* =========================================================================
   task3.js — Lead-capture form that appears 6 seconds into video playback.
   --------------------------------------------------------------------------
   - Uses the YouTube IFrame API for playback control + state tracking.
   - The 6-second timer is based on *playback time*, not wall-clock time, so
     pausing the video pauses the countdown.
   - When the form opens, the video is paused so the user can focus on it.
   - Submissions are validated client-side and stored in localStorage. The
     submissions table at the bottom is a debug view of recent leads.
   - Once shown (and either submitted or skipped) the form does not appear
     again in the same session.
   ========================================================================= */
(() => {
  'use strict';

  const VIDEO_ID = 'RJTCAL1DRro';
  const TRIGGER_SECONDS = 6;
  const STORAGE_KEY = 't3:leads';
  const SESSION_FLAG = 't3:formShown';

  /* ---- DOM refs --------------------------------------------------------- */
  const stage      = document.querySelector('[data-stage]');
  const playerHost = document.getElementById('yt-player');
  const dim        = stage.querySelector('[data-stage-dim]');
  const lead       = stage.querySelector('[data-lead]');
  const form       = stage.querySelector('[data-lead-form]');
  const success    = stage.querySelector('[data-lead-success]');
  const skipBtn    = stage.querySelector('[data-lead-skip]');
  const closeBtn   = stage.querySelector('[data-lead-close]');
  const resetBtn   = document.querySelector('[data-reset]');
  const triggerBtn = document.querySelector('[data-trigger-now]');
  const subsBody   = document.querySelector('[data-subs-body]');

  let player = null;
  let pollId = null;
  let formShown = sessionStorage.getItem(SESSION_FLAG) === '1';
  let lastFocusedBeforeOpen = null;

  /* ---- Focus trap utility ---------------------------------------------- */
  const focusableSelector = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const trap = (e) => {
    if (stage.dataset.formOpen !== 'true') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeForm({ skipped: true });
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = Array.from(lead.querySelectorAll(focusableSelector))
      .filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

  /* ---- Form open / close ----------------------------------------------- */
  const openForm = () => {
    if (formShown) return;
    formShown = true;
    sessionStorage.setItem(SESSION_FLAG, '1');
    lastFocusedBeforeOpen = document.activeElement;

    // Pause the video so the form is the focal point — this is the
    // "smooth experience" the brief asks for.
    if (player && typeof player.pauseVideo === 'function') player.pauseVideo();

    stage.dataset.formOpen = 'true';
    lead.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', trap);

    // Defer focus to give the slide-in transition time to start.
    setTimeout(() => {
      const firstInput = lead.querySelector('input, select, button');
      firstInput?.focus();
    }, 60);
  };

  const closeForm = ({ skipped = false, submitted = false } = {}) => {
    stage.dataset.formOpen = 'false';
    lead.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', trap);
    if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === 'function') {
      lastFocusedBeforeOpen.focus();
    }
    // Resume playback unless the user explicitly hit "Skip" with the video already paused.
    if (!skipped || (player && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PAUSED)) {
      if (player && typeof player.playVideo === 'function') player.playVideo();
    }
    if (submitted) {
      // Reset to default state in case the user re-opens via debug.
      setTimeout(() => { showFormState(); form.reset(); }, 400);
    }
  };

  const showSuccessState = () => {
    form.hidden = true;
    success.hidden = false;
  };
  const showFormState = () => {
    form.hidden = false;
    success.hidden = true;
  };

  /* ---- Validation ------------------------------------------------------- */
  const validators = {
    name: (v) => v.trim().length >= 2 || 'Please enter your full name.',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.',
    phone: (v) => /^[+]?[\d\s\-()]{7,}$/.test(v.trim()) || 'Please enter a valid phone number.',
  };

  const validateField = (field) => {
    const fn = validators[field.name];
    if (!fn) return true;
    const result = fn(field.value);
    const errEl = form.querySelector(`[data-error-for="${field.name}"]`);
    if (result === true) {
      field.setAttribute('aria-invalid', 'false');
      if (errEl) errEl.textContent = '';
      return true;
    }
    field.setAttribute('aria-invalid', 'true');
    if (errEl) errEl.textContent = result;
    return false;
  };

  form.addEventListener('input', (e) => {
    if (e.target.matches('input')) {
      if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = form.querySelectorAll('input[name]');
    let ok = true;
    fields.forEach((f) => { if (!validateField(f)) ok = false; });
    if (!ok) return;

    const data = {
      name:     form.elements.name.value.trim(),
      email:    form.elements.email.value.trim(),
      phone:    form.elements.phone.value.trim(),
      interest: form.elements.interest.value,
      submittedAt: new Date().toISOString(),
      videoId: VIDEO_ID,
    };

    // Persist
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { stored = []; }
    stored.unshift(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.slice(0, 50)));

    console.log('[Task 3] Lead captured:', data);
    renderSubmissions();
    showSuccessState();

    // Auto-close after a short pause so the user sees the confirmation
    setTimeout(() => closeForm({ submitted: true }), 1600);
  });

  skipBtn.addEventListener('click', () => closeForm({ skipped: true }));
  closeBtn.addEventListener('click', () => closeForm({ skipped: true }));

  /* ---- Submissions debug table ---------------------------------------- */
  const renderSubmissions = () => {
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { stored = []; }
    subsBody.innerHTML = '';
    if (stored.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'subs__empty';
      td.textContent = 'No leads captured yet. The form appears 6 seconds into playback.';
      tr.appendChild(td);
      subsBody.appendChild(tr);
      return;
    }
    stored.forEach((row) => {
      const tr = document.createElement('tr');
      const when = new Date(row.submittedAt).toLocaleString();
      [row.name, row.email, row.phone, row.interest, when].forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v || '—';
        tr.appendChild(td);
      });
      subsBody.appendChild(tr);
    });
  };

  /* ---- YouTube IFrame API ---------------------------------------------- */
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(playerHost, {
      videoId: VIDEO_ID,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: () => { /* nothing to do until playback starts */ },
        onStateChange: (e) => {
          // Start polling only while the video is playing. Pausing leaves
          // the interval running but `currentTime` won't advance, so the
          // timer effectively "freezes" — which is what we want.
          if (e.data === YT.PlayerState.PLAYING && pollId === null && !formShown) {
            pollId = window.setInterval(() => {
              const t = player.getCurrentTime();
              if (t >= TRIGGER_SECONDS) {
                clearInterval(pollId); pollId = null;
                openForm();
              }
            }, 250);
          }
        },
      },
    });
  };
  if (!window.__ytApiInjected) {
    window.__ytApiInjected = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  /* ---- Debug controls -------------------------------------------------- */
  triggerBtn?.addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_FLAG);
    formShown = false;
    openForm();
  });
  resetBtn?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_FLAG);
    formShown = false;
    renderSubmissions();
  });

  renderSubmissions();
})();
