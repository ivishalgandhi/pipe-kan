# Epic Filter, children cache, and Move

## Problem Statement

The left pane lists Epics and Favourites. Filter already hides Cards, but the Epic rows ignore it: pick Labels, Priority, or Assignee and the Board shrinks while every Epic stays. Search on an Epic is only key and summary. The payload already has Epic labels (`kanban` on DEMO-1); mapping drops them, so a Labels Filter cannot see the Epic as an Issue.

The number on an Epic row is Scope Cards with that key. Children outside Scope are missing until the user clicks a row that shows 0 and `/api/epic` runs. The user wants that number — and Filter hide-row — at load, without selecting.

There is no way to Move an Epic. Cards Move by dropping on a Column (`jira issue move`). Epics are not Cards (ADR-0004). Favourite `...` files a Favourite into a Folder; its label already says Move, which is the wrong verb. The user wants a row menu that Moves the Epic Issue (Proposed → In Development, or whatever statuses the listed Epics occupy).

## Solution

Three slices, in this order:

1. Keep labels on the Epic. Search matches key, summary, labels, or a child. Filter still hides Cards. An Epic row stays when the Epic's own field matches or a remaining child matches. Labels, Priority, and Stories-assignee facets are the union of Card values and listed Epic values. Favourites and Folders use the same hide-row rule; an empty Folder stays. Filter that hides the selected row does not clear selection.

2. Cache every non-Epic child of the listed Epics. The row number is that set (after Search and Filter). Refresh fills the cache with one batched `parent` / Epic Link list. Fixture and the store adapter fill it at hydrate. A Pipe stays Scope-only until Refresh. The Board stays Scope. Select stamps missing children from the cache (no second jira-cli call). If the children call fails, the Board stays, counts fall back to Scope Cards, and the error banner shows. ADR-0007.

3. `...` on every Epic row Moves the Epic. Destinations are occupied Epic statuses from the full `-tEpic` list (Search and Filter hide rows, not destinations). Current status is omitted. Favourite `...` keeps Folder items and puts statuses under a Move submenu. Status-group `...` is just statuses. Hide `...` or the submenu when empty. Same Write-back as a Card: wait for `jira issue move` and Refresh, no optimistic jump, children do not Move, collapse stays put. Fixture gains a second Epic in Done so the local menu is not empty. Folder filing stops using the word Move.

## User Stories

