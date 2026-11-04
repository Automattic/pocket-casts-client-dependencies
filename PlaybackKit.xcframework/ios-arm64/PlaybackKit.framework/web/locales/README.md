# Translations

One file per language the apps ship: iOS's 15 and Android's five more (ar, el, en-GB, ko, nb). English is the source, in [`../core/copy.js`](../core/copy.js); each file here maps the same keys to that language, and a key a file leaves out is shown in English.

> **Status: machine-translated drafts, not reviewed.** Translated by Claude on 2026-11-04 from the **placeholder** English, for layout work and review. Before release they need a native speaker's review, and every one of them is redone when the writing team's final copy lands. Each file's header says what to look at first.

## How a language is picked

By default Playback is in **the app's language**, with the user's region for numbers and dates: the native libraries pass it as `PLAYBACK_ENV.locale` (iOS: `Locale.current`, which iOS gives the first of the user's languages the app has, or the per-app language from Settings, e.g. `en-KR` on a Korean phone, since the app has no Korean; Android: the first of the user's languages the bundle has, the per-app language when one is set). So Playback never shows a language the rest of the app does not. The host can choose another with `payload.locale`, which wins; the rig's `?locale=` wins over both.

Given a language tag, the page tries, in order: the exact language and region (`fr-CA`), the language and script (`zh-Hant`), the language (`fr`), then English. A few regions borrow a neighbour, as the apps do: Spanish outside Spain → `es-MX`, any Portuguese → `pt-BR`, English outside the US → `en-GB` (which holds only what differs from English), `no`/`nn` → `nb`. A language the bundle has no file for is shown in English, numbers and direction included ([`copy.js`](../core/copy.js), `translationChain` and `displayLocale`).

`payload.strings` still overrides any key, over the bundled translation.

## When the English changes

`web/test/locales.test.js` keeps a copy of the English the translations were made from (`web/test/locales.source.json`) and fails, naming the keys, when `copy.js` no longer matches it. Re-translate those keys in every file by the rules below, then refresh the copy with `npm run translations:snapshot` (in `web/`).

The same test checks every file mechanically: every key, no extra keys, the same `{placeholders}`, every plural form the language needs. It cannot check meaning; that is the review.

## Rules

For whoever translates, person or model.

1. **Brand names stay as they are**: "Pocket Casts" and "Playback". Last year's translations turned Playback into an ordinary word ("Wiedergabeliste", that is *playlist*; "riproduzione"; "uppspelning"; "Rétrospective"; "التشغيل"). `Playback {year}` and `Playback’{yy}` are the same in every language.
2. **Register: match the apps.** The second person each app already uses:

   | | Address | | Address |
   |---|---|---|---|
   | ar | Modern Standard; gender-neutral (below) | ja | polite (です／ます), no pronoun |
   | ca | tu | ko | polite (합니다／세요체), no 회원님 |
   | de | du (lower case) | nb | du |
   | el | εσύ | nl | je |
   | es | tú (Spain) | pt-BR | você |
   | es-MX | tú (Mexico: *escuchaste*, not *has escuchado*) | ru | вы (lower case) |
   | fr, fr-CA | vous | sv | du |
   | it | tu | zh-Hans | 您 |
   | | | zh-Hant | 你 (Taiwan) |

