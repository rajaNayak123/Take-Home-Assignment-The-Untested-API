# Submission Notes

## Coverage

```
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
All files        |   97.46 |    96.55 |   93.33 |   97.22 |
 src             |   69.23 |       75 |       0 |   69.23 |  (app.js — see note below)
 src/routes      |     100 |    95.83 |     100 |     100 |
 src/services    |     100 |    94.73 |     100 |     100 |
 src/utils       |     100 |      100 |     100 |     100 |

Test Suites: 4 passed, 1 skipped (known-bugs.test.js, intentionally), 5 total
Tests:       75 passed, 3 skipped, 78 total
```

A `coverageThreshold` of 80% (statements/branches/functions/lines) is enforced in
`package.json` under the `jest` key, so `npm run coverage` fails the build if coverage
ever regresses below the assignment's bar — not just something to eyeball once.

`app.js`'s lower number is just the `app.listen(...)` bootstrap block and the global error
middleware, neither of which get exercised because Supertest talks to the exported `app`
directly rather than a running server, and none of the current routes throw synchronously.
Not something I'd spend time chasing for its own sake — it's dead-simple code and the
"functions" metric is misleading here (arrow functions passed inline to `app.listen`/`app.use`
aren't really "functions to test" in the interesting sense).

## What I'd test next with more time

- **The 3 known-but-unfixed bugs** (pagination offset, priority reset on complete, unprotected
  fields on PUT) — regression tests already exist in `tests/known-bugs.test.js` as `.skip`,
  ready to flip on once fixed.
- **Concurrent/duplicate assignment behavior** — right now `PATCH /:id/assign` always
  overwrites silently. Worth deciding (with a product owner) whether reassignment should be
  allowed outright, require an `?force=true` flag, or return the previous assignee in the
  response so a client can show "reassigned from X to Y."
- **Input size / type fuzzing** on `POST`/`PUT` bodies — e.g. extremely long titles, non-object
  bodies, arrays instead of objects, unicode/emoji titles.
- **`getPaginated` with negative or non-integer `page`/`limit`** — currently untested and, once
  BUG-2 is fixed, worth locking down explicitly (e.g. clamp `page` to 1, reject `limit <= 0`).
- **Load/perf behavior** of the in-memory array approach (e.g. `getPaginated` and `getByStatus`
  are O(n) scans) — fine at small scale, but worth a note before this goes anywhere near
  production traffic.

## What surprised me in the codebase

- The pagination bug (BUG-2) is subtle because the route layer's default (`page` defaults to
  `1` when missing) actually *hides* page 0 as a usable value from a normal API consumer —
  so the "first page" behavior most callers will hit by default is already wrong out of the box.
- `completeTask` resetting `priority` to `medium` looks like a copy-paste leftover (maybe from
  an earlier version where `priority` defaulted on creation) rather than intentional behavior —
  it's not mentioned anywhere in the API docs and has no obvious product reason to exist.
- The route-level validation (`validators.js`) is solid on primitive types but has no concept
  of "field whitelist," which is what lets BUG-4 (protected-field overwrite on PUT) through —
  worth a broader pass across all mutating endpoints, not just `/assign` (which I did whitelist
  for the new feature).
- No existing tests at all going in, on an API that's "heading to production" — matches the
  assignment's framing exactly, and it was a good reminder that the *shape* of a bug (silent
  data corruption vs. a loud 500) matters as much as whether it exists.

## Questions I'd ask before shipping this to production

1. Is the in-memory store intentional for this stage (e.g. behind a DB migration later), or
   should persistence be part of this deliverable?
2. For `PATCH /:id/assign` — should reassigning an already-assigned task be allowed silently,
   blocked, or require an explicit flag? I defaulted to "allow, overwrite" as the least
   surprising REST semantics, but this is a product call.
3. Should `assignee` be a free-text string (as specified) or a reference to a user/id? Free text
   makes typos and inconsistent naming ("Priya" vs "priya" vs "P. Sharma") a real risk down the line.
4. For BUG-4 (unprotected fields on PUT), is there a broader auth/permissions layer planned, or
   is this API intended to be fully trusted-client-only? That changes how urgently it needs fixing.
5. What's the expected behavior for `GET /tasks?status=` with an empty string, or an invalid/
   unrecognized status value — silently return nothing, or 400?

## Notes on the new `/assign` endpoint

- `assignee` is required, must be a non-empty string after trimming (leading/trailing
  whitespace is stripped before storing).
- Reassigning a task that already has an assignee is allowed and simply overwrites the
  previous value (see question 2 above).
- Added `assignee: null` as a default field on task creation for schema consistency, so every
  task returned by any endpoint has a stable, predictable shape rather than `assignee` only
  appearing after the first assignment.