1. As a Board user, I want Filter to hide Epic rows that have no remaining children and whose own fields do not match, so that the left pane agrees with the Board.
2. As a Board user, I want an Epic row to stay when a remaining child matches Filter, so that a parent of visible Cards does not disappear.
3. As a Board user, I want an Epic row to stay when the Epic's own labels match Labels Filter, so that an Epic labeled `kanban` stays even if no child is labeled `kanban`.
4. As a Board user, I want an Epic row to stay when the Epic's own priority matches Priority Filter, so that a High Epic stays even if every child is Low.
5. As a Board user, I want an Epic row to stay when the Epic's own assignee matches Stories assignee Filter, so that the Epic is treated as an Issue with a person.
6. As a Board user, I want `epicAssignee` Filter to hide an Epic whose assignee is not selected and that has no remaining children, so that Epic-assignee and hide-row are one rule.
7. As a Board user, I want an Epic with no children in Scope yet to stay when Filter is on, so that I can still click it and fetch children.
8. As a Board user, I want Search to match an Epic on key, summary, or labels, so that typing `kanban` finds DEMO-1 by its own label.
9. As a Board user, I want Search to keep an Epic that has a matching child, so that the existing Search rule still holds.
10. As a Board user, I want the Labels facet to list labels from Cards and from listed Epics, so that an Epic-only label is pickable.
11. As a Board user, I want the Priority facet to list priorities from Cards and from listed Epics, so that an Epic-only priority is pickable.
12. As a Board user, I want the Stories-assignee facet to list people from Cards and from listed Epics, so that an Epic-only assignee is pickable.
13. As a Board user, I want Unassigned on people facets to still appear only when someone is unassigned, so that empty Boards do not invent Unassigned.
14. As a Board user, I want Favourites to hide under the same Filter and Search rule as status-group Epics, so that the pane is one rule.
15. As a Board user, I want an empty Folder to stay visible after Filter hides its Favourites, so that Folder is a local shelf, not a Filter result.
16. As a Board user, I want a Filter that hides the selected Epic's row to leave that Epic selected, so that a checkbox does not jump me to All stories.
17. As a Board user, I want the Board under a still-selected hidden Epic to keep showing that Epic's remaining children, so that I can finish looking.
18. As a Board user, I want All stories to be how I leave a hidden selection, so that leaving is deliberate.
19. As a Board user, I want the number on an Epic row to be every non-Epic child (Story, Bug, Task, and the rest), so that the count matches what click-to-fetch already pulls.
20. As a Board user, I want that number after Search and Filter, so that the painted count matches remaining children I can still see.
21. As a Board user, I want that number at first Fixture or store paint, so that I do not have to Refresh or click to see it locally.
22. As a Board user on real Jira, I want that number after the boot Refresh, so that I do not wait on click.
23. As a Board user who Piped a snapshot, I want first paint to count Scope Cards only, so that Pipe stays a snapshot until I Refresh.
24. As a Board user, I want Refresh to fill the children cache with one extra jira-cli list, so that N Epics do not become N processes.
25. As a Board user, I want the Board after Refresh to stay Scope, so that out-of-Scope children do not appear as Cards until I select their Epic.
26. As a Board user, I want clicking an Epic with no Scope children to stamp the cached children onto the Board, so that I do not wait on a second jira-cli call.
27. As a Board user, I want clicking an Epic that already has Scope children to keep today's skip, so that we do not re-fetch what is already on the Board.
28. As a Board user, I want a failed children call to keep the Board I already have, so that Refresh does not throw away a good Scope list.
29. As a Board user, I want a failed children call to fall counts back to Scope Cards and show the error banner, so that I know the number is thin.
30. As a Board user, I want `...` on every Epic row (Favourites and status groups), so that I can Move an Epic wherever it appears.
31. As a Board user, I want status-group `...` items to be occupied Epic statuses, so that I pick a destination the same way I drop a Card on a Column.
32. As a Board user, I want destinations taken from the full `-tEpic` list, so that Search and Filter hide rows but do not shrink the menu.
33. As a Board user, I want the Epic's current status omitted from the menu, so that same-status is not a destination.
34. As a Board user, I want status-group `...` hidden when there is nowhere to Move, so that a control that opens nothing is not noise.
35. As a Board user, I want Favourite `...` to keep Unfiled and Folder names, so that Folder filing still lives on that menu.
36. As a Board user, I want Favourite Move destinations in a Move submenu, so that Write-back is named Move and filing is not.
37. As a Board user, I want the Move submenu hidden when it would be empty, so that Favourite `...` still opens for Folders only.
38. As a Board user, I want Folder filing to stop using the word Move, so that Move means `jira issue move`.
39. As a Board user, I want picking a status to run `jira issue move` on that Epic key and Refresh, so that Write-back stays jira-cli.
40. As a Board user, I want to wait for that Write-back (busy as today), so that the row does not jump ahead of Jira.
41. As a Board user, I want an illegal Epic Move to keep the Epic where it was and show the existing error banner, so that failure matches Card Move.
42. As a Board user, I want a same-status Epic Move to be a noop, so that we do not shell jira-cli for nothing.
43. As a Board user, I want children to stay in their Columns when I Move the Epic, so that Epic status is not child status.
44. As a Board user, I want the Epic to appear in the destination status group after Refresh, so that the pane matches Jira.
45. As a Board user, I want a collapsed destination group to stay collapsed, so that Move does not surprise-open groups.
46. As a Board user, I want a Favourited Epic that I Moved to stay in Favourites, so that I can still see it if the destination group is collapsed.
47. As a Board user, I want the selected Epic to stay selected after Move if that key is still listed, so that I do not lose the Board I was looking at.
48. As a Fake Jira user, I want a second Fixture Epic in Done, so that DEMO-1 can Move somewhere locally.
49. As a Fake Jira user, I want Epic Move to use the existing To Do / In Progress / Done transitions, so that we do not invent a second workflow.
50. As a Board user on real Jira, I want Proposed, In Development, and any other occupied Epic status to appear when listed Epics occupy them, so that the menu is the real workflow.
51. As a Board user, I do not want a legal-transitions read this cut, so that the menu stays the occupied-status rule.
52. As a Board user, I do not want Proposed or In Development in Fake Jira this cut, so that local demo stays the existing graph.

