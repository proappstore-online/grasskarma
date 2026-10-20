import { completeSchedule, type ScheduleCompletion } from './schedules'
import { drainPendingPhotoCleanup, queuePhotoCleanup, uploadMowAfterPhoto } from './photos'

export const MAX_AFTER_PHOTO_BYTES = 10 * 1024 * 1024

/** Why a chosen after-photo cannot be used, or null when it is fine. */
export function afterPhotoProblem(file: File | null): string | null {
  if (!file) return null
  if (!file.type.startsWith('image/')) return 'The after-photo must be an image.'
  if (file.size > MAX_AFTER_PHOTO_BYTES) return 'The after-photo must be 10 MB or smaller.'
  return null
}

/**
 * The assigned mower marks a mow done (#29), optionally with an after-photo.
 * The photo is uploaded and recorded first, because the server accepts only a
 * key the mower already owns. If the completion is then refused, the photo is
 * queued for cleanup so a refused write never leaves an orphaned public image.
 */
export async function markMowDone(completion: ScheduleCompletion, photo: File | null): Promise<void> {
  const problem = afterPhotoProblem(photo)
  if (problem) throw new Error(problem)
  const afterPhotoKey = photo ? await uploadMowAfterPhoto(photo) : null
  try {
    await completeSchedule({ ...completion, afterPhotoKey })
  } catch (error) {
    if (afterPhotoKey) {
      await queuePhotoCleanup([afterPhotoKey]).then(drainPendingPhotoCleanup).catch((cleanupError) => {
        console.warn('After-photo cleanup will be retried', cleanupError)
      })
    }
    throw error
  }
}
