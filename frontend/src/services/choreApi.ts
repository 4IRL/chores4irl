import type { Chore, ApiResponse } from '@customTypes/SharedTypes';

type ChoreWire = Omit<Chore, 'dateLastCompleted'> & { dateLastCompleted: string };

function parseChore(wire: ChoreWire): Chore {
    return { ...wire, dateLastCompleted: new Date(wire.dateLastCompleted) };
}

async function handleResponse<T>(res: Response): Promise<T> {
    const json: ApiResponse<T> = await res.json();
    if (!json.success || json.data === undefined) {
        throw new Error(json.error ?? 'Unknown API error');
    }
    return json.data;
}

export async function fetchAllChores(): Promise<Chore[]> {
    const wires = await handleResponse<ChoreWire[]>(await fetch('/api/chores'));
    return wires.map(parseChore);
}

export async function addChore(newChore: Omit<Chore, 'id'>): Promise<Chore> {
    const res = await fetch('/api/chores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...newChore,
            dateLastCompleted: newChore.dateLastCompleted instanceof Date
                ? newChore.dateLastCompleted.toISOString()
                : newChore.dateLastCompleted,
        }),
    });
    return parseChore(await handleResponse<ChoreWire>(res));
}

export async function completeChore(id: number, date: Date): Promise<Chore> {
    const res = await fetch(`/api/chores/${id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateLastCompleted: date.toISOString() }),
    });
    return parseChore(await handleResponse<ChoreWire>(res));
}

export async function removeChore(id: number): Promise<void> {
    await handleResponse<null>(await fetch(`/api/chores/${id}`, { method: 'DELETE' }));
}
