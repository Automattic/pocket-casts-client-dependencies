// One view per page kind. Every view is `(ctx) => HTMLElement[]` where ctx carries the
// page, its quiz state, a translator, the dispatch function, `reduceMotion` and `rtl`.
// A view can instead return `{article, update}`: its own page, updated in place for the
// rest of the visit (the top show's carousel and reveal, the top month's grid, the
// summary's cards). Pages in FINAL have the Figma design; the rest are still wireframes
// (labels, boxes and buttons). Share lives in the story container (app.js), not in the
// views, but for the summary's own Share pill.

import { h } from './dom.js';
import { artwork } from './artwork.js';
import { coverStack } from './stack.js';
import { topShowView } from './top-show.js';
import { topMonthView } from './top-month.js';
import { summaryView } from './summary.js';
import { durationParts } from '../core/format.js';

/** Page kinds drawn to the final design. Everything else renders as a wireframe. */
const FINAL = new Set(['intro', 'shows-and-episodes', 'top-podcast', 'top-shows', 'best-month', 'total-minutes', 'year-comparison', 'completion-rate', 'roles-intro', 'archetype', 'summary', 'outro']);

// ── helpers ────────────────────────────────────────────────────────────────────────

const episodes = (ctx, count) => ctx.t('count.episodes', { count });

/** A year's listening in its two largest units ("6 days 3 hours"). */
function listening(ctx, seconds) {
  const { t } = ctx;
  const { days, hours, minutes } = durationParts(seconds);
  const units = days ? [t('duration.days', { count: days }), hours && t('duration.hours', { count: hours })] : hours ? [t('duration.hours', { count: hours }), minutes && t('duration.minutes', { count: minutes })] : [t('duration.minutes', { count: minutes })];
  const [first, second] = units.filter(Boolean);
  return second ? t('duration.pair', { first, second }) : first;
}

function heading(text) {
  // tabindex -1 so focus can move here on every page change (screen readers announce it).
  return h('h1', { class: 'title', tabindex: '-1', 'data-testid': 'title' }, text);
}

function storyTitle(text) {
  return h('h1', { class: 'story-title', tabindex: '-1', 'data-testid': 'title' }, text);
}

function button(label, onClick, { primary, ...attrs } = {}) {
  return h('button', { type: 'button', class: primary ? 'btn primary' : 'btn', onClick, ...attrs }, label);
}

// ── pages ──────────────────────────────────────────────────────────────────────────

