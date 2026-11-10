// Traditional Chinese (Taiwan). Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - The personality names: 收藏家, 先鋒派, 達人, 多面手, 漫遊者 (達人 for the Aficionado is Taiwan usage).
// - "And you made them count!" adapted as "every minute was worth it" (minutes.title).
// - Register and terms: 你, Podcast in Latin letters and 單集, as the app's zh-Hant; Taiwan wording
//   (載入, 略過, 紀錄), not a conversion of zh-Hans.
// - summary.topShows is 最愛 Podcast; summary.role is 你的個性, to match archetype.title.
// - outro.again is 再看一次 (watch the story again), not the app's 再次播放 (audio playback).

export default {
  'chrome.close': '關閉',
  'chrome.back': '上一頁',
  'chrome.next': '下一頁',
  'chrome.share': '分享這個故事',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': '第 {current} 頁，共 {total} 頁',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': '這是你的 Podcast 年度回顧。準備好一起來看看了嗎？',
  'intro.loading': '正在載入你的專屬體驗…',
  'intro.body': '你聽了什麼、愛上了哪些 Podcast，還有你身為聽眾的獨特之處。',

  'count.shows': { other: '{count} 個 Podcast' },
  'count.episodes': { other: '{count} 個單集' },
  'shows.title': '你收聽了 {shows}，共 {episodes}',
  'shows.artwork': '你最常聽的 Podcast',

  'topPodcast.quizTitle': '不過，有一個節目最讓你著迷。猜得到是哪一個嗎？',
  'topPodcast.quizHint': '選一個吧',
  'topPodcast.confirm': '就是它！',
  'topPodcast.correct': '完全正確！',
  'topPodcast.wrong': '差一點！',
  'topPodcast.timeout': '時間到！',
  'topPodcast.direct': '你最常聽的 Podcast',
  'topPodcast.episodes': '今年你收聽了 {episodes}。',
  'topPodcast.listened': { other: '收聽了 {count} 分鐘' },

  'topShows.title': { other: '你的 Podcast 前 {count} 名' },
  'topShows.rank': '#{rank}',
  'topShows.listened': '收聽了 {episodes}',

  'bestMonth.quizTitle': '今年有一個月，你聽得特別多。猜猜是哪個月？',
  'bestMonth.quizHint': '選一個吧',
  'bestMonth.confirm': '就是它！',
  'bestMonth.months': '月份',
  'bestMonth.correct': '完全正確！',
  'bestMonth.wrong': '差一點！',
  'bestMonth.timeout': '時間到！',
  'bestMonth.direct': '你收聽最多的月份',
  'bestMonth.detail': { other: '你在{month}收聽了 {count} 分鐘' },

  'minutes.title': { other: '今年你花了 {count} 分鐘收聽 Podcast。每一分鐘都很值得！' },

  'comparison.up': '和 {year} 年相比，你的收聽時間增加了 {percent}%。',
  'comparison.down': '和 {year} 年相比，你的收聽時間減少了 {percent}%。',
  'comparison.same': '和 {year} 年相比，你的收聽時間差不多。',
  'duration.days': { other: '{count} 天' },
  'duration.hours': { other: '{count} 小時' },
  'duration.minutes': { other: '{count} 分鐘' },
  'duration.pair': '{first} {second}',

  'completion.title': '你開始收聽的單集，有 {percent}% 都聽到了最後',
  'completion.detail': { other: '在你開始收聽的 {count} 個單集中，你聽完了 {completed} 個。' },

  'rolesIntro.title': '以上是你的數據。那麼，你的 Podcast 個性是什麼呢？',
  'rolesIntro.body': '一起來看看吧',

  'archetype.title': '你的個性是……',
  'archetype.collector.name': '收藏家',
  'archetype.collector.body': '你獨一無二，總能挖到別人錯過的節目，不管聽眾有多少。',
  'archetype.avantGardist.name': '先鋒派',
  'archetype.avantGardist.body': '你走在最前端，天生好奇，總是領先一步，在新節目爆紅之前就發現它們。',
  'archetype.aficionado.name': '達人',
  'archetype.aficionado.body': '你對觸動自己的事物充滿熱情。當別人在各種類型間游移，你選擇深入鑽研一個主題。',
  'archetype.anthologist.name': '多面手',
  'archetype.anthologist.body': '你包羅萬象，興趣橫跨無數類型，卻始終忠於自己。',
  'archetype.flaneur.name': '漫遊者',
  'archetype.flaneur.body': '你是如飢似渴的聽眾，四處漫遊，在成千上萬個節目中尋找下一個心頭好。',

  'summary.title': 'Playback {year}',
  'summary.shareTitle': '我的 Playback {year}',
  'summary.cards': '你的 Playback 卡片',
  'summary.card': '第 {index} 張卡片，共 {count} 張',
  'summary.topShows': '最愛 Podcast',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': '收聽分鐘數',
  'summary.role': '你的個性',
  'summary.footer': 'Playback’{yy}',
  'summary.share': '分享',
  'summary.skip': '略過',

  'outro.title': '感謝你這一年與 Pocket Casts 相伴',
  'outro.body': '和朋友分享你的 Playback，也向陪伴你一整年的創作者們表達支持吧。',
  'outro.again': '再看一次',

  'empty.title': '收聽紀錄還不夠多',
  'empty.body': '再多聽幾個單集，就能為你產生 Playback 了。',
  'empty.close': '關閉',

  'error.title': '無法載入你的 Playback',
  'error.close': '關閉',
};
