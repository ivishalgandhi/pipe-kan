## Parent

Part of #10.

## What to build

Every Epic row has `...`. Picking a status Moves that Epic (`jira issue move` on the Epic key, then Refresh). Destinations are occupied Epic statuses from the full `-tEpic` list, current status omitted. Search and Filter hide rows, not destinations. Status-group `...` is just those statuses and is hidden when the list is empty. Favourite `...` keeps Unfiled and Folder names; statuses live under a Move submenu, hidden when empty. Folder filing must not use the word Move.

Wait for Write-back (busy as today). No optimistic row jump. Children stay in their Columns. Destination groups stay collapsed. A Favourited Epic stays in Favourites. Selected Epic stays selected if the key is still listed. Illegal Move keeps the Epic where it was and uses the existing error banner. Same-status is a noop.

Fixture gains a second Epic in Done so DEMO-1 can Move locally. Fake Jira stays To Do / In Progress / Done.

## Acceptance criteria

- [ ] Status-group Epic rows have `...` whose items are occupied Epic statuses from the full listed set, minus current, hidden when empty.
- [ ] Favourite `...` keeps Folder filing (Unfiled + Folder names) and puts statuses under a Move submenu, hidden when empty. Filing copy does not say Move.
- [ ] Picking a status runs the existing Move Write-back on that Epic key and Refresh. Same-status noops. Illegal Move keeps the Epic and shows the error banner.
- [ ] Children do not Move. Collapse does not auto-open. A Favourite copy stays. Selection stays if the key is still listed.
- [ ] Fixture includes a second Epic in Done. Fake Jira transitions stay To Do / In Progress / Done.
- [ ] Tests sit on App Move: Epic-key same-status noop, success Refreshes, children stay on the Board, second Fixture Epic is listed in Done. `...` chrome is not tested.

## Blocked by

#12 Epic children cache.
