# Linear look smoke

Synthetic fixtures only. No live board and no vendor host.

- Add Filter named rows: 23 (the ticket text says 21; the named list is 23).
- Covered: view browser, view composer, Add Filter, project picker, inbox, sidebar sections, favorite folders, team nav, footer, icon tokens.
- Screenshot placeholders (not committed): views, add filter, move to project, inbox, sidebar.
- Performance numbers are in perf.md. Medians after this change: cold 317ms, project switch 522ms, workspace switch 450ms. All within the 0.34.2 budgets.

```
PASS plane fixture has at least 3 views
PASS plane fixture views have icon, description, scope, and kind
PASS plane fixture has at least 5 inbox rows
PASS plane fixture inbox covers update, assign, and mention
PASS plane fixture inbox mentions DEMO-12
PASS plane fixture team nests the six nav items
PASS plane fixture favorites sit in a folder
PASS jira fixture has at least 3 views
PASS jira fixture views have icon, description, scope, and kind
PASS jira fixture has at least 5 inbox rows
PASS jira fixture inbox covers update, assign, and mention
PASS jira fixture inbox mentions DEMO-12
PASS jira fixture team nests the six nav items
PASS jira fixture favorites sit in a folder
PASS plane fixture lists Acme Demo
PASS add filter menu renders
PASS add filter renders 23 named rows
PASS add filter spans AI filter through Template
PASS non-backend rows are dimmed and marked coming soon
PASS AI prompt stays closed until the row is opened
PASS inbox renders at least five 48px rows
PASS inbox rows use DEMO-12
PASS read inbox is empty
PASS sidebar sections render
PASS empty favorite folder renders
PASS team row exposes its scope
PASS cycles are enabled
PASS dead footer rows are hidden
PASS inbox badge renders
PASS view browser groups personal and team
PASS view composer renders
PASS project picker renders
PASS new project actions stay inert
PASS icon marks expose data-icon
PASS status marks use tokens and a hollow backlog
PASS rendered icons do not hardcode hex
```
