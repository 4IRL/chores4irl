import { useState } from 'react';
import type { Chore } from '@customTypes/SharedTypes';
import FormField from './FormField';

type FormState = {
    name: string;
    details: string;
    room: string;
    dateLastCompleted: string;
    duration: string;
    frequency: string;
    urgency: '' | 'low' | 'medium' | 'high';
    longTermTask: boolean;
};

const initialFormState: FormState = {
    name: '',
    details: '',
    room: '',
    dateLastCompleted: '',
    duration: '',
    frequency: '',
    urgency: '',
    longTermTask: false,
};

function choreToFormState(chore: Chore): FormState {
    return {
        name: chore.name,
        details: chore.details ?? '',
        room: chore.room,
        dateLastCompleted: chore.dateLastCompleted.toISOString().slice(0, 10),
        duration: String(chore.duration),
        frequency: String(chore.frequency),
        urgency: chore.urgency ?? '',
        longTermTask: chore.longTermTask ?? false,
    };
}

type ChoreFormProps = {
    mode?: 'add' | 'edit';
    initialChore?: Chore;
    onSubmit: (chore: Omit<Chore, 'id'>) => void;
    onCancel: () => void;
};

export default function ChoreForm({ mode = 'add', initialChore, onSubmit, onCancel }: ChoreFormProps) {
    const [formData, setFormData] = useState<FormState>(() =>
        initialChore ? choreToFormState(initialChore) : initialFormState,
    );

    function handleFieldChange(name: string, value: string) {
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        onSubmit({
            name: formData.name,
            details: formData.details || null,
            room: formData.room,
            dateLastCompleted: new Date(formData.dateLastCompleted),
            duration: Number(formData.duration),
            frequency: Number(formData.frequency),
            urgency: formData.urgency || undefined,
            longTermTask: formData.longTermTask || undefined,
        });
        if (mode === 'add') setFormData(initialFormState);
    }

    return (
        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md overflow-y-auto max-h-[90dvh]">
            <h3 className="text-white font-semibold text-lg mb-4">{mode === 'edit' ? 'Edit Chore' : 'Add New Chore'}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <FormField name="name" label="Name" value={formData.name} onChange={handleFieldChange} required autoFocus />
                <FormField name="details" label="Details" value={formData.details} onChange={handleFieldChange} />
                <FormField name="room" label="Room" value={formData.room} onChange={handleFieldChange} required />
                <FormField name="dateLastCompleted" label="Last Completed" value={formData.dateLastCompleted} onChange={handleFieldChange} type="date" required />
                <FormField name="duration" label="Duration (minutes)" value={formData.duration} onChange={handleFieldChange} type="number" required />
                <FormField name="frequency" label="Frequency (days)" value={formData.frequency} onChange={handleFieldChange} type="number" required />

                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-400">Urgency</label>
                    <select
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

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="longTermTask"
                        checked={formData.longTermTask}
                        onChange={e => setFormData(prev => ({ ...prev, longTermTask: e.target.checked }))}
                        className="accent-indigo-500"
                    />
                    <label htmlFor="longTermTask" className="text-sm text-gray-400">Long-term task</label>
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
