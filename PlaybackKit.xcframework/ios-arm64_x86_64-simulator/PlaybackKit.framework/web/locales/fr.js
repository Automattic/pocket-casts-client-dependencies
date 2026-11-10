// French. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - Personality names, gender-neutral: the epicene ones bare (Avant-gardiste, Anthologiste),
//   the gendered ones as a trait, "Âme de …" (collectionneur, aficionado, flâneur), not
//   "Le Collectionneur / La Collectionneuse". Title "Votre personnalité…".
// - Nothing agrees with "vous": "Prêt ?", "curieux", "passionné", "auditeur" rephrased.
// - "And you made them count!" → "Et chacune a compté !" (each minute counted).
// - "Bien vu !" for "Exactly!", "Celui-ci !" for "This one!", "Rejouer" for Play again.
// - "Partager cette story", as the app's last Playback; "{episodes} à votre actif" on the top 5.
// - Narrow no-break space (U+202F) before ! ? : and %.

export default {
  'chrome.close': 'Fermer',
  'chrome.back': 'Précédent',
  'chrome.next': 'Suivant',
  'chrome.share': 'Partager cette story',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Étape {current} sur {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Voici votre année en podcasts. On commence ?',
  'intro.loading': 'Chargement de votre expérience…',
  'intro.body': 'Ce que vous avez écouté. Les podcasts que vous avez adorés. Ce qui vous distingue des autres.',

  'count.shows': { one: '{count} podcast', other: '{count} podcasts' },
  'count.episodes': { one: '{count} épisode', other: '{count} épisodes' },
  'shows.title': 'Vous avez écouté {episodes} de {shows}',
  'shows.artwork': 'Vos podcasts les plus écoutés',

  'topPodcast.quizTitle': 'Mais un podcast a retenu votre attention plus que les autres. Devinez lequel ?',
  'topPodcast.quizHint': 'Choisissez-en un',
  'topPodcast.confirm': 'Celui-ci !',
  'topPodcast.correct': 'Bien vu !',
  'topPodcast.wrong': 'Pas tout à fait !',
  'topPodcast.timeout': 'Temps écoulé !',
  'topPodcast.direct': 'Votre podcast préféré',
  'topPodcast.episodes': 'Vous avez écouté {episodes} cette année.',
  'topPodcast.listened': { one: '{count} minute d’écoute', other: '{count} minutes d’écoute' },

  'topShows.title': { one: 'Voici votre top {count}', other: 'Voici votre top {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': '{episodes} à votre actif',

  'bestMonth.quizTitle': 'Votre écoute a atteint un pic pendant un mois cette année. Devinez lequel ?',
  'bestMonth.quizHint': 'Choisissez-en un',
  'bestMonth.confirm': 'Celui-ci !',
  'bestMonth.months': 'Mois',
  'bestMonth.correct': 'Bien vu !',
  'bestMonth.wrong': 'Pas tout à fait !',
  'bestMonth.timeout': 'Temps écoulé !',
  'bestMonth.direct': 'Votre mois record',
  'bestMonth.detail': { one: 'Vous avez écouté {count} minute en {month}', other: 'Vous avez écouté {count} minutes en {month}' },

  'minutes.title': {
    one: 'Vous avez passé {count} minute à écouter des podcasts cette année. Et elle a compté !',
    other: 'Vous avez passé {count} minutes à écouter des podcasts cette année. Et chacune a compté !',
  },

  'comparison.up': 'Par rapport à {year}, votre temps d’écoute a augmenté de {percent} %.',
  'comparison.down': 'Par rapport à {year}, votre temps d’écoute a baissé de {percent} %.',
  'comparison.same': 'Par rapport à {year}, votre temps d’écoute est resté à peu près le même.',
  'duration.days': { one: '{count} jour', other: '{count} jours' },
  'duration.hours': { one: '{count} heure', other: '{count} heures' },
  'duration.minutes': { one: '{count} minute', other: '{count} minutes' },
  'duration.pair': '{first} {second}',

  'completion.title': 'Vous avez écouté {percent} % de vos épisodes jusqu’au bout',
  'completion.detail': {
    one: 'Vous avez commencé {count} épisode et en avez terminé {completed}.',
    other: 'Sur les {count} épisodes commencés, vous en avez terminé {completed}.',
  },

  'rolesIntro.title': 'Voilà pour les chiffres. Mais quelle personnalité se cache derrière votre écoute ?',
  'rolesIntro.body': 'Jetons un œil',

  'archetype.title': 'Votre personnalité…',
  'archetype.collector.name': 'Âme de collectionneur',
  'archetype.collector.body': 'Vous êtes unique en votre genre : vous dénichez les podcasts qui échappent aux autres, aussi confidentiels soient-ils.',
  'archetype.avantGardist.name': 'Avant-gardiste',
  'archetype.avantGardist.body': 'D’une curiosité insatiable, vous avez toujours une longueur d’avance et repérez les nouveaux podcasts avant qu’ils ne percent.',
  'archetype.aficionado.name': 'Âme d’aficionado',
  'archetype.aficionado.body': 'Ce qui vous anime vous passionne : vous creusez un sujet à fond pendant que d’autres papillonnent d’un genre à l’autre.',
  'archetype.anthologist.name': 'Anthologiste',
  'archetype.anthologist.body': 'Vous êtes multiple : vous réunissez d’innombrables centres d’intérêt, tous genres confondus, sans jamais cesser d’être vous-même.',
  'archetype.flaneur.name': 'Âme de flâneur',
  'archetype.flaneur.body': 'Votre appétit d’écoute est sans limites : vous partez loin, au hasard, pour trouver votre prochain coup de cœur parmi des milliers.',

  'summary.title': 'Playback {year}',
  'summary.shareTitle': 'Mon Playback {year}',
  'summary.cards': 'Vos cartes Playback',
  'summary.card': 'Carte {index} sur {count}',
  'summary.topShows': 'Top podcasts',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Minutes d’écoute',
  'summary.role': 'Votre profil',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Partager',
  'summary.skip': 'Passer',

  'outro.title': 'Merci d’avoir passé votre année avec Pocket Casts',
  'outro.body': 'Partagez votre Playback avec vos amis et montrez un peu d’amour aux créateurs qui vous ont tenu compagnie toute l’année.',
  'outro.again': 'Rejouer',

  'empty.title': 'Pas encore assez d’écoute',
  'empty.body': 'Écoutez encore quelques épisodes et votre Playback sera prêt.',
  'empty.close': 'Fermer',

  'error.title': 'Impossible de charger votre Playback',
  'error.close': 'Fermer',
};
