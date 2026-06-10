# UI Refactor Plan — ABO Sports TV

> **Scope:** Frontend only (`components/`, `app/`, `pages/`). No backend API routes, database schemas, or deployment configs.
>
> **Goal:** Premium Dribbble-style dark UI with golden accents, neon highlights, and glassmorphism overlays.
>
> **Execution:** Complete tasks in order. Each task is isolated and token-friendly.

---

## Design System Foundation

### Color Tokens

| Token | Usage | Suggested Value |
|-------|-------|-----------------|
| `bg-primary` | Page background | `#0A0E17` (charcoal/navy black) |
| `bg-secondary` | Cards, panels | `#111827` |
| `bg-elevated` | Hover states, modals | `#1A2234` |
| `accent-gold` | Active tabs, progress bar, CTAs | `#F5C518` / `#FFD700` |
| `accent-gold-glow` | Active tab border glow | `rgba(245, 197, 24, 0.5)` |
| `accent-cyan` | Borders, live highlights | `#00E5FF` / `#22D3EE` |
| `accent-neon` | Live badges, pulse effects | `#39FF14` |
| `live-red` | "LIVE NOW" badge | `#EF4444` |
| `text-primary` | Headings | `#F9FAFB` |
| `text-secondary` | Body, labels | `#9CA3AF` |
| `text-muted` | Timestamps, meta | `#6B7280` |
| `border-subtle` | Card borders | `rgba(0, 229, 255, 0.15)` |
| `glass-bg` | Glassmorphism panels | `rgba(17, 24, 39, 0.6)` |
| `glass-border` | Glass panel edges | `rgba(255, 255, 255, 0.08)` |

### Typography

| Role | Font | Weight | Size (mobile → desktop) |
|------|------|--------|-------------------------|
| Display / Logo | Inter or Poppins | 700 | 20px → 24px |
| H1 (page title) | Inter | 700 | 24px → 32px |
| H2 (section) | Inter | 600 | 18px → 22px |
| H3 (card title) | Inter | 600 | 16px → 18px |
| Body | Inter | 400 | 14px → 16px |
| Caption / Meta | Inter | 400 | 12px → 13px |
| Bengali fallback | Noto Sans Bengali | 400–600 | Same scale as body |

**Bengali support:** Load `Noto Sans Bengali` alongside Inter via `next/font/google`. Apply `font-bengali` utility class where Bengali content renders.

### Spacing & Radius

- Card radius: `rounded-2xl` (16px)
- Pill tabs: `rounded-full`
- Channel cards: `rounded-xl` (12px)
- Section gap: `gap-6` mobile, `gap-8` desktop
- Container max-width: `max-w-7xl mx-auto px-4`

### Effects

- **Golden glow (active tab):** `box-shadow: 0 0 12px rgba(245, 197, 24, 0.4), inset 0 0 0 1px #F5C518`
- **Glassmorphism:** `backdrop-blur-xl bg-glass-bg border border-glass-border`
- **Live pulse:** CSS `@keyframes pulse` on neon dot + red badge
- **Neon border:** `border border-accent-cyan/30` with optional `shadow-[0_0_8px_rgba(0,229,255,0.2)]`

---

## Architecture Overview

```
app/
├── layout.tsx              ← Global shell: fonts, dark bg, nav wrappers
├── page.tsx                ← Home: hero player + category tabs + channel grid
├── live/page.tsx           ← Live streams listing
├── sports/page.tsx         ← Match calendar + match cards
├── match/[id]/page.tsx     ← Pre-match: H2H, lineups, stats
└── profile/page.tsx        ← User profile

components/
├── layout/
│   ├── TopBar.tsx
│   ├── BottomNav.tsx (mobile)
│   └── SidebarNav.tsx (desktop, optional)
├── ui/                     ← Primitives (shadcn-style or custom)
│   ├── Button.tsx
│   ├── Badge.tsx
│   ├── PillTab.tsx
│   ├── GlassPanel.tsx
│   └── ScrollArea.tsx
├── player/
│   ├── HeroVideoPlayer.tsx
│   ├── VideoControls.tsx
│   └── LiveStatsOverlay.tsx
├── channels/
│   └── ChannelGrid.tsx
├── matches/
│   ├── MatchCalendar.tsx
│   ├── MatchCard.tsx
│   ├── HeadToHead.tsx
│   └── LineupList.tsx
└── home/
    └── CategoryTabs.tsx
```

---

## Task Breakdown

### Task 1: Setup Colors & Typography
**Files:** `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`

