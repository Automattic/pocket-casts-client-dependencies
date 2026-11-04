// Italian. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - Personality names, gender-neutral, no article: Collezionista, Avanguardista, Antologista
//   (epicene), and two adapted to stay epicene: Aficionado → Specialista, Flâneur → Nomade.
// - Nothing agrees with "tu": "pronto", "curioso", "appassionato", "ascoltatore", "fedele a
//   te stesso" rephrased.
// - Percentages avoid il/l’ before a number ("dell’8%"): "di un {percent}%", and the
//   completion title as "Episodi ascoltati fino alla fine: {percent}%".
// - "And you made them count!" → "E ogni minuto ha fatto la differenza!".
// - "creator" for creators, "Ricomincia" for Play again, "Specialista" vs "Aficionado".

export default {
  'chrome.close': 'Chiudi',
  'chrome.back': 'Indietro',
  'chrome.next': 'Avanti',
  'chrome.share': 'Condividi questa storia',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Passo {current} di {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Ecco il tuo anno in podcast. Iniziamo?',
  'intro.body': 'Cosa hai ascoltato. I podcast che hai amato. Cosa ti distingue da tutti gli altri.',

  'count.shows': { one: '{count} podcast', other: '{count} podcast' },
  'count.episodes': { one: '{count} episodio', other: '{count} episodi' },
  'shows.title': 'Hai ascoltato {episodes} di {shows}',
  'shows.artwork': 'I tuoi podcast più ascoltati',

  'topPodcast.quizTitle': 'Ma un podcast ha catturato la tua attenzione più di tutti. Indovini quale?',
  'topPodcast.quizHint': 'Scegline uno',
  'topPodcast.confirm': 'Questo!',
  'topPodcast.correct': 'Esatto!',
  'topPodcast.wrong': 'Non proprio!',
  'topPodcast.timeout': 'Tempo scaduto!',
  'topPodcast.direct': 'Il tuo podcast preferito',
  'topPodcast.episodes': 'Quest’anno hai ascoltato {episodes}.',
  'topPodcast.listened': { one: '{count} minuto di ascolto', other: '{count} minuti di ascolto' },

  'topShows.title': { one: 'Ecco il tuo podcast preferito', other: 'Ecco la tua top {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'Hai ascoltato {episodes}',

  'bestMonth.quizTitle': 'Quest’anno c’è stato un mese in cui hai ascoltato più di tutti. Indovini quale?',
  'bestMonth.quizHint': 'Scegline uno',
  'bestMonth.confirm': 'Questo!',
  'bestMonth.months': 'Mesi',
  'bestMonth.correct': 'Esatto!',
  'bestMonth.wrong': 'Non proprio!',
  'bestMonth.timeout': 'Tempo scaduto!',
  'bestMonth.direct': 'Il tuo mese record',
  'bestMonth.detail': { one: 'Hai ascoltato {count} minuto in {month}', other: 'Hai ascoltato {count} minuti in {month}' },

  'minutes.title': {
    one: 'Quest’anno hai passato {count} minuto ad ascoltare podcast. E ha fatto la differenza!',
    other: 'Quest’anno hai passato {count} minuti ad ascoltare podcast. E ogni minuto ha fatto la differenza!',
  },

  'comparison.up': 'Rispetto al {year}, il tuo tempo di ascolto è aumentato di un {percent}%.',
  'comparison.down': 'Rispetto al {year}, il tuo tempo di ascolto è diminuito di un {percent}%.',
  'comparison.same': 'Rispetto al {year}, il tuo tempo di ascolto è rimasto più o meno lo stesso.',
  'duration.days': { one: '{count} giorno', other: '{count} giorni' },
  'duration.hours': { one: '{count} ora', other: '{count} ore' },
  'duration.minutes': { one: '{count} minuto', other: '{count} minuti' },
  'duration.pair': '{first} {second}',

  'completion.title': 'Episodi ascoltati fino alla fine: {percent}%',
  'completion.detail': {
    one: 'Su {count} episodio iniziato, ne hai completati {completed}.',
    other: 'Su {count} episodi iniziati, ne hai completati {completed}.',
  },

  'rolesIntro.title': 'Questi sono i tuoi numeri. Ma qual è la tua personalità da podcast?',
  'rolesIntro.body': 'Scopriamolo',

  'archetype.title': 'La tua personalità è…',
  'archetype.collector.name': 'Collezionista',
  'archetype.collector.body': 'Non c’è nessuno come te: scovi i podcast che sfuggono agli altri, per quanto piccolo sia il loro pubblico.',
  'archetype.avantGardist.name': 'Avanguardista',
  'archetype.avantGardist.body': 'Hai la curiosità nel sangue e sei sempre un passo avanti: scopri i nuovi podcast prima che diventino famosi.',
  'archetype.aficionado.name': 'Specialista',
  'archetype.aficionado.body': 'Ti appassioni a ciò che ti emoziona: vai a fondo su un argomento mentre gli altri saltano da un genere all’altro.',
  'archetype.anthologist.name': 'Antologista',
  'archetype.anthologist.body': 'Contieni moltitudini: riunisci interessi di ogni genere senza mai smettere di essere te.',
  'archetype.flaneur.name': 'Nomade',
  'archetype.flaneur.body': 'Hai una fame insaziabile di ascolti: vaghi in lungo e in largo per trovare il tuo prossimo podcast del cuore tra migliaia.',

  'summary.title': 'Playback {year}',
  'summary.cards': 'Le tue schede Playback',
  'summary.card': 'Scheda {index} di {count}',
  'summary.topShows': 'Top podcast',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Minuti di ascolto',
  'summary.role': 'Il tuo profilo',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Condividi',
  'summary.skip': 'Salta',

  'outro.title': 'Grazie per aver trascorso l’anno con Pocket Casts',
  'outro.body': 'Condividi il tuo Playback con gli amici e mostra un po’ d’amore ai creator che ti hanno fatto compagnia tutto l’anno.',
  'outro.again': 'Ricomincia',

  'empty.title': 'Non hai ancora ascoltato abbastanza',
  'empty.body': 'Ascolta ancora qualche episodio e il tuo Playback sarà pronto.',
  'empty.close': 'Chiudi',

  'error.title': 'Non è stato possibile caricare il tuo Playback',
  'error.close': 'Chiudi',
};
