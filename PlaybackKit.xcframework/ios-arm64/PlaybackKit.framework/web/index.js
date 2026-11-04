// Library entry point.
export { createSession } from './core/session.js';
export { normalizePayload, PAYLOAD_VERSION } from './core/model.js';
export { deriveStats } from './core/stats.js';
export { assignArchetype, ARCHETYPE_IDS } from './core/archetypes.js';
export { buildPages } from './core/pages.js';
export { createFlow } from './core/flow.js';
export { DEFAULT_RULES, resolveRules, SUMMARY_VARIANTS } from './core/config.js';
export { createTranslator, STRINGS } from './core/copy.js';
export { mountPlayback } from './ui/app.js';
