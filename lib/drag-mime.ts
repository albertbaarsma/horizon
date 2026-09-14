// ─── Cross-component drag payloads ─────────────────────────────────────────
// Custom dataTransfer MIME types for drags that cross component boundaries —
// plain React state (like the Kanban/Week-internal drags use) only works
// within a single component, so a drag that needs to land in a DIFFERENT
// component (e.g. a task card dropped onto a day in WeekTab) needs a real
// payload on the browser's own dataTransfer object instead.

/** A task is being dragged — read by any drop target, not just the source view
 *  (Kanban/Lijst/Horizon cards all set this; WeekTab's day cells read it to
 *  schedule the task on that date). */
export const TASK_MIME = 'application/x-albert-task'
