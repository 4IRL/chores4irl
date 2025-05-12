export interface Chore {
    id: number;
    name: string;
    details: string;
    locationLabel: 'bedroom' | 'kitchen' | 'living room' | 'garage' | 'other';
    frequency: number;
    daysElapsed: number;
    lastCompleted: Date;
    hidden: boolean;
    quantity: string;
    urgency: 'low' | 'medium' | 'high';
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
  }