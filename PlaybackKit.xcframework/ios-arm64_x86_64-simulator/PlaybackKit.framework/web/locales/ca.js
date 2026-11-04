// Catalan. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - Personality names, gender-neutral, no article: Col·leccionista, Avantguardista,
//   Antologista (epicene), and two adapted to stay epicene: Aficionado → Especialista,
//   Flâneur → Nòmada. "Oient" (epicene) for listener.
// - Nothing agrees with "tu": "preparat", "curiós", "únic", "apassionat" rephrased.
// - Built to avoid elision before a number or a month: "has escoltat {shows} i {episodes}",
//   "aquest {month}" (not "a l’abril / al desembre"), "un {percent} %" (not "l’11 %").
// - "And you made them count!" → "I cada minut ha comptat!".
// - "Gairebé!" for "Not quite!", "Som-hi?" in the tagline, "Torna a començar" for Play again.

export default {
  'chrome.close': 'Tanca',
  'chrome.back': 'Enrere',
  'chrome.next': 'Següent',
  'chrome.share': 'Comparteix aquesta història',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Pas {current} de {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Aquí tens el teu any en pòdcasts. Som-hi?',
  'intro.body': 'El que has escoltat. Els pòdcasts que t’han encantat. El que et fa diferent de la resta.',

  'count.shows': { one: '{count} pòdcast', other: '{count} pòdcasts' },
  'count.episodes': { one: '{count} episodi', other: '{count} episodis' },
  'shows.title': 'Has escoltat {shows} i {episodes}',
  'shows.artwork': 'Els teus pòdcasts preferits',

  'topPodcast.quizTitle': 'Però hi ha un pòdcast que s’ha endut la major part de la teva atenció. Endevines quin?',
  'topPodcast.quizHint': 'Tria’n un',
  'topPodcast.confirm': 'Aquest!',
  'topPodcast.correct': 'Exacte!',
  'topPodcast.wrong': 'Gairebé!',
  'topPodcast.timeout': 'S’ha acabat el temps!',
  'topPodcast.direct': 'El teu pòdcast preferit',
  'topPodcast.episodes': 'Enguany has escoltat {episodes}.',
  'topPodcast.listened': { one: '{count} minut d’escolta', other: '{count} minuts d’escolta' },

  'topShows.title': { one: 'Aquest és el teu pòdcast preferit', other: 'Aquest és el teu top {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'Has escoltat {episodes}',

  'bestMonth.quizTitle': 'Enguany hi ha hagut un mes en què has escoltat més que mai. Endevines quin?',
  'bestMonth.quizHint': 'Tria’n un',
  'bestMonth.confirm': 'Aquest!',
  'bestMonth.months': 'Mesos',
  'bestMonth.correct': 'Exacte!',
  'bestMonth.wrong': 'Gairebé!',
  'bestMonth.timeout': 'S’ha acabat el temps!',
  'bestMonth.direct': 'El teu mes rècord',
  'bestMonth.detail': { one: 'Has escoltat {count} minut aquest {month}', other: 'Has escoltat {count} minuts aquest {month}' },

  'minutes.title': {
    one: 'Enguany has passat {count} minut escoltant pòdcasts. I ha valgut la pena!',
    other: 'Enguany has passat {count} minuts escoltant pòdcasts. I cada minut ha comptat!',
  },

  'comparison.up': 'Respecte al {year}, el teu temps d’escolta ha augmentat un {percent} %.',
  'comparison.down': 'Respecte al {year}, el teu temps d’escolta ha baixat un {percent} %.',
  'comparison.same': 'Respecte al {year}, el teu temps d’escolta s’ha mantingut gairebé igual.',
  'duration.days': { one: '{count} dia', other: '{count} dies' },
  'duration.hours': { one: '{count} hora', other: '{count} hores' },
  'duration.minutes': { one: '{count} minut', other: '{count} minuts' },
  'duration.pair': '{first} {second}',

  'completion.title': 'Has escoltat fins al final un {percent} % dels teus episodis',
  'completion.detail': {
    one: 'Has començat {count} episodi i n’has acabat {completed}.',
    other: 'Dels {count} episodis que has començat, n’has acabat {completed}.',
  },

  'rolesIntro.title': 'Aquests són els teus números. Però quina personalitat tens com a oient?',
  'rolesIntro.body': 'Fem-hi un cop d’ull',

  'archetype.title': 'La teva personalitat és…',
  'archetype.collector.name': 'Col·leccionista',
  'archetype.collector.body': 'No hi ha ningú com tu: trobes els pòdcasts que als altres se’ls escapen, per petita que sigui la seva audiència.',
  'archetype.avantGardist.name': 'Avantguardista',
  'archetype.avantGardist.body': 'Tens la curiositat a la sang i sempre vas un pas per davant: descobreixes pòdcasts nous abans que es facin famosos.',
  'archetype.aficionado.name': 'Especialista',
  'archetype.aficionado.body': 'Et deixes portar per allò que t’apassiona: aprofundeixes en un sol tema mentre els altres salten d’un gènere a l’altre.',
  'archetype.anthologist.name': 'Antologista',
  'archetype.anthologist.body': 'Contens multituds: reuneixes un munt d’interessos de tots els gèneres sense deixar mai de ser tu.',
  'archetype.flaneur.name': 'Nòmada',
  'archetype.flaneur.body': 'Tens una gana insaciable d’escoltar: vas d’aquí cap allà per trobar el teu proper pòdcast preferit entre milers.',

  'summary.title': 'Playback {year}',
  'summary.cards': 'Les teves targetes de Playback',
  'summary.card': 'Targeta {index} de {count}',
  'summary.topShows': 'Top pòdcasts',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Minuts d’escolta',
  'summary.role': 'El teu perfil',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Comparteix',
  'summary.skip': 'Omet',

  'outro.title': 'Gràcies per passar l’any amb Pocket Casts',
  'outro.body': 'Comparteix el teu Playback amb els amics i mostra una mica d’estima als creadors que t’han fet companyia tot l’any.',
  'outro.again': 'Torna a començar',

  'empty.title': 'Encara no has escoltat prou',
  'empty.body': 'Escolta uns quants episodis més i el teu Playback estarà a punt.',
  'empty.close': 'Tanca',

  'error.title': 'No s’ha pogut carregar el teu Playback',
  'error.close': 'Tanca',
};
