// Declarations only — no runtime values. Every consumer imports these with
// `import type`, so nothing is emitted at runtime. If a runtime export (enum,
// const, function) is ever needed, rename this back to SharedTypes.ts.
export interface Chore {
    id: number;
    name: string;
    room: string;
    dateLastCompleted: Date;
    duration: number;
    frequency: number;
    urgency?: 'low' | 'medium' | 'high';
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}