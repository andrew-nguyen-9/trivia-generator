"use client";

import { useState } from "react";
import { HOURS, ROOMS, type MysteryCase } from "@/lib/mystery";

function displayRoom(r: string): string {
  return r.replace(/^the /, "The ");
}

function DropdownSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { label: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-bg/40 px-3 py-2 text-left text-sm text-ink transition hover:border-gold/30"
      >
        <span className={selected ? "text-ink" : "text-muted"}>
          {selected?.label ?? placeholder}
        </span>
        <span className="text-muted text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm transition hover:bg-gold/10 ${
                o.value === value ? "text-gold" : "text-ink"
              }`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MysteryAccusationForm({
  mystery,
  whoGuess,
  whereGuess,
  whenGuess,
  onWhereChange,
  onWhenChange,
  onSubmit,
}: {
  mystery: MysteryCase;
  whoGuess: string[];
  whereGuess: string | null;
  whenGuess: number | null;
  onWhereChange: (room: string) => void;
  onWhenChange: (hourIndex: number) => void;
  onSubmit: () => void;
}) {
  const canSubmit = whoGuess.length > 0 && whereGuess !== null && whenGuess !== null;

  return (
    <div className="gilt-frame mt-6 rounded-2xl bg-surface/60 p-5">
      <p className="microlabel mb-3 text-gold">submit accusation</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="microlabel mb-1 text-muted">who</p>
          <div className="min-h-[2.5rem] rounded-xl border border-line bg-bg/40 px-3 py-2">
            {whoGuess.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {whoGuess.map((id) => {
                  const s = mystery.suspects.find((s) => s.id === id);
                  return (
                    <span
                      key={id}
                      className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300"
                    >
                      {s?.emoji}{" "}
                      {s?.id
                        .split("-")
                        .map((p) => p[0].toUpperCase() + p.slice(1))
                        .join(" ")}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-sm italic text-muted">Tag suspects PRIME</span>
            )}
          </div>
        </div>
        <div>
          <p className="microlabel mb-1 text-muted">where</p>
          <DropdownSelect
            value={whereGuess ?? ""}
            onChange={onWhereChange}
            placeholder="Select room"
            options={ROOMS.map((r) => ({ label: displayRoom(r), value: r }))}
          />
        </div>
        <div>
          <p className="microlabel mb-1 text-muted">when</p>
          <DropdownSelect
            value={whenGuess !== null ? String(whenGuess) : ""}
            onChange={(v) => onWhenChange(Number(v))}
            placeholder="Select hour"
            options={HOURS.map((h, i) => ({ label: h, value: String(i) }))}
          />
        </div>
      </div>
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="microlabel mt-4 w-full rounded-full border border-ember py-3 text-ember transition enabled:hover:bg-ember enabled:hover:text-ink disabled:opacity-40"
      >
        submit verdict
      </button>
    </div>
  );
}
