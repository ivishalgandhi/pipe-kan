## Parent

Part of #15.

## What to build

Each Preset name has row `...`: Save over (write last-used into that name), Rename, Delete. Rename uses the same uniqueness rule as Save. Delete leaves last-used chrome as it is.

Preset names are 28px Linear sidebar-nav rows (Epics stay 56px). The group collapse persists with Favourites (`Presets` key), default open. No applied/dirty highlight.

Linear: [Custom Views](https://linear.app/docs/custom-views) overflow on a view (Edit / Duplicate analog = Save over + Rename; delete is the owner-check we skip). [Display options](https://linear.app/docs/display-options) and [Board layout](https://linear.app/docs/board-layout) for Hide-column chrome, not a board/list toggle. Sidebar row recipe: `docs/research/linear-ui.md` §6.2. Full take/leave-out table is on #15.

## Acceptance criteria

- [ ] Row `...` Save over writes last-used Filter, Sort, and Hide into that name and keeps the name.
- [ ] Row `...` Rename retitles with the same uniqueness rule as Save (trim, reject empty, case-insensitive clash).
- [ ] Row `...` Delete drops the name and leaves last-used chrome as it is.
- [ ] Names are 28px sidebar-nav rows. Collapse persists (`Presets` key, default open). No applied highlight.
- [ ] Tests sit on Preset list functions (overwrite / rename / delete). `...` chrome, 28px rows, and collapse are not tested.

## Blocked by

#16 Save and apply a Preset.
