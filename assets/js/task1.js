/* =========================================================================
   task1.js — "Exclusive Privileges" carousel controller
   --------------------------------------------------------------------------
   - Single active card; immediate neighbors visible as "prev"/"next"
   - Looping (last → first, first → last) via shortest-path index math
   - Auto-advance every 4s; pauses on hover/focus and when the tab is hidden
   - Keyboard (← →), pointer drag/swipe, dot indicators
   - Respects prefers-reduced-motion
   ========================================================================= */
(() => {
  'use strict';

  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const track = root.querySelector('[data-carousel-track]');
  const cards = Array.from(track.querySelectorAll('.card'));
  const prevBtn = root.querySelector('[data-carousel-prev]');
  const nextBtn = root.querySelector('[data-carousel-next]');
  const dotsHost = root.querySelector('[data-carousel-dots]');
  const live = root.querySelector('[data-carousel-live]');

  const n = cards.length;
  if (n === 0) return;

  const AUTOPLAY_MS = 4000;
  const SWIPE_THRESHOLD = 50;  // px before we count a drag as a swipe
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let active = 0;
  let autoplayId = null;
  let paused = false;

  /* ---- Render ----------------------------------------------------------- */
  // Compute the "logical" position of card i relative to the active card,
  // taking the shorter direction around the loop. Returns a value in (-n/2, n/2].
  const relativePos = (i) => {
    let d = (i - active + n) % n;
    if (d > n / 2) d -= n;
    return d;
  };

  const positionLabel = (delta) => {
    if (delta === 0) return 'active';
    if (delta === -1) return 'prev';
    if (delta === 1) return 'next';
    return delta < 0 ? 'far-prev' : 'far-next';
  };

  const render = () => {
    cards.forEach((card, i) => {
      const pos = positionLabel(relativePos(i));
      card.dataset.pos = pos;
      card.setAttribute('aria-hidden', pos === 'active' ? 'false' : 'true');
      // Active card is the only tab-stop inside the carousel
      const focusable = card.querySelector('.card__cta');
      if (focusable) focusable.tabIndex = pos === 'active' ? 0 : -1;
    });
    Array.from(dotsHost.children).forEach((dot, i) => {
      dot.setAttribute('aria-current', i === active ? 'true' : 'false');
    });
    if (live) {
      const title = cards[active].querySelector('.card__title')?.textContent?.trim();
      live.textContent = `Slide ${active + 1} of ${n}${title ? `: ${title}` : ''}`;
    }
  };

  /* ---- Navigation ------------------------------------------------------- */
  const go = (delta) => {
    active = (active + delta + n) % n;
    render();
  };
  const goTo = (i) => {
    active = ((i % n) + n) % n;
    render();
  };

  /* ---- Autoplay --------------------------------------------------------- */
  const startAutoplay = () => {
    if (reduceMotion || autoplayId !== null) return;
    autoplayId = window.setInterval(() => {
      if (!paused && !document.hidden) go(1);
    }, AUTOPLAY_MS);
  };
  const stopAutoplay = () => {
    if (autoplayId !== null) {
      clearInterval(autoplayId);
      autoplayId = null;
    }
  };

  /* ---- Build dots ------------------------------------------------------- */
  for (let i = 0; i < n; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel__dot';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => { goTo(i); });
    dotsHost.appendChild(dot);
  }

  /* ---- Event wiring ----------------------------------------------------- */
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));

  // CTA links in the demo are decorative placeholders — swallow the navigation
  cards.forEach((card) => {
    const cta = card.querySelector('.card__cta');
    cta?.addEventListener('click', (e) => e.preventDefault());
  });

  root.addEventListener('mouseenter', () => { paused = true; });
  root.addEventListener('mouseleave', () => { paused = false; });
  root.addEventListener('focusin',  () => { paused = true; });
  root.addEventListener('focusout', () => { paused = false; });

  // Keyboard: arrow keys when carousel has focus
  root.tabIndex = 0;
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'Home')       { e.preventDefault(); goTo(0); }
    if (e.key === 'End')        { e.preventDefault(); goTo(n - 1); }
  });

  // Pointer drag / swipe — Pointer Events unify mouse + touch + pen
  let dragStartX = null;
  let dragDelta = 0;
  track.addEventListener('pointerdown', (e) => {
    // Ignore drags that begin on the CTA button so its click still fires
    if (e.target.closest('.card__cta')) return;
    dragStartX = e.clientX;
    dragDelta = 0;
    track.setPointerCapture(e.pointerId);
    paused = true;
  });
  track.addEventListener('pointermove', (e) => {
    if (dragStartX === null) return;
    dragDelta = e.clientX - dragStartX;
  });
  const endDrag = (e) => {
    if (dragStartX === null) return;
    try { track.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    if (dragDelta >  SWIPE_THRESHOLD) go(-1);
    if (dragDelta < -SWIPE_THRESHOLD) go(1);
    dragStartX = null;
    dragDelta = 0;
    paused = false;
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // Pause autoplay when tab is hidden (saves cycles, prevents jumping)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay(); else startAutoplay();
  });

  /* ---- Boot ------------------------------------------------------------- */
  render();
  startAutoplay();
})();
