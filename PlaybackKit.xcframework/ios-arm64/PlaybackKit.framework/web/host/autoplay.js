// Walkthrough driver for the rig: plays the whole flow unattended so a platform can be
// screenshotted or filmed with nobody tapping. It goes through the public flow actions
// only, exactly what a person's taps would do. A timed sequence (the intro) is watched
// to its last step, as a person would, before moving on.
//
// `guess` controls the quiz screens: 'correct', 'wrong', or 'alternate' (wrong first,
// correct second, so one run shows both outcomes).

export function startAutoplay(controller, { intervalMs = 1500, guess = 'alternate', onDone } = {}) {
  const { flow, dispatch } = controller;
  let quizzes = 0;
  let variantsShown = 0;
  let sharedSummary = false;
  let stopped = false;

  const step = () => {
    if (stopped) return;
    const page = flow.getPage();
    const answer = page.quiz ? flow.answers()[page.id] : null;

    if (!flow.stepsDone()) {
      return;
    } else if (page.quiz && !answer.revealed) {
      if (answer.selectedId == null) {
        const wantCorrect = guess === 'correct' || (guess === 'alternate' && quizzes % 2 === 1);
        const options = page.quiz.options;
        const pick = wantCorrect ? options.find((o) => o.id === page.quiz.answerId) : options.find((o) => o.id !== page.quiz.answerId);
        dispatch({ type: 'select', optionId: pick.id });
      } else {
        dispatch({ type: 'confirm' });
        quizzes++;
      }
    } else if (page.kind === 'summary' && variantsShown < 2) {
      variantsShown++;
      dispatch({ type: 'setVariant', variant: variantsShown === 1 ? 'b' : 'c' });
    } else if (page.kind === 'summary' && !sharedSummary) {
      sharedSummary = true;
      dispatch({ type: 'share' });
    } else if (page.kind === 'outro' || page.kind === 'empty') {
      stop();
      onDone?.();
      return;
    } else {
      dispatch({ type: 'next' });
    }
  };

  const timer = setInterval(step, intervalMs);
  function stop() {
    stopped = true;
    clearInterval(timer);
  }
  return { stop };
}
