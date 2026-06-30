import express from 'express';
import { getAllChores, createChore, completeChore, deleteChore, updateChore } from './chores.js';
import { choreEvents, CHORE_CHANGED } from './events.js';
import type { Chore, ApiResponse } from '../../types/SharedTypes.js';

const app = express();
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

// Server-Sent Events stream: pushes a lightweight "chores changed" doorbell to
// every connected device whenever any mutation succeeds. Clients re-pull the
// full list from GET /api/chores on each signal. One-directional over plain
// HTTP, so the browser EventSource reconnects automatically on drop.
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(':ok\n\n'); // initial comment so proxies open the stream immediately

    const onChange = () => res.write(`data: ${CHORE_CHANGED}\n\n`);
    choreEvents.on(CHORE_CHANGED, onChange);

    // Heartbeat keeps the connection alive through idle-connection reapers
    // (proxies, phones). EventSource transparently reconnects if it still drops.
    const heartbeat = setInterval(() => res.write(':ping\n\n'), 25_000);

    req.on('close', () => {
        clearInterval(heartbeat);
        choreEvents.off(CHORE_CHANGED, onChange);
    });
});

app.post('/api/chores', (req, res) => {
    const body = req.body as Omit<Chore, 'id'>;
    if (!body.name || !body.room || !body.dateLastCompleted || body.duration == null || body.frequency == null) {
        return res.status(400).json({ success: false, error: 'Missing required fields' } satisfies ApiResponse<never>);
    }
    try {
        const data = createChore(body);
        choreEvents.emit(CHORE_CHANGED);
        return res.status(201).json({ success: true, data } satisfies ApiResponse<typeof data>);
    } catch {
        return res.status(500).json({ success: false, error: 'Failed to create chore' } satisfies ApiResponse<never>);
    }
});

app.put('/api/chores/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid id' } satisfies ApiResponse<never>);
    }
    const body = req.body as Omit<Chore, 'id'>;
    if (!body.name || !body.room || !body.dateLastCompleted || body.duration == null || body.frequency == null) {
        return res.status(400).json({ success: false, error: 'Missing required fields' } satisfies ApiResponse<never>);
    }
    try {
        const data = updateChore(id, body);
        if (!data) {
            return res.status(404).json({ success: false, error: 'Chore not found' } satisfies ApiResponse<never>);
        }
        choreEvents.emit(CHORE_CHANGED);
        return res.json({ success: true, data } satisfies ApiResponse<typeof data>);
    } catch {
        return res.status(500).json({ success: false, error: 'Failed to update chore' } satisfies ApiResponse<never>);
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
        choreEvents.emit(CHORE_CHANGED);
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
        choreEvents.emit(CHORE_CHANGED);
        return res.json({ success: true, data: null } satisfies ApiResponse<null>);
    } catch {
        return res.status(500).json({ success: false, error: 'Failed to delete chore' } satisfies ApiResponse<never>);
    }
});

export default app;
