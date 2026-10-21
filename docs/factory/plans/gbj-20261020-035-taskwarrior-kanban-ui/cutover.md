# cutover.md — gbj-20261020-035 Taskwarrior-first kanban profile

## Goal
Replace what is served at `https://taskwarrior.tail48fe8.ts.net/` with the new pipe-kan Taskwarrior profile, while keeping `/timebox` untouched and preserving a rollback path.

## Assumption
The app runs on a **fresh, dedicated host/CT**; the operator provisions a new CT before cutover. This plan does not describe modifying the existing taskwarrior node.

> Superseded: this plan moved to a standalone repo and host (job gbj-20261020-035). This branch is kept for reference and will not be merged.

---

## 1. Current route state

```
Tailscale Funnel (443)
  → taskwarrior.tail48fe8.ts.net
    → tailscale serve
      → /     = nginx :80 → 127.0.0.1:3000   (502 today; old taskwarrior-web-ui not running)
      → /timebox = nginx :8080 → 127.0.0.1:3001 (timebox Next.js; 200 OK; MUST STAY)
```

`/timebox` is systemd `timebox.service` on `/opt/timebox`. It is independent of the root app and must not be touched.

---

## 2. Target route state

```
Tailscale Funnel (443)
  → taskwarrior.tail48fe8.ts.net
    → tailscale serve
      → /     = pipe-kan @ 127.0.0.1:5173 (Taskwarrior profile)
      → /timebox = nginx :8080 → 127.0.0.1:3001 (unchanged)
```

The new app listens on `127.0.0.1:5173` (pipe-kan default). No nginx reverse proxy is needed if Tailnet-only auth is chosen; Tailscale serve can forward directly to `:5173`. If Google SSO is chosen, nginx + oauth2-proxy sits in front, same pattern as CT 425.

---

## 3. Data paths

### Path A: Local replica on app host (recommended)
- Proxmox CT with Debian 13, Taskwarrior 3.4.2 installed.
- App user (`taskwarrior` or `pipekan`) owns `TASKDATA=/var/lib/taskwarrior/.task`.
- `task export` runs locally; no network dependency for reads/writes.
- Backup: operator runs `task export` to JSON and `rsync`s the `.task` directory.

### Path B: TaskChampion sync server + replica
- A separate host (or same host) runs `taskchampion-sync-server`.
- App host syncs with `task sync` before/after sessions.
- Allows phone/laptop replicas.
- Adds operational complexity: TLS cert, auth token, sync scheduling.

**Recommendation**: Path A for initial cutover. Path B is a future enhancement that does not require app changes.

---

## 4. Ansible deploy pattern

Follow the `proxmox/pipekan` pattern (CT 425), adapted for Taskwarrior:

1. **Provision CT** (`--tags provision`)
   - Debian 13 LXC (2 cores, 2 GB RAM, 20 GB disk)
   - Tailscale join with TUN device
   - App user created (e.g., `taskkan`)

2. **Install Taskwarrior** (`--tags taskwarrior`)
   - `apt install taskwarrior` (Debian 13 has 3.4.x)
   - Create `TASKDATA` directory, owned by app user
   - Import existing tasks (operator copies `.task` from old host or starts fresh)

3. **Install pipe-kan** (`--tags install`)
   - `bun` runtime
   - `bunx pipe-kan@latest` (or build from this repo)
   - systemd service file: `taskwarrior-kanban.service`
   - Environment file: `/etc/taskwarrior-kanban/env` with `TASKDATA`, `HOST=127.0.0.1`, `PORT=5173`

4. **Tailscale serve** (`--tags tailscale`)
   - `tailscale serve --https=443 --set-path=/ localhost:5173`
   - `/timebox` path stays unchanged (operator must configure separately or keep old nginx)

5. **Auth decision**
   - **Tailnet-only** (default): no oauth2-proxy. Tailscale ACLs gate access.
   - **Google SSO**: add nginx + oauth2-proxy role, same as pipekan. Allowlist: `igandhivishal@gmail.com`.

---

## 5. Cutover steps

### Phase 1: Build and verify on new CT (dry run)
1. Provision new CT (e.g., CT 450).
2. Install Taskwarrior + pipe-kan on new CT.
3. Seed with fake data: `TASKWARRIOR_FIXTURE=synthetic bunx pipe-kan`.
4. Verify app loads at `http://<ct-ip>:5173` from inside the tailnet.
5. Run smoke tests: `bun test`, `bun run smoke`.
6. Verify `/timebox` is NOT on this CT (it stays on old CT or separate host).

### Phase 2: Data migration (if preserving tasks)
1. On old host: `task export > tasks.json`.
2. Copy `.task/` directory to new CT.
3. On new CT: verify `task export` matches.
4. **Do not** run `task sync` to a sync server unless Path B is chosen.

### Phase 3: Route switch
1. On new CT: start `taskwarrior-kanban.service`.
2. Verify `curl -s http://127.0.0.1:5173 | head` returns HTML.
3. **Keep old route config** on the operator's tailnet admin panel:
   - Old: `taskwarrior.tail48fe8.ts.net` → old CT 400
   - Do not delete the old serve config yet.
4. Update Tailscale serve/Funnel: point `taskwarrior.tail48fe8.ts.net` → new CT 450.
   - If using MagicDNS + Funnel: update in Tailscale admin console.
   - If using DNS A record: update the record.

### Phase 4: Verification
1. Browse `https://taskwarrior.tail48fe8.ts.net/` from a tailnet device.
2. Verify Board loads with tasks.
3. Verify quick-add, drag, complete, edit work and show in `task export`.
4. Verify `https://taskwarrior.tail48fe8.ts.net/timebox` still 200 OK.
5. Verify keyboard shortcuts work.
6. Verify light/dark mode.

### Phase 5: Rollback (if needed)
1. Revert Tailscale serve/Funnel to point back to old CT 400.
2. Old app (taskwarrior-web-ui) may need restart if it was running.
3. New CT can stay up for debugging; operator shuts it down after confirmation.

---

## 6. Rollback checklist

| Step | Command / Action |
|---|---|
| 1. Revert DNS/serve | Tailscale admin console → restore old target |
| 2. Restart old service | `pct exec 400 -- systemctl restart taskwarrior-web-ui` (if applicable) |
| 3. Verify `/` | `curl -s https://taskwarrior.tail48fe8.ts.net/ | head` |
| 4. Verify `/timebox` | `curl -s https://taskwarrior.tail48fe8.ts.net/timebox | head` |
| 5. Notify | Operator confirms rollback complete |

---

## 7. Decisions for the operator

| Decision | Options | Recommended default |
|---|---|---|
| Clean host | New CT or wipe old CT | **New CT** |
| Auth | Tailnet-only or Google SSO | **Tailnet-only** (simpler) |
| Data path | Local replica (A) or sync server (B) | **Local replica (A)** |
| Funnel | Keep on or turn off | **Keep on** (no change; Tailscale ACLs gate access) |
| `/timebox` | Same host or separate | **Separate** (stays on old host or its own CT) |

---

## 8. No-Funnel note

This plan does **not** change Tailscale Funnel status. Funnel is currently ON for `taskwarrior.tail48fe8.ts.net`. Keeping it on is the operator's call; the app itself has no Funnel awareness. If the operator turns Funnel off, only tailnet devices can reach the host, which is a reasonable hardening step.
