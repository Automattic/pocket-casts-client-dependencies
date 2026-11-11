// Product rules, in one place. Every number the flow's behaviour depends on is here so
// it can be tuned (or overridden by the host through `PLAYBACK_ENV.rules`) without
// touching logic.

export const DEFAULT_RULES = Object.freeze({
  /** Below this much listening there is nothing worth recapping. */
  minTotalSeconds: 30 * 60,
  /** Ranked shows on the "top shows" screen. */
  topCount: 5,
  /** Quiz options on the "top show" screen (the user's own top shows, shuffled). */
  quizMaxOptions: 6,
  /** Fewer shows than this and the quiz is pointless: the result is shown directly. */
  quizMinOptions: 3,
  /** Fewer listening months than this and the "best month" quiz is pointless. */
  monthQuizMinMonths: 2,
  /** No year-over-year screen unless last year had at least this much listening. */
  comparisonMinPreviousSeconds: 30 * 60,
  /** |change| below this percentage reads as "about the same". */
  comparisonSamePercent: 1,
  /** No completion screen for users who started fewer episodes than this. */
  completionMinStarted: 5,
  /** Interactive screens reveal their answer on their own after this long without a pick. */
  revealTimeoutMs: 2 * 60 * 1000,
});

/** Merge host overrides over the defaults. */
export function resolveRules(overrides = {}) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  return { ...DEFAULT_RULES, ...o };
}

export const SUMMARY_VARIANTS = Object.freeze(['a', 'b', 'c']);

/** The year the intro's title names while the host's data, which says it, is still to come. */
export const PLAYBACK_YEAR = 2026;
