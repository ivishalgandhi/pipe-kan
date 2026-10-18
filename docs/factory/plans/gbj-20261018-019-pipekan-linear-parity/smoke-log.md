# Smoke log — gbj-20261018-019

Synthetic Plane fixture only (`PLANE_FIXTURE=synthetic`). No live credentials.

Screenshot references live in `linear-refs/`. This run does not open a browser, so there is no browser console export.

`bun test` and `bun run typecheck` are recorded below when this file is refreshed after those commands. The script section is the HTTP and helper smoke.

## Smoke script

```
pipe-kan linear parity smoke
fixture: synthetic Plane work+personal, both contain PULSE
-- filters, context menu, command palette, timeline
PASS view filter matches status and priority
PASS view filter chips render status and priority
PASS context menu includes copy link
PASS command palette ow lists workspaces
PASS command palette includes Initiatives
PASS command palette includes Display
PASS timeline view lays out bars and ticks
PASS initiatives default to list
PASS projects can switch to timeline
PASS jira without jira-cli explains Fake Jira
-- source server
PASS source server board kind is plane
PASS source server plane board has no error
PASS source server merged view includes work/PULSE-1
PASS source server merged view includes personal/PULSE-1
PASS source server initiatives view has at least 5 rows
PASS source server projects view lists PULSE from work and personal
PASS source server timeline health covers several states
PASS source server taskwarrior stays disabled
PASS source server source switch plane to jira without restart
PASS source server jira source serves the fake board
PASS source server fake jira board lists DEMO issues
PASS source server jira board is not the plane merge
PASS source server source switch jira back to plane
PASS source server merged view returns after source switch
PASS source server taskwarrior switch is refused
-- built artifact
PASS built artifact board kind is plane
PASS built artifact plane board has no error
PASS built artifact merged view includes work/PULSE-1
PASS built artifact merged view includes personal/PULSE-1
PASS built artifact initiatives view has at least 5 rows
PASS built artifact projects view lists PULSE from work and personal
PASS built artifact timeline health covers several states
PASS built artifact taskwarrior stays disabled
PASS built artifact source switch plane to jira without restart
PASS built artifact jira source serves the fake board
PASS built artifact fake jira board lists DEMO issues
PASS built artifact jira board is not the plane merge
PASS built artifact source switch jira back to plane
PASS built artifact merged view returns after source switch
PASS built artifact taskwarrior switch is refused
smoke ok
```
