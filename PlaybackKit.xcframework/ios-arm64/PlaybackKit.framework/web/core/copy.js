// All user-facing copy. Placeholder copy: the writing team owns the final strings.
//
// An entry is a template string with `{name}` placeholders, or a plural table
// `{ one, other, ... }` selected by `params.count`. `{count}` is formatted for the
// locale. Translations are bundled, one file per language in `../locales` (its README
// says how a language is picked and how they are kept up to date); the host can still
// override any entry through `payload.strings`, and a key no table has is English here.
// After changing an entry here, re-translate it (`web/test/locales.test.js` names it).

import { formatNumber } from './format.js';
import { TRANSLATIONS } from '../locales/index.js';

export const STRINGS = Object.freeze({
  'chrome.close': 'Close',
  'chrome.back': 'Back',
  'chrome.next': 'Next',
  'chrome.share': 'Share this story',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Step {current} of {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Here’s your year in podcasts. Ready to dig in?',
  // In the tagline's place (Figma "Intro 5"), when moving on from the intro waits for the app
  // to read the listening history (PCIOS-1324).
  'intro.loading': 'Loading your experience…',
  'intro.body': 'What you listened to. The podcasts you loved. What sets you apart as a listener.',

  'count.shows': { one: '{count} show', other: '{count} shows' },
  'count.episodes': { one: '{count} episode', other: '{count} episodes' },
  'shows.title': 'You listened to {episodes} across {shows}',
  'shows.artwork': 'Your top shows',

  'topPodcast.quizTitle': 'But one show got most of your attention. Can you guess which?',
  'topPodcast.quizHint': 'Pick one',
  'topPodcast.confirm': 'This one!',
  // The verdict, then `topPodcast.episodes` on the next line. Figma has the first only;
  // the others follow it until the writing team says otherwise.
  'topPodcast.correct': 'Exactly!',
  'topPodcast.wrong': 'Not quite!',
  'topPodcast.timeout': 'Time’s up!',
  'topPodcast.direct': 'Your top show',
  'topPodcast.episodes': 'You listened to {episodes} this year.',
  'topPodcast.listened': { one: 'Listened to {count} minute', other: 'Listened to {count} minutes' },

  'topShows.title': { one: 'Here’s your top show', other: 'Here’s your top {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'Listened to {episodes}',

  'bestMonth.quizTitle': 'Your listening spiked for one month this year. Guess which one?',
  'bestMonth.quizHint': 'Pick one',
  'bestMonth.confirm': 'This one!',
  'bestMonth.months': 'Months',
  // The verdict, then `bestMonth.detail` on the next line (Figma's "Top month 3"). Figma
  // has the first only; the others are the top show's until the writing team says otherwise.
  'bestMonth.correct': 'Exactly!',
  'bestMonth.wrong': 'Not quite!',
  'bestMonth.timeout': 'Time’s up!',
  'bestMonth.direct': 'Your top month',
  'bestMonth.detail': { one: 'You listened to {count} minute in {month}', other: 'You listened to {count} minutes in {month}' },

  // Figma's. The issue notes its sample numbers disagree ("4,500 minutes" over "40,400"):
  // both are the user's minutes here.
  'minutes.title': { one: 'You spent {count} minute listening to podcasts this year. And you made them count!', other: 'You spent {count} minutes listening to podcasts this year. And you made them count!' },

  // Figma's, for both directions. Figma has none for about the same (under 1% either way).
  'comparison.up': 'Compared to {year}, your listening time went up {percent}%.',
  'comparison.down': 'Compared to {year}, your listening time went down {percent}%.',
  'comparison.same': 'Compared to {year}, your listening time stayed about the same.',
  // A year's listening on its circle: its two largest units ("6 days 3 hours").
  'duration.days': { one: '{count} day', other: '{count} days' },
  'duration.hours': { one: '{count} hour', other: '{count} hours' },
  'duration.minutes': { one: '{count} minute', other: '{count} minutes' },
  'duration.pair': '{first} {second}',

  // Figma's. Its sample numbers disagree (73% over 72 of 128): both are the user's here.
  'completion.title': 'You got all the way to the end of {percent}% of your podcasts',
  'completion.detail': { one: 'From the {count} episode you started, you completed {completed} of them.', other: 'From the {count} episodes you started, you completed {completed} of them.' },

  'rolesIntro.title': 'Those are your numbers. But what’s your podcast personality?',
  'rolesIntro.body': 'Let’s take a look',

  // Figma's "Role 1–5" (the P2's video is older: "Your role is..", "The explorer", one line each).
  'archetype.title': 'Your personality is..',
  'archetype.collector.name': 'The Collector',
  'archetype.collector.body': 'You’re one-of-a-kind, gathering up the shows that other people miss, however small their audience.',
  'archetype.avantGardist.name': 'The Avant-gardist',
  'archetype.avantGardist.body': 'Cutting-edge and curious by nature, you’re always one step ahead, finding new shows before they get big.',
  'archetype.aficionado.name': 'The Aficionado',
  'archetype.aficionado.body': 'You’re passionate about what moves you, going deep on one subject while others flit from genre to genre.',
  'archetype.anthologist.name': 'The Anthologist',
  'archetype.anthologist.body': 'You contain multitudes, bringing together countless interests across genres while remaining true to yourself.',
  'archetype.flaneur.name': 'The Flâneur',
  'archetype.flaneur.body': 'You’re a voracious listener, wandering far and wide to find your next favorite among thousands.',

  // Figma's "Summary 1–3" (the P2's video titles it "Playback’26"; its role, "Specialist", is
  // Figma's sample: each card draws the user's role). The share image's title is its share frames'.
  'summary.title': 'Playback {year}',
  'summary.shareTitle': 'My Playback {year}',
  'summary.cards': 'Your Playback cards',
  'summary.card': 'Card {index} of {count}',
  'summary.topShows': 'Top shows',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Minutes Listened',
  'summary.role': 'Your role',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Share',
  'summary.skip': 'Skip',

  // Figma's "Repeate or close" (the P2's video has "podcasters" for "creators", and no full stop).
  'outro.title': 'Thanks for spending your year with Pocket Casts',
  'outro.body': 'Share your Playback with friends and show some love to the creators who kept you company all year.',
  'outro.again': 'Play again',

  'empty.title': 'Not enough listening yet',
  'empty.body': 'Listen to a few more episodes and your Playback will be ready to build.',
  'empty.close': 'Close',

  'error.title': "We couldn't load your Playback",
  'error.close': 'Close',
});

function pluralCategory(locale, n) {
  try {
    return new Intl.PluralRules(locale).select(n);
  } catch {
    return 'other';
  }
}

// Languages borrowed by a neighbour, as the apps do.
const LANGUAGE_ALIASES = { no: 'nb', nn: 'nb' };
/** English-speaking regions that spell as the US does; the rest read en-GB. */
const US_ENGLISH = new Set(['US', 'AS', 'GU', 'MH', 'MP', 'PR', 'UM', 'VI']);

function parseLocale(tag) {
  try {
    return new Intl.Locale(String(tag).replace(/_/g, '-'));
  } catch {
    return null;
  }
}

/** The bundled translations for a BCP 47 tag, best first; none for US English or an unknown language. */
export function translationChain(tag) {
  const loc = parseLocale(tag)?.maximize();
  if (!loc) return [];
  const language = LANGUAGE_ALIASES[loc.language] ?? loc.language;
  const { script, region } = loc;
  const candidates = [`${language}-${region}`, `${language}-${script}`, language];
  if (language === 'es' && region !== 'ES') candidates.splice(1, 0, 'es-MX');
  if (language === 'pt') candidates.push('pt-BR');
  if (language === 'en' && !US_ENGLISH.has(region)) candidates.push('en-GB');
  return [...new Set(candidates)].filter((c) => Object.hasOwn(TRANSLATIONS, c));
}

/**
 * The locale the page is shown in: the host's (normalised: `pt_BR` → `pt-BR`), unless its
 * language has no translation here; then English, numbers, months and direction too, so
 * the page is in one language.
 */
export function displayLocale(tag) {
  const loc = typeof tag === 'string' && tag ? parseLocale(tag) : null;
  if (!loc) return 'en';
  return loc.language === 'en' || translationChain(tag).length ? loc.toString() : 'en';
}

/** Build a translator bound to a locale and a set of host overrides. */
export function createTranslator(locale = 'en', overrides = {}) {
  const tables = [overrides ?? {}, ...translationChain(locale).map((c) => TRANSLATIONS[c]), STRINGS];
  return function t(key, params = {}) {
    let entry = null;
    for (const table of tables) if ((entry = table[key]) != null) break;
    if (entry == null) return key;
    if (typeof entry === 'object') {
      const cat = pluralCategory(locale, params.count);
      entry = entry[cat] ?? entry.other ?? Object.values(entry)[0];
    }
    return String(entry).replace(/\{(\w+)\}/g, (m, name) => {
      if (!(name in params)) return m;
      const v = params[name];
      // Years are numbers but never get a thousands separator.
      return typeof v === 'number' && name !== 'year' ? formatNumber(v, locale) : String(v);
    });
  };
}
