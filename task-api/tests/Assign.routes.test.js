const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('PATCH /tasks/:id/assign', () => {
  test('happy path: assigns a task to a named person', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Needs an owner' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Priya' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Priya');
    expect(res.body.id).toBe(created.body.id);
  });

  test('edge case: returns 404 for a non-existent task', async () => {
    const res = await request(app)
      .patch('/tasks/missing-id/assign')
      .send({ assignee: 'Priya' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  test('edge case: returns 400 when assignee is an empty string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Needs an owner' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
  });

  test('edge case: returns 400 when assignee is only whitespace', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Needs an owner' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '   ' });

    expect(res.status).toBe(400);
  });

  test('edge case: returns 400 when assignee is missing from the body', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Needs an owner' });

    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({});
    expect(res.status).toBe(400);
  });

  test('edge case: returns 400 when assignee is not a string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Needs an owner' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 12345 });

    expect(res.status).toBe(400);
  });

  test('reassigning an already-assigned task overwrites the previous assignee', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Needs an owner' });
    await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Priya' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Sam' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Sam');
  });

  test('leading/trailing whitespace on a valid name is trimmed', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Needs an owner' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '  Priya  ' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Priya');
  });
});