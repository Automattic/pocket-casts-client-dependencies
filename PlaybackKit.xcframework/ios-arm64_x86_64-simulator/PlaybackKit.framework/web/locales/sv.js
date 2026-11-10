// Swedish. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - The personality names are common-gender nouns used for anyone: Samlaren,
//   Avantgardisten, Kännaren, Allätaren (playful: someone with broad taste), Flanören,
//   after "Du är…". Is Allätaren right for the Anthologist?
// - The wordplay: "And you made them count!" is "Och varenda en räknades!".
// - "Top show" is the app's "favoritpodcast", since "topppodcast" reads badly.
// - The brand takes "din" (din Playback): check it against how the app refers to it.
// - "Share this story" is the app's "Dela den här berättelsen".

export default {
  'chrome.close': 'Stäng',
  'chrome.back': 'Tillbaka',
  'chrome.next': 'Nästa',
  'chrome.share': 'Dela den här berättelsen',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Steg {current} av {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Här är ditt podcastår. Redo att dyka in?',
  'intro.loading': 'Läser in din upplevelse…',
  'intro.body': 'Det du lyssnade på. De podcasts du älskade. Det som gör dig unik som lyssnare.',

  'count.shows': { one: '{count} podcast', other: '{count} podcasts' },
  'count.episodes': { one: '{count} avsnitt', other: '{count} avsnitt' },
  'shows.title': 'Du lyssnade på {episodes} från {shows}',
  'shows.artwork': 'Dina favoritpodcasts',

  'topPodcast.quizTitle': 'Men en podcast fick mest av din uppmärksamhet. Kan du gissa vilken?',
  'topPodcast.quizHint': 'Välj en',
  'topPodcast.confirm': 'Den här!',
  'topPodcast.correct': 'Exakt!',
  'topPodcast.wrong': 'Inte riktigt!',
  'topPodcast.timeout': 'Tiden är ute!',
  'topPodcast.direct': 'Din favoritpodcast',
  'topPodcast.episodes': 'Du lyssnade på {episodes} i år.',
  'topPodcast.listened': { one: 'Lyssnade i {count} minut', other: 'Lyssnade i {count} minuter' },

  'topShows.title': { one: 'Här är din favoritpodcast', other: 'Här är din topp {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'Lyssnade på {episodes}',

  'bestMonth.quizTitle': 'Ditt lyssnande toppade en månad i år. Kan du gissa vilken?',
  'bestMonth.quizHint': 'Välj en',
  'bestMonth.confirm': 'Den här!',
  'bestMonth.months': 'Månader',
  'bestMonth.correct': 'Exakt!',
  'bestMonth.wrong': 'Inte riktigt!',
  'bestMonth.timeout': 'Tiden är ute!',
  'bestMonth.direct': 'Din toppmånad',
  'bestMonth.detail': { one: 'Du lyssnade {count} minut i {month}', other: 'Du lyssnade {count} minuter i {month}' },

  'minutes.title': { one: 'Du ägnade {count} minut åt podcasts i år. Och den räknades!', other: 'Du ägnade {count} minuter åt podcasts i år. Och varenda en räknades!' },

  'comparison.up': 'Jämfört med {year} har din lyssningstid ökat med {percent} %.',
  'comparison.down': 'Jämfört med {year} har din lyssningstid minskat med {percent} %.',
  'comparison.same': 'Jämfört med {year} är din lyssningstid ungefär densamma.',
  'duration.days': { one: '{count} dag', other: '{count} dagar' },
  'duration.hours': { one: '{count} timme', other: '{count} timmar' },
  'duration.minutes': { one: '{count} minut', other: '{count} minuter' },
  'duration.pair': '{first} {second}',

  'completion.title': 'Du lyssnade klart på {percent} % av dina avsnitt',
  'completion.detail': { one: 'Av det {count} avsnitt du började på lyssnade du klart på {completed}.', other: 'Av de {count} avsnitt du började på lyssnade du klart på {completed}.' },

  'rolesIntro.title': 'Det var dina siffror. Men vilken podcastpersonlighet har du?',
  'rolesIntro.body': 'Vi tar en titt',

  'archetype.title': 'Du är…',
  'archetype.collector.name': 'Samlaren',
  'archetype.collector.body': 'Du är unik och samlar på de podcasts som andra missar, hur liten publiken än är.',
  'archetype.avantGardist.name': 'Avantgardisten',
  'archetype.avantGardist.body': 'Nyfiken och nyskapande som du är ligger du alltid steget före och hittar nya podcasts innan de slår igenom.',
  'archetype.aficionado.name': 'Kännaren',
  'archetype.aficionado.body': 'Du brinner för det som berör dig och går på djupet i ett ämne medan andra hoppar från genre till genre.',
  'archetype.anthologist.name': 'Allätaren',
  'archetype.anthologist.body': 'Du rymmer mångfald och samlar otaliga intressen från alla genrer – och förblir ändå helt dig själv.',
  'archetype.flaneur.name': 'Flanören',
  'archetype.flaneur.body': 'Du lyssnar omättligt och strövar vida omkring för att hitta din nästa favorit bland tusentals.',

  'summary.title': 'Playback {year}',
  'summary.shareTitle': 'Min Playback {year}',
  'summary.cards': 'Dina Playback-kort',
  'summary.card': 'Kort {index} av {count}',
  'summary.topShows': 'Favoritpodcasts',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Lyssnade minuter',
  'summary.role': 'Din roll',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Dela',
  'summary.skip': 'Hoppa över',

  'outro.title': 'Tack för att du tillbringade ditt år med Pocket Casts',
  'outro.body': 'Dela din Playback med vänner och visa lite kärlek till kreatörerna som höll dig sällskap hela året.',
  'outro.again': 'Se igen',

  'empty.title': 'Inte tillräckligt med lyssnande än',
  'empty.body': 'Lyssna på några fler avsnitt så blir din Playback klar.',
  'empty.close': 'Stäng',

  'error.title': 'Vi kunde inte läsa in din Playback',
  'error.close': 'Stäng',
};
