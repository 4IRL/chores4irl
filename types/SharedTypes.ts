export interface Chore {
    id: number;
    name: string; 
    details?: string | null; // optional details about the chore
    category: string[];
    // 'bedroom' | 'kitchen' | 'living room' | 'garage' | 'other'
    dateLastCompleted: Date; // chore last completed on this date
    duration: number; // estimate of how long the chore takes to complete in minutes
    frequency: number; // how often the chore should be completed in days 
    hidden: boolean;
    urgency?: 'low' | 'medium' | 'high';
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}