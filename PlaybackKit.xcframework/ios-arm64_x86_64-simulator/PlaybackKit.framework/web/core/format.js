// Locale-aware formatting. Everything user-visible that is a number, a duration or a
// month name goes through here so no screen formats on its own.

// An Intl formatter is slow to make (about a quarter of a millisecond on a phone, and the
// month grid asks for two dozen names as the page is built), so each is made once.
const formatters = new Map();
function formatter(kind, locale, options) {
  const key = `${kind}|${locale}`;
  let f = formatters.get(key);
  if (!f) formatters.set(key, (f = kind === 'number' ? new Intl.NumberFormat(locale) : new Intl.DateTimeFormat(locale, options)));
  return f;
}

export function formatNumber(n, locale = 'en') {
  return formatter('number', locale).format(n);
}

export function monthName(month, locale = 'en') {
  // UTC so the host's time zone can never shift the month.
  return formatter('long', locale, { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, month, 15)),
  );
}

/** A month's short name in capitals, as the month grid labels it ("JAN"). */
export function monthShort(month, locale = 'en') {
  return formatter('short', locale, { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, month, 15)))
    .replace(/\.$/, '')
    .toLocaleUpperCase(locale);
}

/** { hours, minutes } from seconds, rounded to the nearest minute. */
export function splitDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/**
 * A duration's two largest whole units, rounded to the smaller: days and hours from a day
 * up, hours and minutes from an hour, else minutes. A unit that rounds to nothing is left
 * out ("6 days", not "6 days 0 hours").
 */
export function durationParts(seconds) {
  const minutes = Math.round(Math.max(0, seconds) / 60);
  if (minutes >= 24 * 60) {
    const hours = Math.round(seconds / 3600);
    return { days: Math.floor(hours / 24), hours: hours % 24 };
  }
  if (minutes >= 60) return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
  return { minutes };
}
