const { validateCreateTask, validateUpdateTask, validateAssignTask } = require('../src/utils/validators');

describe('validateCreateTask', () => {
  test('passes for a minimal valid task', () => {
    expect(validateCreateTask({ title: 'Valid' })).toBeNull();
  });

  test('rejects a missing title', () => {
    expect(validateCreateTask({})).toMatch(/title/i);
  });

  test('rejects a whitespace-only title', () => {
    expect(validateCreateTask({ title: '   ' })).toMatch(/title/i);
  });

  test('rejects an invalid status', () => {
    expect(validateCreateTask({ title: 'A', status: 'bogus' })).toMatch(/status/i);
  });

  test('rejects an invalid priority', () => {
    expect(validateCreateTask({ title: 'A', priority: 'urgent' })).toMatch(/priority/i);
  });

  test('rejects an invalid dueDate', () => {
    expect(validateCreateTask({ title: 'A', dueDate: 'not-a-date' })).toMatch(/dueDate/i);
  });
});

describe('validateUpdateTask', () => {
  test('passes for an empty update (no-op)', () => {
    expect(validateUpdateTask({})).toBeNull();
  });

  test('rejects a whitespace-only title', () => {
    expect(validateUpdateTask({ title: '  ' })).toMatch(/title/i);
  });

  test('rejects an invalid status', () => {
    expect(validateUpdateTask({ status: 'bogus' })).toMatch(/status/i);
  });

  test('rejects an invalid priority', () => {
    expect(validateUpdateTask({ priority: 'urgent' })).toMatch(/priority/i);
  });

  test('rejects an invalid dueDate', () => {
    expect(validateUpdateTask({ dueDate: 'not-a-date' })).toMatch(/dueDate/i);
  });

  test('accepts a valid partial update', () => {
    expect(validateUpdateTask({ status: 'done', priority: 'high' })).toBeNull();
  });
});

describe('validateAssignTask', () => {
  test('passes for a valid assignee', () => {
    expect(validateAssignTask({ assignee: 'Priya' })).toBeNull();
  });

  test('rejects a missing assignee', () => {
    expect(validateAssignTask({})).toMatch(/assignee/i);
  });

  test('rejects a non-string assignee', () => {
    expect(validateAssignTask({ assignee: 42 })).toMatch(/assignee/i);
  });

  test('rejects an empty string assignee', () => {
    expect(validateAssignTask({ assignee: '' })).toMatch(/assignee/i);
  });

  test('rejects a whitespace-only assignee', () => {
    expect(validateAssignTask({ assignee: '   ' })).toMatch(/assignee/i);
  });
});