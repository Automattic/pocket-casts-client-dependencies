// Portuguese (Brazil). Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - Personality names: epicene nouns with no article, so they fit any listener: Colecionista
//   (rarer than colecionador/a, chosen because it has one form), Vanguardista, Especialista (for
//   the Aficionado), Antologista, Flâneur (kept: known in Brazil, and invariable).
// - The minutes pun: "E cada um deles contou!" (contar: to count, and to matter).
// - "Compartilhar este story": the app's own button, kept; "story" may read as Instagram's.
// - Portuguese "one" covers 0 and 1, so the top-5 title keeps the number for one show
//   ("Este é o seu top 1").
// - "Acertou!" / "Quase!" for the verdicts; "Ver de novo" for Play again (the app has
//   "Ouvir de novo", but the story is watched, not heard).

export default {
  'chrome.close': 'Fechar',
  'chrome.back': 'Voltar',
  'chrome.next': 'Avançar',
  'chrome.share': 'Compartilhar este story',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Passo {current} de {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Este é o seu ano em podcasts. Vamos começar?',
  'intro.body': 'O que você ouviu. Os podcasts que você amou. O que torna o seu jeito de ouvir especial.',

  'count.shows': { one: '{count} podcast', other: '{count} podcasts' },
  'count.episodes': { one: '{count} episódio', other: '{count} episódios' },
  'shows.title': 'Você ouviu {episodes} de {shows}',
  'shows.artwork': 'Seus podcasts mais ouvidos',

  'topPodcast.quizTitle': 'Mas um podcast ficou com a maior parte da sua atenção. Adivinha qual?',
  'topPodcast.quizHint': 'Escolha um',
  'topPodcast.confirm': 'É este!',
  'topPodcast.correct': 'Acertou!',
  'topPodcast.wrong': 'Quase!',
  'topPodcast.timeout': 'Acabou o tempo!',
  'topPodcast.direct': 'Seu podcast favorito',
  'topPodcast.episodes': 'Você ouviu {episodes} este ano.',
  'topPodcast.listened': { one: '{count} minuto ouvido', other: '{count} minutos ouvidos' },

  'topShows.title': { one: 'Este é o seu top {count}', other: 'Este é o seu top {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'Você ouviu {episodes}',

  'bestMonth.quizTitle': 'Teve um mês em que você ouviu mais do que nunca este ano. Adivinha qual?',
  'bestMonth.quizHint': 'Escolha um',
  'bestMonth.confirm': 'É este!',
  'bestMonth.months': 'Meses',
  'bestMonth.correct': 'Acertou!',
  'bestMonth.wrong': 'Quase!',
  'bestMonth.timeout': 'Acabou o tempo!',
  'bestMonth.direct': 'Seu mês campeão',
  'bestMonth.detail': { one: 'Você ouviu {count} minuto em {month}', other: 'Você ouviu {count} minutos em {month}' },

  'minutes.title': { one: 'Você passou {count} minuto ouvindo podcasts este ano. E valeu cada segundo!', other: 'Você passou {count} minutos ouvindo podcasts este ano. E cada um deles contou!' },

  'comparison.up': 'Em comparação com {year}, seu tempo de escuta aumentou {percent}%.',
  'comparison.down': 'Em comparação com {year}, seu tempo de escuta diminuiu {percent}%.',
  'comparison.same': 'Em comparação com {year}, seu tempo de escuta ficou praticamente igual.',
  'duration.days': { one: '{count} dia', other: '{count} dias' },
  'duration.hours': { one: '{count} hora', other: '{count} horas' },
  'duration.minutes': { one: '{count} minuto', other: '{count} minutos' },
  'duration.pair': '{first} {second}',

  'completion.title': 'Você chegou ao fim de {percent}% dos seus episódios',
  'completion.detail': { one: 'Você começou {count} episódio e terminou {completed}.', other: 'Você começou {count} episódios e terminou {completed} deles.' },

  'rolesIntro.title': 'Esses são os seus números. Mas que tipo de ouvinte você é?',
  'rolesIntro.body': 'Vamos descobrir',

  'archetype.title': 'Sua personalidade é…',
  'archetype.collector.name': 'Colecionista',
  'archetype.collector.body': 'Não existe ninguém como você: você reúne os podcasts que passam despercebidos, por menor que seja o público.',
  'archetype.avantGardist.name': 'Vanguardista',
  'archetype.avantGardist.body': 'Com a curiosidade como bússola, você está sempre um passo à frente e descobre podcasts antes que eles façam sucesso.',
  'archetype.aficionado.name': 'Especialista',
  'archetype.aficionado.body': 'O que te move é a paixão: você mergulha fundo em um tema enquanto outros pulam de gênero em gênero.',
  'archetype.anthologist.name': 'Antologista',
  'archetype.anthologist.body': 'Você contém multidões: reúne inúmeros interesses de todos os gêneros sem deixar de ser você.',
  'archetype.flaneur.name': 'Flâneur',
  'archetype.flaneur.body': 'Você ouve com um apetite voraz e explora sem rumo para encontrar seu próximo favorito entre milhares.',

  'summary.title': 'Playback {year}',
  'summary.cards': 'Seus cartões do Playback',
  'summary.card': 'Cartão {index} de {count}',
  'summary.topShows': 'Top podcasts',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Minutos ouvidos',
  'summary.role': 'Seu perfil',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Compartilhar',
  'summary.skip': 'Pular',

  'outro.title': 'Obrigado por passar o ano com o Pocket Casts',
  'outro.body': 'Compartilhe seu Playback com os amigos e mostre seu carinho pelos criadores que te fizeram companhia o ano todo.',
  'outro.again': 'Ver de novo',

  'empty.title': 'Você ainda não ouviu o suficiente',
  'empty.body': 'Ouça mais alguns episódios e a gente prepara o seu Playback.',
  'empty.close': 'Fechar',

  'error.title': 'Não foi possível carregar seu Playback',
  'error.close': 'Fechar',
};
