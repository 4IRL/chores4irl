import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllChores, addChore, completeChore, removeChore } from '../../services/choreApi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse<T>(data: T, status = 200) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve({ success: true, data }),
    } as Response);
}

const WIRE_CHORE = {
    id: 1, name: 'Sweep', room: 'Kitchen',
    dateLastCompleted: '2025-01-01T00:00:00.000Z',
    duration: 10, frequency: 7,
};

beforeEach(() => mockFetch.mockReset());

describe('fetchAllChores', () => {
    it('returns parsed Chore array with dateLastCompleted as Date', async () => {
        mockFetch.mockReturnValue(mockResponse([WIRE_CHORE]));
        const result = await fetchAllChores();
        expect(result).toHaveLength(1);
        expect(result[0].dateLastCompleted).toBeInstanceOf(Date);
        expect(result[0].dateLastCompleted.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('throws when API returns success: false', async () => {
        mockFetch.mockReturnValue(Promise.resolve({
            json: () => Promise.resolve({ success: false, error: 'Server error' }),
        } as Response));
        await expect(fetchAllChores()).rejects.toThrow('Server error');
    });
});

describe('addChore', () => {
    it('sends POST with ISO date string and returns parsed Chore', async () => {
        mockFetch.mockReturnValue(mockResponse(WIRE_CHORE));
        const input = {
            name: 'Sweep', room: 'Kitchen',
            dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
            duration: 10, frequency: 7,
        };
        const result = await addChore(input);
        expect(result.dateLastCompleted).toBeInstanceOf(Date);
        const call = mockFetch.mock.calls[0];
        const body = JSON.parse(call[1].body);
        expect(body.dateLastCompleted).toBe('2025-01-01T00:00:00.000Z');
    });
});

describe('completeChore', () => {
    it('sends PATCH with ISO date and returns updated Chore', async () => {
        mockFetch.mockReturnValue(mockResponse(WIRE_CHORE));
        const result = await completeChore(1, new Date('2025-01-01T00:00:00.000Z'));
        expect(result.dateLastCompleted).toBeInstanceOf(Date);
        const call = mockFetch.mock.calls[0];
        expect(call[0]).toBe('/api/chores/1/complete');
        expect(call[1].method).toBe('PATCH');
    });
});

describe('removeChore', () => {
    it('sends DELETE and resolves without error', async () => {
        mockFetch.mockReturnValue(mockResponse(null));
        await expect(removeChore(1)).resolves.toBeUndefined();
        const call = mockFetch.mock.calls[0];
        expect(call[0]).toBe('/api/chores/1');
        expect(call[1].method).toBe('DELETE');
    });
});
