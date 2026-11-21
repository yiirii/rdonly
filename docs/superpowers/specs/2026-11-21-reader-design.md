# Library / Reader App — Design

App name: **Rd Only** (repo `rdonly`).
Status: draft for approval · 2026-11-21

---

## 1. Why this exists

Justin reads novels (EPUB), manga, webtoons, comics and PDFs on a Windows laptop and an iPhone. Apple Books is the current tool and it falls short in three ways:

1. **It "removes" books**, forcing re-downloads.
2. **It reads manga badly.**
3. **Its themes are boring** — too few page/font variants, and the app itself has no character.

Success = one calm, beautiful library that never silently loses a book or your place in it, opens every format in the right mode automatically, and syncs progress/highlights between laptop and phone, offline-first.

## 2. Goals, non-goals, anti-goals

**Goals (v1)**
- Formats: EPUB, PDF, CBZ, CBR, CB7, folders of images.
- Reading **modes** chosen by the book's **type tag**, overridable per book.
- A wide range of eye-friendly reading themes and book fonts.
- Library with **series stacks + user collections**, search, sort.
- Bookmarks, highlights, notes — synced.
- Wins: finishing a book/volume, daily reading goal + streak, stats page.
- Sync of everything except the book files themselves (see §4).

**Non-goals (v1)**
- Storing book files in the cloud (chosen: option B — import on each device).
- MOBI/AZW3, TXT, DRM-protected books, dictionary, in-book search, text-to-speech, a store.
- Desktop auto-update (manual installers, as in the brief).

**Anti-goals — it fails if…**
- A book, its progress or its highlights ever disappear without the user being told and given a one-tap fix.
- Any reading theme is harsh on the eyes (pure white on pure black, glaring white pages, low-contrast grey-on-grey).
- Page turns or zoom stutter on the phone.
- Two devices disagree about stats/streaks after syncing.

## 3. Approaches considered (reader engine)

| Option | Trade-off | Decision |
|---|---|---|
| **foliate-js (EPUB) + pdf.js (PDF) + our own image viewer for comics/manga/webtoons** | Proven text layout; our animations, themes and comic modes stay fully custom | **Chosen** |
| Fully custom EPUB layout engine | Total pixel control, but weeks extra and many bugs on odd EPUBs | Rejected |
| epub.js + pdf.js | Widely used but less maintained; pagination stutters on phones | Rejected |

Comic archives are unpacked with **libarchive.js** (WebAssembly; handles ZIP/RAR/7z) so CBZ/CBR/CB7 all use one code path on both shells.

## 4. Platforms, stack, storage

Kept from the brief unchanged: Electron (main/preload/renderer) Windows .exe; same web app as an iPhone Home-Screen PWA on GitHub Pages; Vite + React + TS; Zustand; Framer Motion; custom SVG charts; Vitest; Playwright at 390×844 and laptop viewports.

**Adapted from the brief:**
- **Records storage adapter**: Electron file storage on desktop; **IndexedDB** (not localStorage) in the browser — localStorage's ~5 MB limit is too tight once highlights and covers pile up. Same runtime-selected adapter pattern.
- **Book files storage adapter** (new, separate):
  - Desktop: files in the app data folder, `books/{hash}.{ext}`.
  - Browser/iPhone: **Origin Private File System** (fast file storage built into Safari), falling back to IndexedDB blobs.
- **Keeping iPhone from deleting books** (the Apple Books problem):
  - On first launch the app calls `navigator.storage.persist()` to ask iOS to treat its storage as permanent. Home-Screen apps are also exempt from Safari's 7-day data clearing.
  - Settings → Storage shows: space used, and whether iOS granted persistence (with a warning if not).
  - If a file is lost anyway, the book's record, cover, progress and highlights survive (they're synced). The card shows **"File missing — tap to re-import"**; re-importing the same file relinks everything (§5.1).

## 5. Data model & sync

Sync follows the brief exactly: records at `users/{uid}/{collection}/{id}`, each with `updatedAt` and optional `deleted` tombstone; local copy is the working copy; offline queue persisted locally; live remote stream merged per record; newest `updatedAt` wins; first sync merges record by record; Firestore rules restrict `users/{uid}/**` to that uid; email+password auth only.

