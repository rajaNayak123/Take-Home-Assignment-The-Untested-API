const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  test('creates a task with defaults applied', () => {
    const task = taskService.create({ title: 'Write tests' });

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Write tests');
    expect(task.description).toBe('');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.dueDate).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.createdAt).toBeDefined();
  });

  test('creates a task with all fields provided', () => {
    const task = taskService.create({
      title: 'Ship feature',
      description: 'Ship it',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-01-01T00:00:00.000Z',
    });

    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.dueDate).toBe('2026-01-01T00:00:00.000Z');
  });

  test('each created task gets a unique id', () => {
    const a = taskService.create({ title: 'A' });
    const b = taskService.create({ title: 'B' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('getAll', () => {
  test('returns empty array when no tasks exist', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  test('returns all created tasks', () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  test('returns a copy, not the internal array reference', () => {
    taskService.create({ title: 'A' });
    const result = taskService.getAll();
    result.push({ title: 'Injected' });
    expect(taskService.getAll()).toHaveLength(1);
  });
});

describe('findById', () => {
  test('finds an existing task by id', () => {
    const created = taskService.create({ title: 'Findable' });
    expect(taskService.findById(created.id)).toEqual(created);
  });

  test('returns undefined for a non-existent id', () => {
    expect(taskService.findById('does-not-exist')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  beforeEach(() => {
    taskService.create({ title: 'Todo task', status: 'todo' });
    taskService.create({ title: 'In progress task', status: 'in_progress' });
    taskService.create({ title: 'Done task', status: 'done' });
  });

  test('returns only tasks matching the exact status', () => {
    const result = taskService.getByStatus('todo');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('todo');
  });

  test('does not return partial/substring matches (e.g. "progress" should not match "in_progress")', () => {
    // Regression test for BUG-1 (see BUG_REPORT.md) — fixed to use exact match.
    const result = taskService.getByStatus('progress');
    expect(result).toHaveLength(0);
  });

  test('returns an empty array for an empty string status rather than matching everything', () => {
    const result = taskService.getByStatus('');
    expect(result).toHaveLength(0);
  });

  test('returns an empty array when no tasks match', () => {
    expect(taskService.getByStatus('archived')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) {
      taskService.create({ title: `Task ${i}` });
    }
  });

  test('returns the requested slice size', () => {
    const result = taskService.getPaginated(0, 2);
    expect(result).toHaveLength(2);
  });

  test('returns fewer items on the last page', () => {
    const result = taskService.getPaginated(2, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test('returns an empty array when the page is beyond available data', () => {
    const result = taskService.getPaginated(10, 2);
    expect(result).toEqual([]);
  });
});

describe('getStats', () => {
  test('returns zeroed counts when there are no tasks', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts tasks by status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'todo' });
    taskService.create({ title: 'C', status: 'done' });

    const stats = taskService.getStats();
    expect(stats.todo).toBe(2);
    expect(stats.done).toBe(1);
    expect(stats.in_progress).toBe(0);
  });

  test('counts a task with a past dueDate that is not done as overdue', () => {
    taskService.create({ title: 'Late', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(1);
  });

  test('does not count a done task with a past dueDate as overdue', () => {
    taskService.create({ title: 'Late but done', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(0);
  });

  test('does not count a task with a future dueDate as overdue', () => {
    taskService.create({ title: 'Future', status: 'todo', dueDate: '2099-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(0);
  });
});

describe('update', () => {
  test('updates provided fields and leaves others untouched', () => {
    const task = taskService.create({ title: 'Original', priority: 'low' });
    const updated = taskService.update(task.id, { title: 'Updated' });

    expect(updated.title).toBe('Updated');
    expect(updated.priority).toBe('low');
  });

  test('returns null when updating a non-existent task', () => {
    expect(taskService.update('missing-id', { title: 'X' })).toBeNull();
  });
});

describe('remove', () => {
  test('removes an existing task and returns true', () => {
    const task = taskService.create({ title: 'To delete' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });

  test('returns false when removing a non-existent task', () => {
    expect(taskService.remove('missing-id')).toBe(false);
  });
});

describe('completeTask', () => {
  test('sets status to done and stamps completedAt', () => {
    const task = taskService.create({ title: 'Finish me' });
    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe('done');
    expect(completed.completedAt).toBeDefined();
  });

  test('returns null for a non-existent task', () => {
    expect(taskService.completeTask('missing-id')).toBeNull();
  });
});

describe('assignTask', () => {
  test('sets the assignee on an existing task', () => {
    const task = taskService.create({ title: 'Needs an owner' });
    const assigned = taskService.assignTask(task.id, 'Priya');

    expect(assigned.assignee).toBe('Priya');
  });

  test('returns null for a non-existent task', () => {
    expect(taskService.assignTask('missing-id', 'Priya')).toBeNull();
  });

  test('allows reassigning a task that already has an assignee', () => {
    const task = taskService.create({ title: 'Reassign me' });
    taskService.assignTask(task.id, 'Priya');
    const reassigned = taskService.assignTask(task.id, 'Sam');

    expect(reassigned.assignee).toBe('Sam');
  });
});