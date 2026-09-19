# Plane catalog walks Projects serially and waits out PAT 429

Unscoped `--workspace` Refresh must finish on a Workspace with many Projects. Catalog load walks Projects one at a time and shares a global Plane HTTP in-flight bound of 1 (pagination, module-issues joins, Write-back). Requests honor `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`: remaining 0 waits until reset; 429 waits that window then retries once. We rejected bursting every Project's states/labels/modules/work-items, retrying 429 four times in the same minute, and telling operators to pass `--projects` instead. `--projects` still only narrows after the project list. Jira is unchanged.

## Status

Accepted

## Considered options

- **Fan-out per Project (`Promise.all`)** — rejected. Public PAT quota is 60 requests per minute per API key; overlapping GETs 429 a large Workspace.
- **Four same-minute 429 retries** — rejected. Exponential 1s/2s/4s/8s still spends the same window.
- **`--projects` as the fix** — rejected. Unscoped `--workspace` must load every listed Project.
- **Keep-mode / hide Fixture** — out of this ADR (later ticket on the same bug).

## Consequences

- Plane REST is serialized. A many-Project Refresh is slower than a burst and preferred to 429.
- ADR-0014's Plane REST path is paced here; `--projects` remains a narrowing flag, not a throttle.