**Steps:**
1. Extend Tailwind theme with all color tokens from the table above.
2. Add CSS custom properties in `globals.css` for glass effects and glow utilities.
3. Configure `next/font/google` for Inter (and optionally Poppins) + Noto Sans Bengali.
4. Set `html` / `body` to dark background (`bg-primary`), antialiased text, and default `text-primary`.
5. Add utility classes: `.glow-gold`, `.glass-panel`, `.neon-border`, `.live-pulse`.

**Acceptance criteria:**
- [ ] Dark charcoal page background renders on all routes
- [ ] Bengali text renders correctly with Noto Sans Bengali
- [ ] Golden and cyan accent utilities available as Tailwind classes

---

### Task 2: Create Base UI Primitives
**Files:** `components/ui/Button.tsx`, `Badge.tsx`, `PillTab.tsx`, `GlassPanel.tsx`, `ScrollArea.tsx`

**Steps:**
1. **Button** — Variants: `primary` (gold fill), `outline` (cyan border), `ghost`, `reminder` (gold outline + icon).
2. **Badge** — Variants: `live` (red + pulse dot), `upcoming`, `neutral`.
3. **PillTab** — Horizontal pill with inactive (`bg-elevated text-secondary`) and active (`glow-gold border-accent-gold text-accent-gold`) states.
4. **GlassPanel** — Reusable frosted container with `backdrop-blur-xl`, semi-transparent bg, subtle border.
5. **ScrollArea** — Horizontal scroll wrapper for pill tabs (hide scrollbar, snap scroll).

**Acceptance criteria:**
- [ ] All primitives match dark theme and use design tokens only
- [ ] PillTab active state shows golden glow
- [ ] GlassPanel renders frosted effect over dark backgrounds

---

### Task 3: Build Top Bar Navigation
**Files:** `components/layout/TopBar.tsx`

**Steps:**
1. Fixed/sticky top bar with `bg-secondary/80 backdrop-blur-md border-b border-border-subtle`.
2. Left: "ABO SPORTS TV" logo/wordmark in gold or white with bold typography.
3. Center (desktop): optional search input with icon, dark elevated style.
4. Right: search icon (mobile), profile avatar/icon button.
5. Height: ~56px mobile, ~64px desktop.

**Acceptance criteria:**
- [ ] Logo visible and branded
- [ ] Search and profile icons functional (wire to existing routes/handlers)
- [ ] Bar stays fixed on scroll without layout shift

---

### Task 4: Build Bottom / Sidebar Navigation
**Files:** `components/layout/BottomNav.tsx`, `components/layout/SidebarNav.tsx`

**Steps:**
1. **BottomNav (mobile/tablet):** Fixed bottom bar with 4 items — Home, Sports, Live, Profile.
2. Icons: Lucide or similar (Home, Calendar, Radio/Live, User).
3. Active item: gold icon + gold label; inactive: muted gray.
4. **SidebarNav (desktop ≥1024px):** Collapsible left sidebar, same 4 routes, optional expand on hover.
5. Integrate into `app/layout.tsx` — show BottomNav on mobile, Sidebar on desktop.

**Acceptance criteria:**
- [ ] All 4 nav items route correctly
- [ ] Active route highlighted in gold
- [ ] Safe-area padding for mobile notches

---

### Task 5: Build Category Tabs (Horizontal Pills)
**Files:** `components/home/CategoryTabs.tsx`

**Steps:**
1. Horizontal scrollable row of pill tabs: Global Sports, Bangladesh, India, World Cup, etc.
2. Use `PillTab` primitive from Task 2.
3. State: controlled `activeCategory` prop or internal state with `onChange` callback.
4. Snap scroll on mobile; fade edge indicators optional.
5. Pass selected category up to parent for filtering channel grid.

**Acceptance criteria:**
- [ ] Tabs scroll horizontally on narrow screens
- [ ] Active tab has golden glow border
- [ ] Category change triggers parent filter (no API changes)

---

### Task 6: Build Hero Video Player
**Files:** `components/player/HeroVideoPlayer.tsx`, `components/player/VideoControls.tsx`

**Steps:**
1. Large card container: `rounded-2xl overflow-hidden border border-border-subtle aspect-video`.
2. Video element (or placeholder) filling container.
3. **LIVE NOW badge:** top-left red badge with pulse dot (use `Badge` variant `live`).
4. **Custom controls overlay (bottom):**
   - Play/pause, volume, fullscreen icons
   - Progress bar: track dark gray, fill/thumb gold (`accent-gold`)
   - Time elapsed / duration labels
5. Controls fade in on hover/tap, auto-hide after 3s during playback.
6. Accept `src`, `poster`, `isLive` props from existing page data.

