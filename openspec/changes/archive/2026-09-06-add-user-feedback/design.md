## Context

See proposal.md — Why. The constraints that actually shape the approach:

- **The table has no GSIs** (`lib/keys.ts`), and adding one for a feature this small would be the most expensive thing in the change. Whatever key layout feedback uses has to make both access patterns — "cap one account's volume" and "read everything recent" — work without one.
- **TTL is already enabled** on `expiresAt` (`infra/dynamodb.tf:26`), so expiry is a field rather than an infrastructure change.
- **API Gateway routes are enumerated in Terraform** (`local.api_routes` in `apigateway.tf`). A route present in `router.ts` but absent from that map returns 404 from the gateway, before the Lambda runs — so the backend code and the route map have to move together. An early draft of this design claimed the change touched no Terraform at all; that was wrong, and the symptom was a 404 in the browser with a complete and correct backend sitting behind it.
- **Two brands, four stacks.** Brand isolation is stack isolation, so feedback partitions itself by construction. The read tool has to select a stack rather than filter within one.
- **The application must work with no backend at all.** `config.ts` exposes `accountsEnabled`, false in a checkout with no `.env.local`, and in that state the app makes no account calls of any kind. The footer has to respect that as a third state, not just signed-in and signed-out.
- **Motifs are a fixed set of surface-bound slots** (`app-visual-design`), one per surface. A footer is a new surface, and the temptation to give it a decorative edge is exactly what that requirement exists to refuse.

## Goals / Non-Goals

**Goals:**
- Both access patterns as bounded queries, no GSI, no table scan that grows with unrelated data.
- The per-account cap enforced server-side against stored state, not against anything the client asserts.
- A build identifier that is absent-tolerant, in deliberate contrast to `VITE_BRAND`.
- A footer that both brands can style through the existing seam with no new mechanism.

**Non-Goals:**
- Any admin UI, now or as a later phase this design should leave room for. The specs forbid it; this design does not hedge against them.
- Deduplicating or threading submissions. Each is a standalone record.
- Tolerating clock skew between client and server. All timestamps are server-assigned.

## Decisions

### Two items per submission, not one

A submission writes two records in one transaction, mirroring the existing share-pointer pattern (`CARD#<id> SHARE#<token>` alongside `SHARE#<token> META`):

```
FEEDBACK#<YYYY-MM-DD>  <ts>#<rand>          message, contact?, context{}, submitterId, createdAt, expiresAt
USER#<sub>             FEEDBACK#<ts>#<rand> createdAt, expiresAt          <- cap pointer, no message text
```

The date-partitioned record makes "read the last N days" a query over a handful of partitions. The user-partitioned pointer makes the rolling-window cap a single query on the submitter's own partition with a `begins_with` on the sort key — the same shape `listMemberships` uses for `MAX_CARDS_PER_USER`.

*Alternative rejected: one item under `USER#<sub>`, read by Scan.* Simpler to write, and at this volume the cost is negligible. It lost because the Scan reads the entire table — every card, trip, and event — to return a handful of feedback items, so the read tool's cost and latency grow with data that has nothing to do with feedback. Paying one transaction at write time to keep the read bounded is the better trade when writes are rare and the table is shared.

*Alternative rejected: one item under `FEEDBACK#<date>` with a counter item for the cap.* A rolling window over a counter needs either a fixed window (gameable at the boundary) or the timestamps anyway, at which point the pointer records are the timestamps.

The pointer deliberately carries **no message text**, so the cap query never reads submission content.

### The build identifier is absent-tolerant, unlike the brand

`VITE_BRAND` exists to fail the build loudly when unset — shipping the wrong brand's assets to a bucket is unrecoverable and silent. The build identifier is the opposite: a local `npm run build` has no commit to report, and failing there would break the ordinary development loop to protect nothing.

So it is read as a plain `import.meta.env.VITE_COMMIT_SHA` falling back to `"unknown"`, with no `define` and no validation. CI supplies `github.sha`, which is already available to the workflow — **no new GitHub Environment variable, and so no per-environment manual setup**, which is what made the `VITE_BRAND` rollout a four-workspace chore.

Recording the contrast because the two live in the same config file and the next person will reasonably assume they follow the same rule.

### The footer has three states, not two

| `accountsEnabled` | Session | Footer shows |
| --- | --- | --- |
| false | — | No feedback link at all |
| true | signed out | Link, opening a dialog that explains sign-in is required and offers it |
| true | signed in | Link, opening the form |

The first row is the one that gets forgotten. A checkout with no `.env.local` has no account system, so a feedback link there is a link to nothing — and rendering it would also risk the dialog triggering the very account call the signed-out requirement forbids.

### The footer carries no motif

It uses a plain top border and muted foreground, no `panel-edge`, no `bg-page-texture`. The page texture is already claimed by `AppShell`, and a second motif on a surface inside it would break the one-motif-per-surface rule. Both brands differentiate the footer through tokens and copy alone, which is the seam working as designed rather than needing an extension.

### Bounds

| Bound | Value | Why |
| --- | --- | --- |
| Message length | 2 000 characters | Long enough for a real bug report, three orders of magnitude below `MAX_BODY_BYTES` |
| Contact length | 254 characters | The RFC 5321 maximum for an address; validated for length and a single `@`, nothing more |
| Per-account cap | 10 per rolling 24 hours | Bounds abuse, not use; nobody with something to say hits it |
| Expiry | 180 days | Long enough that infrequent reading does not lose reports |

Over-cap is rejected as `429` with a code the client can recognise, so the dialog can say "you have sent a lot of feedback today" rather than showing a generic failure.

Contact addresses get length and shape checks only. Fully validating an email address is a known tar pit, and the consequence of a malformed one is that a reply bounces — not a security or storage problem.

## Risks / Trade-offs

- **Sign-in gating silences the people most worth hearing from** → Accepted and named in the proposal, not mitigated. The footer link stays visible signed out so the channel is at least discoverable, and if the account requirement proves to be the reason nobody submits, the endpoint can be opened later behind the throttle-plus-honeypot design this one replaced.
- **An Office Lingo Bingo user must consent to a Google screen that says "Travel Bingo" before they can report a bug** → The 0.4 trade surfacing somewhere it was not anticipated. The signed-out dialog should say the sign-in is a Google sign-in, so the unfamiliar name is at least preceded by a warning rather than arriving cold.
- **Reports expire after 180 days** → A channel nobody reads loses its contents silently. Mitigated by making the read tool trivially easy to run and printing the count of submissions nearing expiry, so reading it once shows what is about to be lost.
- **Stored text is attacker-controlled** → Kept out of the application entirely by the specs. The residual risk is the terminal: the read tool must not interpret escape sequences in submitted text, so it prints values as data rather than echoing them raw.
- **A signed-in abuser can still submit up to the cap, repeatedly** → The cap bounds cost, and `sub` makes the account identifiable. Blocking one is a Cognito operation, not a code change.
- **The transaction makes a submission two writes** → Doubles the write cost of an operation that happens a few times a week. Irrelevant at this volume, and the reason is a bounded read path rather than a scan.

## Migration Plan

No infrastructure change, no data migration, no backfill. The new key prefixes are additive to a table whose specification already anticipates new entity types. Deployment is an ordinary backend-then-frontend deploy; both brands' dev environments get it before either production.

Rollback is a revert: the route disappears, the footer disappears, and any records already written expire on their own TTL without leaving an orphaned structure behind.
