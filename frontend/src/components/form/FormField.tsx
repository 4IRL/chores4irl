import { useRef } from 'react';
import ClearButton from '../common/ClearButton';

type FormFieldProps = {
    name: string;
    label: string;
    value: string | number;
    onChange: (name: string, value: string) => void;
    type?: 'text' | 'number' | 'date';
    required?: boolean;
    autoFocus?: boolean;
    /** Intended for text-like fields only; renders a clear-✕ once the field has content. */
    clearable?: boolean;
};

export default function FormField({
    name,
    label,
    value,
    onChange,
    type = 'text',
    required = false,
    autoFocus = false,
    clearable = false,
}: FormFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={name} className="text-sm text-gray-400 capitalize">{label}</label>
            <div className="relative">
                <input
                    ref={inputRef}
                    id={name}
                    name={name}
                    type={type}
                    value={value}
                    onChange={e => onChange(name, e.target.value)}
                    required={required}
                    autoFocus={autoFocus}
                    className={`bg-gray-700 text-white rounded px-3 py-2 text-sm w-full ${clearable ? 'pr-14' : ''}`}
                />
                {clearable && value !== '' && (
                    <ClearButton
                        label={`Clear ${label}`}
                        onClear={() => {
                            onChange(name, '');
                            inputRef.current?.focus();
                        }}
                        anchor="top"
                    />
                )}
            </div>
        </div>
    );
}
