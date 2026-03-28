export interface Chore {
    id: number;
    name: string;
    details?: string | null;
    room: string;
    dateLastCompleted: Date;
    duration: number;
    frequency: number;
    urgency?: 'low' | 'medium' | 'high';
    longTermTask?: boolean;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}