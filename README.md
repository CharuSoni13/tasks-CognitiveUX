# Internship Assignment — 3-Task Demo Website

A single static website that delivers all three tasks from the brief using only **HTML, CSS, and vanilla JavaScript** — no frameworks, no UI kits, no JS libraries (the YouTube IFrame Player API is Google's own first-party script, the only allowed exception).

## Tasks

| # | Page | What it does |
|---|---|---|
| 1 | `task1.html` | Pixel-perfect replica of the ICICI noFee *Exclusive Privileges* carousel — auto-advance, swipe, keyboard, dot indicators, `prefers-reduced-motion` aware |
| 2 | `task2.html` | Carousel of 3 YouTube videos with live chapter highlighting + an auto-chapter generator that parses YouTube descriptions via the Data API v3 (with even-split fallback) |
| 3 | `task3.html` | Embedded video that surfaces a lead-capture form 6 seconds into playback. Focus trap, Esc-to-skip, `localStorage` persistence, debug submission table |

## Run locally

The site is fully static — no build step. Any static file server works:

```bash
# from the project root
python3 -m http.server 8000
# then open http://127.0.0.1:8000
```

> Opening the `.html` files directly via `file://` mostly works, but a real `http://` origin is recommended because the YouTube IFrame API and clipboard API behave better there.

## Deploy

The output is a flat directory of static files, ready for **GitHub Pages** or **Netlify** with zero config:

- **GitHub Pages:** push to a repo and enable Pages from the branch root.
- **Netlify:** drag-and-drop the project folder into the Netlify deploy UI, or connect the repo with no build command and the project root as the publish directory.

## File layout

```
.
├── index.html              ← landing + cross-task nav
├── task1.html              ← Exclusive Privileges replica
├── task2.html              ← Video chapters + auto-generator
├── task3.html              ← 6-second lead-capture form
├── PRD.md                  ← product spec (with locked-in decisions)
├── README.md
└── assets/
    ├── css/
    │   ├── global.css      ← reset, design tokens, shared nav/footer
    │   ├── task1.css
    │   ├── task2.css
    │   └── task3.css
    ├── js/
    │   ├── task1.js
    │   ├── task2.js
    │   └── task3.js
    ├── fonts/              ← drop @font-face files here when switching off CDN
    └── img/                ← reserved for future static assets
```

## Notes for reviewers

- **Fonts**: Loaded from Google Fonts (`Poppins`) for portability. To go fully self-hosted, download the Poppins woff2 files into `assets/fonts/` and replace the `<link>` tag with `@font-face` declarations — the CSS variable `--font-sans` is the single switchover point.
- **YouTube API key** *(Task 2 only)*: The auto-chapter generator accepts a user-pasted key at runtime. Nothing is committed to the repo and the key is never written to storage.
- **Form data** *(Task 3)*: There is no backend. Validated submissions are logged to the console and stored in `localStorage` under `t3:leads`. A debug table at the bottom of the page renders the saved entries; a "Reset" button clears them and resets the session flag so the 6-second trigger fires again.
- **Browsers**: Targets the latest Chrome, Safari, and Firefox.
- **Accessibility**: Skip link on every page, semantic landmarks, ARIA on the carousel and modal, focus trap + restore inside the lead form, `prefers-reduced-motion` short-circuits autoplay and transitions.

## Tradeoffs worth flagging

- **"Auto-detect suitable chapter points"** *(Task 2C)*: The brief asks for automatic chapter detection from a URL. True ML-based scene/audio detection requires a backend with video access, which YouTube does not allow third-party clients to download. The honest, pure-JS approach implemented here is to **parse chapters out of the video's description** via the YouTube Data API, falling back to an even split if none are present. This is documented inline in `assets/js/task2.js`.
- **Carousel approach** *(Task 1)*: Cards are absolutely positioned with a `data-pos` attribute set by JS, and CSS handles the visual states (`active`, `prev`, `next`, `far-prev`, `far-next`). Chosen over CSS scroll-snap because scroll-snap can't smoothly produce the "side cards scaled-down and dimmed" visual that the original section shows.
- **6-second timer** *(Task 3)*: Implemented as a 250 ms poll of `player.getCurrentTime()` because the YouTube IFrame API does not expose a native "time updated" event. The timer is naturally based on playback time, so pausing the video pauses the countdown — exactly the "smooth experience" the brief requires.
