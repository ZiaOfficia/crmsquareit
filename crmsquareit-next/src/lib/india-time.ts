/**
 * "Today" and "this month" in India time, whatever the server's own clock is
 * (Vercel runs on UTC, 5½ hours behind).
 *
 * Two kinds of date live in the database:
 * - Calendar days picked in a date input (due dates, follow-ups, payment and
 *   expense dates) are saved as midnight UTC of that day. Compare them with
 *   indiaToday(), indiaMonthStart() and friends.
 * - Timestamps (createdAt, lastLogin, updatedAt) are real instants. Compare
 *   them with the ...At() versions, which give the moment India's day or month began.
 */
import { dayKey, dbDate } from "./hr";

const DAY = 86_400_000;
/** India is UTC+5:30 all year (no daylight saving). */
const IST_OFFSET = 330 * 60_000;

const ym = () => dayKey().split("-").map(Number) as [number, number, number];

/** India's year right now, e.g. 2026. */
export const indiaYear = () => ym()[0];

/** Today's date in India, as a calendar-day value. */
export const indiaToday = () => dbDate(dayKey());
/** Tomorrow's date in India, as a calendar-day value. */
export const indiaTomorrow = () => new Date(indiaToday().getTime() + DAY);
/** First day of India's current month (or `offset` months away), as a calendar-day value. */
export const indiaMonthStart = (offset = 0) => {
  const [y, m] = ym();
  return new Date(Date.UTC(y, m - 1 + offset, 1));
};
/** 1 January of India's current year, as a calendar-day value. */
export const indiaYearStart = () => new Date(Date.UTC(indiaYear(), 0, 1));

/** Converts a calendar-day value to the instant that day began in India. */
export const indiaStartAt = (day: Date) => new Date(day.getTime() - IST_OFFSET);
/** The instant today began in India, for timestamps. */
export const indiaTodayAt = () => indiaStartAt(indiaToday());
/** The instant India's current month (or `offset` months away) began, for timestamps. */
export const indiaMonthStartAt = (offset = 0) => indiaStartAt(indiaMonthStart(offset));
/** The last moment of a picked calendar day in India (23:59:59.999 IST). */
export const indiaEndOfDay = (day: Date) => new Date(indiaStartAt(day).getTime() + DAY - 1);

/** "YYYY-M" key (month 0-based) for a calendar-day value, for grouping by month. */
export const dayMonthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
