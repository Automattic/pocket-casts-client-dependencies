// The payload contract: the facts a host hands the page. See docs/payload.md.
//
// The host supplies facts only. No colours, no layout, no ranking, no copy: everything
// derived (top shows, best month, comparison) is computed here, once, for every platform.
// The archetype is the one fact the host does not read from the device: the backend
// works it out (archetypes.js). `normalizePayload` is the single gate: whatever it
// returns is safe for the rest of the code to assume.

import { displayLocale } from './copy.js';
import { ARCHETYPE_IDS, FALLBACK_ARCHETYPE } from './archetypes.js';

export const PAYLOAD_VERSION = 1;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const nonNeg = (v) => (isNum(v) && v > 0 ? v : 0);

/**
 * @typedef {Object} Podcast
 * @property {string} uuid
 * @property {string} title
 * @property {string} author
 * @property {string|null} artworkUrl
 * @property {number} playedSeconds       listening time this year
 * @property {number} episodesPlayed      distinct episodes played this year
 *
 * @typedef {Object} Payload
 * @property {number} version
 * @property {number} year
 * @property {string} locale
 * @property {Podcast[]} podcasts
 * @property {number[]} monthlySeconds    12 entries, January first
 * @property {number|null} previousYearSeconds
 * @property {{started:number, completed:number}|null} completion
 * @property {string|null} archetype     the backend's, one of ARCHETYPE_IDS; null when the host has none
 * @property {Object<string,string|Object>} strings   copy overrides
 */

/**
 * @param {unknown} raw
 * @returns {{ok: true, payload: Payload, warnings: string[]} | {ok: false, errors: string[]}}
 */
export function normalizePayload(raw) {
  const errors = [];
  const warnings = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['payload is missing'] };
  if (raw.version !== PAYLOAD_VERSION) {
    return { ok: false, errors: [`unsupported payload version: ${raw.version}`] };
  }
  if (!isNum(raw.year)) errors.push('year must be a number');
  if (!Array.isArray(raw.podcasts)) errors.push('podcasts must be an array');
  if (errors.length) return { ok: false, errors };

  const seen = new Set();
  const podcasts = [];
  raw.podcasts.forEach((p, i) => {
    if (!p || typeof p.uuid !== 'string' || !p.uuid || typeof p.title !== 'string') {
      warnings.push(`podcasts[${i}] dropped: needs uuid and title`);
      return;
    }
    if (seen.has(p.uuid)) {
      warnings.push(`podcasts[${i}] dropped: duplicate uuid ${p.uuid}`);
      return;
    }
    seen.add(p.uuid);
    podcasts.push({
      uuid: p.uuid,
      title: p.title,
      author: typeof p.author === 'string' ? p.author : '',
      artworkUrl: typeof p.artworkUrl === 'string' ? p.artworkUrl : null,
      playedSeconds: nonNeg(p.playedSeconds),
      episodesPlayed: Math.floor(nonNeg(p.episodesPlayed)),
    });
  });

  let monthly = Array.isArray(raw.monthlySeconds) ? raw.monthlySeconds.map(nonNeg) : [];
  if (monthly.length !== 12) {
    if (monthly.length) warnings.push(`monthlySeconds has ${monthly.length} entries, expected 12`);
    monthly = Array.from({ length: 12 }, (_, i) => monthly[i] || 0);
  }

  // The page is in one language: one the bundle has no translation for is English throughout.
  const locale = displayLocale(raw.locale);
  if (typeof raw.locale === 'string' && raw.locale && locale === 'en' && !/^en\b/i.test(raw.locale)) warnings.push(`locale "${raw.locale}" has no translation: the page is in English`);

  const c = raw.completion;
  const completion =
    c && isNum(c.started) && isNum(c.completed) && c.started > 0
      ? { started: Math.floor(c.started), completed: Math.min(Math.floor(c.completed), Math.floor(c.started)) }
      : null;

  const archetype = ARCHETYPE_IDS.includes(raw.archetype) ? raw.archetype : null;
  if (raw.archetype != null && !archetype) warnings.push(`archetype "${raw.archetype}" is not one the page knows: it shows ${FALLBACK_ARCHETYPE}`);

  return {
    ok: true,
    warnings,
    payload: {
      version: PAYLOAD_VERSION,
      year: raw.year,
      locale,
      podcasts,
      monthlySeconds: monthly,
      previousYearSeconds: isNum(raw.previousYearSeconds) && raw.previousYearSeconds >= 0 ? raw.previousYearSeconds : null,
      completion,
      archetype,
      strings: raw.strings && typeof raw.strings === 'object' ? raw.strings : {},
    },
  };
}
