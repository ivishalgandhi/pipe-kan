# Named Presets for Filter, Sort, and Hide

## Problem Statement

Last-used Filter, Sort, and Hide already persist (ADR-0006). There is no way to keep more than one chrome snapshot. Switching between “only High” and “no Done Column” means re-checking the header each time. Linear’s View is a named query; the user wants a named save next to Favourites, listed under a collapsible group, styled like that View list. Hide-individual-Cards and a Kanban of Epics were asked in the same breath; those are different products.

## Solution

A **Preset** is a named, local snapshot of Filter, Sort, and Hide. It is not Scope, Search, Favourite, Open, or Linear’s View (ADR-0008).

- **Save** (Presets `...`, name field) names the current last-used chrome. Names trim, reject empty, clash case-insensitively, same as Folders. No built-ins. Two names may hold the same chrome.
- **Apply** (click the name) copies that snapshot into last-used. Later Filter / Sort / Hide write last-used only. The named copy stays until Save over. No dirty/applied highlight.
- **Row `...`**: Save over, Rename, Delete.
- **Left pane**: collapsible **Presets** after Favourites, before Epics. Always shown, even empty. Default open. Collapse persists with Favourites (`Presets` key). Names are 28px Linear sidebar-nav rows; Epics stay 56px.
- **Does not change**: Scope, Refresh, Search, selected Epic. Search and Filter never hide Preset names.
- **Storage**: own `localStorage` key. Last-used and Favourites stay as they are.
- **Styling constraint**: the example [Linear View](https://linear.app/work-product/view/operations-reliability-sql-7dceaa1029ae) plus `docs/research/linear-ui.md` (28px nav items, radius 8, 2px stack, micro section label). Chrome only; do not copy Linear’s query-as-View. Official product docs for behaviour are listed under Linear sources.

## Linear sources

Primary sources (Linear docs, not third-party). Chrome and named-save behaviour come from these pages. Do not copy Linear’s product into pipe-kan.

| Linear | Doc | Take for Preset | Leave out |
| --- | --- | --- | --- |
| Custom Views | https://linear.app/docs/custom-views | Name the current Filter + display chrome; list those names in the sidebar; overflow on a name edits or deletes it; click a name opens that chrome. Linear: save a filtered board/list (`Option/Alt V` or Save view). | Sharing, workspace/team/project views, view owners, Slack/subscriptions, copy URL, one-off issue URLs, “Views” as a second Scope. Linear’s Save icon appears only after at least one filter; we still allow Save of empty chrome. |
| Filters | https://linear.app/docs/filters | Filter already hides Cards by property (`F` analog is the header Filter). A Preset snapshots that Filter. Linear: one or more filters refine a view; the list updates live. | Filters in the URL, Advanced AND/OR groups, AI filter, sharing a filtered URL. Our Filter is local chrome, not Scope. |
| Display options | https://linear.app/docs/display-options | Sort and Hide persist as personal chrome, like Linear’s “update for your view only” (leave the menu; it sticks). Linear: Display options order/group/layout; personal vs Set as default. | Board/list toggle (`Cmd/Ctrl B`), grouping/sub-grouping, workspace Set as default, card display-properties, Show empty groups. |
| Board layout | https://linear.app/docs/board-layout | Hide a Column from the column `...` (Linear: Hide from the column more menu). Linear: nearly all views can be board or list of the *same* issues. | Toggling the Board to a list, parked hidden columns at the far right, a Kanban whose Cards are Epics (ADR-0004). |
| Favorites | https://linear.app/docs/favorites | Sidebar list next to Favourites. Linear: favorite a custom view to pin it in the sidebar; folders organise a long list. | Starring a Preset. Favourites stay curated Epics (`CONTEXT.md`). Folders-of-Presets are out. |
| Sidebar views | https://linear.app/docs/joining-your-team-on-linear | Collapsible sidebar group of named views. Linear: Views under team/workspace; favorites above teams. | Workspace Views page, default team views (All Issues / Active / Backlog) as built-in Presets. |

Worked example (styling only): https://linear.app/work-product/view/operations-reliability-sql-7dceaa1029ae

Tokens and density: `docs/research/linear-ui.md` (sidebar nav 28px, radius 8, 2px stack, micro section label). Visual language only; do not ship Linear wordmark.

## User Stories

1. As a Board user, I want to Save the current Filter, Sort, and Hide under a name, so that I can get that chrome back later without re-checking the header.
2. As a Board user, I want Save to live on Presets `...` with a name field, so that the header stays Filter / Sort / Hide.
3. As a Board user, I want an empty name (after trim) rejected, so that a nameless snapshot is not a Preset.
4. As a Board user, I want a name that clashes case-insensitively rejected, so that `Now` and `now` are one name, same as Folders.
5. As a Board user, I want a clash to be an error, not a silent overwrite, so that Save over is deliberate.
6. As a Board user, I want two different names to hold the same chrome, so that uniqueness is the name, not the snapshot.
7. As a Board user, I want new names to append in create order, so that the list does not jump alphabetically.
8. As a Board user, I want no built-in names, so that Clear Filter / Sort / Hide stays the empty chrome and last-used stays unnamed.
9. As a Board user, I want the Presets group to stay when the list is empty, so that the first Save has a home.
10. As a Board user, I want to click a name to Apply that snapshot to last-used Filter, Sort, and Hide, so that the Board chrome matches the named copy.
11. As a Board user, I want later Filter / Sort / Hide to change last-used only, so that the named copy does not silently rewrite.
12. As a Board user, I want Apply to leave Search as it is, so that a session-only needle is not chrome.
13. As a Board user, I want Apply to leave the selected Epic as it is, so that a Preset is not a Favourite.
14. As a Board user, I want Apply to leave Scope and not Refresh, so that a Preset is not a second Scope.
15. As a Board user, I want no applied/dirty highlight on a name, so that a later Filter tweak does not lie about which Preset is live.
16. As a Board user, I want row `...` Save over to write last-used into that name, so that I can update a snapshot without deleting it.
17. As a Board user, I want row `...` Rename, so that I can change the label without changing the snapshot.
18. As a Board user, I want Rename to use the same uniqueness rule as Save, so that a clash is an error.
19. As a Board user, I want row `...` Delete, so that I can drop a name I no longer use.
20. As a Board user, I want Delete to leave last-used chrome as it is, so that removing a name does not Clear Filter.
21. As a Board user, I want Presets listed after Favourites and before the Epics heading, so that named chrome sits next to curated Epics, not inside them.
22. As a Board user, I want the Presets group to collapse and remember that, so that it matches Favourites.
23. As a Board user, I want Presets default open, so that the empty group with Save is visible on first visit.
24. As a Board user, I want Preset names as 28px sidebar-nav rows, so that a name is not an Epic.
25. As a Board user, I want Search and Filter to never hide Preset names, so that hide-row stays on Epics and Cards.
26. As a Board user, I want Presets on this machine only, so that there is no account and no Jira write for a name.
27. As a Board user, I do not want a Kanban whose Cards are Epics this cut, so that ADR-0004 stays.
28. As a Board user, I do not want Hide of individual Cards this cut, so that Filter and Hide Columns stay the hide verbs.

## Implementation Decisions

- Two later tickets, linear: Save + Apply (empty group, persist, click applies) then overwrite / rename / delete plus 28px / collapse.
- No new HTTP, jira-cli, or Board payload. Preset is local chrome.
- One test seam: Preset list functions, same shape as Folder functions (add / apply / overwrite / rename / delete). Follow addFolder / renameFolder / removeFolder.
- Shape: a list of `{ name, filter, sort, hide }`. Apply returns that chrome (or fail). Add appends. Overwrite replaces chrome for an existing name. Rename retitles. Delete drops the entry.
- Name rules copy Folders: trim, reject empty, clash case-insensitively, unique. Save of a new name that clashes is fail, not overwrite.
- Own `localStorage` key. Do not grow `board-chrome` or `favourite-epics`.
- Apply copies into the existing last-used chrome blob (ADR-0006). Last-used remains the live chrome.
- Search, selected Epic, Scope, Refresh: untouched on Apply / Save / Delete.
- Left pane: Presets group after Favourites, before Epics. Always shown. Create `...` on the group (name + Save). Click name applies. Row `...` is ticket 2.
- Collapse: same Epic-status collapse blob as Favourites, key `Presets`, default open.
- Row height: 28px Linear sidebar-nav (`docs/research/linear-ui.md` section 6.2). Epic rows stay 56px.
- No applied highlight. No built-in empty Preset. No auto-named last-used row.
- `...` chrome and localStorage wiring are not a test seam (same rule as Folder menus).

## Testing Decisions

- Test external behaviour of the Preset list functions, not dropdown markup or localStorage.
- Prior art: Folder uniqueness and create-order tests (addFolder rejects `now` after `Now`; rename clash; empty name fails).
- Add: Save appends; Apply returns that chrome; overwrite replaces chrome and keeps the name; rename uniqueness; delete leaves other names; empty / clash fail; apply of a missing name fails; two names may hold the same chrome.
- Do not add component tests for `...` menus, 28px rows, or collapse.
- Do not add HTTP tests. Preset is not App Refresh / Move.

## Out of Scope

- Scope flags, Refresh on Apply, or a second jira-cli list.
- Search or selected Epic inside a Preset.
- Hide individual Cards.
- A Kanban Board whose Cards are Epics.
- Shared / remote Presets (file, gist, Jira, account).
- Applied/dirty highlight or Linear unsaved-view.
- Built-in names or auto-saving last-used as a row.
- Drag-reorder, Folders-of-Presets, header picker.
- New Filter facets.

## Further Notes

Glossary: **Preset** is the noun (`CONTEXT.md`). ADR-0008: local chrome, not Scope. ADR-0006: last-used stays the live blob. ADR-0004: Epics are not Cards.

Read Linear sources before implementing. Custom Views + Display options + Board layout + Favorites are the product pages; `docs/research/linear-ui.md` is the chrome recipe. The example View URL is styling only.

Implement each child ticket in a fresh window from that ticket, not from this spec thread.
