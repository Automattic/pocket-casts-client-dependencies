// Listener archetypes. The user sees exactly one. Names and one-line definitions are
// from the visual-direction post ("The Culturista" concept). These are SIMPLIFIED rules:
// the written ones in the Sept 16 P2 replace them in PCIOS-1299. Thresholds are in
// DEFAULT_RULES.archetypes.
//
// Rules are checked in priority order and the first to match wins: that order is the
// tie-break when a listener fits several. The most specific (rarest) archetypes come
// first, and The Flâneur is the default that always matches.
//
// Sparse data never earns an archetype by accident: a show with no audience figure is
// not small, and listening with no known genre is not a genre (it still counts towards
// total listening, so it dilutes the genre shares rather than being ignored).

import { UNKNOWN_GENRE } from './model.js';

export const ARCHETYPE_IDS = Object.freeze([
  'collector',
  'avantGardist',
  'aficionado',
  'anthologist',
  'flaneur',
]);

const knownGenres = (stats) => stats.genres.filter((g) => g.genre !== UNKNOWN_GENRE);

const RULES = [
  {
    id: 'collector',
    // The favourite show (the ranking's first, so its tie-breaks apply) has few listeners.
    // A count of 0 is a show the backend has no figure for: someone is listening to it.
    test(stats, r) {
      const top = stats.topPodcast;
      if (!top || !(top.listenerCount > 0) || top.listenerCount >= r.collectorMaxAudience) return null;
      return { show: top.title, listenerCount: top.listenerCount };
    },
  },
  {
    id: 'avantGardist',
    // Followed several shows before they got big.
    test(stats, r) {
      const early = stats.ranking.filter((p) => p.earlyFollower);
      if (early.length < r.avantGardistMinEarlyShows) return null;
      return { earlyShows: early.length };
    },
  },
  {
    id: 'aficionado',
    // One genre takes up most of the listening. Genres are ordered by time, then name.
    test(stats, r) {
      const top = knownGenres(stats)[0];
      if (!top || top.share < r.aficionadoMinGenreShare) return null;
      return { genre: top.genre, share: top.share };
    },
  },
  {
    id: 'anthologist',
    // Many different genres, each a real part of the listening.
    test(stats, r) {
      const real = knownGenres(stats).filter((g) => g.share >= r.anthologistMinGenreShare);
      if (real.length < r.anthologistMinGenres) return null;
      return { genres: real.length };
    },
  },
  { id: 'flaneur', test: () => ({}) },
];

/** @returns {{id: string, evidence: object}} */
export function assignArchetype(stats) {
  for (const rule of RULES) {
    const evidence = rule.test(stats, stats.rules.archetypes);
    if (evidence) return { id: rule.id, evidence };
  }
  throw new Error('unreachable: the fallback archetype always matches');
}
