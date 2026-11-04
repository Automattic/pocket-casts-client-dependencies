// The flow: a reducer over (pages, state). It owns navigation, quiz state, the
// auto-reveal timer, timed steps inside a page (the intro), sharing and restart. It
// knows nothing about the DOM or the host: it takes actions and returns state plus
// *effects* (messages for the host).
//
// Time is injected (`clock`) so the whole thing is deterministic under test.

import { SUMMARY_VARIANTS } from './config.js';

const freshAnswer = () => ({ selectedId: null, revealed: false, correct: null, reason: null });

/** When step `i` of a page starts on its own, in ms after entering the page. */
function stepStart(page, i) {
  let at = 0;
  for (let k = 0; k < i; k++) at += page.steps[k].ms ?? 0;
  return at;
}

/** The step a page's timeline has reached `ms` after entering it. */
function stepAtTime(page, ms) {
  let i = 0;
  while (i < page.steps.length - 1 && ms >= stepStart(page, i + 1)) i++;
  return i;
}

/**
 * @param {Object} opts
 * @param {ReturnType<import('./pages.js').buildPages>} opts.pages
 * @param {ReturnType<import('./config.js').resolveRules>} opts.rules
 * @param {() => number} opts.clock                        milliseconds
 * @param {string} [opts.startAt]                          page id to open on
 * @param {Object<string, {selectedId: string|null, revealed: boolean}>} [opts.restored]  quiz answers from an earlier session
 */