3. **Terms: the apps' own.** podcast / episode: ar بودكاست / حلقة; ca pòdcast / episodi; de Podcast / Folge; el podcast / επεισόδιο; es pódcast / episodio; es-MX podcast / episodio; fr, fr-CA podcast / épisode; it podcast (no plural ending) / episodio; ja ポッドキャスト / エピソード; ko 팟캐스트 / 에피소드; nb podcast (pl. podcaster) / episode; nl podcast / aflevering; pt-BR podcast / episódio; ru подкаст / выпуск; sv podcast (pl. podcasts) / avsnitt; zh-Hans 播客 / 集 (单集); zh-Hant Podcast / 單集. English says "show" for a podcast; use the language's word for podcast where "show" would read oddly. Share, Close, Play again: the apps' buttons (Teilen, Schließen, …), unless they are wrong.
4. **The listener's gender is unknown.** Nothing may agree with the listener in a way that picks a gender: no gendered adjective, participle or past-tense verb about "you" (Spanish *curioso/curiosa*, Russian *слушал/слушала*, Arabic *شغوف/شغوفة*). Rephrase: a noun instead of an adjective, the plural or formal form, another construction. **The five personality names** must fit anyone: an epicene noun with no article where the language has one (es *Coleccionista*, *Vanguardista*), else a label for the type rather than the person, else the language's usual generic form. Say in the file's header what was chosen.
5. **Placeholders**: keep every `{name}` the English has, in any order. `{count}` may be left out only from a plural form that a single number reaches (Arabic `zero`, `one`, `two`). What they hold:

   | Placeholder | Holds |
   |---|---|
   | `{count}` | the number the plural form is chosen by, formatted for the locale |
   | `{episodes}`, `{shows}` | `count.episodes` / `count.shows` already filled in ("140 episodes"). `count.episodes` is the object of "listened to" in three sentences (`shows.title`, `topPodcast.episodes`, `topShows.listened`), so it takes the case all three need; `count.shows` appears only in `shows.title`, so it takes whatever case that sentence needs |
   | `{month}` | the month's name from `Intl`, in the form it gives alone: ru *декабрь* (nominative), el *Δεκεμβρίου* (genitive), ja *12月*. Build the sentence around that form ("{month}: …"), since it cannot be inflected |
   | `{year}` | a year, no separator: in `comparison.*` the **previous** year |
   | `{yy}` | the year's last two digits |
   | `{percent}` | a whole number; the `%` is the string's (write it the language's way: fr `{percent} %` with U+202F) |
   | `{first}`, `{second}` | two `duration.*` units already filled in ("6 days", "3 hours") |
   | `{rank}`, `{title}` | a show's place (1–5) and its title, as the show names itself (any language) |
   | `{index}`, `{current}`, `{total}` | positions, for screen readers |

   A placeholder cannot take an elided article or contraction that depends on its first sound (Italian *l'8 %* but *il 62 %*, Catalan *l'11 %*, *a l'abril* but *al desembre*): phrase around it.

6. **Plurals**: a table keyed by CLDR category with exactly the categories whole numbers reach: ar `zero one two few many other`; ru `one few many`; ja, ko, zh-Hans, zh-Hant `other`; every other language here `one other`. A key that is a plain string in English stays a plain string.
7. **Length**: every layout is fitted to Figma's English. A few places give a longer translation room (a quiz title may take three lines, the hint and the months moving down; a button widens past Figma's width rather than wrapping), but stay close to the English length, and prefer the shorter of two good options, above all for: the buttons (`topPodcast.confirm`, `bestMonth.confirm` "This one!", `summary.share`, `summary.skip`, `outro.again`), the hints ("Pick one"), the verdicts ("Exactly!"), the summary card labels (`summary.topShows`, `summary.minutes`, `summary.role`), the `duration.*` units (they sit on one line inside a circle and never wrap), and the personality names (set large, centred, in a box about 320 pt wide; one or two short words).
8. **Adapt rather than translate word for word**: the wordplay ("And you made them count!", minutes that count), the tone (warm, a little playful, never formal-stiff), Figma's two-dot "Your personality is.." (the language's own ellipsis or colon; the heading may change to fit the names, de *Deine Persönlichkeit:*). "Play again" starts the story over: *watch again*, not the audio *replay* the apps' players say. `#{rank}` is the language's own way to write a place (ja *{rank}位*). `duration.pair` joins two units with no "and" unless the language needs one. Where the brand takes a grammatical gender or would take an ending, decide once and say so in the file's header (de *dein Playback*; sv, nb *din Playback*, never *Playbacken*). The language's own typography: quotes, the curly apostrophe (’), French spaces before `! ? : ; %` (narrow no-break space, U+202F), Spanish ¡ ¿, CJK full-width punctuation.
9. **Right to left (Arabic)**: no bidi control characters; every piece of text takes its direction from its first letter (`unicode-bidi: plaintext`), so a string must not **start** with a Latin word or a placeholder that may hold one (`{title}`); start it with Arabic.
10. **Accessibility strings** (`chrome.*`, `shows.artwork`, `bestMonth.months`, `summary.cards`, `summary.card`, `intro.logo`) are read by screen readers, not shown: natural spoken phrasing.

