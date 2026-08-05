"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export default function LocationAutocomplete({ value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (value.trim().length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(value)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { results: Suggestion[] };
        setSuggestions(data.results ?? []);
      } catch {
        // Ignore transient failures; the user can still type a location manually.
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function select(suggestion: Suggestion) {
    onChange(suggestion.address ? `${suggestion.name}, ${suggestion.address}` : suggestion.name);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="예: 강남역, 서울시청"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((suggestion, i) => (
            <li key={`${suggestion.name}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(suggestion)}
                className="w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-medium text-slate-900">{suggestion.name}</div>
                {suggestion.address && (
                  <div className="text-xs text-slate-400">{suggestion.address}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
