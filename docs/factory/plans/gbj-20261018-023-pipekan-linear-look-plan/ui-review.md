# UI review

## Maker self-check

Checked in headless Chrome against the synthetic fixture, not against the local reference screenshots.

- View browser opens from Views and shows New view. The composer has the icon grid, title, description, Issues/Projects, Save to, and Create view.
- `F` opens Add Filter with the named rows, including AI filter and Template. Escape closes it.
- Shift+P on a hovered card opens the project picker (`Projects in … team`, No project).
- Inbox opens from the sidebar and lists rows. The unread badge is the needs-input count.
- Sidebar shows Inbox, Pulse, Agent, Workspace, Favorites, Your teams, and the footer. Cycles is disabled. Empty favorite folders say so.
- After a source switch to Jira, Initiatives is not in the sidebar and Inbox still is.
- Status, priority, label, and avatar marks use CSS variables. Sizes match `icon-spec.md`.

Screenshot placeholders only. Reference images were not copied into this worktree and were not compared side by side.

## Independent review

Pending. This maker pass is not the Opus UI specialist review and not the Kimi referee pass. Those gates run after the maker, against `spec.md`, `tickets.md`, and the local screenshots. No coverage score is claimed here.
