/* =========================================================================
   task2.js — YouTube video carousel, dynamic chapter sidebar,
              and auto-chapter generator (description-parsing).
   --------------------------------------------------------------------------
   - Uses the official YouTube IFrame Player API (script loaded inline).
   - Chapters seeded per video below; the generator at the bottom of the page
     calls YouTube Data API v3 (key supplied by the user) to extract chapter
     timestamps from a video's description, with an even-split fallback.
   ========================================================================= */
(() => {
  'use strict';

  /* ---- Seeded video + chapter data --------------------------------------
     These chapters are illustrative placeholders structured the way the
     real flow expects. Replace the entries below — or use the generator at
     the bottom of the page — with timestamps parsed from each video's
     description on YouTube.
     -------------------------------------------------------------------- */
  const VIDEOS = [
    {
      id: 'RJTCAL1DRro',
      title: 'Video 1',
      chapters: [
        { t: 0,   title: 'Intro' },
        { t: 30,  title: 'Context & setup' },
        { t: 75,  title: 'Main demonstration' },
        { t: 140, title: 'Walkthrough' },
        { t: 210, title: 'Wrap-up' },
      ],
    },
    {
      id: 'jj_aUFX8SV8',
      title: 'Video 2',
      chapters: [
        { t: 0,   title: 'Opening' },
        { t: 45,  title: 'Background' },
        { t: 120, title: 'Key concept' },
        { t: 200, title: 'Examples' },
        { t: 280, title: 'Closing remarks' },
      ],
    },
    {
      id: 'xmmxkmVSiq0',
      title: 'Video 3',
      chapters: [
        { t: 0,   title: 'Intro' },
        { t: 40,  title: 'Topic overview' },
        { t: 100, title: 'Deep dive' },
        { t: 180, title: 'Case study' },
        { t: 260, title: 'Conclusion' },
      ],
    },
  ];

  /* ---- DOM refs --------------------------------------------------------- */
  const playerHost   = document.getElementById('yt-player');
  const titleEl      = document.querySelector('[data-player-title]');
  const idEl         = document.querySelector('[data-player-id]');
  const thumbsList   = document.querySelector('[data-thumbs-list]');
  const thumbsPrev   = document.querySelector('[data-thumbs-prev]');
  const thumbsNext   = document.querySelector('[data-thumbs-next]');
  const chaptersList = document.querySelector('[data-chapters-list]');
  const chaptersCount= document.querySelector('[data-chapters-count]');

  /* ---- Helpers ---------------------------------------------------------- */
  const formatTime = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${ss}`
      : `${m}:${ss}`;
  };

  const parseTimestamp = (text) => {
    // Accepts H:MM:SS, M:SS, MM:SS, or H:M:SS
    const m = text.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) return null;
    const a = +m[1], b = +m[2], c = m[3] !== undefined ? +m[3] : null;
    return c === null ? a * 60 + b : a * 3600 + b * 60 + c;
  };

  // YouTube duration is ISO 8601: e.g. PT1H2M30S
  const parseIsoDuration = (iso) => {
    const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  };

  const parseVideoId = (input) => {
    if (!input) return null;
    const trimmed = input.trim();
    // Already an 11-char ID
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed);
      // youtu.be/<id>
      if (url.hostname.endsWith('youtu.be')) {
        const id = url.pathname.slice(1);
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      // youtube.com/watch?v=<id>
      const v = url.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
      // youtube.com/embed/<id> or /shorts/<id> or /v/<id>
      const parts = url.pathname.split('/').filter(Boolean);
      const known = ['embed', 'shorts', 'v'];
      const idx = parts.findIndex((p) => known.includes(p));
      if (idx !== -1 && parts[idx + 1] && /^[\w-]{11}$/.test(parts[idx + 1])) {
        return parts[idx + 1];
      }
    } catch { /* not a URL */ }
    return null;
  };

  /* ---- Player state ----------------------------------------------------- */
  let player = null;
  let activeIndex = 0;
  let highlightTimer = null;

  const setActiveChapter = () => {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    const t = player.getCurrentTime();
    const chapters = VIDEOS[activeIndex].chapters;
    let current = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (t >= chapters[i].t) current = i; else break;
    }
    Array.from(chaptersList.children).forEach((node, i) => {
      node.setAttribute('aria-current', i === current ? 'true' : 'false');
    });
  };

  const renderChapters = () => {
    const chapters = VIDEOS[activeIndex].chapters || [];
    chaptersList.innerHTML = '';
    chaptersCount.textContent = `${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`;
    if (chapters.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'chapters__empty';
      empty.textContent = 'No chapters available for this video.';
      chaptersList.appendChild(empty);
      return;
    }
    chapters.forEach((c, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chap';
      btn.setAttribute('data-i', String(i));
      btn.innerHTML = `
        <span class="chap__time">${formatTime(c.t)}</span>
        <span class="chap__title"></span>
      `;
      btn.querySelector('.chap__title').textContent = c.title;
      btn.addEventListener('click', () => {
        if (player && typeof player.seekTo === 'function') {
          player.seekTo(c.t, true);
          if (typeof player.playVideo === 'function') player.playVideo();
        }
      });
      li.appendChild(btn);
      chaptersList.appendChild(li);
    });
    setActiveChapter();
  };

  const renderMeta = () => {
    const v = VIDEOS[activeIndex];
    titleEl.textContent = v.title;
    idEl.textContent = v.id;
  };

  const renderThumbs = () => {
    thumbsList.innerHTML = '';
    VIDEOS.forEach((v, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb';
      btn.setAttribute('aria-label', `Play ${v.title}`);
      btn.setAttribute('aria-current', i === activeIndex ? 'true' : 'false');
      btn.innerHTML = `
        <img class="thumb__img" alt=""
             src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg"
             loading="lazy" />
        <span class="thumb__cap"></span>
      `;
      btn.querySelector('.thumb__cap').textContent = v.title;
      btn.addEventListener('click', () => loadIndex(i));
      thumbsList.appendChild(btn);
    });
  };

  const loadIndex = (i) => {
    activeIndex = ((i % VIDEOS.length) + VIDEOS.length) % VIDEOS.length;
    const v = VIDEOS[activeIndex];
    if (player && typeof player.loadVideoById === 'function') {
      player.loadVideoById(v.id);
    }
    Array.from(thumbsList.children).forEach((node, idx) => {
      node.setAttribute('aria-current', idx === activeIndex ? 'true' : 'false');
    });
    // Scroll the active thumb into view
    thumbsList.children[activeIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    renderMeta();
    renderChapters();
  };

  /* ---- YouTube IFrame API boot ----------------------------------------- */
  // The API expects a global `onYouTubeIframeAPIReady` callback.
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(playerHost, {
      videoId: VIDEOS[activeIndex].id,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: () => {
          // Poll for chapter highlight — there is no native time-update event
          highlightTimer = window.setInterval(setActiveChapter, 500);
        },
        onStateChange: (e) => {
          // Re-sync immediately on play/seek
          if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED) {
            setActiveChapter();
          }
        },
      },
    });
  };

  // Inject the IFrame API script (idempotent — guards a global flag)
  if (!window.__ytApiInjected) {
    window.__ytApiInjected = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  /* ---- Thumbnail-strip prev/next --------------------------------------- */
  thumbsPrev.addEventListener('click', () => loadIndex(activeIndex - 1));
  thumbsNext.addEventListener('click', () => loadIndex(activeIndex + 1));

  // Initial render
  renderThumbs();
  renderMeta();
  renderChapters();

  /* =====================================================================
     Auto-Chapter Generator
     ----------------------------------------------------------------------
     - User pastes a YouTube URL + their YouTube Data API v3 key
     - We fetch the video's snippet+contentDetails, scan the description for
       timestamp lines like "0:00 Intro" / "12:34 Topic"
     - If no timestamps found, fall back to evenly-spaced chapters using the
       video's duration
     ===================================================================== */

  const genForm     = document.querySelector('[data-gen-form]');
  const genUrl      = document.querySelector('[data-gen-url]');
  const genKey      = document.querySelector('[data-gen-key]');
  const genStatus   = document.querySelector('[data-gen-status]');
  const genResults  = document.querySelector('[data-gen-results]');
  const genListEl   = document.querySelector('[data-gen-list]');
  const genCodeEl   = document.querySelector('[data-gen-code]');
  const genCopyBtn  = document.querySelector('[data-gen-copy]');
  const genUseBtn   = document.querySelector('[data-gen-use]');

  let lastGenerated = null;  // { id, chapters, source }

  const setStatus = (msg, kind = 'info') => {
    genStatus.className = `generator__status generator__status--${kind}`;
    genStatus.textContent = msg;
  };

  const TIMESTAMP_LINE = /(?:^|\n)\s*[\-•\*]?\s*((?:\d{1,2}:)?\d{1,2}:\d{1,2})\s+[\-–—:.)]?\s*(.+?)(?=\n|$)/g;

  const extractChaptersFromDescription = (desc) => {
    if (!desc) return [];
    const out = [];
    let m;
    TIMESTAMP_LINE.lastIndex = 0;
    while ((m = TIMESTAMP_LINE.exec(desc)) !== null) {
      const t = parseTimestamp(m[1]);
      const title = m[2].trim().replace(/[\-–—]+$/, '').trim();
      if (t !== null && title) out.push({ t, title });
    }
    // YouTube only treats descriptions as chapters when the first timestamp is 0
    // and times are strictly increasing — we'll be a bit more lenient here.
    if (out.length < 2) return [];
    // De-dupe and sort
    const seen = new Set();
    const cleaned = out
      .filter(c => { if (seen.has(c.t)) return false; seen.add(c.t); return true; })
      .sort((a, b) => a.t - b.t);
    return cleaned;
  };

  const evenSplit = (durationSec, parts = 6) => {
    const step = Math.max(15, Math.floor(durationSec / parts));
    const out = [];
    for (let i = 0; i < parts; i++) {
      const t = i * step;
      if (t >= durationSec) break;
      out.push({ t, title: `Part ${i + 1}` });
    }
    return out;
  };

  const formatChaptersAsCode = (videoId, chapters) => {
    const lines = chapters.map(c => `    { t: ${c.t}, title: ${JSON.stringify(c.title)} },`);
    return `// Paste into VIDEOS in task2.js\n{\n  id: ${JSON.stringify(videoId)},\n  title: 'Generated video',\n  chapters: [\n${lines.join('\n')}\n  ],\n}`;
  };

  const renderGeneratorResults = (videoId, chapters, source) => {
    lastGenerated = { id: videoId, chapters, source };
    genResults.classList.add('is-visible');
    genListEl.innerHTML = '';
    chapters.forEach((c) => {
      const li = document.createElement('li');
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = formatTime(c.t);
      const title = document.createElement('span');
      title.textContent = c.title;
      li.append(t, title);
      genListEl.appendChild(li);
    });
    genCodeEl.textContent = formatChaptersAsCode(videoId, chapters);
  };

  genForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = genUrl.value.trim();
    const key = genKey.value.trim();
    const id = parseVideoId(url);

    if (!id) {
      setStatus('Could not extract a video ID from that URL.', 'err');
      return;
    }
    if (!key) {
      setStatus('A YouTube Data API v3 key is required. See the link below the form.', 'err');
      return;
    }

    setStatus('Fetching video metadata…', 'info');
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${id}&key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (!res.ok) {
        const reason = data?.error?.message || `HTTP ${res.status}`;
        setStatus(`YouTube API error: ${reason}`, 'err');
        return;
      }
      const item = data.items && data.items[0];
      if (!item) {
        setStatus('No video found for that ID.', 'err');
        return;
      }
      const description = item.snippet?.description || '';
      const durationSec = parseIsoDuration(item.contentDetails?.duration || '');
      let chapters = extractChaptersFromDescription(description);
      let source;

      if (chapters.length >= 2) {
        source = 'description';
        setStatus(`Parsed ${chapters.length} chapter${chapters.length === 1 ? '' : 's'} from the video description.`, 'ok');
      } else if (durationSec > 0) {
        chapters = evenSplit(durationSec, 6);
        source = 'even-split';
        setStatus('No timestamps found in the description — generated an even split based on duration. Edit titles before using.', 'warn');
      } else {
        setStatus('No timestamps in description, and duration could not be determined.', 'err');
        return;
      }
      renderGeneratorResults(id, chapters, source);
    } catch (err) {
      setStatus(`Request failed: ${err.message}`, 'err');
    }
  });

  genCopyBtn.addEventListener('click', async () => {
    const text = genCodeEl.textContent;
    try {
      await navigator.clipboard.writeText(text);
      const original = genCopyBtn.textContent;
      genCopyBtn.textContent = 'Copied!';
      setTimeout(() => { genCopyBtn.textContent = original; }, 1400);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  });

  // "Use in player" — load the generated chapters into the live player
  genUseBtn.addEventListener('click', () => {
    if (!lastGenerated) return;
    const newEntry = {
      id: lastGenerated.id,
      title: 'Generated video',
      chapters: lastGenerated.chapters,
    };
    // Replace or insert: if the id already exists, swap chapters in place
    const existing = VIDEOS.findIndex(v => v.id === newEntry.id);
    if (existing >= 0) {
      VIDEOS[existing] = { ...VIDEOS[existing], chapters: newEntry.chapters };
      loadIndex(existing);
    } else {
      VIDEOS.push(newEntry);
      renderThumbs();
      loadIndex(VIDEOS.length - 1);
    }
    setStatus('Loaded chapters into the player above.', 'ok');
  });

  // Clean up the polling interval if the page is unloaded
  window.addEventListener('beforeunload', () => {
    if (highlightTimer) clearInterval(highlightTimer);
  });
})();
