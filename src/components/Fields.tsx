import { useEffect, useRef, useState } from "react";

/** Keep incomplete input local; commit only on blur/Enter, never on every keystroke. */
export function CommitInput({
  value,
  onCommit,
  label,
  numeric = false,
  integer = false,
  ...props
}: {
  value: string | number;
  onCommit: (value: string) => void;
  label: string;
  numeric?: boolean;
  integer?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  const cancelBlur = useRef(false);
  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  function commit() {
    if (cancelBlur.current) {
      cancelBlur.current = false;
      return;
    }
    if (
      numeric &&
      (!draft.trim() ||
        !Number.isFinite(Number(draft)) ||
        Number(draft) < 0 ||
        (integer && !Number.isInteger(Number(draft))))
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (draft !== String(value)) onCommit(draft);
  }
  return (
    <input
      {...props}
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? "Introduce un número no negativo válido." : undefined}
      inputMode={numeric ? "decimal" : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancelBlur.current = true;
          setDraft(String(value));
          setInvalid(false);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