## Implementation Decisions

- Three later tickets, linear: labels + Filter/Search self-or-child (Scope Cards as the children list) → children cache at hydrate/Refresh → Epic Move. Not one ticket.
- No new modules. Seams stay Board mapping, visibility, and App (hydrate / Refresh / children / Move).
- Epic mapping keeps labels the same way a Card does (labels plus components). Assignee and priority already survive; do not drop labels in the Epic face.
- Visibility hide-row: keep the Epic if its own field hits the active Filter or Search, or if any child in the children list remains after Filter and Search. An Epic with an empty children list stays under Filter (click still works).
- filterEpics, Favourites listing, facet builders, and the painted row count all take Filter plus a children list. Ticket 1 passes Scope Cards. Ticket 2 passes the cache.
- Facet union: Labels, Priority, and Stories assignee values are unique-sorted unions of Card values and listed Epic values. Unassigned still appears only when someone is unassigned (Card or Epic).
- Selection: applyBoard already keeps the selected key if it is still listed. Filter hide-row must not clear selection either.
- Children cache (ADR-0007): every non-Epic child of listed Epic keys. Refresh: one extra jira-cli list with the same JQL listEpic already uses, batched (`parent in (...)` OR `"Epic Link" in (...)`). Hydrate: Fixture and store adapter derive the cache from the in-process store. Pipe: no cache until Refresh.
- Board payload grows a children-by-Epic map so the pane can feed visibility. Columns stay Scope.
- `/api/epic` (select with zero Scope children) stamps from the cache. No second jira-cli call when the cache has that key. Today's skip when Scope already has children stays.
- Children-call failure: Refresh's Scope list stays; cache stays empty or last-good Scope Cards; error banner. Do not fail the whole Refresh. Do not fall back to N listEpic calls.
- Move destinations: unique statuses from the full listed Epic set, minus the row's current status, minus empty. Not Board Column titles. Not legal transitions.
- Favourite `...`: Folder items stay top-level; statuses live under a Move heading/submenu. Status-group `...`: statuses at the top level. Hide the control or the submenu when its Move list is empty.
- Folder filing aria-label and copy must not say Move.
- app.move same-status noop looks at Board Cards and listed Epics. Success still Refresh. Failure still 409 plus error banner. No optimistic Epic row.
- Fixture: add a second Epic in Done (no children required) so DEMO-1 has a destination. Fake Jira transitions stay To Do / In Progress / Done.
- `...` chrome is not a test seam (same rule as Folder menus).

## Testing Decisions

- Test external behaviour of the three existing seams, not dropdown markup or localStorage.
- Board mapping: an Epic in the `-tEpic` payload keeps labels; a Card still keeps labels. Follow existing Card-label tests.
- Visibility: follow existing Search-keeps-an-Epic and Filter-by-labels tests. Add: Search matches Epic labels; Filter self-or-child for labels, priority, and Stories assignee; hide-row when neither self nor child hits; empty children list stays under Filter; facet union includes Epic-only values; Favourites hide-row matches; empty Folder stays; row count is remaining children from the children list, not only Scope Cards.
- App: follow existing Refresh / children / Move HTTP tests. Add: hydrate (store) fills the children map; Refresh fills it from one batched list; Pipe hydrate has no cache; children-call failure keeps the Board and falls counts back; `/api/epic` stamps from cache without a second list; app.move on an Epic key noops same status, Refreshes on success, leaves children on the Board; Fixture's second Epic is listed in Done.
- Do not add component tests for `...` menus or collapse.

## Out of Scope

- A legal-transitions API or menu of only allowed statuses.
- Teaching Fake Jira Proposed / In Development or any second workflow.
- Moving children when the Epic Moves.
- Auto-expanding the destination Epic group.
- Merging cached children onto the Board at load (Scope leak).
- Changing Scope, Favourite, or Folder behaviour except hide-row and the Move submenu.
- Open, Sort, Hide, or new Filter facets.
- Persisting Filter-group collapse (already skipped).

## Further Notes

Glossary: Filter hides Cards and, now, Epic rows that neither self nor child match. Search matches Epic labels. Move is Write-back, including from an Epic row menu. File is putting a Favourite in a Folder — never Move. The children cache is not Scope (ADR-0007).

Implement each child ticket in a fresh window from that ticket, not from this spec thread.
