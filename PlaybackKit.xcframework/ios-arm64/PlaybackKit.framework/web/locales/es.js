// Spanish (Spain). Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - Personality names: epicene nouns with no article, so they fit any listener: Coleccionista,
//   Vanguardista, Especialista (for the Aficionado: "aficionado/a" is gendered), Antologista (a
//   rare word), Trotamundos (for the Flâneur: "flâneur" is little known in Spanish).
// - "pódcast" (the RAE spelling), with no plural ending, as the app mostly writes it.
// - The minutes pun: "¡Y cada uno ha contado!" (contar: to count, and to matter).
// - "¡Casi!" for "Not quite!": softer than a plain no.
// - The percent sign after a no-break space (RAE), unlike last year's app strings ("un 40%").

export default {
  'chrome.close': 'Cerrar',
  'chrome.back': 'Atrás',
  'chrome.next': 'Siguiente',
  'chrome.share': 'Compartir esta historia',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Paso {current} de {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Este es tu año en pódcast. ¿Empezamos?',
  'intro.body': 'Lo que has escuchado. Los pódcast que te han encantado. Lo que te distingue como oyente.',

  'count.shows': { one: '{count} pódcast', other: '{count} pódcast' },
  'count.episodes': { one: '{count} episodio', other: '{count} episodios' },
  'shows.title': 'Has escuchado {episodes} de {shows}',
  'shows.artwork': 'Tus pódcast más escuchados',

  'topPodcast.quizTitle': 'Pero un pódcast se ha llevado casi toda tu atención. ¿Adivinas cuál?',
  'topPodcast.quizHint': 'Elige uno',
  'topPodcast.confirm': '¡Es este!',
  'topPodcast.correct': '¡Exacto!',
  'topPodcast.wrong': '¡Casi!',
  'topPodcast.timeout': '¡Se acabó el tiempo!',
  'topPodcast.direct': 'Tu pódcast favorito',
  'topPodcast.episodes': 'Has escuchado {episodes} este año.',
  'topPodcast.listened': { one: '{count} minuto de escucha', other: '{count} minutos de escucha' },

  'topShows.title': { one: 'Este es tu pódcast favorito', other: 'Este es tu top {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'Has escuchado {episodes}',

  'bestMonth.quizTitle': 'Este año hubo un mes en el que escuchaste más que nunca. ¿Adivinas cuál?',
  'bestMonth.quizHint': 'Elige uno',
  'bestMonth.confirm': '¡Es este!',
  'bestMonth.months': 'Meses',
  'bestMonth.correct': '¡Exacto!',
  'bestMonth.wrong': '¡Casi!',
  'bestMonth.timeout': '¡Se acabó el tiempo!',
  'bestMonth.direct': 'Tu mes estrella',
  'bestMonth.detail': { one: 'Escuchaste {count} minuto en {month}', other: 'Escuchaste {count} minutos en {month}' },

  'minutes.title': { one: 'Has pasado {count} minuto escuchando pódcast este año. ¡Y ha valido cada segundo!', other: 'Has pasado {count} minutos escuchando pódcast este año. ¡Y cada uno ha contado!' },

  'comparison.up': 'En comparación con {year}, tu tiempo de escucha ha subido un {percent} %.',
  'comparison.down': 'En comparación con {year}, tu tiempo de escucha ha bajado un {percent} %.',
  'comparison.same': 'En comparación con {year}, tu tiempo de escucha se ha mantenido casi igual.',
  'duration.days': { one: '{count} día', other: '{count} días' },
  'duration.hours': { one: '{count} hora', other: '{count} horas' },
  'duration.minutes': { one: '{count} minuto', other: '{count} minutos' },
  'duration.pair': '{first} {second}',

  'completion.title': 'Has llegado hasta el final del {percent} % de tus episodios',
  'completion.detail': { one: 'Has empezado {count} episodio y has terminado {completed}.', other: 'Has empezado {count} episodios y has terminado {completed}.' },

  'rolesIntro.title': 'Esos son tus números. Pero ¿qué tipo de oyente eres?',
  'rolesIntro.body': 'Vamos a verlo',

  'archetype.title': 'Tu personalidad es…',
  'archetype.collector.name': 'Coleccionista',
  'archetype.collector.body': 'No hay nadie como tú: reúnes los pódcast que a los demás se les escapan, por pequeña que sea su audiencia.',
  'archetype.avantGardist.name': 'Vanguardista',
  'archetype.avantGardist.body': 'Con la curiosidad por bandera, siempre vas un paso por delante y descubres pódcast antes de que se hagan famosos.',
  'archetype.aficionado.name': 'Especialista',
  'archetype.aficionado.body': 'Te apasiona lo que te mueve: vas a fondo con un tema mientras otros saltan de género en género.',
  'archetype.anthologist.name': 'Antologista',
  'archetype.anthologist.body': 'Contienes multitudes: reúnes un sinfín de intereses de todos los géneros sin dejar de ser tú.',
  'archetype.flaneur.name': 'Trotamundos',
  'archetype.flaneur.body': 'Escuchas con un apetito voraz y exploras sin rumbo fijo para dar con tu próximo favorito entre miles.',

  'summary.title': 'Playback {year}',
  'summary.cards': 'Tus tarjetas de Playback',
  'summary.card': 'Tarjeta {index} de {count}',
  'summary.topShows': 'Top pódcast',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Minutos escuchados',
  'summary.role': 'Tu perfil',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Compartir',
  'summary.skip': 'Saltar',

  'outro.title': 'Gracias por pasar el año con Pocket Casts',
  'outro.body': 'Comparte tu Playback con tus amigos y dales un poco de cariño a los creadores que te han acompañado todo el año.',
  'outro.again': 'Ver otra vez',

  'empty.title': 'Aún no has escuchado lo suficiente',
  'empty.body': 'Escucha unos cuantos episodios más y podremos preparar tu Playback.',
  'empty.close': 'Cerrar',

  'error.title': 'No hemos podido cargar tu Playback',
  'error.close': 'Cerrar',
};
