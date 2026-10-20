import { useEffect, useId, useRef, useState } from 'react'
import { afterPhotoProblem } from '../lib/mowCompletion'

interface MarkMowDoneProps {
  /** Human description of the mow, e.g. "21/10/2026 · 09:00". */
  mowLabel: string
  saving: boolean
  onConfirm: (photo: File | null) => void
}

/** "Mark as done" for one assigned mow, with an optional after-photo (#29). */
export function MarkMowDone({ mowLabel, saving, onConfirm }: MarkMowDoneProps) {
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const photoId = useId()
  const photoInput = useRef<HTMLInputElement>(null)
  const problem = afterPhotoProblem(photo)

  useEffect(() => {
    if (open) photoInput.current?.focus()
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Mark as done: ${mowLabel}`}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--on-accent)]"
      >
        Mark as done
      </button>
    )
  }

  return (
    <fieldset className="w-full space-y-3 rounded-md border border-[var(--line)] p-3" disabled={saving}>
      <legend className="px-1 text-sm font-medium">Complete mow: {mowLabel}</legend>
      <div>
        <label htmlFor={photoId} className="mb-1 block text-sm">After photo (optional)</label>
        <input
          ref={photoInput}
          id={photoId}
          type="file"
          accept="image/*"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
      </div>
      {problem && <p role="alert" className="text-sm text-[var(--error)]">{problem}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onConfirm(photo)}
          disabled={saving || problem !== null}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--on-accent)] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Confirm done'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPhoto(null) }}
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </fieldset>
  )
}
