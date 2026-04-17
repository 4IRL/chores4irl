import express from 'express';
import { getAllChores, createChore, completeChore, deleteChore } from './chores.js';
import type { Chore, ApiResponse } from '../../types/SharedTypes.js';

const app = express();
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
});
app.use(express.json());

app.get('/api/chores', (_req, res) => {
    try {
        const data = getAllChores();
        res.json({ success: true, data } satisfies ApiResponse<typeof data>);
    } catch {
        res.status(500).json({ success: false, error: 'Failed to fetch chores' } satisfies ApiResponse<never>);
    }
});

app.post('/api/chores', (req, res) => {
    const body = req.body as Omit<Chore, 'id'>;
    if (!body.name || !body.room || !body.dateLastCompleted || body.duration == null || body.frequency == null) {
        return res.status(400).json({ success: false, error: 'Missing required fields' } satisfies ApiResponse<never>);
    }
    try {
        const data = createChore(body);
        return res.status(201).json({ success: true, data } satisfies ApiResponse<typeof data>);
    } catch {
        return res.status(500).json({ success: false, error: 'Failed to create chore' } satisfies ApiResponse<never>);
    }
});

app.patch('/api/chores/:id/complete', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid id' } satisfies ApiResponse<never>);
    }
    const { dateLastCompleted } = req.body as { dateLastCompleted: string };
    if (!dateLastCompleted) {
        return res.status(400).json({ success: false, error: 'dateLastCompleted is required' } satisfies ApiResponse<never>);
    }
    try {
        const data = completeChore(id, dateLastCompleted);
        if (!data) {
            return res.status(404).json({ success: false, error: 'Chore not found' } satisfies ApiResponse<never>);
        }
        return res.json({ success: true, data } satisfies ApiResponse<typeof data>);
    } catch {
        return res.status(500).json({ success: false, error: 'Failed to update chore' } satisfies ApiResponse<never>);
    }
});

app.delete('/api/chores/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid id' } satisfies ApiResponse<never>);
    }
    try {
        if (!deleteChore(id)) {
            return res.status(404).json({ success: false, error: 'Chore not found' } satisfies ApiResponse<never>);
        }
        return res.json({ success: true, data: null } satisfies ApiResponse<null>);
    } catch {
        return res.status(500).json({ success: false, error: 'Failed to delete chore' } satisfies ApiResponse<never>);
    }
});

export default app;
