// The flow: a reducer over (pages, state). It owns navigation, quiz state, the
// auto-reveal timer, timed steps inside a page (the intro, which then moves on by
// itself, through a transition of its own into the next page), sharing and restart. It knows nothing about the DOM or the host: it takes
// actions and returns state plus *effects* (messages for the host).
//
// It can start before it has every page (PCIOS-1324): the host opens the story at once and
// reads the user's listening history while the intro plays. Until `load` brings the rest
// (`pending`), the flow holds on its last page: moving on from there (a tap, or the intro
// moving on by itself) leaves it *waiting*, which the container shows, and `load` moves on
// as soon as the pages are there.
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

function quizzesOf(pages) {
  return new Map(pages.filter((p) => p.quiz).map((p) => [p.id, p.quiz]));
}

/**
 * The step a page rests on: its last, or, where the last is the `transition` into the next
 * page (the intro's wave, PCIOS-1324), the one before. The steps up to it run on the clock;
 * the transition runs once the page moves on from it.
 */
function restOf(page) {
  return page.steps.length - (page.steps.at(-1).transition ? 2 : 1);
}

/** The step a page's timeline has reached `ms` after entering it (up to the one it rests on). */
function stepAtTime(page, ms) {
  let i = 0;
  while (i < restOf(page) && ms >= stepStart(page, i + 1)) i++;
  return i;
}

/**
 * @param {Object} opts
 * @param {ReturnType<import('./pages.js').buildPages>} opts.pages
 * @param {ReturnType<import('./config.js').resolveRules>} opts.rules
 * @param {() => number} opts.clock                        milliseconds
 * @param {string} [opts.startAt]                          page id to open on
 * @param {Object<string, {selectedId: string|null, revealed: boolean}>} [opts.restored]  quiz answers from an earlier session
 * @param {number} [opts.pending]  the rest of the pages are still to come (`load`): the story's
 *   length to show until then. 0: `pages` is the whole story.
 */
