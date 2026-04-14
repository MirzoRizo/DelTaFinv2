// src/components/warehouse/BarcodeScanner.tsx
// Компонент для работы со штрих-код сканером
//
// Как работает USB/Bluetooth сканер:
// Он эмулирует клавиатуру — вводит символы очень быстро (за ~50мс)
// и в конце нажимает Enter. Мы отличаем его от ручного ввода
// по скорости: если весь код введён быстрее 100мс — это сканер.

import { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  autoFocus?: boolean;
}

export function BarcodeScanner({ onScan, autoFocus = false }: BarcodeScannerProps) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Глобальный перехват ввода сканера (даже когда фокус не на поле)
  useEffect(() => {
    if (!isListening) return;

    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Сканер вводит символы с интервалом < 30мс
      // Если прошло больше 150мс — начинаем новый буфер
      if (timeSinceLastKey > 150) {
        bufferRef.current = "";
      }

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        if (code.length >= 4) {          // минимальная длина штрих-кода
          onScan(code);
          setLastScan(code);
          setValue(code);
          setTimeout(() => setValue(""), 1500);
        }
        bufferRef.current = "";
        e.preventDefault();
        return;
      }

      // Накапливаем символы
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListening, onScan]);

  // Ручной ввод через поле
  function handleManualSubmit() {
    const code = value.trim();
    if (code.length >= 4) {
      onScan(code);
      setLastScan(code);
      setTimeout(() => setValue(""), 1500);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/40 font-mono">Штрих-код / Сканер</label>

        {/* Кнопка глобального прослушивания */}
        <button
          type="button"
          onClick={() => setIsListening(!isListening)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all",
            isListening
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "border-white/[0.08] text-white/30 hover:text-white/50"
          )}
        >
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            isListening ? "bg-emerald-400 animate-pulse" : "bg-white/20"
          )} />
          {isListening ? "Слушаю сканер" : "Включить сканер"}
        </button>
      </div>

      {/* Поле ввода */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
          placeholder="Наведи сканер или введи код вручную"
          className={cn(
            "flex-1 px-3 py-2.5 bg-white/[0.04] border rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none transition-all font-mono",
            lastScan && value === lastScan
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-white/[0.08] focus:border-emerald-500/40"
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="px-3 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleManualSubmit}
          className="px-3 py-2.5 bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] rounded-lg text-white/50 hover:text-white transition-all"
        >
          <ScanLine className="w-4 h-4" />
        </button>
      </div>

      {/* Подсказка */}
      {isListening && (
        <div className="text-xs text-white/20 font-mono">
          ● Любой ввод со сканера будет перехвачен автоматически
        </div>
      )}
    </div>
  );
}
