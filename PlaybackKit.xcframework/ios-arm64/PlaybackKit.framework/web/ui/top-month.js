// The top month (Figma "Top month 1–3", moving as the P2's best-months video does,
// measured from it frame by frame; see docs/effects.md).
//
// The guess: the question, "Pick one", twelve months as flat discs on a grid and "This
// one!", dim until a month is picked. A pick turns that month's disc into Creative Lab's
// bubble: the flat disc gives way to the backdrop's, drawn in the month's `.tm-slot`
// (ui/backdrop.js anchors it there), and its label turns white. The reveal: the verdict and
// the minutes, every month resizing to its listening as its bubble comes in. One page:
// the view updates in place (`update`). The page's CSS times everything (playback.css),
// from the per-month delays and sizes set here (MONTH_MOTION, core/pages.js).

import { followTitle, h } from './dom.js';
import { monthName, monthShort } from '../core/format.js';
import { MONTH_MOTION, MONTH_SIZE, monthAt } from '../core/pages.js';

/** Figma's grid: each month's centre, from the grid's centre (pt), and its disc. */
const COLUMNS = [-115.5, 0.5, 117.5];
const ROWS = [-182, -59, 64, 187];

export function topMonthView(ctx) {
  const { t, page, dispatch, payload } = ctx;
  const quiz = page.quiz;
  const locale = payload.locale;
  const { months, month: best, seconds } = page.data;

  const ask = h('h1', { class: 'story-title tm-ask', tabindex: '-1', 'data-testid': 'title' }, t('bestMonth.quizTitle'));
  const hint = h('p', { class: 'tm-hint' }, t('bestMonth.quizHint'));
  const verdictHead = h('span', { class: 'tm-verdict-head' });
  const verdictDetail = h('span', { class: 'tm-verdict-detail' }, t('bestMonth.detail', { count: Math.floor(seconds / 60), month: monthName(best, locale) }));
  const verdict = h('h1', { class: 'story-title tm-verdict', tabindex: '-1', role: 'status', 'data-testid': quiz ? 'verdict' : 'title' }, verdictHead, verdictDetail);

  const cells = months.map((m) => {
    const id = String(m.month);
    const style = [
      `--x: ${COLUMNS[m.month % 3]}`,
      `--y: ${ROWS[Math.floor(m.month / 3)]}`,
      `--size: ${m.size}`,
      `--from: ${MONTH_SIZE.guess / m.size}`,
      `--in: ${monthAt(m.month, MONTH_MOTION.in).toFixed(4)}s`,
      `--reveal: ${monthAt(m.month, MONTH_MOTION.reveal).toFixed(4)}s`,
    ].join('; ');
    return h(
      'button',
      {
        type: 'button',
        class: 'tm-month',
        style,
        'data-month': id,
        // Only options when there is a quiz (no quiz: the answer, straight away).
        ...(quiz ? { 'data-testid': `option-${id}` } : {}),
        'aria-pressed': 'false',
        'aria-label': monthName(m.month, locale),
        onClick: () => { if (quiz && !ctx.revealed) dispatch({ type: 'select', optionId: id }); },
      },
      h('span', { class: 'tm-disc', 'aria-hidden': 'true' }),
      h('span', { class: 'tm-slot', 'aria-hidden': 'true' }),
      h('span', { class: 'tm-label', 'aria-hidden': 'true' }, monthShort(m.month, locale)),
    );
  });
  const grid = h('div', { class: 'tm-grid', role: 'group', 'aria-label': t('bestMonth.months') }, cells);
  const confirm = quiz ? h('button', { type: 'button', class: 'tm-confirm', 'data-testid': 'confirm', onClick: () => dispatch({ type: 'confirm' }) }, t('bestMonth.confirm')) : null;

  const article = h('article', { class: 'page page-best-month', 'data-page': page.id }, ask, hint, grid, verdict, confirm);
  followTitle(article, ask);

  /** The pick shows: the month picked turns, the one before turns back. */
  function setPick(id) {
    for (const cell of cells) {
      const on = cell.dataset.month === id;
      const was = cell.getAttribute('aria-pressed') === 'true';
      cell.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (was && !on) cell.dataset.unpicked = '';
      else if (on) delete cell.dataset.unpicked;
    }
    if (confirm) confirm.toggleAttribute('data-ready', id != null);
    if (confirm) confirm.setAttribute('aria-disabled', id == null ? 'true' : 'false');
  }

  function setVerdict() {
    const a = ctx.answer;
    verdictHead.textContent = !quiz ? t('bestMonth.direct') : a.correct == null ? t('bestMonth.timeout') : a.correct ? t('bestMonth.correct') : t('bestMonth.wrong');
  }

  /** Off the guess, onto the answer: the page's CSS plays the rest from now. */
  function reveal(live) {
    setVerdict();
    article.dataset.phase = live ? 'reveal' : 'result';
    for (const el of [ask, hint]) el.setAttribute('aria-hidden', 'true');
    grid.setAttribute('inert', '');
    confirm?.setAttribute('inert', '');
    if (live) verdict.focus({ preventScroll: true });
  }

  if (ctx.revealed) {
    setPick(ctx.answer?.selectedId ?? null);
    reveal(false);
  } else {
    article.dataset.phase = 'guess';
    setPick(ctx.answer?.selectedId ?? null);
  }

  return {
    article,
    update(next) {
      ctx = next;
      if (!next.revealed) setPick(next.answer?.selectedId ?? null);
      if (next.revealed && article.dataset.phase === 'guess') reveal(true);
    },
  };
}
