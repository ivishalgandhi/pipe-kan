## Parent

Part of #10.

## What to build

The number on an Epic row is every non-Epic child (Story, Bug, Task, and the rest), including those outside Scope, after Search and Filter. Refresh fills a children cache with one extra jira-cli list (`parent` or Epic Link, batched across listed Epic keys). Fixture and the store adapter fill that cache at hydrate. A Pipe stays Scope-only until Refresh. The Board stays Scope (ADR-0007).

Selecting an Epic that has no Scope children stamps from the cache (no second jira-cli call). Selecting one that already has Scope children keeps today's skip. If the children call fails, the Board stays, counts fall back to Scope Cards, and the error banner shows.

## Acceptance criteria

- [ ] The painted Epic row number is remaining children from the cache after Search and Filter, not only Scope Cards.
- [ ] Refresh fills the cache with one batched children list. Columns stay Scope.
- [ ] Fixture and store hydrate fill the cache from the in-process store so first local paint matches Refresh.
- [ ] Pipe hydrate has no cache; first paint counts Scope Cards until Refresh.
- [ ] Select with zero Scope children stamps cached children onto the Board without a second list. Select with Scope children still skips the fetch.
- [ ] A failed children call keeps the Board, falls counts back to Scope Cards, and shows the error banner. It does not fail the whole Refresh and does not fall back to one list per Epic.
- [ ] Tests sit on App hydrate / Refresh / children (existing HTTP tests). Visibility already accepts a children list from the prior ticket.

## Blocked by

#11 Epic labels and Filter hide-row.
