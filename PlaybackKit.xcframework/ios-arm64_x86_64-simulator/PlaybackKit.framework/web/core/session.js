// Wires the pure pieces together: payload → stats → archetype → pages → flow.
// DOM-free, so the whole flow can be driven (and tested) from Node.
//
// The payload can come late (PCIOS-1324): with `env.pending` and no payload, the session
// opens on the intro, the one page that needs no data, while the host reads the user's
// listening history, and `load` brings the rest of the story when it is there.

import { resolveRules } from './config.js';
import { normalizePayload } from './model.js';
import { deriveStats } from './stats.js';
import { assignArchetype } from './archetypes.js';
import { buildPages, introPage, STORY_LENGTH } from './pages.js';
import { createFlow } from './flow.js';

/**
 * @param {unknown} rawPayload  null with `env.pending`: the payload comes later, through `load`
 * @param {Object} [env]  host settings: rules, startAt, answers, reduceMotion, pending
 * @param {() => number} [clock]
 */
export function createSession(rawPayload, env = {}, clock = () => Date.now()) {
  const rules = resolveRules(env.rules);
  const options = { reduceMotion: env.reduceMotion === true };
  if (rawPayload == null && env.pending) {
    // The intro only, holding at its end until the rest comes.
    const pages = [introPage(options)];
    const flow = createFlow({ pages, rules, clock, restored: env.answers, pending: STORY_LENGTH });
    const session = { ok: true, pending: true, payload: null, warnings: [], rules, stats: null, archetype: null, pages, flow };
    /**
     * The payload, now that the host has it. Builds the story from it but leaves the flow as
     * it is: `flow.load(session.pages)` gives the flow the rest, for the caller to do once it
     * has told the host (ui/app.js). Not enough listening: the intro, then the empty page.
     * @returns {{ok: true, warnings: string[]} | {ok: false, errors: string[]}}
     */
    session.load = (raw) => {
      if (!session.pending) return { ok: false, errors: ['the payload is already loaded'] };
      const built = build(raw, rules, options);
      if (!built.ok) return built;
      const pages = built.pages[0].kind === 'intro' ? built.pages : [flow.pages[0], ...built.pages];
      Object.assign(session, { ...built, pages, pending: false });
      return { ok: true, warnings: built.warnings };
    };
    return session;
  }
  const built = build(rawPayload, rules, options);
  if (!built.ok) return built;
  const flow = createFlow({ pages: built.pages, rules, clock, startAt: env.startAt, restored: env.answers });
  return { ok: true, pending: false, ...built, rules, flow };
}

function build(rawPayload, rules, options) {
  const normalized = normalizePayload(rawPayload);
  if (!normalized.ok) return { ok: false, errors: normalized.errors };
  const { payload, warnings } = normalized;
  const stats = deriveStats(payload, rules);
  const archetype = assignArchetype(payload);
  const pages = buildPages(stats, archetype, options);
  return { ok: true, payload, warnings, stats, archetype, pages };
}
