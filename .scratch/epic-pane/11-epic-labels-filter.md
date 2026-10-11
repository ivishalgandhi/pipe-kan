## Parent

Part of #10.

## What to build

Epics keep labels (same source as Cards: labels plus components). Search matches an Epic on key, summary, or labels, or when a child matches. Filter still hides Cards. An Epic row stays when the Epic's own field hits Filter or a remaining child hits; it hides when neither does. Labels, Priority, and Stories-assignee facets are the union of Card values and listed Epic values. Unassigned still appears only when someone is unassigned.

Favourites and Folders use the same hide-row rule. An empty Folder stays. A Filter that hides the selected Epic's row does not clear selection; All stories is how you leave.

The children list this ticket passes is still Scope Cards. The painted number can stay Scope-only until the children-cache ticket.

## Acceptance criteria

- [ ] An Epic in the list payload keeps labels the same way a Card does (labels plus components, omitted when both are empty).
- [ ] Search keeps an Epic whose key, summary, or labels match, or that has a matching child.
- [ ] Filter still hides Cards. An Epic row stays if the Epic's own labels, priority, or assignee hits the active Filter, or if a remaining child hits. It hides when neither does.
- [ ] An Epic with no children in Scope stays under Filter (click still works).
- [ ] Labels, Priority, and Stories-assignee facets are the unique-sorted union of Card values and listed Epic values. Unassigned appears only when a Card or Epic is unassigned.
- [ ] Favourites hide under the same Filter and Search rule. An empty Folder stays visible.
- [ ] Hiding the selected Epic's row does not clear selection. The Board keeps that Epic's remaining children. All stories leaves.
- [ ] Tests sit on Board mapping and visibility (filterEpics, Favourites listing, facets, hide-row). Dropdown markup and localStorage are not tested. The children list is Scope Cards.

## Blocked by

None (can start immediately).
