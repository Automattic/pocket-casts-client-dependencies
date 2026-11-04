// Wires the pure pieces together: payload → stats → archetype → pages → flow.
// DOM-free, so the whole flow can be driven (and tested) from Node.

import { resolveRules } from './config.js';
import { normalizePayload } from './model.js';
import { deriveStats } from './stats.js';
import { assignArchetype } from './archetypes.js';
import { buildPages } from './pages.js';
import { createFlow } from './flow.js';

/**
 * @param {unknown} rawPayload
 * @param {Object} [env]  host settings: rules, startAt, answers, reduceMotion
 * @param {() => number} [clock]
 */
export function createSession(rawPayload, env = {}, clock = () => Date.now()) {
  const normalized = normalizePayload(rawPayload);
  if (!normalized.ok) return { ok: false, errors: normalized.errors };

  const { payload, warnings } = normalized;
  const rules = resolveRules(env.rules);
  const stats = deriveStats(payload, rules);
  const archetype = assignArchetype(stats);
  const pages = buildPages(stats, archetype, { reduceMotion: env.reduceMotion === true });
  const flow = createFlow({ pages, rules, clock, startAt: env.startAt, restored: env.answers });
  return { ok: true, payload, warnings, rules, stats, archetype, pages, flow };
}
