# Command overlay for jumping on this Board

## Problem Statement

Header **Search** only hides Epics and Cards already on this Board. It cannot switch **All stories** and **All epics**, cannot **Open**, cannot **Refresh**, cannot open the **Agent**, and cannot **Apply** a **Preset**. Typing an Epic key on **All stories** does not put that Epic on the Columns: the Epic is a left-pane row. Jumping with the mouse across the pane, header, and Agent is slow. Focusing Search on Cmd/Ctrl+K would look like Linear and still fail those jumps. Fetching a missing key from Jira would be a second **Scope**.

## Solution

A **Command** overlay (Cmd/Ctrl+K) jumps using the in-memory Board: listed **Epics** and **Scope** **Cards** (the **Pipe** or last **Refresh**). It is not **Search**, not **Scope**, and not a live jira-cli lookup (ADR-0011).

- **Open**: Cmd/Ctrl+K toggles the overlay. It always steals focus from **Search**, Scope flags, and the Agent composer. Escape closes it and returns focus. `/` is not a shortcut.
- **Empty query**: **Actions** only (**All stories**, **All epics**, **Refresh**, **Agent**, each **Preset** as Apply {name}).
- **Type**: matching **Epics** and **Cards** appear under those groups. Actions stay, filtered by substring on the row label.
- **Pick**:
  - **Card** → **All stories**, clear selected Epic, **Open**, clear **Search**.
  - **Epic** or **Favourite** (starred Epic row) → **All epics**, **Open**, clear **Search**.
  - **All stories** / **All epics** / **Refresh** / **Agent** / Apply {Preset} → that existing action, clear **Search**.
- **Filter** and **Hide** stay (ADR-0006). **Open** still works if the Card is off a Column.
- **Miss**: empty list. No fetch.
- **Cap**: 8 Epics and 8 Cards, payload order. Actions never cap.

## User Stories

