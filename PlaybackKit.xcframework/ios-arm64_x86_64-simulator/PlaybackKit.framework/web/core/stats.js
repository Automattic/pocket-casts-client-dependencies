// Everything derived from the payload. Pure functions, no DOM, no clock.

import { resolveRules } from './config.js';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** Most listened first; ties broken by episodes, then title, so the order is total. */
export function rankPodcasts(podcasts) {
  return podcasts
    .filter((p) => p.playedSeconds > 0)
    .sort(
      (a, b) =>
        b.playedSeconds - a.playedSeconds ||
        b.episodesPlayed - a.episodesPlayed ||
        a.title.localeCompare(b.title, 'en') ||
        a.uuid.localeCompare(b.uuid),
    );
}

/** Best month by listening time; ties go to the earlier month. null if nothing was played. */
export function findBestMonth(monthlySeconds) {
  let best = null;
  monthlySeconds.forEach((seconds, month) => {
    if (seconds > 0 && (best === null || seconds > best.seconds)) best = { month, seconds };
  });
  return best;
}

export function genreBreakdown(ranking) {
  const total = sum(ranking.map((p) => p.playedSeconds));
  const bySeconds = new Map();
  for (const p of ranking) bySeconds.set(p.genre, (bySeconds.get(p.genre) || 0) + p.playedSeconds);
  return [...bySeconds.entries()]
    .map(([genre, seconds]) => ({ genre, seconds, share: total ? seconds / total : 0 }))
    .sort((a, b) => b.seconds - a.seconds || a.genre.localeCompare(b.genre, 'en'));
}

export function compareYears(totalSeconds, previousSeconds, rules) {
  if (previousSeconds == null || previousSeconds < rules.comparisonMinPreviousSeconds) return null;
  const rawPercent = ((totalSeconds - previousSeconds) / previousSeconds) * 100;
  const percent = Math.round(Math.abs(rawPercent));
  const direction =
    Math.abs(rawPercent) < rules.comparisonSamePercent ? 'same' : rawPercent > 0 ? 'up' : 'down';
  return { previousSeconds, totalSeconds, deltaSeconds: totalSeconds - previousSeconds, percent, direction };
}

/**
 * @param {import('./model.js').Payload} payload
 * @param {Partial<typeof import('./config.js').DEFAULT_RULES>} [ruleOverrides]
 */
export function deriveStats(payload, ruleOverrides) {
  const rules = resolveRules(ruleOverrides);
  const ranking = rankPodcasts(payload.podcasts);
  const monthTotal = sum(payload.monthlySeconds);
  // The monthly series is the authority on total time; the show list may be truncated
  // by the backend. Fall back to the show list only when there is no monthly data.
  const totalSeconds = monthTotal > 0 ? monthTotal : sum(ranking.map((p) => p.playedSeconds));
  const eligible = totalSeconds >= rules.minTotalSeconds && ranking.length >= 1;

  const completion = payload.completion && payload.completion.started >= rules.completionMinStarted
    ? {
        ...payload.completion,
        percent: Math.round((payload.completion.completed / payload.completion.started) * 100),
      }
    : null;

  return {
    rules,
    year: payload.year,
    eligible,
    totalSeconds,
    totalMinutes: Math.floor(totalSeconds / 60),
    showsCount: ranking.length,
    episodesCount: sum(ranking.map((p) => p.episodesPlayed)),
    ranking,
    topPodcast: ranking[0] || null,
    top: ranking.slice(0, rules.topCount),
    months: payload.monthlySeconds.map((seconds, month) => ({ month, seconds })),
    monthsWithData: payload.monthlySeconds.filter((s) => s > 0).length,
    bestMonth: findBestMonth(payload.monthlySeconds),
    comparison: compareYears(totalSeconds, payload.previousYearSeconds, rules),
    completion,
    genres: genreBreakdown(ranking),
  };
}
