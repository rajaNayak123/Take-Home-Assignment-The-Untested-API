const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('POST /tasks', () => {
  test('happy path: creates a task and returns 201', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Write the report' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write the report');
    expect(res.body.status).toBe('todo');
    expect(res.body.id).toBeDefined();
  });

  test('edge case: missing title returns 400', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  test('edge case: invalid status returns 400', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Bad status', status: 'archived' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  test('edge case: invalid dueDate returns 400', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Bad due date', dueDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/i);
  });
});

describe('GET /tasks', () => {
  test('happy path: returns all tasks', async () => {
    await request(app).post('/tasks').send({ title: 'A' });
    await request(app).post('/tasks').send({ title: 'B' });

    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('filters by status via query param', async () => {
    await request(app).post('/tasks').send({ title: 'Todo one', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'Doing one', status: 'in_progress' });

    const res = await request(app).get('/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('todo');
  });

  test('filtering by an unrecognized status returns an empty array, not an error', async () => {
    await request(app).post('/tasks').send({ title: 'Todo one', status: 'todo' });

    const res = await request(app).get('/tasks?status=archived');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('paginates results when page and limit are provided', async () => {
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }

    const res = await request(app).get('/tasks?page=0&limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /tasks/stats', () => {
  test('happy path: returns counts by status and overdue count', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 0, done: 1, overdue: 0 });
  });

  test('is not shadowed by the /:id routes (route ordering)', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('error');
  });

  test('reflects an overdue, non-done task in the overdue count', async () => {
    await request(app)
      .post('/tasks')
      .send({ title: 'Late', dueDate: '2000-01-01T00:00:00.000Z' });
    await request(app)
      .post('/tasks')
      .send({ title: 'Late but done', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(1);
  });
});

describe('PUT /tasks/:id', () => {
  test('happy path: updates an existing task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });

    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
  });

  test('edge case: returns 404 for a non-existent task', async () => {
    const res = await request(app).put('/tasks/missing-id').send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  test('edge case: invalid priority returns 400', async () => {
    const created = await request(app).post('/tasks').send({ title: 'A' });

    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ priority: 'urgent' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  test('happy path: deletes an existing task and returns 204', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Delete me' });

    const res = await request(app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get('/tasks');
    expect(getRes.body).toHaveLength(0);
  });

  test('edge case: returns 404 for a non-existent task', async () => {
    const res = await request(app).delete('/tasks/missing-id');
    expect(res.status).toBe(404);
  });

  test('edge case: deleting the same task twice returns 404 on the second attempt', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Delete me once' });

    const first = await request(app).delete(`/tasks/${created.body.id}`);
    expect(first.status).toBe(204);

    const second = await request(app).delete(`/tasks/${created.body.id}`);
    expect(second.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('happy path: marks a task done and stamps completedAt', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Finish' });

    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).toBeDefined();
  });

  test('edge case: returns 404 for a non-existent task', async () => {
    const res = await request(app).patch('/tasks/missing-id/complete');
    expect(res.status).toBe(404);
  });

  test('edge case: completing an already-completed task stays done without erroring', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Finish twice' });
    await request(app).patch(`/tasks/${created.body.id}/complete`);

    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });
});