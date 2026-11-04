// Arabic. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - Gender: nothing is addressed to "you" in a form that picks one. Verbs about the listener
//   are in the past tense, written the same for both ("استمعت"); buttons are verbal nouns
//   (مشاركة، إغلاق، تخطي) rather than imperatives (شارك/شاركي); "Pick one" is a question
//   ("أيها برأيك؟"); the sentences use nouns where English has adjectives.
// - The five names: الرحّالة (Flâneur) fits anyone; the other four are the generic masculine
//   (جامع النوادر، الطليعي، الشغوف، الموسوعي) under "شخصيتك هي…". A neutral alternative
//   would be welcome.
// - A podcast is "بودكاست"; counted, a show is "برنامج" (12 برنامجًا), which declines where
//   بودكاست does not. Check that this reads naturally.
// - Plural tables spell out one and two (حلقة واحدة، حلقتين). `count.episodes` and
//   `count.shows` are in the genitive (they follow إلى and من); the `duration.*` units stand
//   alone, so their duals are nominative (يومان).
// - Wordplay: "And you made them count!" → "وكانت كل دقيقة منها تستحق!" (every minute was worth it).

export default {
  'chrome.close': 'إغلاق',
  'chrome.back': 'رجوع',
  'chrome.next': 'التالي',
  'chrome.share': 'مشاركة هذه القصة',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'الخطوة {current} من {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'إليك عامك في عالم البودكاست. هل نبدأ؟',
  'intro.body': 'ما استمعت إليه. البرامج التي أحببتها. وما يميّزك عن غيرك.',

  'count.shows': {
    zero: '{count} برنامج',
    one: 'برنامج واحد',
    two: 'برنامجين',
    few: '{count} برامج',
    many: '{count} برنامجًا',
    other: '{count} برنامج',
  },
  'count.episodes': {
    zero: '{count} حلقة',
    one: 'حلقة واحدة',
    two: 'حلقتين',
    few: '{count} حلقات',
    many: '{count} حلقة',
    other: '{count} حلقة',
  },
  'shows.title': 'استمعت إلى {episodes} من {shows}',
  'shows.artwork': 'برامجك الأكثر استماعًا',

  'topPodcast.quizTitle': 'لكن برنامجًا واحدًا استحوذ على معظم اهتمامك. هل يمكنك تخمينه؟',
  'topPodcast.quizHint': 'أيها برأيك؟',
  'topPodcast.confirm': 'هذا!',
  'topPodcast.correct': 'بالضبط!',
  'topPodcast.wrong': 'ليس تمامًا!',
  'topPodcast.timeout': 'انتهى الوقت!',
  'topPodcast.direct': 'برنامجك الأول',
  'topPodcast.episodes': 'استمعت إلى {episodes} هذا العام.',
  'topPodcast.listened': {
    zero: '{count} دقيقة استماع',
    one: 'دقيقة استماع واحدة',
    two: 'دقيقتا استماع',
    few: '{count} دقائق استماع',
    many: '{count} دقيقة استماع',
    other: '{count} دقيقة استماع',
  },

  'topShows.title': {
    zero: 'أفضل {count} برنامج لديك',
    one: 'برنامجك المفضل',
    two: 'أفضل برنامجين لديك',
    few: 'أفضل {count} برامج لديك',
    many: 'أفضل {count} برنامجًا لديك',
    other: 'أفضل {count} برنامج لديك',
  },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'استمعت إلى {episodes}',

  'bestMonth.quizTitle': 'بلغ استماعك ذروته في شهر واحد هذا العام. هل يمكنك تخمينه؟',
  'bestMonth.quizHint': 'أي شهر برأيك؟',
  'bestMonth.confirm': 'هذا!',
  'bestMonth.months': 'الأشهر',
  'bestMonth.correct': 'بالضبط!',
  'bestMonth.wrong': 'ليس تمامًا!',
  'bestMonth.timeout': 'انتهى الوقت!',
  'bestMonth.direct': 'شهرك الأبرز',
  'bestMonth.detail': {
    zero: 'استمعت لمدة {count} دقيقة في {month}',
    one: 'استمعت لمدة دقيقة واحدة في {month}',
    two: 'استمعت لمدة دقيقتين في {month}',
    few: 'استمعت لمدة {count} دقائق في {month}',
    many: 'استمعت لمدة {count} دقيقة في {month}',
    other: 'استمعت لمدة {count} دقيقة في {month}',
  },

  'minutes.title': {
    zero: 'قضيت {count} دقيقة في الاستماع إلى البودكاست هذا العام. وكانت كل دقيقة منها تستحق!',
    one: 'قضيت دقيقة واحدة في الاستماع إلى البودكاست هذا العام. وكانت تستحق!',
    two: 'قضيت دقيقتين في الاستماع إلى البودكاست هذا العام. وكانت كل دقيقة منهما تستحق!',
    few: 'قضيت {count} دقائق في الاستماع إلى البودكاست هذا العام. وكانت كل دقيقة منها تستحق!',
    many: 'قضيت {count} دقيقة في الاستماع إلى البودكاست هذا العام. وكانت كل دقيقة منها تستحق!',
    other: 'قضيت {count} دقيقة في الاستماع إلى البودكاست هذا العام. وكانت كل دقيقة منها تستحق!',
  },

  'comparison.up': 'مقارنةً بعام {year}، ارتفع وقت استماعك بنسبة {percent}%.',
  'comparison.down': 'مقارنةً بعام {year}، انخفض وقت استماعك بنسبة {percent}%.',
  'comparison.same': 'مقارنةً بعام {year}، بقي وقت استماعك على حاله تقريبًا.',
  'duration.days': {
    zero: '{count} يوم',
    one: 'يوم واحد',
    two: 'يومان',
    few: '{count} أيام',
    many: '{count} يومًا',
    other: '{count} يوم',
  },
  'duration.hours': {
    zero: '{count} ساعة',
    one: 'ساعة واحدة',
    two: 'ساعتان',
    few: '{count} ساعات',
    many: '{count} ساعة',
    other: '{count} ساعة',
  },
  'duration.minutes': {
    zero: '{count} دقيقة',
    one: 'دقيقة واحدة',
    two: 'دقيقتان',
    few: '{count} دقائق',
    many: '{count} دقيقة',
    other: '{count} دقيقة',
  },
  'duration.pair': '{first} و{second}',

  'completion.title': 'استمعت حتى النهاية إلى {percent}% من حلقاتك',
  'completion.detail': {
    zero: 'من بين {count} حلقة بدأتها، أكملت {completed} منها.',
    one: 'بدأت حلقة واحدة وأكملت {completed} منها.',
    two: 'بدأت حلقتين وأكملت {completed} منهما.',
    few: 'من بين {count} حلقات بدأتها، أكملت {completed} منها.',
    many: 'من بين {count} حلقة بدأتها، أكملت {completed} منها.',
    other: 'من بين {count} حلقة بدأتها، أكملت {completed} منها.',
  },

  'rolesIntro.title': 'هذه أرقامك. لكن ما شخصيتك في عالم البودكاست؟',
  'rolesIntro.body': 'لنلقِ نظرة',

  'archetype.title': 'شخصيتك هي…',
  'archetype.collector.name': 'جامع النوادر',
  'archetype.collector.body': 'لا أحد يشبهك؛ لك عين تلتقط البرامج التي يفوّتها الآخرون، مهما صغر جمهورها.',
  'archetype.avantGardist.name': 'الطليعي',
  'archetype.avantGardist.body': 'الفضول في طبعك، وخطوتك دائمًا تسبق الجميع؛ البرامج الجديدة تصل إليك قبل أن تشتهر.',
  'archetype.aficionado.name': 'الشغوف',
  'archetype.aficionado.body': 'شغفك بما يلامس قلبك لا حدود له: التعمّق في موضوع واحد هو أسلوبك، بينما يتنقّل الآخرون من نوع إلى آخر.',
  'archetype.anthologist.name': 'الموسوعي',
  'archetype.anthologist.body': 'في داخلك عوالم كثيرة: اهتمامات لا تُحصى من كل الأنواع تجتمع فيك، وتبقى ذاتك كما هي.',
  'archetype.flaneur.name': 'الرحّالة',
  'archetype.flaneur.body': 'شهيتك للاستماع لا تشبع، وجولاتك تمتد بعيدًا بحثًا عن برنامجك المفضل التالي بين الآلاف.',

  'summary.title': 'Playback {year}',
  'summary.cards': 'بطاقات Playback الخاصة بك',
  'summary.card': 'البطاقة {index} من {count}',
  'summary.topShows': 'أبرز البرامج',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'دقائق الاستماع',
  'summary.role': 'شخصيتك',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'مشاركة',
  'summary.skip': 'تخطي',

  'outro.title': 'شكرًا لأنك قضيت عامك مع Pocket Casts',
  'outro.body': 'حان وقت مشاركة Playback الخاص بك مع أصدقائك، وإظهار بعض المحبة لصنّاع المحتوى الذين رافقوك طوال العام.',
  'outro.again': 'إعادة العرض',

  'empty.title': 'لا يوجد استماع كافٍ بعد',
  'empty.body': 'بضع حلقات أخرى، ويصبح Playback الخاص بك جاهزًا.',
  'empty.close': 'إغلاق',

  'error.title': 'تعذّر تحميل Playback الخاص بك',
  'error.close': 'إغلاق',
};