export function createFlow({ pages, rules, clock, startAt, restored = {}, pending = 0 }) {
  let quizzes = quizzesOf(pages);
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
    // Moving on was asked for (a tap, or the page moving on by itself) while the pages after
    // this one are still to come: the flow moves on once they are (`load`).
    waiting: false,
  };

  /** Restores earlier answers, validating them against the current quizzes. */
  function restore(answers) {
    for (const [id, a] of Object.entries(restored || {})) {
      const quiz = quizzes.get(id);
      if (!quiz || !a) continue;
      const valid = quiz.options.some((o) => o.id === a.selectedId);
      if (a.revealed) {
        answers[id] = { selectedId: valid ? a.selectedId : null, revealed: true, correct: valid ? a.selectedId === quiz.answerId : null, reason: 'restored' };
      } else if (valid) {
        answers[id].selectedId = a.selectedId;
      }
    }
    return answers;
  }
  restore(state.answers);

  const pageAt = (s = state) => pages[s.index];
  const isRevealed = (page, s = state) => !page.quiz || s.answers[page.id].revealed;
  const isBlocked = (page, s = state) => !isRevealed(page, s);
  /** Is the page on a step that plays through (or its transition), taking no taps? */
  const isLocked = (page, s = state) => Boolean(page.steps?.[s.step].locked || page.steps?.[s.step].transition);
  /** The story's length: what the host said to expect while its pages are still to come. */
  const count = () => (pending ? Math.max(pending, pages.length) : pages.length);
  /** Is there a page after this one (or one still to come)? */
  const hasNext = () => state.index < pages.length - 1 || Boolean(pending);

  /**
   * When the current page moves on by itself, in ms after entering it: once the step it
   * rests on, if that has an `ms`, has run that long from when it began (by the clock, a tap
   * that skipped to it, or a revisit), and in its transition, once that has run. Null when it
   * waits for the user, or, having asked to move on, for the pages still to come.
   */
  function movesOnAt() {
    const page = pageAt();
    if (!page.steps) return null;
    const rest = restOf(page);
    if (state.step > rest) return state.stepAt + page.steps[state.step].ms;
    if (page.steps[rest].ms == null || isBlocked(page) || !hasNext() || state.waiting) return null;
    return (state.step === rest ? state.stepAt : stepStart(page, rest)) + page.steps[rest].ms;
  }

  /** Moves on to the next page, or, while that is still to come, waits for it. */
  function moveOn(effects) {
    if (state.index < pages.length - 1) enter(state.index + 1, effects);
    else if (pending && !state.waiting) state = { ...state, waiting: true };
  }

  /**
   * Moves on from the step the page rests on, `at` ms after entering it: into its transition,
   * once the page after it is there (it leads into that page), or, while that is still to
   * come, waits for it; without a transition, on.
   */
  function advance(effects, at) {
    const page = pageAt();
    const last = page.steps ? page.steps.length - 1 : -1;
    if (!page.steps?.[last].transition || state.step === last) return moveOn(effects);
    if (state.index < pages.length - 1) state = { ...state, step: last, stepAt: at };
    else if (pending && !state.waiting) state = { ...state, waiting: true };
  }

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
      // A sequence plays once: coming back to it shows the step it rests on, as it is once
      // everything on it has come in (`settled` ms in).
      step: revisit && page.steps ? restOf(page) : 0,
      stepAt: revisit && page.steps ? -(page.steps[restOf(page)].settled ?? 0) : 0,
      waiting: false,
    };
    effects.push({ type: 'page', pageId: page.id, index, count: count(), revisit });
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
        // A step that plays through (the intro's logo and rings) takes no taps, and nor does
        // a transition into the next page (its wave).
        if (isLocked(page)) break;
        // Moving on during a timed sequence skips to the step it rests on first.
        if (page.steps && state.step < restOf(page)) {
          state = { ...state, step: restOf(page), stepAt: elapsed() };
          break;
        }
        if (isBlocked(page)) break;
        advance(effects, elapsed());
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
          if (state.step < restOf(page)) {
            const due = stepAtTime(page, elapsed());
            if (due > state.step) state = { ...state, step: due, stepAt: stepStart(page, due) };
          }
          // The step it rests on run, the page moves on as a tap would (the intro: POC-1020),
          // into its transition, and that run, on: when each was due, so a late tick lands
          // where the clock is.
          const { index } = state;
          for (let at = movesOnAt(); at != null && elapsed() >= at && state.index === index; at = movesOnAt()) advance(effects, at);
          if (state.index !== index) break;
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
    /** Every page there is so far (all of them, unless some are still to come). */
    get pages() { return pages; },
    getState: () => state,
    getPage: () => pageAt(),
    isBlocked: () => isBlocked(pageAt()),
    isRevealed: () => isRevealed(pageAt()),
    elapsedMs: elapsed,
    canGoBack: () => state.index > 0,
    canGoNext: () => !isBlocked(pageAt()) && !isLocked(pageAt()) && hasNext(),
    /** The story's length: every page, or, while some are still to come, what to expect. */
    count,
    /** True while the pages after the first ones are still to come (`load`). */
    isPending: () => Boolean(pending),
    /** True while moving on waits for the pages still to come: the container shows it. */
    isWaiting: () => Boolean(pending) && state.waiting,
    /** Remaining auto-reveal time for the current page, or null when no timer is running. */
    revealCountdownMs() {
      const p = pageAt();
      if (!p.quiz || state.answers[p.id].revealed || state.answers[p.id].selectedId != null) return null;
      return Math.max(0, rules.revealTimeoutMs - elapsed());
    },
    /**
     * The current page's step, for pages with `steps`: which one, how long it has been
     * showing (or, before the page's clock has started, how long until it starts:
     * `startsInMs`), and how long until the next one is due, or on the last until the page
     * moves on by itself (null when it waits for the user). Steps advance, and the page
     * moves on, on `tick`; dispatch one when `remainingMs` runs out.
     */
    step() {
      const p = pageAt();
      if (!p.steps) return null;
      const into = elapsed() - state.stepAt;
      const until = state.step < restOf(p) ? stepStart(p, state.step + 1) : movesOnAt();
      return {
        index: state.step,
        id: p.steps[state.step].id,
        count: p.steps.length,
        elapsedMs: Math.max(0, into),
        startsInMs: Math.max(0, -into),
        remainingMs: until == null ? null : Math.max(0, until - elapsed()),
        ...p.steps[state.step],
      };
    },
    /** True unless the current page is still playing the steps before the one it rests on. */
    stepsDone: () => !pageAt().steps || state.step >= restOf(pageAt()),
    /**
     * How long until the current page's own timeline has shown everything on it, in ms from
     * now (0 once it has): its steps, then its last step's `shows`, from when that step began
     * (the intro: the wave washing in, as it moves on), or until it moves on, where it does by
     * itself (the intro, once its transition has run: its segment is full as it goes), or the
     * page's `shows`, from entering it (what its backdrop draws after the DOM has settled: the
     * completion rate's sweep). The DOM's own animations are the view's to add (ui/app.js).
     * Paused time does not count. A transition not due yet (the intro waiting for the data)
     * counts for nothing.
     */
    untilShownMs() {
      const p = pageAt();
      if (!p.steps) return Math.max(0, (p.shows || 0) * 1000 - elapsed());
      const last = p.steps.length - 1;
      const ahead = p.steps[last].transition && state.step < last;
      const lastAt = state.step === last ? state.stepAt : ahead ? movesOnAt() : stepStart(p, last);
      if (lastAt == null) return 0;
      const ends = ahead ? lastAt + p.steps[last].ms : movesOnAt() ?? 0;
      return Math.max(0, Math.max(lastAt + (p.steps[last].shows || 0) * 1000, ends) - elapsed());
    },
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
    /**
     * The whole story, once the host's data is there: `all` is every page, starting with the
     * ones the flow already has (the intro). The flow stays where it is, unless moving on was
     * waiting for these, when it moves on now (the intro: into its transition). Earlier answers are restored against the new
     * quizzes. Emits what that moving on emits.
     */
    load(all) {
      if (!pending) return [];
      const effects = [];
      pages = all;
      pending = 0;
      quizzes = quizzesOf(pages);
      state = { ...state, answers: restore(initialAnswers()) };
      if (state.waiting) {
        state = { ...state, waiting: false };
        if (!isBlocked(pageAt())) advance(effects, elapsed());
      }
      for (const fn of listeners) fn(state, effects, { type: 'load' });
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
