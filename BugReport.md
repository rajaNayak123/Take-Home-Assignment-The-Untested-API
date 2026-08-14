# Bug Report

Found by writing unit tests against `taskService.js` and integration tests against the
routes, then comparing actual output to what the API/README imply the behavior should be.
Repro snippets are plain Node scripts I ran against the service directly before writing
the corresponding Jest test.

---

## BUG-1: `getByStatus` matches on substring, not equality — **FIXED in this submission**

**File:** `src/services/taskService.js`

**Expected:** `GET /tasks?status=todo` returns only tasks whose status is *exactly* `todo`.

**Actual:** The filter used `t.status.includes(status)`, which is `String.prototype.includes`
— substring matching, not equality. So `?status=progress` incorrectly matches every task
with status `in_progress`, and `?status=` (empty string) matches *every* task, since every
string "includes" the empty string.

**How I found it:** Writing the "does not match partial status" test in
`tests/taskService.test.js` — I expected `getByStatus('progress')` to return `[]` and it
returned the `in_progress` task instead.

**Fix applied:**
```js
// before
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));

// after
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```
Covered by `tests/taskService.test.js` → `describe('getByStatus')`.

---

## BUG-2: Pagination is off by one page (not fixed — regression test in `tests/known-bugs.test.js`, skipped)

**File:** `src/services/taskService.js`, `getPaginated`

**Expected:** `GET /tasks?page=1&limit=10` returns the *first* 10 tasks (page 1 = the start).

**Actual:** `offset = page * limit`, not `(page - 1) * limit`. So page 1 already skips the
first `limit` tasks, and the true first page is only reachable at `page=0`. This is
inconsistent with `tasks.js`, which defaults `page` to `1` when it's not provided
(`parseInt(page) || 1`) — meaning the *default* paginated request already skips the first
page of results.

**How I found it:** Repro script:
```js
svc.create({ title: 'A' }); svc.create({ title: 'B' }); svc.create({ title: 'C' });
svc.getPaginated(1, 2); // returns [C] — expected [A, B]
```

**Suggested fix:**
```js
const getPaginated = (page, limit) => {
  const offset = (page - 1) * limit;
  return tasks.slice(offset, offset + limit);
};
```
Would need a decision on what `page=0` or negative pages should do (clamp to page 1
is the safest default).

---

## BUG-3: Completing a task silently overwrites its priority (not fixed — regression test in `tests/known-bugs.test.js`, skipped)

**File:** `src/services/taskService.js`, `completeTask`

**Expected:** Marking a task complete changes `status` and `completedAt` only. Priority is
unrelated to completion and shouldn't change.

**Actual:** `completeTask` unconditionally sets `priority: 'medium'`, clobbering whatever
priority the task had (e.g. a `high`-priority task silently becomes `medium` on completion).

**How I found it:** Repro script:
```js
const t = svc.create({ title: 'Z', priority: 'high' });
svc.completeTask(t.id).priority; // 'medium' — expected 'high'
```

**Suggested fix:** Remove the `priority: 'medium'` line from the spread in `completeTask`
so the existing priority is preserved:
```js
const updated = { ...task, status: 'done', completedAt: new Date().toISOString() };
```

---

## BUG-4: `PUT /tasks/:id` allows overwriting protected fields (not fixed — regression test in `tests/known-bugs.test.js`, skipped)

**Files:** `src/services/taskService.js` (`update`), `src/utils/validators.js` (`validateUpdateTask`)

**Expected:** A client should only be able to update `title`, `description`, `status`,
`priority`, and `dueDate`. Fields like `id` and `createdAt` should be immutable, and
`completedAt` should only change via the `/complete` endpoint.

**Actual:** `update()` does `{ ...tasks[index], ...fields }` with no whitelist, and
`validateUpdateTask` never checks for disallowed keys. Any field in the request body — including
`id`, `createdAt`, or `completedAt` — silently overwrites the stored task. Sending a new `id`
effectively lets a client "rename" a task's identity, which could break any client holding
a reference to the old id.

**How I found it:** Repro script:
```js
const t = svc.create({ title: 'W' });
svc.update(t.id, { id: 'hacked-id', createdAt: 'fake-date' });
// → task's id and createdAt are now 'hacked-id' / 'fake-date'
```

**Suggested fix:** Whitelist the fields accepted by `update`, mirroring how `create`
destructures only known fields:
```js
const update = (id, { title, description, status, priority, dueDate }) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const patch = { title, description, status, priority, dueDate };
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
  tasks[index] = { ...tasks[index], ...patch };
  return tasks[index];
};
```

---

## Summary

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| 1 | `getByStatus` substring match instead of exact match | Medium (incorrect filtering / data leakage across statuses) | **Fixed** |
| 2 | Pagination offset off by one page | Medium (first page of data is effectively unreachable at the documented default) | Open |
| 3 | `completeTask` resets priority to `medium` | Low–Medium (silent, surprising data loss) | Open |
| 4 | `PUT /tasks/:id` allows overwriting `id`/`createdAt`/`completedAt` | Medium–High (data integrity) | Open |