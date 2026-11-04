// Japanese. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - The personality names: コレクター, パイオニア, 探究者, オールラウンダー, 散策家 (katakana and
//   kanji mixed, picked for meaning: the Flâneur as a wanderer, the Anthologist as an all-rounder).
// - "And you made them count!" adapted as "every minute was time well spent" (minutes.title).
// - Counters: 番組 for shows, エピソード for episodes (the app says 件のエピソード); 位 for ranks.
// - outro.again is もう一度見る (watch the story again), not the app's もう一度再生 (audio playback).
// - Register: polite です／ます, あなた kept to the few places Japanese recaps use it.

export default {
  'chrome.close': '閉じる',
  'chrome.back': '戻る',
  'chrome.next': '次へ',
  'chrome.share': 'このストーリーを共有',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': '{total}ステップ中{current}ステップ目',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'ポッドキャストと過ごした、あなたの1年。さっそく振り返ってみませんか？',
  'intro.body': '聴いたもの。好きになったポッドキャスト。そして、リスナーとしてのあなたらしさ。',

  'count.shows': { other: '{count}番組' },
  'count.episodes': { other: '{count}エピソード' },
  'shows.title': '{shows}で、合計{episodes}を聴きました',
  'shows.artwork': 'よく聴いた番組',

  'topPodcast.quizTitle': 'なかでも、いちばん夢中になった番組があります。どれだかわかりますか？',
  'topPodcast.quizHint': '1つ選んでください',
  'topPodcast.confirm': 'これ！',
  'topPodcast.correct': '大正解！',
  'topPodcast.wrong': '惜しい！',
  'topPodcast.timeout': '時間切れ！',
  'topPodcast.direct': 'いちばん聴いた番組',
  'topPodcast.episodes': '今年は{episodes}を聴きました。',
  'topPodcast.listened': { other: '{count}分聴きました' },

  'topShows.title': { other: 'よく聴いた番組トップ{count}' },
  'topShows.rank': '{rank}位',
  'topShows.listened': '{episodes}を聴きました',

  'bestMonth.quizTitle': '今年、とくにたくさん聴いた月がありました。何月だと思いますか？',
  'bestMonth.quizHint': '1つ選んでください',
  'bestMonth.confirm': 'これ！',
  'bestMonth.months': '月の一覧',
  'bestMonth.correct': '大正解！',
  'bestMonth.wrong': '惜しい！',
  'bestMonth.timeout': '時間切れ！',
  'bestMonth.direct': 'いちばん聴いた月',
  'bestMonth.detail': { other: '{month}は{count}分聴きました' },

  'minutes.title': { other: '今年は{count}分、ポッドキャストを聴きました。どの1分も、価値ある時間でしたね！' },

  'comparison.up': '{year}年と比べて、聴いた時間が{percent}%増えました。',
  'comparison.down': '{year}年と比べて、聴いた時間が{percent}%減りました。',
  'comparison.same': '{year}年と比べて、聴いた時間はほぼ同じでした。',
  'duration.days': { other: '{count}日' },
  'duration.hours': { other: '{count}時間' },
  'duration.minutes': { other: '{count}分' },
  'duration.pair': '{first}{second}',

  'completion.title': '聴き始めたエピソードの{percent}%を、最後まで聴き終えました',
  'completion.detail': { other: '再生を始めた{count}エピソードのうち、{completed}エピソードを最後まで聴きました。' },

  'rolesIntro.title': '数字で見ると、こんな1年でした。では、あなたのポッドキャスト・パーソナリティは？',
  'rolesIntro.body': '見てみましょう',

  'archetype.title': 'あなたのタイプは…',
  'archetype.collector.name': 'コレクター',
  'archetype.collector.body': 'みんなが見逃してしまう番組も、リスナーがどんなに少なくても見つけて集める。そんな唯一無二の存在です。',
  'archetype.avantGardist.name': 'パイオニア',
  'archetype.avantGardist.body': '最先端を行く、生まれながらの好奇心。話題になる前の新しい番組を見つけ出し、いつも一歩先を歩いています。',
  'archetype.aficionado.name': '探究者',
  'archetype.aficionado.body': '心を動かすものに、とことん情熱的。ほかの人がジャンルを渡り歩くなか、ひとつのテーマを深く掘り下げます。',
  'archetype.anthologist.name': 'オールラウンダー',
  'archetype.anthologist.body': 'ジャンルをまたぐ数えきれない興味を、自分らしさを失わずにひとつにまとめる、懐の深いリスナーです。',
  'archetype.flaneur.name': '散策家',
  'archetype.flaneur.body': '好奇心旺盛なリスナー。何千もの番組をあちこち巡りながら、次のお気に入りを探し続けています。',

  'summary.title': 'Playback {year}',
  'summary.cards': 'あなたのPlaybackカード',
  'summary.card': '{count}枚中{index}枚目のカード',
  'summary.topShows': 'トップ番組',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': '聴いた分数',
  'summary.role': 'あなたのタイプ',
  'summary.footer': 'Playback’{yy}',
  'summary.share': '共有',
  'summary.skip': 'スキップ',

  'outro.title': '今年1年、Pocket Castsと過ごしていただきありがとうございました',
  'outro.body': 'Playbackを友達とシェアして、1年間そばにいてくれたクリエイターたちに感謝の気持ちを届けましょう。',
  'outro.again': 'もう一度見る',

  'empty.title': 'まだデータが足りません',
  'empty.body': 'あと少しエピソードを聴くと、あなたのPlaybackを作成できるようになります。',
  'empty.close': '閉じる',

  'error.title': 'Playbackを読み込めませんでした',
  'error.close': '閉じる',
};
