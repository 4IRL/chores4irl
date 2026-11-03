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
  clearable?: boolean;
};

// iOS Safari zooms the whole page in on focus for any text input under
// 16px, and doesn't zoom back out once the field blurs/unmounts —
// text-base (16px) below the sm breakpoint avoids triggering it.
const INPUT_CLASS = 'bg-gray-700 text-white rounded px-3 py-2 text-base sm:text-sm';

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
  // Fail closed: only an explicit `clearable` on a text input enables the clear button.
  const showClearable = clearable === true && type === 'text';

  function handleClear() {
    onChange(name, '');
    inputRef.current?.focus();
  }

  const input = (
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      required={required}
      autoFocus={autoFocus}
      ref={inputRef}
      className={showClearable ? `${INPUT_CLASS} w-full pr-11` : INPUT_CLASS}
    />
  );

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm text-gray-400 capitalize">
        {label}
      </label>
      {showClearable ? (
        <div className="relative">
          {input}
          {String(value) !== '' && <ClearButton label={label} onClick={handleClear} />}
        </div>
      ) : (
        input
      )}
    </div>
  );
}
