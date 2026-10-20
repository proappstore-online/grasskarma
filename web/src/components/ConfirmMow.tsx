import { useId, useState } from 'react'
import { ActionRefusedError } from '../lib/actions'
import { MAX_RATING_COMMENT, confirmMow } from '../lib/mowRatings'
import type { Schedule } from '../models'

interface ConfirmMowProps {
  schedule: Schedule
  /** Human description of the mow, e.g. "21/10/2026 · 09:00". */
  mowLabel: string
  /** Reload the page's schedules from the server after any attempt. */
  onSaved: () => Promise<void>
}

/** A group member confirms a done mow and rates it 1-5 (#29). */
export function ConfirmMow({ schedule, mowLabel, onSaved }: ConfirmMowProps) {
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState<number | null>(schedule.myRating)
  const [comment, setComment] = useState(schedule.myComment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = useId()
  const commentId = useId()

  const photo = schedule.afterPhotoUrl && (
    <img src={schedule.afterPhotoUrl} alt={`After photo of the lawn, mow on ${mowLabel}`} className="h-32 w-full max-w-xs rounded-md object-cover" />
  )

  if (schedule.myRating != null && !editing) {
    return (
      <div className="space-y-2">
        {photo}
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-[var(--success)]">
            Confirmed <span aria-hidden="true">★</span>{schedule.myRating}<span className="sr-only"> out of 5</span>
          </p>
          <button
            type="button"
            onClick={() => { setRating(schedule.myRating); setComment(schedule.myComment ?? ''); setEditing(true) }}
            aria-label={`Change rating: ${mowLabel}`}
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
          >
            Change rating
          </button>
        </div>
      </div>
    )
  }

  const submit = async () => {
    if (rating == null) return
    setSaving(true)
    setError(null)
    try {
      await confirmMow(schedule.id, rating, comment)
      setEditing(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof ActionRefusedError
        ? 'Your confirmation was refused: this mow may no longer be done, or you may have left the group. The schedule was reloaded.'
        : err instanceof Error ? err.message : 'Could not save your confirmation.')
    } finally {
      setSaving(false)
      await onSaved()
    }
  }

  return (
    <div className="w-full space-y-3">
      {photo}
      <fieldset disabled={saving} className="space-y-3 rounded-md border border-[var(--line)] p-3">
        <legend className="px-1 text-sm font-medium">Rate the mow: {mowLabel}</legend>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-md border border-[var(--line)] px-2 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]">
              <input type="radio" name={name} value={value} checked={rating === value} onChange={() => setRating(value)} className="accent-[var(--accent)]" />
              {value}<span aria-hidden="true">★</span><span className="sr-only"> star{value === 1 ? '' : 's'}</span>
            </label>
          ))}
        </div>
        <div>
          <label htmlFor={commentId} className="mb-1 block text-sm">Comment (optional)</label>
          <textarea
            id={commentId}
            value={comment}
            maxLength={MAX_RATING_COMMENT}
            rows={2}
            onChange={(event) => setComment(event.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || rating == null}
            aria-label={`Confirm: ${mowLabel}`}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--on-accent)] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm">
              Cancel
            </button>
          )}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  )
}
