import { useState } from 'react';
import type { Chore, Room } from '@customTypes/SharedTypes';
import { formatFormDate, parseFormDate } from '@utils/formDate';
import FormField from './FormField';

type FormState = {
  name: string;
  details: string;
  roomId: string;
  dateLastCompleted: string;
  duration: string;
  frequency: string;
  urgency: '' | 'low' | 'medium' | 'high';
  longTermTask: boolean;
};

function buildInitialFormState(defaultRoomId?: string): FormState {
  return {
    name: '',
    details: '',
    roomId: defaultRoomId && defaultRoomId !== 'all' ? defaultRoomId : '',
    dateLastCompleted: '',
    duration: '',
    frequency: '',
    urgency: '',
    longTermTask: false,
  };
}

function choreToFormState(chore: Chore, householdTimezone: string): FormState {
  return {
    name: chore.name,
    details: chore.details ?? '',
    roomId: String(chore.roomId),
    dateLastCompleted: formatFormDate(chore.dateLastCompleted, householdTimezone),
    duration: String(chore.duration),
    frequency: String(chore.frequency),
    urgency: chore.urgency ?? '',
    longTermTask: chore.longTermTask ?? false,
  };
}

type ChoreFormProps = {
  mode?: 'add' | 'edit';
  initialChore?: Chore;
  defaultRoomId?: string;
  rooms: Room[];
  householdTimezone: string;
  onSubmit: (chore: Omit<Chore, 'id'>) => void;
  onCancel: () => void;
};

export default function ChoreForm({
  mode = 'add',
  initialChore,
  defaultRoomId,
  rooms,
  householdTimezone,
  onSubmit,
  onCancel,
}: ChoreFormProps) {
  const [formData, setFormData] = useState<FormState>(() =>
    initialChore ? choreToFormState(initialChore, householdTimezone) : buildInitialFormState(defaultRoomId),
  );

  function handleFieldChange(name: string, value: string) {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.roomId) return;
    onSubmit({
      name: formData.name,
      details: formData.details || null,
      roomId: Number(formData.roomId),
      dateLastCompleted: parseFormDate(formData.dateLastCompleted, householdTimezone),
      duration: Number(formData.duration),
      frequency: Number(formData.frequency),
      urgency: formData.urgency || undefined,
      longTermTask: formData.longTermTask || undefined,
    });
    if (mode === 'add') setFormData(buildInitialFormState(defaultRoomId));
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md overflow-y-auto max-h-[90dvh]">
      <h3 className="text-white font-semibold text-lg mb-4">
        {mode === 'edit' ? 'Edit Chore' : 'Add New Chore'}
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormField
          name="name"
          label="Name"
          value={formData.name}
          onChange={handleFieldChange}
          required
          autoFocus
          clearable
        />
        <FormField
          name="details"
          label="Details"
          value={formData.details}
          onChange={handleFieldChange}
          clearable
        />
        <FormField
          name="dateLastCompleted"
          label="Last Completed"
          value={formData.dateLastCompleted}
          onChange={handleFieldChange}
          type="date"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="roomId" className="text-sm text-gray-400">
              Room
            </label>
            <select
              id="roomId"
              value={formData.roomId}
              onChange={(e) => handleFieldChange('roomId', e.target.value)}
              required
              // 16px below sm avoids iOS Safari's zoom-on-focus for <select>.
              className="bg-gray-700 text-white rounded px-3 py-2 text-base sm:text-sm"
            >
              <option value="" disabled>
                Select a room
              </option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400">Urgency</label>
            <select
              value={formData.urgency}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, urgency: e.target.value as FormState['urgency'] }))
              }
              // 16px below sm avoids iOS Safari's zoom-on-focus for <select>.
              className="bg-gray-700 text-white rounded px-3 py-2 text-base sm:text-sm"
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            name="duration"
            label="Duration (minutes)"
            value={formData.duration}
            onChange={handleFieldChange}
            type="number"
            required
          />
          <FormField
            name="frequency"
            label="Frequency (days)"
            value={formData.frequency}
            onChange={handleFieldChange}
            type="number"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="longTermTask"
            checked={formData.longTermTask}
            onChange={(e) => setFormData((prev) => ({ ...prev, longTermTask: e.target.checked }))}
            className="accent-indigo-500"
          />
          <label htmlFor="longTermTask" className="text-sm text-gray-400">
            Long-term task
          </label>
        </div>

        <div className="flex gap-3 mt-2">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            {mode === 'edit' ? 'Save Changes' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
