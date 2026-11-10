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
  /**
   * Archetype thresholds. SIMPLIFIED: these follow the one-line definitions in the
   * visual-direction post. PCIOS-1299 replaces them with the rules written in the
   * Sept 16 P2.
   */
  archetypes: Object.freeze({
    /** The Collector: the most-listened show has fewer listeners than this. */
    collectorMaxAudience: 1000,
    /** The Avant-gardist: at least this many shows followed before they got big. */
    avantGardistMinEarlyShows: 2,
    /** The Aficionado: at least this share of listening time is in one genre. */
    aficionadoMinGenreShare: 0.7,
    /** The Anthologist: at least this many genres... */
    anthologistMinGenres: 5,
    /** ...each with at least this share of listening time. */
    anthologistMinGenreShare: 0.05,
  }),
});

/** Merge host overrides over the defaults (one level deep for `archetypes`). */
export function resolveRules(overrides = {}) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  return {
    ...DEFAULT_RULES,
    ...o,
    archetypes: { ...DEFAULT_RULES.archetypes, ...(o.archetypes || {}) },
  };
}

export const SUMMARY_VARIANTS = Object.freeze(['a', 'b', 'c']);

/** The year the intro's title names while the host's data, which says it, is still to come. */
export const PLAYBACK_YEAR = 2026;
