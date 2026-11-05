"use client";

import { useEffect, useId, useRef, useState } from "react";

export type Option = string | { value: string; label: string };

const norm = (o: Option) => (typeof o === "string" ? { value: o, label: o } : o);

/**
 * The back office's dropdown: shows the choice with a dot once it differs from the
 * neutral value (e.g. "All cities"), and lists options with the current one ticked.
 * Keyboard: Enter/Space/arrows open it, arrows move, Enter picks, Escape closes.
 */
export default function Select({
  value,
  onChange,
  options,
  neutral = "",
  label,
  className = "",
  dark = false,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  /** The "no filter" value: shown plainly, without the dot. */
  neutral?: string | null;
  /** Accessible name when there is no visible label. */
  label?: string;
  className?: string;
  dark?: boolean;
  disabled?: boolean;
}) {
  const given = options.map(norm);
  // A saved value that is no longer in the list (e.g. an old assignee) still shows as itself.
  const opts = value && !given.some((o) => o.value === value) ? [...given, { value, label: value }] : given;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = opts.find((o) => o.value === value) ?? opts[0];
  const set = neutral === null || value !== neutral;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    setActive(Math.max(0, opts.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function pick(v: string) {
    setOpen(false);
    if (v !== value) onChange(v);
  }
  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown") setActive((i) => Math.min(opts.length - 1, i + 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(opts.length - 1);
    else if (e.key === "Enter" || e.key === " ") pick(opts[active].value);
    else return;
    e.preventDefault();
  }

  return (
    <div ref={root} className={`ad-select${set ? " is-set" : ""}${dark ? " dark" : ""}${open ? " open" : ""} ${className}`}>
      <button
        type="button"
        className="ad-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        {set && <i className="ad-select-dot" />}
        <span className="ad-select-value">{current?.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul ref={list} id={id} role="listbox" className="ad-select-list" aria-activedescendant={`${id}-${active}`}>
          {opts.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`${o.value === value ? "sel" : ""}${i === active ? " act" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
            >
              <span>{o.label}</span>
              {o.value === value && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
