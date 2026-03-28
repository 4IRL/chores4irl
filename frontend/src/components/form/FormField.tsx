type FormFieldProps = {
    name: string;
    label: string;
    value: string | number;
    onChange: (name: string, value: string) => void;
    type?: 'text' | 'number' | 'date';
    required?: boolean;
    autoFocus?: boolean;
};

export default function FormField({
    name,
    label,
    value,
    onChange,
    type = 'text',
    required = false,
    autoFocus = false,
}: FormFieldProps) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400 capitalize">{label}</label>
            <input
                name={name}
                type={type}
                value={value}
                onChange={e => onChange(name, e.target.value)}
                required={required}
                autoFocus={autoFocus}
                className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
            />
        </div>
    );
}
