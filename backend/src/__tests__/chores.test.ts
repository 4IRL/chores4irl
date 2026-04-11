import { describe, it, expect, beforeEach } from 'vitest';
import { getAllChores, createChore, completeChore, deleteChore } from '../chores.js';
import { db } from '../db.js';

beforeEach(() => {
    db.exec('DELETE FROM chores');
});

describe('getAllChores', () => {
    it('returns empty array when table is empty', () => {
        expect(getAllChores()).toEqual([]);
    });

    it('returns all rows ordered by id', () => {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, long_term_task)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 0),
                   ('Mop', 'Kitchen', '2025-01-02T00:00:00.000Z', 20, 7, 0)`);
        const chores = getAllChores();
        expect(chores).toHaveLength(2);
        expect(chores[0].name).toBe('Sweep');
        expect(chores[1].name).toBe('Mop');
    });
});

describe('createChore', () => {
    it('inserts a chore and returns it with an id', () => {
        const input = {
            name: 'Test Chore',
            room: 'Bathroom',
            dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
            duration: 15,
            frequency: 7,
        };
        const created = createChore(input);
        expect(created.id).toBeGreaterThan(0);
        expect(created.name).toBe('Test Chore');
        expect(created.room).toBe('Bathroom');
        expect(created.dateLastCompleted).toBe('2025-01-01T00:00:00.000Z');
        expect(created.duration).toBe(15);
        expect(created.frequency).toBe(7);
        expect(created.urgency).toBeUndefined();
        expect(created.longTermTask).toBeUndefined();
    });

    it('persists optional fields: details, urgency, longTermTask', () => {
        const input = {
            name: 'Filter',
            room: 'Basement',
            dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
            duration: 10,
            frequency: 90,
            details: 'Replace HVAC filter',
            urgency: 'low' as const,
            longTermTask: true,
        };
        const created = createChore(input);
        expect(created.details).toBe('Replace HVAC filter');
        expect(created.urgency).toBe('low');
        expect(created.longTermTask).toBe(true);
    });
});

describe('completeChore', () => {
    it('updates date_last_completed and returns the updated row', () => {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, long_term_task)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 0)`);
        const id = (db.prepare('SELECT id FROM chores').get() as { id: number }).id;
        const newDate = '2025-06-01T00:00:00.000Z';
        const result = completeChore(id, newDate);
        expect(result).not.toBeNull();
        expect(result!.dateLastCompleted).toBe(newDate);
        expect(result!.id).toBe(id);
    });

    it('returns null when the id does not exist', () => {
        expect(completeChore(9999, '2025-06-01T00:00:00.000Z')).toBeNull();
    });
});

describe('deleteChore', () => {
    it('removes the row and returns true', () => {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, long_term_task)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 0)`);
        const id = (db.prepare('SELECT id FROM chores').get() as { id: number }).id;
        expect(deleteChore(id)).toBe(true);
        expect(getAllChores()).toHaveLength(0);
    });

    it('returns false when the id does not exist', () => {
        expect(deleteChore(9999)).toBe(false);
    });
});
