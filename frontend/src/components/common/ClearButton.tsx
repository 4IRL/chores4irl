import { X } from 'lucide-react';

type ClearButtonProps = { label: string; onClick: () => void };

export default function ClearButton({ label, onClick }: ClearButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Clear ${label}`}
      onClick={onClick}
      className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded text-gray-400 hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
    >
      <X size={16} aria-hidden="true" />
    </button>
  );
}
