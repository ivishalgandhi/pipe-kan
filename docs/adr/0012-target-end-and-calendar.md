# Target End is named and ISO; Calendar is a Board tab

jira-cli `issue list --raw` remashals through typed `IssueFields` and drops `customfield_*`, so Refresh never saw Target End Date. Open already uses `jira issue view KEY --raw` (ADR-0005), which keeps custom field values but not a `names` map (`GET /issue/{key}` has no `expand=names`). Refresh hydrates listed Issues from view-raw with bounded concurrency, resolves Target End by field name (exact "Target End Date", then "Target End" / "Target end", never Target Start) from `names` when present, otherwise from jira-cli config (`JIRA_CONFIG_FILE`, else `$XDG_CONFIG_HOME/.jira/.config.yml`, else `~/.config/.jira/.config.yml`), and persists the instance id locally like last-used chrome — never in git. System `duedate` is a different field. `Card.targetEnd` stores ISO `YYYY-MM-DD`; display formatting happens at render.

Calendar is a **view** of the same visible Cards, not a left-rail widget. The main canvas (`id="cards"`) has Board | Calendar tabs; last tab persists locally (`board-canvas-tab`). A sidebar Calendar control selects that tab. Events come from currently visible Cards for All stories, All epics, or Combined (after Search/Filter/Hide). Epic Cards on Combined keep `created` and `targetEnd`. Clicking an Issue key Opens `id="open"` via `open(key)` — not `window.open`, not the Agent Sidepanel. Official FullCalendar + dayGrid, read-only, no Premium, no date write-back.

## Status

Accepted

## Considered options

- **Left-rail mini month** — rejected. It treated Calendar as chrome beside openers instead of a view of the same Issues.
- **Calendar replaces openers** — rejected. All stories / All epics / Combined stay the issue set; Calendar follows whichever is selected.
- **FullCalendar Premium / scheduler / date write-back** — rejected. Read-only month of created and Target End is enough.
- **Greedy first date-shaped `customfield_*`** — rejected. Target Start and other pickers would win.

## Consequences

- Combined Epic Cards must copy `created` and `targetEnd` or the Combined calendar is empty for Epics.
- Field ids stay local; never commit a work-Jira custom field id, site URL, or token.