**Acceptance criteria:**
- [ ] Prominent hero player at top of home page
- [ ] Red LIVE NOW badge visible when `isLive={true}`
- [ ] Yellow/gold progress bar on custom controls
- [ ] No changes to video source logic or API calls

---

### Task 7: Build Live Stats Overlay (Glassmorphism)
**Files:** `components/player/LiveStatsOverlay.tsx`

**Steps:**
1. Absolutely positioned over hero player (corners or side panels).
2. Use `GlassPanel` for each stat block.
3. Content blocks (data from existing props):
   - **Score panel:** Team A vs Team B, current score, overs/period
   - **Player stats:** batsman/bowler name, runs, strike rate, etc.
   - **Match info:** venue, format, series name
4. Semi-transparent with `backdrop-blur-xl`; text white with cyan accents for numbers.
5. Responsive: stack panels on mobile, side-by-side on desktop.
6. Toggle visibility via prop or minimal overlay button.

**Acceptance criteria:**
- [ ] Frosted glass effect visible over video
- [ ] Stats readable without obscuring entire video
- [ ] Layout adapts mobile ↔ desktop

---

### Task 8: Build Channel Grid
**Files:** `components/channels/ChannelGrid.tsx`, `components/channels/ChannelCard.tsx`

**Steps:**
1. Responsive grid: 2 cols mobile, 3 tablet, 4–5 desktop.
2. **ChannelCard:**
   - `rounded-xl border border-border-subtle bg-secondary`
   - Channel logo (centered, `object-contain`)
   - Channel name below logo
   - Hover: subtle cyan glow border + `scale-[1.02]` transition
   - Active/selected state: gold border glow
3. Accept `channels[]` prop with `id`, `name`, `logoUrl`, `slug`.
4. Click navigates to stream (existing route/link — no API changes).

**Acceptance criteria:**
- [ ] Grid displays Star Sports, GTV, Willow-style cards
- [ ] Cards have rounded corners and subtle borders
- [ ] Hover and selected states use cyan/gold highlights

---

### Task 9: Compose Home Page Layout
**Files:** `app/page.tsx` (or equivalent home route)

**Steps:**
1. Wire layout order:
   1. HeroVideoPlayer (with LiveStatsOverlay)
   2. CategoryTabs
   3. ChannelGrid (filtered by active category)
2. Pull existing data hooks/props — swap JSX only, keep data fetching intact.
3. Add section headings with clear typography hierarchy.
4. Spacing between sections per design system.

**Acceptance criteria:**
- [ ] Home page matches visual hierarchy: player → tabs → grid
- [ ] Existing data still loads (no API modifications)
- [ ] Page responsive on mobile and desktop

---

### Task 10: Build Match Calendar
**Files:** `components/matches/MatchCalendar.tsx`

**Steps:**
1. Horizontal week strip or mini-month calendar UI.
2. Dark elevated container with cyan accent on selected date.
3. Selected date: gold circle/ring highlight.
4. Props: `selectedDate`, `onDateSelect`, `datesWithMatches[]` (dot indicators).
5. Navigation arrows for prev/next week or month.
6. Bengali locale support for day/month labels where applicable.

**Acceptance criteria:**
- [ ] User can select a date
- [ ] Dates with matches show indicator dot
- [ ] Selected date uses gold highlight

---

### Task 11: Build Match Preview Cards
**Files:** `components/matches/MatchCard.tsx`

**Steps:**
1. Card layout:
   - Row 1: Team A flag + name **vs** Team B flag + name
   - Row 2: Match time, format (T20/ODI), stadium name
   - Row 3: **Set Reminder** button (gold outline, bell icon)
2. Styling: `bg-secondary rounded-2xl border border-border-subtle p-4`.
3. Live matches: optional red "LIVE" badge on card corner.
4. Props: `match` object from existing sports page data.

**Acceptance criteria:**
- [ ] Cards show teams, flags, time, stadium
- [ ] Set Reminder button prominent and styled
- [ ] Cards stack vertically below calendar on sports page

---

### Task 12: Compose Sports / Calendar Page
**Files:** `app/sports/page.tsx` (or equivalent)

**Steps:**
1. Page title: "Matches" or "Sports Calendar".
2. MatchCalendar at top.
3. MatchCard list filtered by selected date.
4. Empty state: glass panel with "No matches on this date".
5. Keep existing data fetching; only replace presentation layer.

**Acceptance criteria:**
- [ ] Calendar + match cards work together
- [ ] Date selection filters visible matches
- [ ] No backend or API route changes

---

### Task 13: Build Head-to-Head Component
**Files:** `components/matches/HeadToHead.tsx`

