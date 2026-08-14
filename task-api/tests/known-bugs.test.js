const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('BUG-2 Fix: Pagination offset is 1-based and clamps correctly', () => {
  test('Service level: getPaginated(1, 2) returns the first 2 tasks, and page 0 clamps to page 1', () => {
    taskService.create({ title: 'Task A' });
    taskService.create({ title: 'Task B' });
    taskService.create({ title: 'Task C' });

    // Page 1 should return A and B
    const page1 = taskService.getPaginated(1, 2);
    expect(page1).toHaveLength(2);
    expect(page1[0].title).toBe('Task A');
    expect(page1[1].title).toBe('Task B');

    // Page 0 should also clamp to page 1 and return A and B
    const page0 = taskService.getPaginated(0, 2);
    expect(page0).toHaveLength(2);
    expect(page0[0].title).toBe('Task A');
    expect(page0[1].title).toBe('Task B');

    // Page 2 should return C
    const page2 = taskService.getPaginated(2, 2);
    expect(page2).toHaveLength(1);
    expect(page2[0].title).toBe('Task C');
  });

  test('Route level: GET /tasks?page=1&limit=2 returns the first 2 tasks', async () => {
    await request(app).post('/tasks').send({ title: 'Task A' });
    await request(app).post('/tasks').send({ title: 'Task B' });
    await request(app).post('/tasks').send({ title: 'Task C' });

    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Task A');
    expect(res.body[1].title).toBe('Task B');
  });
});

describe('BUG-3 Fix: completeTask preserves original priority', () => {
  test('Service level: completeTask does not reset priority to medium', () => {
    const task = taskService.create({ title: 'Important Task', priority: 'high' });
    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe('done');
    expect(completed.priority).toBe('high');
  });

  test('Route level: PATCH /tasks/:id/complete preserves priority', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ title: 'Important Task', priority: 'high' });

    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.priority).toBe('high');
  });
});

describe('BUG-4 Fix: PUT /tasks/:id ignores protected fields and arbitrary fields', () => {
  test('Service level: update ignores protected fields like id, createdAt, and completedAt', () => {
    const task = taskService.create({ title: 'Immutable fields test' });
    const originalId = task.id;
    const originalCreatedAt = task.createdAt;

    const updated = taskService.update(task.id, {
      id: 'hacked-id',
      createdAt: '2000-01-01T00:00:00.000Z',
      completedAt: '2000-01-01T00:00:00.000Z',
      title: 'Valid Update',
    });

    expect(updated.id).toBe(originalId);
    expect(updated.createdAt).toBe(originalCreatedAt);
    expect(updated.completedAt).toBeNull();
    expect(updated.title).toBe('Valid Update');
  });

  test('Route level: PUT /tasks/:id does not overwrite protected fields', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Route immutable fields test' });
    const originalId = created.body.id;
    const originalCreatedAt = created.body.createdAt;

    const res = await request(app)
      .put(`/tasks/${originalId}`)
      .send({
        id: 'hacked-id',
        createdAt: '2000-01-01T00:00:00.000Z',
        completedAt: '2000-01-01T00:00:00.000Z',
        title: 'Route Valid Update',
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(originalId);
    expect(res.body.createdAt).toBe(originalCreatedAt);
    expect(res.body.completedAt).toBeNull();
    expect(res.body.title).toBe('Route Valid Update');
  });

  test('Service level: update accepts and applies all whitelisted fields', () => {
    const task = taskService.create({ title: 'Before update', description: 'desc', status: 'todo', priority: 'low' });
    const updated = taskService.update(task.id, {
      title: 'After update',
      description: 'new desc',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-12-31T23:59:59.000Z',
    });

    expect(updated.title).toBe('After update');
    expect(updated.description).toBe('new desc');
    expect(updated.status).toBe('in_progress');
    expect(updated.priority).toBe('high');
    expect(updated.dueDate).toBe('2026-12-31T23:59:59.000Z');
  });
});
