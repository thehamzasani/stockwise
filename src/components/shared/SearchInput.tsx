// src/components/shared/SearchInput.tsx
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Debounce delay in ms. Defaults to 300. */
  debounce?: number;
  autoFocus?: boolean;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  debounce = 300,
  autoFocus = false,
}: SearchInputProps) {
  // Internal state tracks the raw input; debounced value fires onChange
  const [internal, setInternal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep internal in sync if parent resets value externally
  useEffect(() => {
    setInternal(value);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setInternal(next);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(next);
    }, debounce);
  }

  function handleClear() {
    setInternal("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange("");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 text-[#9ca3af]"
      />
      <input
        type="text"
        value={internal}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "h-9 w-full rounded-[7px] border border-[#e4e7ec] bg-white pl-8 pr-8",
          "text-sm text-[#111827] placeholder:text-[#9ca3af]",
          "focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        )}
      />
      {internal && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 text-[#9ca3af] hover:text-[#374151]"
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}