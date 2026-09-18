import { useState, useRef } from 'react';
import type { Chore } from '@customTypes/SharedTypes';
import FormField from './FormField';
import ClearButton from '../common/ClearButton';

type FormState = {
    name: string;
    room: string;
    dateLastCompleted: string;
    duration: string;
    frequency: string;
    urgency: '' | 'low' | 'medium' | 'high';
};

const initialFormState: FormState = {
    name: '',
    room: '',
    dateLastCompleted: '',
    duration: '',
    frequency: '',
    urgency: '',
};

function choreToFormState(chore: Chore): FormState {
    return {
        name: chore.name,
        room: chore.room,
        dateLastCompleted: chore.dateLastCompleted.toISOString().slice(0, 10),
        duration: String(chore.duration),
        frequency: String(chore.frequency),
        urgency: chore.urgency ?? '',
    };
}

type ChoreFormProps = {
    mode?: 'add' | 'edit';
    initialChore?: Chore;
    rooms?: string[];
    onSubmit: (chore: Omit<Chore, 'id'>) => void;
    onCancel: () => void;
};

export default function ChoreForm({ mode = 'add', initialChore, rooms = [], onSubmit, onCancel }: ChoreFormProps) {
    const [formData, setFormData] = useState<FormState>(() =>
        initialChore ? choreToFormState(initialChore) : initialFormState,
    );
    const roomInputRef = useRef<HTMLInputElement>(null);

    function handleFieldChange(name: string, value: string) {
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        onSubmit({
            name: formData.name,
            room: formData.room,
            dateLastCompleted: new Date(formData.dateLastCompleted),
            duration: Number(formData.duration),
            frequency: Number(formData.frequency),
            urgency: formData.urgency || undefined,
        });
        if (mode === 'add') setFormData(initialFormState);
    }

    return (
        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md overflow-y-auto max-h-[90dvh]">
            <h3 className="text-white font-semibold text-lg mb-4">{mode === 'edit' ? 'Edit Chore' : 'Add New Chore'}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <FormField name="name" label="Name" value={formData.name} onChange={handleFieldChange} required autoFocus clearable />
                <div className="flex flex-col gap-1">
                    <label htmlFor="room" className="text-sm text-gray-400 capitalize">Room</label>
                    <div className="relative">
                        <input
                            ref={roomInputRef}
                            id="room"
                            name="room"
                            type="text"
                            list="room-options"
                            value={formData.room}
                            onChange={e => handleFieldChange('room', e.target.value)}
                            required
                            className="bg-gray-700 text-white rounded px-3 py-2 text-sm w-full pr-14"
                        />
                        {formData.room !== '' && (
                            <ClearButton
                                label="Clear Room"
                                onClear={() => {
                                    handleFieldChange('room', '');
                                    roomInputRef.current?.focus();
                                }}
                                anchor="top"
                            />
                        )}
                        <datalist id="room-options">
                            {rooms.map(room => (
                                <option key={room} value={room} />
                            ))}
                        </datalist>
                    </div>
                </div>
                <FormField name="dateLastCompleted" label="Last Completed" value={formData.dateLastCompleted} onChange={handleFieldChange} type="date" required />
                <FormField name="duration" label="Duration (minutes)" value={formData.duration} onChange={handleFieldChange} type="number" required />
                <FormField name="frequency" label="Frequency (days)" value={formData.frequency} onChange={handleFieldChange} type="number" required />

                <div className="flex flex-col gap-1">
                    <label htmlFor="urgency" className="text-sm text-gray-400">Urgency</label>
                    <select
                        id="urgency"
                        value={formData.urgency}
                        onChange={e => setFormData(prev => ({ ...prev, urgency: e.target.value as FormState['urgency'] }))}
                        className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                    >
                        <option value="">None</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>

                <div className="flex gap-3 mt-2">
                    <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg">
                        {mode === 'edit' ? 'Save Changes' : 'Save'}
                    </button>
                    <button type="button" onClick={onCancel} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
