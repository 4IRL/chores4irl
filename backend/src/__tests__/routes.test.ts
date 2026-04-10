import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { db } from '../db.js';

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

describe('GET /api/chores', () => {
    it('returns 200 with empty data array when table is empty', async () => {
        const res = await request(app).get('/api/chores');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, data: [] });
    });

    it('returns 200 with all chores when table has rows', async () => {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, long_term_task)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 0)`);
        const res = await request(app).get('/api/chores');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toBe('Sweep');
    });
});

describe('POST /api/chores', () => {
    it('returns 201 with the created chore', async () => {
        const res = await request(app).post('/api/chores').send(BASE_CHORE);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBeGreaterThan(0);
        expect(res.body.data.name).toBe('Sweep');
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await request(app).post('/api/chores').send({ name: 'Only name' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});

describe('PATCH /api/chores/:id/complete', () => {
    it('returns 200 with the updated chore', async () => {
        const post = await request(app).post('/api/chores').send(BASE_CHORE);
        const id = post.body.data.id;
        const newDate = '2025-06-01T00:00:00.000Z';
        const res = await request(app)
            .patch(`/api/chores/${id}/complete`)
            .send({ dateLastCompleted: newDate });
        expect(res.status).toBe(200);
        expect(res.body.data.dateLastCompleted).toBe(newDate);
    });

    it('returns 404 when chore does not exist', async () => {
        const res = await request(app)
            .patch('/api/chores/9999/complete')
            .send({ dateLastCompleted: '2025-06-01T00:00:00.000Z' });
        expect(res.status).toBe(404);
    });

    it('returns 400 when dateLastCompleted is missing', async () => {
        const res = await request(app).patch('/api/chores/1/complete').send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 when id is not a number', async () => {
        const res = await request(app)
            .patch('/api/chores/abc/complete')
            .send({ dateLastCompleted: '2025-06-01T00:00:00.000Z' });
        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/chores/:id', () => {
    it('returns 200 with null data after deletion', async () => {
        const post = await request(app).post('/api/chores').send(BASE_CHORE);
        const id = post.body.data.id;
        const res = await request(app).delete(`/api/chores/${id}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, data: null });
    });

    it('returns 404 when chore does not exist', async () => {
        const res = await request(app).delete('/api/chores/9999');
        expect(res.status).toBe(404);
    });

    it('returns 400 when id is not a number', async () => {
        const res = await request(app).delete('/api/chores/abc');
        expect(res.status).toBe(400);
    });
});
