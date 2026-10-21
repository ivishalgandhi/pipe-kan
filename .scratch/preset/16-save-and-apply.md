## Parent

Part of #15.

## What to build

An empty **Presets** group sits in the left pane after Favourites and before the Epics heading. Group `...` (name field + Save) names the current last-used Filter, Sort, and Hide. Click a name Applies that snapshot into last-used chrome. Later Filter / Sort / Hide write last-used only.

Names trim, reject empty, and clash case-insensitively, same as Folders. New names append in create order. No built-ins. Own `localStorage` key. Search, selected Epic, Scope, and Refresh stay put. Search and Filter never hide Preset names.

Linear: [Custom Views](https://linear.app/docs/custom-views) (save a filtered board/list; sidebar name opens it). [Filters](https://linear.app/docs/filters) (Filter is the snapshot). [Display options](https://linear.app/docs/display-options) (Sort/Hide persist like personal display). [Favorites](https://linear.app/docs/favorites) (sidebar list next to Favourites, not a starred View). Full take/leave-out table is on #15.

## Acceptance criteria

- [ ] Presets group is always shown after Favourites, even when empty. Group `...` Save names current last-used Filter, Sort, and Hide.
- [ ] Empty or case-insensitive-clash names fail; uniqueness is the name, not the snapshot. Names append in create order. No built-in names.
- [ ] Click a name Applies that snapshot into last-used chrome. Later Filter / Sort / Hide change last-used only. Search, selected Epic, Scope, and Refresh stay put.
- [ ] Search and Filter never hide Preset names. Own storage key; do not grow last-used or Favourites.
- [ ] Tests sit on Preset list functions (add / apply), same shape as Folder functions. `...` chrome and localStorage are not tested.

## Blocked by

None (can start immediately).