### 5.1 Book identity
A book's id is the **SHA-256 hash of its file contents**. The same file imported on laptop and phone is automatically the same book, so progress and highlights line up with no manual matching. Importing a file whose hash already exists = "relink", never a duplicate.

### 5.2 Collections (Firestore)
| Collection | One record per | Key fields | Notes |
|---|---|---|---|
| `books` | book (id = hash) | title, author, series, volume, format, tag, modeOverride?, coverThumb (small WebP, ≤ ~40 KB), fileSize, addedAt | Cover thumb syncs so a book imported on the laptop shows on the phone as "Not on this device" |
| `progress` | book | locator (EPUB CFI / page index / scroll offset), percent, updatedAt | Separate from `books` so frequent saves don't clash with metadata edits. Saved on page-turn, debounced (~15 s) and on close, to stay well inside Spark's 20k writes/day |
| `annotations` | highlight / note / bookmark | bookId, kind, locator, text, note, colour | Each its own record → no list conflicts |
| `collections` | user collection | name, sortOrder | |
| `collectionItems` | (collection, book) pair | collectionId, bookId | Membership as records, so adding on two devices never clobbers |
| `readingSessions` | reading session | bookId, start, durationSec, pagesTurned, deviceId | **Append-only log** — stats and streaks derive from it |
| `finishes` | "finished" event | bookId, at, reversed? | **Append-only**; "mark unfinished" = new compensating entry + `reversed` flag that stays set |
| `dailyGoals` | date | id = `YYYY-MM-DD`, goalMinutes | Keyed by date → idempotent |
| `settings` | setting | key, value | Only synced keys (below) |

Streaks and the daily goal ring are **computed** from `readingSessions` + `dailyGoals`, never stored as counters, so two devices always agree.

### 5.3 Settings
**Synced:** reading theme, font, line spacing, margins, justification, app theme, default mode per tag, daily goal, sound on/off.
**Local-only (explicit list, never synced):** page-turn style (chosen per device, as requested), font size (screens differ), haptics, window size/position, storage location, last-opened tab, device id.

### 5.4 Settings → Account & Sync
Signed-in state, email, last sync time, "offline: N changes waiting", Sign out (keeps local copy). Safety nets: automatic local backups of records, and export/import of all records to one file (book files are not included — they're the user's originals).

## 6. Library

- **Home**: Continue Reading row (most recent progress), then the grid.
- **Series stacks**: books sharing a series collapse into one stacked card showing volume count and series progress; tap to expand. Series/volume are guessed from metadata (EPUB `belongs-to-collection`, ComicInfo.xml `Series`/`Number`) or filenames like `One Piece v03.cbz`, and editable.
- **Collections**: user-made (e.g. Favourites); a book can be in many.
- Search (title/author/series), sort (recent, title, added, progress), filter by tag.
- Ghost cards for books "Not on this device".
- **Import**: desktop — drag-and-drop, file dialog, or a whole folder; iPhone — Import button → Files picker, multi-select (Discord → Save to Files → Import). Duplicate detection by hash.

## 7. Tags → reading modes

| Tag | Default mode | Auto-assigned when |
|---|---|---|
| Novel | Flowing text (themes, fonts, chosen page-turn) | EPUB |
| Manga | Paged, right-to-left, spreads on laptop, zoom | ComicInfo.xml says manga / right-to-left |
| Webtoon | Continuous vertical strip | Most pages are very tall (height ≥ ~2.5× width) |
| Comic | Paged, left-to-right, spreads on laptop, zoom | Other comic archives / image folders |
| Document | Fixed page, zoom, scroll | PDF |

The guess is shown on import with one-tap correction. Each tag's default mode is a setting; any single book can override its mode from the reader menu.

**Comic viewer details (custom):** pages preloaded ahead/behind; two-page spreads on wide screens with automatic single-page for wide/double pages and a cover-offset toggle; pinch / double-tap / wheel zoom and pan done purely with transforms; webtoon strip virtualised so only nearby images are in memory.

