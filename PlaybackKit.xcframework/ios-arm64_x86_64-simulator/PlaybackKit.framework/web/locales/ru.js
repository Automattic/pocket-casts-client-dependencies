// Russian. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - The five names are type labels in the generic masculine, as Russian personality tests
//   name their types ("Архитектор", "Логик"), under "Ваш тип слушателя…": Коллекционер,
//   Авангардист, Знаток (Aficionado), Универсал (Anthologist), Странник (Flâneur; "Фланёр"
//   is too bookish). The last three are adaptations, not translations.
// - Gender: "вы" throughout, so every past-tense verb and short adjective is plural and fits
//   anyone ("вы прослушали", "готовы"); no full adjectives about the listener.
// - `bestMonth.detail` is built around the nominative month ("Это декабрь: 1 234 минуты
//   прослушивания"), since "в {month}" would need "в декабре".
// - `shows.title` leads with the shows: "Вы слушали 12 подкастов — это 140 выпусков".
// - Wordplay: "And you made them count!" → "И ни одна не прошла зря!" (not one was wasted).
// - "Play again" → "Начать заново" (the app's "Прослушать ещё раз" is about audio).

export default {
  'chrome.close': 'Закрыть',
  'chrome.back': 'Назад',
  'chrome.next': 'Далее',
  'chrome.share': 'Поделиться историей',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Шаг {current} из {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Ваш год в подкастах. Готовы погрузиться?',
  'intro.loading': 'Загружаем ваши итоги…',
  'intro.body': 'Что вы слушали. Какие подкасты полюбили. Чем вы выделяетесь среди слушателей.',

  'count.shows': { one: '{count} подкаст', few: '{count} подкаста', many: '{count} подкастов' },
  'count.episodes': { one: '{count} выпуск', few: '{count} выпуска', many: '{count} выпусков' },
  'shows.title': 'Вы слушали {shows} — это {episodes}',
  'shows.artwork': 'Ваши главные подкасты',

  'topPodcast.quizTitle': 'Но один подкаст занимал вас больше остальных. Угадаете какой?',
  'topPodcast.quizHint': 'Выберите один',
  'topPodcast.confirm': 'Вот этот!',
  'topPodcast.correct': 'Точно!',
  'topPodcast.wrong': 'Не совсем!',
  'topPodcast.timeout': 'Время вышло!',
  'topPodcast.direct': 'Ваш главный подкаст',
  'topPodcast.episodes': 'В этом году вы прослушали {episodes}.',
  'topPodcast.listened': { one: '{count} минута прослушивания', few: '{count} минуты прослушивания', many: '{count} минут прослушивания' },

  'topShows.title': { one: 'Ваш топ-{count}', few: 'Ваш топ-{count}', many: 'Ваш топ-{count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'Прослушано: {episodes}',

  'bestMonth.quizTitle': 'В одном месяце этого года вы слушали больше всего. Угадаете, в каком?',
  'bestMonth.quizHint': 'Выберите один',
  'bestMonth.confirm': 'Вот этот!',
  'bestMonth.months': 'Месяцы',
  'bestMonth.correct': 'Точно!',
  'bestMonth.wrong': 'Не совсем!',
  'bestMonth.timeout': 'Время вышло!',
  'bestMonth.direct': 'Ваш главный месяц',
  'bestMonth.detail': { one: 'Это {month}: {count} минута прослушивания', few: 'Это {month}: {count} минуты прослушивания', many: 'Это {month}: {count} минут прослушивания' },

  'minutes.title': {
    one: 'В этом году вы провели за подкастами {count} минуту. И ни одна не прошла зря!',
    few: 'В этом году вы провели за подкастами {count} минуты. И ни одна не прошла зря!',
    many: 'В этом году вы провели за подкастами {count} минут. И ни одна не прошла зря!',
  },

  'comparison.up': 'По сравнению с {year} годом время прослушивания выросло на {percent} %.',
  'comparison.down': 'По сравнению с {year} годом время прослушивания сократилось на {percent} %.',
  'comparison.same': 'По сравнению с {year} годом время прослушивания почти не изменилось.',
  'duration.days': { one: '{count} день', few: '{count} дня', many: '{count} дней' },
  'duration.hours': { one: '{count} час', few: '{count} часа', many: '{count} часов' },
  'duration.minutes': { one: '{count} минута', few: '{count} минуты', many: '{count} минут' },
  'duration.pair': '{first} {second}',

  'completion.title': 'Вы дослушали до конца {percent} % выпусков',
  'completion.detail': {
    one: 'Из {count} начатого выпуска вы дослушали {completed}.',
    few: 'Из {count} начатых выпусков вы дослушали {completed}.',
    many: 'Из {count} начатых выпусков вы дослушали {completed}.',
  },

  'rolesIntro.title': 'Это ваши цифры. А какой вы слушатель?',
  'rolesIntro.body': 'Давайте посмотрим',

  'archetype.title': 'Ваш тип слушателя…',
  'archetype.collector.name': 'Коллекционер',
  'archetype.collector.body': 'Таких, как вы, больше нет: вы находите подкасты, которые другие пропускают, даже если у них совсем маленькая аудитория.',
  'archetype.avantGardist.name': 'Авангардист',
  'archetype.avantGardist.body': 'Любопытство у вас в крови: вы всегда на шаг впереди и находите новые подкасты до того, как они станут популярными.',
  'archetype.aficionado.name': 'Знаток',
  'archetype.aficionado.body': 'Вы всей душой отдаётесь тому, что вас трогает: погружаетесь в одну тему, пока другие перескакивают с жанра на жанр.',
  'archetype.anthologist.name': 'Универсал',
  'archetype.anthologist.body': 'В вас уживаются целые миры: вы сочетаете множество интересов из разных жанров и при этом остаётесь собой.',
  'archetype.flaneur.name': 'Странник',
  'archetype.flaneur.body': 'Вы слушаете запоем и забредаете далеко, чтобы среди тысяч подкастов найти новый любимый.',

  'summary.title': 'Playback {year}',
  'summary.shareTitle': 'Мой Playback {year}',
  'summary.cards': 'Ваши карточки Playback',
  'summary.card': 'Карточка {index} из {count}',
  'summary.topShows': 'Топ подкастов',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Всего минут',
  'summary.role': 'Ваш тип',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Поделиться',
  'summary.skip': 'Пропустить',

  'outro.title': 'Спасибо, что провели этот год с Pocket Casts',
  'outro.body': 'Поделитесь своим Playback с друзьями и поблагодарите авторов, которые были с вами весь год.',
  'outro.again': 'Начать заново',

  'empty.title': 'Пока мало прослушиваний',
  'empty.body': 'Послушайте ещё несколько выпусков, и ваш Playback будет готов.',
  'empty.close': 'Закрыть',

  'error.title': 'Не удалось загрузить ваш Playback',
  'error.close': 'Закрыть',
};
