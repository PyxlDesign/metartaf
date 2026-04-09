'use client';
import type { ViewMode } from '@/lib/types';

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'raw',         label: 'Raw' },
  { value: 'decoded',     label: 'Decoded' },
  { value: 'side-by-side', label: 'Side by Side' },
];

export default function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-600 w-fit">
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
            mode === value
              ? 'bg-sky-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