**Novel reader:** foliate-js renders; we inject theme CSS. Page-turn styles: **Slide** (default), **Fold** (a flat, hard-edged page-fold made of solid shapes — no gradient shading), **Scroll**. Tap zones + swipe on phone, arrow keys/wheel on laptop.

**Document (PDF):** pdf.js, fit-width/fit-page, zoom, page thumbnails.

## 8. Look & feel

From the brief, unchanged: dark by default, **flat colours only, no gradients**, depth from hard-edged solid shapes lit from above (keycap buttons with a solid lip, bead toggles, 1px light top edge on cards), colour only where it means something, transform/opacity-only animation, reduced-motion honoured, sound on key moments with subtle variation, haptics on iPhone, never weaken an animation for performance without asking.

**App:** minimalist, Discord-like flatness, with playful shape animations (cards that settle with a slight bounce, a stack that fans out when a series opens, geometric bursts on wins).

**Reading themes (v1, ~12):** each is a tuned paper/ink pair with contrast kept comfortable — e.g. Paper, Linen, Sepia, Parchment, Sage, Mist, Dusk, Slate, Night, Ink, OLED Black (soft grey text, never pure white), Ember (warm low-blue for late night). Every theme is checked for a comfortable contrast range in a unit test.

**Fonts (bundled, open-licence, work offline):** Literata, Lora, EB Garamond, Crimson Pro, Source Serif, Merriweather, Atkinson Hyperlegible, plus the book's own font. Controls: size, line spacing, margins, justification, hyphenation, with a live preview.

## 9. Wins

- **Finish a book/volume** → shape burst + sound + haptic; logged in `finishes`.
- **Daily goal** (default 20 min) → a flat ring fills as you read; closing it gives a smaller burst. **Streak** counts consecutive goal days.
- **Stats page** → custom SVG: minutes per day/week, books finished per month, time by tag, current/best streak.

## 10. Updates, testing, workflow

As in the brief: PWA self-updates on foreground + periodically, reloading only at a calm moment, with the service-worker version check bypassing cache; desktop updates by hand-delivered installer. TDD; unit + Playwright at both viewports with screenshots I actually look at; a smoke script that visits every screen and runs every main action, checking for errors, stuck overlays and invisible pages; frame-time measurement on an emulated, CPU-throttled phone, before/after any visual change.

Test fixtures: small generated EPUB, PDF, CBZ/CBR/CB7 (manga with ComicInfo, a tall webtoon) committed to the repo.

## 11. Build order (small, shippable increments)

1. **v0.1 Shell + library** — Electron + PWA shells, storage adapters, import EPUB/PDF/CBZ, covers, grid. Deployed to Pages; first installer.
2. **v0.2 Comic viewer** — manga/comic/webtoon modes, tags + auto-detect, CBR/CB7/folders.
3. **v0.3 Sync** — Firebase auth, records sync, offline queue, ghost cards, relink, Settings → Account & Sync. (Early, because it's the part that matters most.)
4. **v0.4 Novel reader + themes + fonts + page-turn styles.**
5. **v0.5 PDF mode.**
6. **v0.6 Series stacks, collections, search/sort.**
7. **v0.7 Bookmarks, highlights, notes.**
8. **v0.8 Wins** — finishes, daily goal, streak, stats.
9. **v0.9 Polish** — sound, haptics, persistence warnings, backups/export, performance pass.

## 12. Needed from Justin before v0.3

- A Firebase project (I'll walk you through creating it and pasting the web config).
- The GitHub repo name for Pages (I can create it if `gh` is signed in to your account).

## 13. Calls I made (check these)

- Records in IndexedDB in the browser instead of localStorage (size).
- Book id = file hash, so the same file relinks automatically.
- Font size and page-turn style are per device; everything else about reading appearance syncs.
- Webtoon auto-detect by page shape; manga by ComicInfo.xml.
- Progress saved debounced (~15 s) to respect free-tier write limits.
- Dictionary, in-book search, MOBI, TXT deferred past v1.
- App name "Rd Only", repo `rdonly`.
