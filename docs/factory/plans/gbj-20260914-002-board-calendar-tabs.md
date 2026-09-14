# gbj-20260914-002 — Board | Calendar tabs

## Intent

Move Calendar from the left-rail mini month onto **Board | Calendar** tabs in the main canvas (`ResizablePanel id="cards"`). Sidebar **Calendar** selects that tab. Events are the currently visible Cards for All stories / All epics / Combined. Click Opens `id="open"`. Independent UI reviewer after PQC.

## Research (from job card; not re-run)

- Jira Calendar is a **view** of the same issues, not a left-rail widget (Atlassian learning).
- BuJo `e5-ui-review`: maker ≠ checker; must-fail; file:line; screenshots.
- Sonnet for iteration once layout is locked; Claude for dense B2B chrome.
- On-disk: `BoardCalendar` `contentHeight={220}` in the left nav; Combined opener exists; `combinedBoard` drops Epic `created` / `targetEnd`; Open pane `id="open"` already right of cards.
- Target End hydration (view-raw, jira-cli config, field-map) is done — do not rewrite `src/app.ts` / `src/app-api.test.ts`.

## Plan

1. **Tabs.** Replace header `<strong>Board</strong>` with Board | Calendar (`role="tablist"`). Persist last tab locally (`board-canvas-tab`, Filter-chrome class). Default Board. Calendar month fills `id="cards"`.
2. **Sidebar.** Calendar is a nav control like Combined: selects the Calendar tab. Remove the 220px left-rail FullCalendar.
3. **Events.** `calendarEvents(Object.values(visible).flat())` — after Search/Filter/Hide. Copy Epic `created` + `targetEnd` in `combinedBoard` (All epics already keeps them via `epicsToColumns`).
4. **Click.** Issue key is a real control; `onOpen(key)` → existing `open(key)`. No `window.open`. Not the Agent panel.
5. **Docs.** CONTEXT Calendar + Combined. Amend ADR-0012 (surface is tabs, not sidebar). Add `docs/factory/prompts/ui-review.md` (BuJo e5 shape). Do not run the UI reviewer.

## Tests

- Tab persistence; sidebar Calendar writes the Calendar tab.
- Stories vs epics vs combined event sets; due-date / Target Start decoy ignored (`targetEnd` only).
- Epic `created` / `targetEnd` survive `combinedBoard`.
- Click helper returns the Issue key for Open.