export function createFlow({ pages, rules, clock, startAt, restored = {} }) {
  const quizzes = new Map(pages.filter((p) => p.quiz).map((p) => [p.id, p.quiz]));
  const listeners = new Set();

  const initialAnswers = () => {
    const answers = {};
    for (const id of quizzes.keys()) answers[id] = freshAnswer();
    return answers;
  };

  let state = {
    index: 0,
    // Each entry into a page is a new visit; `enteredAt` moves on resume (paused time does
    // not count), so it cannot tell one visit from the next.
    visit: 0,
    enteredAt: clock(),
    pausedAt: null,
    answers: initialAnswers(),
    summaryVariant: SUMMARY_VARIANTS[0],
    visited: [],
    finished: false,
    closed: false,
    // The current page's step (pages with `steps`), and when it began, in ms after
    // entering the page.
    step: 0,
    stepAt: 0,
  };

  // Restore earlier answers, validating them against the current quizzes.
  for (const [id, a] of Object.entries(restored || {})) {
    const quiz = quizzes.get(id);
    if (!quiz || !a) continue;
    const valid = quiz.options.some((o) => o.id === a.selectedId);
    if (a.revealed) {
      state.answers[id] = { selectedId: valid ? a.selectedId : null, revealed: true, correct: valid ? a.selectedId === quiz.answerId : null, reason: 'restored' };
    } else if (valid) {
      state.answers[id].selectedId = a.selectedId;
    }
  }

  const pageAt = (s = state) => pages[s.index];
  const isRevealed = (page, s = state) => !page.quiz || s.answers[page.id].revealed;
  const isBlocked = (page, s = state) => !isRevealed(page, s);

  /** `leadMs`: the page's clock starts that much later (Play again: once the outro has left). */
  function enter(index, effects, leadMs = 0) {
    const page = pages[index];
    const revisit = state.visited.includes(page.id);
    state = {
      ...state,
      index,
      visit: state.visit + 1,
      enteredAt: clock() + leadMs,
      pausedAt: null,
      visited: revisit ? state.visited : [...state.visited, page.id],
      // A sequence plays once: coming back to it shows where it ended.
      step: revisit && page.steps ? page.steps.length - 1 : 0,
      stepAt: 0,
    };
    effects.push({ type: 'page', pageId: page.id, index, count: pages.length, revisit });
    if (page.kind === 'outro' && !state.finished) {
      state = { ...state, finished: true };
      effects.push({ type: 'finished' });
    }
  }

  function reveal(reason, effects) {
    const page = pageAt();
    if (!page.quiz || state.answers[page.id].revealed) return;
    const { selectedId } = state.answers[page.id];
    const correct = selectedId == null ? null : selectedId === page.quiz.answerId;
    state = { ...state, answers: { ...state.answers, [page.id]: { selectedId, revealed: true, correct, reason } } };
    effects.push({ type: 'reveal', pageId: page.id, selectedId, answerId: page.quiz.answerId, correct, reason });
  }

  function elapsed() {
    return (state.pausedAt ?? clock()) - state.enteredAt;
  }

  function reduce(action) {
    const effects = [];
    if (state.closed && action.type !== 'restart') return effects;
    const page = pageAt();

    switch (action.type) {
      case 'next': {
        // Moving on during a timed sequence skips to its last step first.
        if (page.steps && state.step < page.steps.length - 1) {
          state = { ...state, step: page.steps.length - 1, stepAt: elapsed() };
          break;
        }
        if (isBlocked(page) || state.index >= pages.length - 1) break;
        enter(state.index + 1, effects);
        break;
      }
      case 'back': {
        if (state.index === 0) break;
        enter(state.index - 1, effects);
        break;
      }
      case 'goTo': {
        const i = pages.findIndex((p) => p.id === action.pageId);
        if (i >= 0 && i !== state.index) enter(i, effects);
        break;
      }
      case 'select': {
        if (!page.quiz || state.answers[page.id].revealed) break;
        if (!page.quiz.options.some((o) => o.id === action.optionId)) break;
        state = { ...state, answers: { ...state.answers, [page.id]: { ...state.answers[page.id], selectedId: action.optionId } } };
        effects.push({ type: 'select', pageId: page.id, optionId: action.optionId });
        break;
      }
      case 'confirm': {
        if (!page.quiz || state.answers[page.id].selectedId == null) break;
        reveal('confirmed', effects);
        break;
      }
      case 'tick': {
        if (page.steps && state.pausedAt == null) {
          const due = stepAtTime(page, elapsed());
          if (due > state.step) state = { ...state, step: due, stepAt: stepStart(page, due) };
        }
        // Auto-reveal so nobody is stuck on a quiz. Spec: after X minutes with no pick.
        if (page.quiz && !state.answers[page.id].revealed && state.answers[page.id].selectedId == null && state.pausedAt == null && elapsed() >= rules.revealTimeoutMs) {
          reveal('timeout', effects);
        }
        break;
      }
      case 'pause': {
        if (state.pausedAt == null) state = { ...state, pausedAt: clock() };
        break;
      }
      case 'resume': {
        if (state.pausedAt != null) state = { ...state, enteredAt: state.enteredAt + (clock() - state.pausedAt), pausedAt: null };
        break;
      }
      case 'setVariant': {
        if (page.kind === 'summary' && SUMMARY_VARIANTS.includes(action.variant)) state = { ...state, summaryVariant: action.variant };
        break;
      }
      case 'share': {
        if (!page.shareable || isBlocked(page)) break;
        effects.push({
          type: 'share',
          pageId: page.id,
          ...(page.kind === 'summary' ? { variant: state.summaryVariant } : {}),
        });
        break;
      }
      case 'restart': {
        state = { ...state, closed: false, finished: false, answers: initialAnswers(), summaryVariant: SUMMARY_VARIANTS[0], visited: [] };
        effects.push({ type: 'restart' });
        // The story starts again once the page it restarts from has left (`leaves`).
        enter(0, effects, (page.leaves || 0) * 1000);
        break;
      }
      case 'close': {
        state = { ...state, closed: true };
        effects.push({ type: 'close', reason: action.reason || 'closed', pageId: page.id, finished: state.finished });
        break;
      }
      default:
        break;
    }
    return effects;
  }

  const flow = {
    pages,
    getState: () => state,
    getPage: () => pageAt(),
    isBlocked: () => isBlocked(pageAt()),
    isRevealed: () => isRevealed(pageAt()),
    elapsedMs: elapsed,
    canGoBack: () => state.index > 0,
    canGoNext: () => !isBlocked(pageAt()) && state.index < pages.length - 1,
    /** Remaining auto-reveal time for the current page, or null when no timer is running. */
    revealCountdownMs() {
      const p = pageAt();
      if (!p.quiz || state.answers[p.id].revealed || state.answers[p.id].selectedId != null) return null;
      return Math.max(0, rules.revealTimeoutMs - elapsed());
    },
    /**
     * The current page's step, for pages with `steps`: which one, how long it has been
     * showing (or, before the page's clock has started, how long until it starts:
     * `startsInMs`), and how long until the next one is due (null on the last). Steps
     * advance on `tick`; dispatch one when `remainingMs` runs out.
     */
    step() {
      const p = pageAt();
      if (!p.steps) return null;
      const last = state.step === p.steps.length - 1;
      const into = elapsed() - state.stepAt;
      return {
        index: state.step,
        id: p.steps[state.step].id,
        count: p.steps.length,
        elapsedMs: Math.max(0, into),
        startsInMs: Math.max(0, -into),
        remainingMs: last ? null : Math.max(0, stepStart(p, state.step + 1) - elapsed()),
        ...p.steps[state.step],
      };
    },
    /** True unless the current page is still playing a timed sequence. */
    stepsDone: () => !pageAt().steps || state.step === pageAt().steps.length - 1,
    /** Snapshot of quiz answers, for the host to persist. */
    answers: () => state.answers,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispatch(action) {
      const before = state;
      const effects = reduce(action);
      if (state !== before || effects.length) for (const fn of listeners) fn(state, effects, action);
      return effects;
    },
    /** Open the initial page. Emits the first `page` effect. */
    start() {
      const effects = [];
      const i = startAt ? pages.findIndex((p) => p.id === startAt) : -1;
      enter(i >= 0 ? i : 0, effects);
      for (const fn of listeners) fn(state, effects, { type: 'start' });
      return effects;
    },
  };
  return flow;
}
