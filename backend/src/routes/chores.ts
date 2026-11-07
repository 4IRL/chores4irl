import { Hono } from 'hono';
import type { ApiResponse } from '../../../types/SharedTypes.js';
import {
  getAllChores,
  createChore,
  updateChore,
  completeChore,
  deleteChore,
  restoreChore,
} from '../chores.js';
import type { AppEnv } from '../types.js';

const chores = new Hono<AppEnv>();

function hasRequiredChoreFields(body: Record<string, unknown>): boolean {
  return (
    Boolean(body.name) &&
    body.roomId != null &&
    Boolean(body.dateLastCompleted) &&
    body.duration != null &&
    body.frequency != null
  );
}

chores.get('/', async (c) => {
  const data = await getAllChores(c.env.DB, c.var.householdId);
  return c.json({ success: true, data } satisfies ApiResponse<typeof data>);
});

chores.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  if (!hasRequiredChoreFields(body)) {
    return c.json({ success: false, error: 'Missing required fields' } satisfies ApiResponse<never>, 400);
  }
  const clientId = typeof body.clientId === 'string' ? body.clientId : undefined;
  const result = await createChore(c.env.DB, c.var.householdId, body as never, clientId);
  if (result.status === 'invalid_room') {
    return c.json({ success: false, error: 'Invalid room' } satisfies ApiResponse<never>, 400);
  }
  if (result.status === 'deleted') {
    return c.json({ success: false, error: 'Chore was deleted' } satisfies ApiResponse<never>, 410);
  }
  return c.json({ success: true, data: result.chore } satisfies ApiResponse<typeof result.chore>, 201);
});

chores.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ success: false, error: 'Invalid id' } satisfies ApiResponse<never>, 400);
  }
  const body = await c.req.json<Record<string, unknown>>();
  if (!hasRequiredChoreFields(body) || body.version == null) {
    return c.json({ success: false, error: 'Missing required fields' } satisfies ApiResponse<never>, 400);
  }
  const result = await updateChore(c.env.DB, c.var.householdId, id, body as never, Number(body.version));
  if (result.status === 'not_found') {
    return c.json({ success: false, error: 'Chore not found' } satisfies ApiResponse<never>, 404);
  }
  if (result.status === 'conflict') {
    return c.json({ success: false, error: 'Chore was changed elsewhere' } satisfies ApiResponse<never>, 409);
  }
  if (result.status === 'invalid_room') {
    return c.json({ success: false, error: 'Invalid room' } satisfies ApiResponse<never>, 400);
  }
  return c.json({ success: true, data: result.chore } satisfies ApiResponse<typeof result.chore>);
});

chores.patch('/:id/complete', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ success: false, error: 'Invalid id' } satisfies ApiResponse<never>, 400);
  }
  const body = await c.req.json<Record<string, unknown>>();
  if (!body.dateLastCompleted) {
    return c.json(
      { success: false, error: 'dateLastCompleted is required' } satisfies ApiResponse<never>,
      400,
    );
  }
  const result = await completeChore(c.env.DB, c.var.householdId, id, String(body.dateLastCompleted));
  if (result.status === 'not_found') {
    return c.json({ success: false, error: 'Chore not found' } satisfies ApiResponse<never>, 404);
  }
  return c.json({ success: true, data: result.chore } satisfies ApiResponse<typeof result.chore>);
});

chores.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ success: false, error: 'Invalid id' } satisfies ApiResponse<never>, 400);
  }
  const deleted = await deleteChore(c.env.DB, c.var.householdId, id);
  if (!deleted) {
    return c.json({ success: false, error: 'Chore not found' } satisfies ApiResponse<never>, 404);
  }
  return c.json({ success: true, data: null } satisfies ApiResponse<null>);
});

chores.patch('/:id/restore', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ success: false, error: 'Invalid id' } satisfies ApiResponse<never>, 400);
  }
  const result = await restoreChore(c.env.DB, c.var.householdId, id);
  if (result.status === 'not_found') {
    return c.json({ success: false, error: 'Chore not found' } satisfies ApiResponse<never>, 404);
  }
  return c.json({ success: true, data: result.chore } satisfies ApiResponse<typeof result.chore>);
});

export default chores;