1. As a Board user, I want Cmd/Ctrl+K to open **Command**, so that I can jump without reaching for the mouse.
2. As a Board user, I want Cmd/Ctrl+K while **Command** is open to close it, so that the same chord toggles.
3. As a Board user, I want Cmd/Ctrl+K while **Search** is focused to open **Command** instead of typing into **Search**, so that the shortcut is not swallowed by the header.
4. As a Board user, I want Cmd/Ctrl+K while Scope flags are focused to open **Command**, so that the flags box does not steal the chord.
5. As a Board user, I want Cmd/Ctrl+K while the **Agent** composer is focused to open **Command**, so that the composer does not eat the chord or send a message.
6. As a Board user, I want Cmd/Ctrl+K to `preventDefault` while this page is focused, so that Chrome's omnibox does not take the key.
7. As a Board user, I want Escape to close **Command**, so that I can leave without picking a row.
8. As a Board user, I want Escape to restore focus to the control that had it, so that I return to **Search**, Scope flags, or the composer.
9. As a Board user, I do not want `/` to open **Command**, so that a slash still types into **Search**.
10. As a Board user, I want **Command** to be an overlay, so that header **Search** stays a hide box.
11. As a Board user, I want an empty **Command** query to list **Actions** only, so that Cmd+K is not a second Board of every **Scope** Card.
12. As a Board user, I want the **Actions** rows to be **All stories**, **All epics**, **Refresh**, **Agent**, then each **Preset** as Apply {name} in create order, so that jump targets match the chrome I already have.
13. As a Board user, I want no **Favourites** action row, so that a Favourite is not listed twice (it is an **Epic**).
14. As a Board user, I want no Create and no **Move** rows, so that **Command** is a jump, not Write-back.
15. As a Board user, I want typing to add matching **Epics** then matching **Cards** under group headings, so that I can jump to an Issue without scanning the Board.
16. As a Board user, I want **Actions** to stay visible while I type, filtered by a case-insensitive substring of the row label, so that Refresh still appears when I type `ref`.
17. As a Board user, I want Apply {name} to match the **Preset** name as well as the word Apply, so that typing the name is enough.
18. As a Board user, I want a **Card** to match the same needles as **Search** (`cardMatches`: key, summary, assignee, priority, parent Epic key, labels), so that Command and Search agree on a Card.
19. As a Board user, I want an **Epic** to match on key, summary, and labels only, so that a matching child does not invent a second Epic row (that rule is **Search** hide-row, not Command).
20. As a Board user, I want matching to be one case-insensitive substring and payload order, so that there is no fuzzy rank to argue with.
21. As a Board user, I want at most 8 matching **Epics** and 8 matching **Cards**, so that a full **Scope** page does not dump into the overlay.
22. As a Board user, I want **Actions** never capped, so that every opener, **Refresh**, **Agent**, and **Preset** remains reachable.
23. As a Board user, I want no “50 more” footer, so that the first slice stays a short list.
24. As a Board user, I want empty groups omitted, so that an empty query does not show empty Epics and Cards headings.
25. As a Board user, I want a query that matches nothing to show an empty list, so that a miss is not a fetch.
26. As a Board user, I want **Command** rows to come from in-memory listed **Epics** and **Scope** **Cards**, so that **Filter**, **Hide**, and header **Search** do not drop jump targets.
27. As a Board user, I want **Command** **Cards** to stay **Scope** Cards even when I am on **All epics**, so that the overlay does not list Epic Cards as stories.
28. As a Board user, I want children-cache Issues that are not in **Scope** omitted from **Cards**, so that **Command** does not leak **Scope** (ADR-0007).
29. As a Board user, I want the first **Pipe** payload to feed **Command** the same way last **Refresh** does, so that I can jump before I Refresh.
30. As a Board user, I want picking a **Card** to switch to **All stories**, so that a story is not **Open** on the Epics Board.
31. As a Board user, I want picking a **Card** to clear the selected Epic, so that **All stories** plus a leftover Epic selection does not hide the Card.
32. As a Board user, I want picking a **Card** to **Open** that Issue, so that the jump lands on details, not only a Column.
33. As a Board user, I want picking a **Card** to clear **Search**, so that a leftover needle does not hide the Card after the jump.
34. As a Board user, I want picking a **Card** to leave **Filter** and **Hide** as they are, so that last-used chrome stays (ADR-0006).
35. As a Board user, I want **Open** to stay if **Filter** or **Hide** left that Card off a Column, so that the jump still shows the Issue.
36. As a Board user, I want picking an **Epic** to switch to **All epics** and **Open** that Epic, so that an Epic is a Card on that Board, not a left-pane children filter.
37. As a Board user, I want a starred **Epic** in the Epics group, so that I can see it is a **Favourite** without a second group.
38. As a Board user, I want picking that starred row to behave like picking the **Epic**, so that a Favourite is a jump-to-Issue, not the left-pane children shortcut.
39. As a Board user, I want picking **All stories** to open that Board and clear the selected Epic, so that I get the full **Scope** Columns.
40. As a Board user, I want picking **All epics** to open that Board, so that I do not have to click the left-pane opener.
41. As a Board user, I want picking **Refresh** to run the existing **Refresh**, so that **Command** is not a second fetch path.
42. As a Board user, I want picking **Agent** to open the **Agent Sidepanel**, so that I do not have to click Agent in the header.
43. As a Board user, I want picking Apply {name} to **Apply** that **Preset** into last-used chrome, so that **Command** is not a second Preset store.
44. As a Board user, I want every pick to clear **Search**, so that session hide does not surprise the landing Board.
45. As a Board user, I want every pick to close **Command**, so that the overlay does not sit on the Board I just opened.
46. As a Board user, I want a key that is not in listed Epics or **Scope** Cards to produce no Epic or Card row, so that **Command** does not pretend Jira was queried.
47. As a Board user, I want that miss to stay empty even after I hit **Refresh** if jira-cli still omitted the key, so that **Search** and **Command** share the same listed set.
48. As a Board user, I want **Command** not to run `jira issue view` or `jira issue list` for a miss, so that a jump is not a second **Scope**.
49. As a Board user, I want no new HTTP for catalog or pick, so that the overlay is local chrome on memory already on the client.
50. As a Board user, I want the overlay to use this app's chrome (hairline, radius, muted secondary text), so that **Command** is not a foreign palette.
51. As a Board user, I want arrow keys and Enter to move and pick in the overlay, so that I can jump without the mouse after Cmd+K.
52. As a Board user, I want the overlay input to receive typing after Cmd+K, so that keystrokes do not leak into **Search** or the composer.
53. As a Board user, I want zero **Presets** to omit Apply rows and still show the other **Actions**, so that an empty Preset list does not break the overlay.
54. As a Board user, I want picking **All stories** while already on **All stories** to still clear selected Epic and **Search**, so that the opener is a reset, not a no-op when an Epic is selected.
55. As a Board user, I want **Command** to list a **Card** that **Hide** or **Filter** currently omits from Columns, so that I can still jump to it and **Open**.

## Implementation Decisions