## Open questions

For the writing team, design and the reviewers; none is a translation's to settle alone.

- **The personality names** are written to fit any listener (rule 4), so in most languages they are not the English names translated: German *Sammlerherz*, French *Âme de collectionneur*, Spanish *Coleccionista*. Arabic and Russian use the generic masculine for most of them. Each file's header says what it chose.
- **"Your role" and "Your personality is.."** name the same thing two ways in the English (`summary.role`, `archetype.title`); some translations made them one word, some kept two.
- **The brand in a sentence**: whether "Playback" takes an article or a gender (de *dein Playback*, sv *din Playback*). In German it also means lip-syncing.
- **Type**: Archivo has Latin only, so Russian, Greek, Arabic, Japanese, Korean and Chinese are drawn in the system's font (SF Pro, Roboto and their companions), at the same sizes and weights.
- **Greek month names**: `Intl` gives Greek months in the genitive even alone (*Δεκεμβρίου*), so the month grid's screen-reader labels read that form; `bestMonth.detail` is written around it.
- **fr-CA**: the apps' *podcast*, or Québec's *balado*.

## What each key is

| Key | Where, and what to know |
|---|---|
| `chrome.close`, `chrome.back`, `chrome.next` | the story's buttons (Close is an icon: its label); Back/Next appear only to keyboard and screen-reader users |
| `chrome.share` | the button under every page: shares the page as an image |
| `chrome.shareBadge` | the badge on the share image: the brand, unchanged |
| `chrome.progress` | the progress bar, for screen readers: "Step 3 of 12" |
| `intro.*` | the first screen: the logo's label, the title ("Playback 2026"), the tagline under it ("Here’s your year in podcasts. Ready to dig in?"), and a line at the bottom of the screen (16 pt, about 350 pt wide) |
| `count.*` | building blocks for other sentences (`{episodes}`, `{shows}`) |
| `shows.title` | "You listened to 140 episodes across 12 shows", over a stack of covers |
| `topPodcast.quizTitle`, `quizHint`, `confirm` | the first quiz: guess your top show from your own top shows on a carousel, then "This one!" |
| `topPodcast.correct`, `wrong`, `timeout`, `direct` | the verdict, big, after the guess (`direct`: when there was no quiz, only one show); then `topPodcast.episodes` on the next line |
| `topPodcast.listened` | under the top show's cover: its minutes |
| `topShows.*` | the top 5 list: title ("Here’s your top 5"; one show: "Here’s your top show"), `#1`, "Listened to 70 episodes" |
| `bestMonth.*` | the second quiz: twelve month discs; the same verdicts, then "You listened to 1,234 minutes in March" |
| `minutes.title` | over the user's minutes drawn huge: "You spent 40,400 minutes listening to podcasts this year. And you made them count!" |
| `comparison.*` | over two circles, last year and this: up, down, or about the same (under 1%) |
| `duration.*` | on each circle, the year's listening in its two largest units: "6 days 3 hours", "5 hours 12 minutes"; `duration.pair` joins two |
| `completion.*` | "You got all the way to the end of 62% of your podcasts" (podcasts = episodes here), then "From the 310 episodes you started, you completed 192 of them." |
| `rolesIntro.*` | before the personality: "Those are your numbers. But what’s your podcast personality?" / "Let’s take a look" |
| `archetype.*` | "Your personality is..", then one of five names (big, gradient) and its sentence |
| `summary.*` | three swipeable cards: the title, card labels, the top shows as "1.Title", the role, the footer `Playback’26`, Share and Skip |
| `outro.*` | the last screen: thanks, a nudge to share, Play again |
| `empty.*`, `error.*` | when there is not enough listening, or the data could not be read |
