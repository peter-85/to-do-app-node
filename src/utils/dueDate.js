// ISO 8601 date (YYYY-MM-DD), optionally followed by "T" and a time with an
// optional "Z" or ±hh:mm offset. Only the date as written is kept.
const ISO_DATE_OR_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

// Returns the due date as "YYYY-MM-DD", null when absent, or undefined when invalid.
export function parseDueDate(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;

  const match = ISO_DATE_OR_DATE_TIME.exec(value);
  if (!match) return undefined;

  // Reject dates that don't exist on the calendar, such as 2026-02-30
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return value.slice(0, 10);
}
