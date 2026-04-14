// src/components/ui/NumericInput.tsx
// Поле для чисел — ноль исчезает при фокусе, восстанавливается если оставить пустым

import { useState, useRef, FocusEvent } from "react";
import { cn } from "../../lib/utils";

interface NumericInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  suffix?: string; // например "кг", "шт"
}

export function NumericInput({
  value, onChange, min = 0, step = 1,
  placeholder, className, style, suffix,
}: NumericInputProps) {
  const [raw, setRaw] = useState<string | null>(null); // null = показываем value
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFocus() {
    // При фокусе: если значение 0 — очищаем поле
    setRaw(value === 0 ? "" : String(value));
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    const parsed = parseFloat(e.target.value);
    const result = isNaN(parsed) ? 0 : (min !== undefined ? Math.max(min, parsed) : parsed);
    onChange(result);
    setRaw(null); // возвращаемся к контролируемому value
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) onChange(parsed);
  }

  const displayValue = raw !== null ? raw : (value === 0 ? "0" : String(value));

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="number"
        value={displayValue}
        min={min}
        step={step}
        placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        className={cn("w-full outline-none transition-all", suffix ? "pr-8" : "", className)}
        style={style}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
          style={{ color: "var(--text-3)" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}