const views = {
  // Every element of every step is here from the start; the step (data-step, set by
  // the container as the flow advances) decides what shows, so changing step fades
  // rather than re-rendering. The backdrop under it is ui/backdrop.js's.
  intro(ctx) {
    const { t, payload } = ctx;
    return [
      h('div', { class: 'intro-logo', role: 'img', 'aria-label': t('intro.logo') },
        h('img', { class: 'logo-dark', src: 'assets/logo.svg', alt: '', width: '80', height: '80' }),
        h('img', { class: 'logo-light', src: 'assets/logo-light.svg', alt: '', width: '80', height: '80' })),
      h('h1', { class: 'intro-title', tabindex: '-1', 'data-testid': 'title' }, t('intro.title', { year: payload.year })),
      h('p', { class: 'intro-tagline', 'data-testid': 'tagline' }, t('intro.tagline')),
      h('p', { class: 'intro-body' }, t('intro.body')),
    ];
  },

  // The top shows' covers, #1 at the front, cycling through the deck (ui/stack.js).
  // Fewer shows fill the front slots first.
  'shows-and-episodes'(ctx) {
    const { t, page } = ctx;
    const { shows, episodes: eps, podcasts } = page.data;
    return [
      storyTitle(t('shows.title', { episodes: t('count.episodes', { count: eps }), shows: t('count.shows', { count: shows }) })),
      h('div', { class: 'stack-wrap' }, coverStack(podcasts, { artwork, label: t('shows.artwork'), animate: !ctx.reduceMotion })),
    ];
  },

  // The guess on a carousel, then the reveal over Creative Lab's shape (ui/top-show.js).
  'top-podcast': topShowView,

  // The top 5: a card per show, coming in one after another (playback.css).
  'top-shows'(ctx) {
    const { t, page } = ctx;
    const shows = page.data.podcasts;
    return [
      storyTitle(t('topShows.title', { count: shows.length })),
      h(
        'ol',
        { class: 'top-list' },
        shows.map((p, i) =>
          h(
            'li',
            { class: `top-card${i === 0 ? ' is-first' : ''}`, style: `--i: ${i}`, 'data-testid': `rank-${i + 1}` },
            artwork(p),
            h(
              'div',
              { class: 'top-body' },
              h('div', { class: 'top-meta' },
                h('span', { class: 'top-rank' }, t('topShows.rank', { rank: i + 1 })),
                h('span', { class: 'top-count' }, t('topShows.listened', { episodes: episodes(ctx, p.episodesPlayed) }))),
              h('div', { class: 'top-names' },
                h('span', { class: 'top-author' }, p.author),
                h('span', { class: 'top-title' }, p.title)),
            ),
          ),
        ),
      ),
    ];
  },

  // The guess on a grid of months, then the answer over Creative Lab's bubbles (ui/top-month.js).
  'best-month': topMonthView,

  // The copy over Creative Lab's 06, the number drawn by the backdrop in the space below
  // it (ui/backdrop.js anchors it there). The page comes in once the page before it
  // (`data-after`) has gone (playback.css).
  'total-minutes'(ctx) {
    const { t, page } = ctx;
    return [
      storyTitle(t('minutes.title', { count: page.data.minutes })),
      h('div', { class: 'mn-number', 'aria-hidden': 'true' }),
    ];
  },

  // The copy over Creative Lab's 07, a circle a year, each sized by its listening
  // (core/pages.js comparisonLayout) and drawn by the backdrop on its `.yc-slot`
  // (ui/backdrop.js anchors it there), the year and its listening on it. Figma's shades
  // darken the circles where they leave the screen.
  'year-comparison'(ctx) {
    const { t, page } = ctx;
    const d = page.data;
    return [
      storyTitle(t(`comparison.${d.direction}`, { year: d.year - 1, percent: d.percent })),
      h(
        'div',
        { class: 'yc-pair', 'data-direction': d.direction },
        h('div', { class: 'yc-shade yc-shade-left' }),
        h('div', { class: 'yc-shade yc-shade-right' }),
        d.circles.map((c) =>
          h(
            'div',
            { class: 'yc-circle', 'data-side': c.side, 'data-testid': `circle-${c.year}`, style: `--x: ${c.x}; --y: ${c.y}; --r: ${c.r}; --lx: ${c.labelX - c.x}` },
            h('div', { class: 'yc-slot' }),
            h('p', { class: 'yc-label' }, h('span', { class: 'yc-year' }, String(c.year)), h('span', { class: 'yc-time' }, listening(ctx, c.seconds))),
          ),
        ),
      ),
    ];
  },

  // The copy over Creative Lab's 08, its shape lit from the left up to the rate, drawn by
  // the backdrop on `.cr-slot`, Figma's box for it (ui/backdrop.js anchors it there).
  'completion-rate'(ctx) {
    const { t, page } = ctx;
    const d = page.data;
    return [
      h('div', { class: 'cr-copy' },
        storyTitle(t('completion.title', { percent: d.percent })),
        h('p', { class: 'cr-detail' }, t('completion.detail', { count: d.started, completed: d.completed }))),
      h('div', { class: 'cr-area', 'aria-hidden': 'true' }, h('div', { class: 'cr-slot' })),
    ];
  },

  // The copy over Figma's two logos, drawn by the backdrop in their boxes (`.rl-glow`,
  // ui/backdrop.js anchors them there), which the role page after it has too.
  'roles-intro'(ctx) {
    const { t } = ctx;
    return [roleGlows(), storyTitle(t('rolesIntro.title')), h('p', { class: 'roles-body' }, t('rolesIntro.body'))];
  },

  // The role, over the same two logos (carried on from roles intro): Figma's "Role 1–5", one
  // template, the name in Figma's gradient and its line under it.
  archetype(ctx) {
    const { t, page } = ctx;
    const { id } = page.data;
    return [
      roleGlows(),
      storyTitle(t('archetype.title')),
      h('div', { class: 'ar-role', 'data-role': id },
        h('h2', { class: 'ar-name', 'data-testid': 'role' }, t(`archetype.${id}.name`)),
        h('p', { class: 'ar-body' }, t(`archetype.${id}.body`))),
    ];
  },

  // Three cards on a carousel, the same data on each, only the background changing (ui/summary.js).
  summary: summaryView,

  // The copy over Creative Lab's 12 (the backdrop's) and Figma's dark disc under it; Play again
  // restarts the story, the story's close ends it.
  outro(ctx) {
    const { t } = ctx;
    return [
      h('div', { class: 'ou-disc', 'aria-hidden': 'true' }),
      h('div', { class: 'ou-copy' }, storyTitle(t('outro.title')), h('p', { class: 'ou-body' }, t('outro.body'))),
      h('button', { type: 'button', class: 'pill ou-again', 'data-testid': 'again', onClick: () => ctx.dispatch({ type: 'restart' }) }, t('outro.again')),
    ];
  },

  empty(ctx) {
    const { t } = ctx;
    return [
      heading(t('empty.title')),
      h('p', { class: 'body' }, t('empty.body')),
      button(t('empty.close'), () => ctx.dispatch({ type: 'close', reason: 'closed' }), { primary: true, 'data-testid': 'close-cta' }),
    ];
  },
};

/** Figma's boxes for the two logos on roles intro and the role (the backdrop draws them). */
function roleGlows() {
  return h('div', { class: 'rl-glows', 'aria-hidden': 'true' }, h('div', { class: 'rl-glow rl-glow-a', 'data-glow': 'role-a' }), h('div', { class: 'rl-glow rl-glow-b', 'data-glow': 'role-b' }));
}

export function renderPage(ctx) {
  const { kind } = ctx.page;
  const view = views[kind];
  const content = view ? view(ctx) : [heading(kind)];
  if (content.article) return Object.assign(content.article, { update: content.update });
  return h('article', { class: `page page-${kind}${FINAL.has(kind) ? '' : ' wireframe'}`, 'data-page': ctx.page.id, 'data-step': ctx.step?.id, 'data-after': ctx.page.data?.after }, content);
}
