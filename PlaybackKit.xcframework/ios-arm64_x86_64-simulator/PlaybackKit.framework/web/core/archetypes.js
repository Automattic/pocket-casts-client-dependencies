// Listener archetypes. The user sees exactly one, and the backend picks it: the sync API
// applies the rules written in the Sept 16 P2 to the user's whole year, against figures
// for every show and every listener (`GET /user/playback-2026/archetype`, and
// `Playback2026Archetypes` in pocket-casts-sync-api). The host passes it in the payload.
// Nothing here can apply those rules: they need data the device does not have.
//
// The backend stores a user's archetype the first time it is asked and never changes it,
// so the role is the same on every device and every time the story is opened.

export const ARCHETYPE_IDS = Object.freeze([
  'collector',
  'avantGardist',
  'aficionado',
  'anthologist',
  'flaneur',
]);

/**
 * The role when the host has none (it could not reach the backend): the backend's own
 * default, the one it gives a listener without enough plays for any other.
 */
export const FALLBACK_ARCHETYPE = 'anthologist';

/**
 * @param {import('./model.js').Payload} payload
 * @returns {{id: string}}
 */
export function assignArchetype(payload) {
  return { id: payload.archetype ?? FALLBACK_ARCHETYPE };
}
