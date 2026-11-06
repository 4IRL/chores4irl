import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Search } from 'lucide-react';
import ClearButton from '../common/ClearButton';

type ChoreSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  // Called after onChange('') instead of refocusing when the clear happened
  // while the input was disabled (a disabled input cannot take focus).
  onClearWhileDisabled?: () => void;
};

const ChoreSearchInput = forwardRef<HTMLInputElement, ChoreSearchInputProps>(function ChoreSearchInput(
  { value, onChange, disabled = false, onFocus, onBlur, onClearWhileDisabled },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  function handleClear() {
    onChange('');
    if (disabled) onClearWhileDisabled?.();
    else inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onChange('');
    } else if (event.key === 'Enter') {
      event.preventDefault();
      inputRef.current?.blur();
    }
  }

  // Tapping the clear button must not blur a focused input.
  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target !== inputRef.current && target.closest('button')) event.preventDefault();
  }

  return (
    <div role="search" className="relative flex-1" onMouseDown={handleMouseDown}>
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        aria-label="Search chores"
        placeholder="Search chores"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        className="w-full min-h-[44px] bg-gray-700 text-white rounded-lg pl-9 pr-11 py-2 text-base sm:text-sm placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-50"
      />
      {value !== '' && <ClearButton label="search" onClick={handleClear} />}
    </div>
  );
});

export default ChoreSearchInput;
