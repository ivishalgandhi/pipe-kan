## Parent

Part of #25.

## What to build

Typing in **Command** adds matching **Epics** then **Scope** **Cards** under group headings (cap 8 + 8, payload order, empty groups omitted). **Cards** match the same needles as **Search**. **Epics** match key, summary, and labels only (not via child). Catalog uses in-memory listed Epics and Scope Cards: **Filter**, **Hide**, **Search**, and selected Epic do not drop rows; children-cache Issues that are not in Scope stay out; on **All epics**, Cards stay Scope Cards. A **Favourite** is a starred Epic row; pick is still the Epic jump.

Pick a **Card**: **All stories**, clear selected Epic, **Open**, clear **Search**. Pick an **Epic**: **All epics**, **Open**, clear **Search**. **Filter** and **Hide** stay. **Open** stays if the Card is off a Column. A key not listed is no Epic/Card row (no jira-cli lookup).

## Acceptance criteria

- [ ] Typing lists matching Epics then Cards after filtered Actions. Cap 8 Epics and 8 Cards, payload order. Actions never cap. Empty groups omitted. No “50 more” footer.
- [ ] Card match is the existing Card matcher. Epic match is key / summary / labels; a matching child does not invent an Epic row.
- [ ] Catalog ignores **Filter**, **Hide**, **Search**, and selected Epic. Cards are Scope Cards even on **All epics**. Children-cache Issues outside Scope are omitted. The first **Pipe** payload feeds **Command** the same as last **Refresh**.
- [ ] A Favourite key shows a star on that Epic row. Pick is the Epic jump (**All epics** + **Open**), not the left-pane children shortcut. No Favourites group.
- [ ] Pick a Card: **All stories**, clear selected Epic, **Open**, clear **Search**. Pick an Epic: **All epics**, **Open**, clear **Search**. **Filter** and **Hide** stay. **Open** stays if **Filter** or **Hide** left the Card off a Column. Every pick closes **Command**.
- [ ] A query that matches no Actions, Epics, or Cards is an empty list. An unknown key yields no Issue rows and does not fetch Jira.
- [ ] Tests sit on catalog + pick: match rules, cap, payload order, Filter/Hide/Search/selected Epic do not drop rows, children-cache omitted, Favourite starred `epic` intent, `card` and `epic` intents, miss empty. Overlay DOM is not tested.

## Blocked by

#26 Command overlay for Actions.
