import { db } from './db.js';
import type { Chore } from '../../types/SharedTypes.js';

type ChoreRow = {
    id: number;
    name: string;
    room: string;
    date_last_completed: string;
    duration: number;
    frequency: number;
    urgency: 'low' | 'medium' | 'high' | null;
};

type ChoreWire = Omit<Chore, 'dateLastCompleted'> & { dateLastCompleted: string };

function rowToChore(row: ChoreRow): ChoreWire {
    return {
        id: row.id,
        name: row.name,
        room: row.room,
        dateLastCompleted: row.date_last_completed,
        duration: row.duration,
        frequency: row.frequency,
        urgency: row.urgency ?? undefined,
    };
}

export function getAllChores(): ChoreWire[] {
    return (db.prepare('SELECT * FROM chores ORDER BY id').all() as ChoreRow[]).map(rowToChore);
}

export function createChore(input: Omit<Chore, 'id'>): ChoreWire {
    const result = db.prepare(`
        INSERT INTO chores (name, room, date_last_completed, duration, frequency, urgency)
        VALUES (@name, @room, @date_last_completed, @duration, @frequency, @urgency)
    `).run({
        name: input.name,
        room: input.room,
        date_last_completed: input.dateLastCompleted instanceof Date
            ? input.dateLastCompleted.toISOString()
            : String(input.dateLastCompleted),
        duration: input.duration,
        frequency: input.frequency,
        urgency: input.urgency ?? null,
    });
    return rowToChore(db.prepare('SELECT * FROM chores WHERE id = ?').get(result.lastInsertRowid) as ChoreRow);
}

export function completeChore(id: number, dateLastCompleted: string): ChoreWire | null {
    const result = db.prepare('UPDATE chores SET date_last_completed = ? WHERE id = ?').run(dateLastCompleted, id);
    if (result.changes === 0) return null;
    return rowToChore(db.prepare('SELECT * FROM chores WHERE id = ?').get(id) as ChoreRow);
}

export function updateChore(id: number, input: Omit<Chore, 'id'>): ChoreWire | null {
    const result = db.prepare(`
        UPDATE chores
        SET name = @name, room = @room,
            date_last_completed = @date_last_completed, duration = @duration,
            frequency = @frequency, urgency = @urgency
        WHERE id = @id
    `).run({
        id,
        name: input.name,
        room: input.room,
        date_last_completed: input.dateLastCompleted instanceof Date
            ? input.dateLastCompleted.toISOString()
            : String(input.dateLastCompleted),
        duration: input.duration,
        frequency: input.frequency,
        urgency: input.urgency ?? null,
    });
    if (result.changes === 0) return null;
    return rowToChore(db.prepare('SELECT * FROM chores WHERE id = ?').get(id) as ChoreRow);
}

export function deleteChore(id: number): boolean {
    return db.prepare('DELETE FROM chores WHERE id = ?').run(id).changes > 0;
}
