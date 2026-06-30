import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { db } from '../db.js';
import { choreEvents, CHORE_CHANGED } from '../events.js';

beforeEach(() => {
    db.exec('DELETE FROM chores');
});

const BASE_CHORE = {
    name: 'Sweep',
    room: 'Kitchen',
    dateLastCompleted: '2025-01-01T00:00:00.000Z',
    duration: 10,
    frequency: 7,
};

describe('choreEvents emit on successful mutation', () => {
    it('fires exactly once on create, complete, update, and delete — never on errors', async () => {
        const onChange = vi.fn();
        choreEvents.on(CHORE_CHANGED, onChange);
        try {
            // create (201)
            const post = await request(app).post('/api/chores').send(BASE_CHORE);
            const id = post.body.data.id;
            expect(onChange).toHaveBeenCalledTimes(1);

            // complete (200)
            await request(app).patch(`/api/chores/${id}/complete`).send({ dateLastCompleted: '2025-06-01T00:00:00.000Z' });
            expect(onChange).toHaveBeenCalledTimes(2);

            // update (200)
            await request(app).put(`/api/chores/${id}`).send({ ...BASE_CHORE, name: 'Mop' });
            expect(onChange).toHaveBeenCalledTimes(3);

            // delete (200)
            await request(app).delete(`/api/chores/${id}`);
            expect(onChange).toHaveBeenCalledTimes(4);

            // failure paths must NOT emit
            await request(app).post('/api/chores').send({ name: 'incomplete' }); // 400
            await request(app).put('/api/chores/9999').send(BASE_CHORE); // 404
            await request(app).patch('/api/chores/9999/complete').send({ dateLastCompleted: '2025-06-01T00:00:00.000Z' }); // 404
            await request(app).delete('/api/chores/9999'); // 404
            expect(onChange).toHaveBeenCalledTimes(4);
        } finally {
            choreEvents.off(CHORE_CHANGED, onChange);
        }
    });
});

describe('GET /api/events SSE stream', () => {
    it('writes a data: changed frame when a mutation emits, then cleans up its listener and heartbeat on close', async () => {
        const baseline = choreEvents.listenerCount(CHORE_CHANGED);
        const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

        // Drive a real socket so we read the live stream rather than a buffered body.
        const server = app.listen(0);
        await new Promise<void>(resolve => server.once('listening', resolve));
        const { port } = server.address() as { port: number };

        const controller = new AbortController();
        const res = await fetch(`http://127.0.0.1:${port}/api/events`, { signal: controller.signal });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        try {
            // Wait until the route has subscribed its listener, then emit.
            await vi.waitFor(() => expect(choreEvents.listenerCount(CHORE_CHANGED)).toBe(baseline + 1));
            choreEvents.emit(CHORE_CHANGED);

            // Read frames until we see the doorbell (initial :ok comment arrives first).
            let buffer = '';
            await vi.waitFor(async () => {
                const { value } = await reader.read();
                if (value) buffer += decoder.decode(value, { stream: true });
                expect(buffer).toContain(`data: ${CHORE_CHANGED}`);
            });
            expect(buffer).toContain(':ok');
        } finally {
            controller.abort();
            await reader.cancel().catch(() => {});
            // The close handler must detach the listener (no leak across reconnects)
            // and clear the heartbeat interval (no leaked timer across reconnects).
            await vi.waitFor(() => expect(choreEvents.listenerCount(CHORE_CHANGED)).toBe(baseline));
            await vi.waitFor(() => expect(clearIntervalSpy).toHaveBeenCalled());
            clearIntervalSpy.mockRestore();
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });
});
