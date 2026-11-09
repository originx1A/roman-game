import { useState } from 'react'

/*
 * Password field with the little eye (Tony 2026-11-08: "add that little eye icon so you
 * can see what your password is after you type it in — it's a pain in the ass").
 * Each instance owns its show/hide state, so the eye toggles THIS field only. The eye is
 * a plain type="button" — it never submits the form it sits in and never touches the
 * person check. Sheets render their fields conditionally, so closing a sheet (or moving
 * to another one) unmounts the field and the next open starts hidden again.
 */
export function PasswordInput({
  value,
  onChange,
  autoComplete,
  placeholder,
  ariaLabel,
  inputClassName,
}: {
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder: string
  ariaLabel: string
  inputClassName?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <span className="pass-wrap">
      <input
        className={inputClassName}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="pass-eye"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.6M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.4-1.2" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5 7 10 7 10-7 10-7-3.5-7-10-7-10 7-10 7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  )
}
