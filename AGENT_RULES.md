# AGENT_RULES.md

## PROJECT MODE

This is a production IPTV / OTT / PWA application.

Primary goals:

1. Stability
2. Reliability
3. Minimal changes
4. Minimal token usage
5. Zero regressions

Never optimize for large-scale rewrites.

---

## TOKEN PROTECTION MODE

Treat token consumption as a limited resource.

Before any action:

1. Identify exact task.
2. Identify exact files.
3. Ignore everything else.

Never scan unrelated code.

Never perform repository-wide analysis unless explicitly requested.

---

## REPOSITORY ACCESS POLICY

**DEFAULT: DO NOT scan:**

- entire repository
- entire src
- entire app
- entire pages
- entire components

Only read files required for the task.

Maximum initial scope: **3–10 files**.

Expand only when necessary.

---

## MANDATORY WORKFLOW

**Step 1** — Determine affected files.

**Step 2** — Read only affected files.

**Step 3** — Identify root cause.

**Step 4** — Implement smallest possible fix.

**Step 5** — Validate modified area only.

Never jump directly to large refactors.

---

## AUDIT POLICY

When asked to audit:

Do NOT scan entire project.

First determine:

- affected feature
- affected modules
- affected components

Audit only those areas.

Return concise findings. Avoid long reports.

---

## FIX POLICY

Always prefer:

**small fix > medium refactor > large rewrite**

Never rewrite working systems.

Never rebuild existing functionality.

Never replace stable code without evidence.

---

## PLAYER RULES

Preserve:

- channel switching
- playback
- volume controls
- playback settings
- user preferences
- recovery logic

Never remove existing working features.

---

## UI RULES

Do not redesign unless requested.

Do not move components unnecessarily.

Do not create duplicate controls.

Do not create duplicate settings.

Fix only the requested issue.

---

## PWA RULES

Preserve:

- service worker
- cache
- offline support
- installation support

Never interrupt playback because of cache refresh.

---

## ERROR HANDLING

Never expose:

- stack traces
- browser internal errors
- raw HLS errors
- raw fetch errors

Prefer silent recovery.

Show user-friendly messages only.

---

## FILE MODIFICATION POLICY

Modify only files directly related to the issue.

Avoid touching:

- unrelated components
- unrelated hooks
- unrelated utilities
- unrelated styles

Minimize changed files.

---

## RESPONSE POLICY

Keep responses short.

Do not generate lengthy reports.

Do not explain obvious code.

Do not repeat findings.

Provide only:

- root cause
- fix
- validation result

---

## MODEL USAGE POLICY

For simple fixes: use Composer Fast.

For architecture decisions: use GPT-5.5 High.

For deep reasoning only: use Claude Thinking.

Do not use expensive reasoning models for routine fixes.

---

## PERFORMANCE POLICY

Priorities:

1. Stability
2. Correctness
3. Reliability
4. Performance
5. New features

Never sacrifice stability.

---

## COMMIT POLICY

One issue = one commit.

Examples:

- `fix(player): resolve playback interruption`
- `fix(hls): improve stream recovery`
- `fix(ui): resolve mobile layout issue`

Avoid giant commits.

---

## STRICT PROHIBITIONS

Never:

- analyze entire repository repeatedly
- perform repeated scans
- rewrite stable systems
- create placeholders
- create duplicate features
- generate unnecessary code
- generate unnecessary reports
- consume excessive tokens

Always use the smallest possible scope.

Always choose the least-change solution.

Always preserve working functionality.
