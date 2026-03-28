import { db } from './db.js';
import type { Chore } from '../../types/SharedTypes.js';

type ChoreRow = {
    id: number;
    name: string;
    details: string | null;
    room: string;
    date_last_completed: string;
    duration: number;
    frequency: number;
    urgency: 'low' | 'medium' | 'high' | null;
    long_term_task: number;
};

type ChoreWire = Omit<Chore, 'dateLastCompleted'> & { dateLastCompleted: string };

function rowToChore(row: ChoreRow): ChoreWire {
    return {
        id: row.id,
        name: row.name,
        details: row.details ?? null,
        room: row.room,
        dateLastCompleted: row.date_last_completed,
        duration: row.duration,
        frequency: row.frequency,
        urgency: row.urgency ?? undefined,
        longTermTask: row.long_term_task === 1 ? true : undefined,
    };
}

export function getAllChores(): ChoreWire[] {
    return (db.prepare('SELECT * FROM chores ORDER BY id').all() as ChoreRow[]).map(rowToChore);
}

export function createChore(input: Omit<Chore, 'id'>): ChoreWire {
    const result = db.prepare(`
        INSERT INTO chores (name, details, room, date_last_completed, duration, frequency, urgency, long_term_task)
        VALUES (@name, @details, @room, @date_last_completed, @duration, @frequency, @urgency, @long_term_task)
    `).run({
        name: input.name,
        details: input.details ?? null,
        room: input.room,
        date_last_completed: input.dateLastCompleted instanceof Date
            ? input.dateLastCompleted.toISOString()
            : String(input.dateLastCompleted),
        duration: input.duration,
        frequency: input.frequency,
        urgency: input.urgency ?? null,
        long_term_task: input.longTermTask ? 1 : 0,
    });
    return rowToChore(db.prepare('SELECT * FROM chores WHERE id = ?').get(result.lastInsertRowid) as ChoreRow);
}

export function completeChore(id: number, dateLastCompleted: string): ChoreWire | null {
    const result = db.prepare('UPDATE chores SET date_last_completed = ? WHERE id = ?').run(dateLastCompleted, id);
    if (result.changes === 0) return null;
    return rowToChore(db.prepare('SELECT * FROM chores WHERE id = ?').get(id) as ChoreRow);
}

export function deleteChore(id: number): boolean {
    return db.prepare('DELETE FROM chores WHERE id = ?').run(id).changes > 0;
}
