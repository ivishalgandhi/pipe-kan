# Command is a jump overlay, not Search

Command is a Cmd/Ctrl+K overlay that jumps using the in-memory Refresh payload (listed Epics and Scope Cards). It is not header Search, not Scope, and not a live jira-cli lookup. We rejected focusing Search because Search cannot switch All stories / All epics, and rejected fetch-on-miss because that is a second Scope.