- **Command** is client-only chrome on the in-memory Board. No new App HTTP, no jira-cli, no children-cache merge (ADR-0007, ADR-0011).
- One test seam: catalog + pick. Same family as Preset/Folder list functions (input in memory → grouped rows / jump intent). Overlay markup, Cmd/Ctrl+K wiring, and focus restore are not a test seam.
- Catalog input: listed Epics, **Scope** Cards (stories columns of the in-memory Board, not the painted **All epics** Columns), Preset names in create order, Favourite keys (for the star only), and the typed query. Ignore **Filter**, **Hide**, header **Search**, selected Epic, and children-cache Cards.
- Catalog output, empty query: Actions group only, in this order: All stories, All epics, Refresh, Agent, then one Apply {name} per Preset.
- Catalog output, non-empty query: Actions whose label contains the needle (case-insensitive substring), then up to 8 matching Epics in payload order, then up to 8 matching Cards in payload order. Omit a group with no rows.
- Card match reuses the existing Card matcher. Epic match reuses the existing Epic matcher (key / summary / labels). Do not keep an Epic because a child matches.
- Pick maps a row to a jump intent. The Board applies that intent with existing openers, **Open**, **Refresh**, Agent open, and **Apply**. Suggested intent shape (decision, not a shipped prototype):

```
CommandJump =
  | { kind: "all-stories" }
  | { kind: "all-epics" }
  | { kind: "refresh" }
  | { kind: "agent" }
  | { kind: "preset"; name: string }
  | { kind: "epic"; key: string }
  | { kind: "card"; key: string }
```

- Applying a jump always clears **Search** and closes the overlay. **Filter** / **Hide** are untouched. `card` also switches to **All stories** and clears selected Epic before **Open**. `epic` switches to **All epics** before **Open**. `preset` is existing Apply (including today's All-epics → All-stories side effect). `all-stories` is the existing opener (clears selected Epic).
- Overlay: one field, grouped rows, keyboard highlight + Enter. Existing UI primitives; do not add a second **Search**. No recents store.
- Shortcut: meta/ctrl + K on `window`, toggle, `preventDefault`. Capture while **Search**, Scope flags, or the Agent composer is focused. Escape closes and restores the previously focused element. Do not bind `/`.
- Favourite: star on the Epic row when the key is in Favourite keys. Same `epic` jump. No Favourites group and no Favourites action.

## Testing Decisions

- Test external behaviour of catalog + pick only: given Epics, Scope Cards, Preset names, Favourite keys, and a query, assert groups, labels, caps, match rules, and the jump intent for a picked row. Do not test overlay DOM, focus, or keydown.
- Prior art: visibility and Preset tests (Card/Epic matchers, Filter/Hide leaving memory intact, add/apply Preset). Follow that style: tables of inputs → rows / intent.
- Must cover: empty query is Actions only; typing adds Epics then Cards; Actions filter on label; Card matcher needles; Epic does not match via child; cap 8 + 8 and payload order; Actions uncapped; Filter/Hide/Search/selected Epic do not drop catalog rows; children-cache Cards omitted; Favourite is a starred Epic whose pick is `epic`; Card pick is `card`; miss (unknown key) yields no Issue rows; empty Presets omit Apply rows.
- Do not add HTTP tests. **Open** / **Refresh** stay the existing calls.
- Do not add component tests for Cmd/Ctrl+K, Escape, or chrome density.

## Out of Scope

- Live jira-cli lookup, `jira issue view` on miss, or merging a fetched Issue into **Scope**.
- Children-cache Cards in the Cards group (ADR-0007).
- Create, **Move**, or any Write-back from **Command**.
- `/` shortcut, fuzzy rank, recents, or a “50 more” footer.
- A Favourites group or a Favourites action that focuses the left pane.
- Clearing **Filter** / **Hide** on jump (ADR-0006).
- Focusing header **Search** instead of an overlay (ADR-0011).
- New HTTP, Scope flags, or a second process.
- Command palette libraries as a product requirement (implementation may use existing primitives).

## Further Notes

Glossary: **Command** (`CONTEXT.md`). It is not **Search**, **Scope**, or a palette. ADR-0011 is the product fork. ADR-0006 last-used chrome. ADR-0007 children cache is pane-only. ADR-0008 Preset is local chrome. ADR-0009 **All epics** is a Board.

A create in Jira after `bunx` is still invisible until **Refresh** lists it. **Command** will not fix that. On **All stories** an Epic is still a left-pane row; picking it in **Command** is how keyboard users land on **All epics**.

Implement child tickets in a fresh window from those tickets, not from this spec thread.