**Steps:**
1. Two-column team header: logos, names, home/away labels.
2. **Last 5 matches** row per team: W-L-D pills (W=green, L=red, D=gray).
3. **Stadium block:** name, city, capacity with icon.
4. **H2H summary:** total meetings, wins per team (optional bar chart).
5. All inside elevated cards with section headings (H2 typography).

**Acceptance criteria:**
- [ ] Team logos and last-5 form visible
- [ ] Stadium capacity displayed
- [ ] Clear visual separation between teams

---

### Task 14: Build Lineup List Component
**Files:** `components/matches/LineupList.tsx`

**Steps:**
1. Two columns (Team A | Team B) on desktop; stacked on mobile.
2. Each column:
   - Section: Starting XI, Substitutes (if applicable)
   - Player row: jersey number, name, role icon (bat/bowl/keeper)
3. Captain/keeper badges in gold/cyan.
4. Dark card background with subtle row dividers.

**Acceptance criteria:**
- [ ] Full starting lineups readable
- [ ] Captain and wicket-keeper clearly marked
- [ ] Responsive two-column → single-column layout

---

### Task 15: Compose Pre-Match Detail Page
**Files:** `app/match/[id]/page.tsx` (or equivalent)

**Steps:**
1. Page structure:
   - Match header (teams, time, venue)
   - HeadToHead section
   - LineupList section
   - Optional: Set Reminder CTA sticky at bottom on mobile
2. Use existing match detail data — presentation only.
3. Breadcrumb or back link to Sports page.

**Acceptance criteria:**
- [ ] Pre-match view shows H2H + lineups
- [ ] Typography hierarchy clear across sections
- [ ] Mobile-friendly with sticky reminder CTA

---

### Task 16: Build Live Page
**Files:** `app/live/page.tsx`

**Steps:**
1. Reuse HeroVideoPlayer for featured live stream.
2. Below: grid or list of currently live channels/matches.
3. Live items use red badge + neon border accent.
4. Reuse ChannelCard or MatchCard with `isLive` variant.

**Acceptance criteria:**
- [ ] Live page highlights active streams
- [ ] Consistent with home player styling
- [ ] Live indicators use red/neon treatment

---

### Task 17: Build Profile Page Shell
**Files:** `app/profile/page.tsx`

**Steps:**
1. Profile header: avatar, username, member since.
2. Settings list: reminders, preferences, language (Bengali toggle if applicable).
3. Dark card sections with icon + label rows.
4. Logout/sign-out button styled as outline variant.

**Acceptance criteria:**
- [ ] Profile page matches global dark theme
- [ ] Navigation back to home works
- [ ] No auth/API logic changes

---

### Task 18: Polish, Motion & Accessibility
**Files:** `app/globals.css`, assorted components

**Steps:**
1. Add subtle `transition-all duration-200` on interactive elements.
2. Focus rings: gold outline for keyboard navigation (`focus-visible:ring-2 ring-accent-gold`).
3. `prefers-reduced-motion`: disable pulse/glow animations.
4. ARIA labels on icon-only buttons (search, profile, nav).
5. Color contrast check: body text ≥ 4.5:1 on dark backgrounds.
6. Test Bengali content in match names, channel names, UI labels.

**Acceptance criteria:**
- [ ] Keyboard navigable
- [ ] Reduced motion respected
- [ ] Bengali and English text both render cleanly

---

## Suggested Execution Order

| Phase | Tasks | Rationale |
|-------|-------|-----------|
| **Foundation** | 1 → 2 | Tokens and primitives first |
| **Shell** | 3 → 4 | Global navigation before page content |
| **Home** | 5 → 6 → 7 → 8 → 9 | Core streaming experience |
| **Sports** | 10 → 11 → 12 | Calendar and match previews |
| **Detail** | 13 → 14 → 15 | Pre-match deep dive |
| **Secondary pages** | 16 → 17 | Live and Profile |
| **QA** | 18 | Polish and a11y |

---

## Constraints Reminder

- ✅ Modify: `components/`, `app/`, `pages/`, `globals.css`, `tailwind.config.ts`
- ❌ Do NOT modify: API routes, `lib/db`, Prisma/schema, `render.yaml`, Vercel config, env secrets
- ✅ Reuse existing data hooks, props, and fetch calls — change JSX/styling only
- ✅ Deploy via existing GitHub → Vercel CI/CD (no config edits needed)

---

## How to Proceed

Reply with the task number to implement, e.g.:

> **"Execute Task 1"**

Each task is self-contained. Dependencies are noted above; complete foundation tasks before dependent ones.
