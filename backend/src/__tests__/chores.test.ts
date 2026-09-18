import { describe, it, expect, beforeEach } from 'vitest';
import { getAllChores, createChore, completeChore, deleteChore, updateChore } from '../chores.js';
import { db } from '../db.js';
import type { Chore } from '../../../types/SharedTypes.js';

beforeEach(() => {
    db.exec('DELETE FROM chores');
});

describe('getAllChores', () => {
    it('returns empty array when table is empty', () => {
        expect(getAllChores()).toEqual([]);
    });

    it('returns all rows ordered by id', () => {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7),
                   ('Mop', 'Kitchen', '2025-01-02T00:00:00.000Z', 20, 7)`);
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
        expect(created).not.toHaveProperty('longTermTask');
        expect(created).not.toHaveProperty('details');
    });

    it('persists the optional urgency field', () => {
        const input = {
            name: 'Filter',
            room: 'Basement',
            dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
            duration: 10,
            frequency: 90,
            urgency: 'low' as const,
        };
        const created = createChore(input);
        expect(created.urgency).toBe('low');
    });

    it('ignores legacy details/longTermTask keys sent by a stale client', () => {
        const created = createChore({
            name: 'Sweep',
            room: 'Kitchen',
            dateLastCompleted: new Date('2025-01-02T00:00:00.000Z'),
            duration: 10,
            frequency: 7,
            details: 'stale',
            longTermTask: true,
        } as unknown as Omit<Chore, 'id'>);
        expect(created.name).toBe('Sweep');
        expect(created).not.toHaveProperty('details');
        expect(created).not.toHaveProperty('longTermTask');
    });
});

describe('completeChore', () => {
    it('updates date_last_completed and returns the updated row', () => {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7)`);
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

describe('updateChore', () => {
    function seedRow(): number {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, urgency)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, NULL)`);
        return (db.prepare('SELECT id FROM chores').get() as { id: number }).id;
    }

    it('updates all editable fields and returns the updated row', () => {
        const id = seedRow();
        const result = updateChore(id, {
            name: 'Mop',
            room: 'Bathroom',
            dateLastCompleted: new Date('2025-02-02T00:00:00.000Z'),
            duration: 20,
            frequency: 14,
            urgency: 'high',
        });
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Mop');
        expect(result!.room).toBe('Bathroom');
        expect(result!.dateLastCompleted).toBe('2025-02-02T00:00:00.000Z');
        expect(result!.duration).toBe(20);
        expect(result!.frequency).toBe(14);
        expect(result!.urgency).toBe('high');
        expect(result!.id).toBe(id);
        expect(result).not.toHaveProperty('details');
        expect(result).not.toHaveProperty('longTermTask');
    });

    it('clears optional fields when omitted', () => {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, urgency)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 'medium')`);
        const id = (db.prepare('SELECT id FROM chores').get() as { id: number }).id;
        const result = updateChore(id, {
            name: 'Mop',
            room: 'Bathroom',
            dateLastCompleted: new Date('2025-02-02T00:00:00.000Z'),
            duration: 20,
            frequency: 14,
        });
        expect(result).not.toBeNull();
        expect(result!.urgency).toBeUndefined();
    });

    it('a no-op save (identical values) still returns the row, not null', () => {
        const id = seedRow();
        const result = updateChore(id, {
            name: 'Sweep',
            room: 'Kitchen',
            dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
            duration: 10,
            frequency: 7,
        });
        expect(result).not.toBeNull();
        expect(result!.id).toBe(id);
    });

    it('ignores legacy details/longTermTask keys sent by a stale client', () => {
        const id = seedRow();
        const result = updateChore(id, {
            name: 'Sweep',
            room: 'Kitchen',
            dateLastCompleted: new Date('2025-01-02T00:00:00.000Z'),
            duration: 10,
            frequency: 7,
            details: 'stale',
            longTermTask: true,
        } as unknown as Omit<Chore, 'id'>);
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Sweep');
        expect(result).not.toHaveProperty('details');
        expect(result).not.toHaveProperty('longTermTask');
    });

    it('returns null when the id does not exist', () => {
        expect(updateChore(9999, {
            name: 'Mop',
            room: 'Bathroom',
            dateLastCompleted: new Date('2025-02-02T00:00:00.000Z'),
            duration: 20,
            frequency: 14,
        })).toBeNull();
    });
});

describe('deleteChore', () => {
    it('removes the row and returns true', () => {
        db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency)
            VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7)`);
        const id = (db.prepare('SELECT id FROM chores').get() as { id: number }).id;
        expect(deleteChore(id)).toBe(true);
        expect(getAllChores()).toHaveLength(0);
    });

    it('returns false when the id does not exist', () => {
        expect(deleteChore(9999)).toBe(false);
    });
});
