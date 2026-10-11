## Parent

Part of #25.

## What to build

Cmd/Ctrl+K toggles a **Command** overlay. Empty query lists **Actions** only: **All stories**, **All epics**, **Refresh**, **Agent**, then each **Preset** as Apply {name} in create order. Zero Presets omit Apply rows. Typing filters Actions by a case-insensitive substring of the row label. Pick runs that existing action, clears **Search**, and closes the overlay. **All stories** still clears the selected Epic when already on that Board.

The chord steals focus from **Search**, Scope flags, and the Agent composer, and `preventDefault` so Chrome's omnibox does not take it. Escape closes and restores focus. `/` is not a shortcut. Arrow keys and Enter pick. Overlay uses this app's chrome (hairline, radius, muted secondary text). No Epic or Card rows yet.

## Acceptance criteria

- [ ] Cmd/Ctrl+K toggles **Command**. The same chord while open closes it.
- [ ] The chord opens **Command** while **Search**, Scope flags, or the Agent composer is focused, and `preventDefault` while this page is focused. `/` does not open **Command**.
- [ ] Escape closes **Command** and restores focus to the control that had it.
- [ ] Empty query lists **Actions** only, in order: **All stories**, **All epics**, **Refresh**, **Agent**, then Apply {name} for each **Preset** in create order. Empty Presets omit Apply rows. No Favourites, Create, or **Move** rows.
- [ ] Typing filters **Actions** by case-insensitive substring of the row label (Apply {name} matches the **Preset** name and Apply). No Epic or Card group yet.
- [ ] Pick **All stories** opens that Board and clears selected Epic. Pick **All epics** opens that Board. Pick **Refresh** runs existing **Refresh**. Pick **Agent** opens the **Agent Sidepanel**. Pick Apply {name} Applies that **Preset**. Every pick clears **Search** and closes **Command**. **Filter** and **Hide** stay.
- [ ] Arrow keys and Enter move and pick. After Cmd+K, typing goes to the overlay field, not **Search** or the composer.
- [ ] Tests sit on catalog + pick: empty query is Actions only; empty Presets omit Apply; action label filter; pick intents `all-stories` / `all-epics` / `refresh` / `agent` / `preset`. Overlay DOM, focus, and keydown are not tested.

## Blocked by

None (can start immediately).
