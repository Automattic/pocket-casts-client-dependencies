// Simplified Chinese. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - The personality names: 收藏家, 先锋派, 发烧友, 多面手, 漫游者 (the Anthologist as an all-rounder).
// - "And you made them count!" adapted as "not a minute was wasted" (minutes.title).
// - Register: 您, as the app; spaces between digits and Chinese (“140 集”), as the app's strings.
// - summary.role is 您的性格, to match archetype.title's 性格 rather than English "role".
// - outro.again is 再看一次 (watch the story again), not the app's 再次播放 (audio playback).

export default {
  'chrome.close': '关闭',
  'chrome.back': '上一页',
  'chrome.next': '下一页',
  'chrome.share': '分享此故事',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': '第 {current} 页，共 {total} 页',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': '这是您的年度播客回顾。准备好一探究竟了吗？',
  'intro.body': '您听了什么，爱上了哪些播客，又是什么让您成为与众不同的听众。',

  'count.shows': { other: '{count} 个播客' },
  'count.episodes': { other: '{count} 集' },
  'shows.title': '您在 {shows}中收听了 {episodes}',
  'shows.artwork': '您最常听的播客',

  'topPodcast.quizTitle': '不过，有一个播客最让您着迷。猜猜是哪一个？',
  'topPodcast.quizHint': '请选择一个',
  'topPodcast.confirm': '就是它！',
  'topPodcast.correct': '完全正确！',
  'topPodcast.wrong': '差一点！',
  'topPodcast.timeout': '时间到！',
  'topPodcast.direct': '您最常听的播客',
  'topPodcast.episodes': '今年您收听了 {episodes}。',
  'topPodcast.listened': { other: '收听了 {count} 分钟' },

  'topShows.title': { other: '您的播客 Top {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': '收听了 {episodes}',

  'bestMonth.quizTitle': '今年有一个月，您听得特别多。猜猜是几月？',
  'bestMonth.quizHint': '请选择一个',
  'bestMonth.confirm': '就是它！',
  'bestMonth.months': '月份',
  'bestMonth.correct': '完全正确！',
  'bestMonth.wrong': '差一点！',
  'bestMonth.timeout': '时间到！',
  'bestMonth.direct': '您收听最多的月份',
  'bestMonth.detail': { other: '您在{month}收听了 {count} 分钟' },

  'minutes.title': { other: '今年您花了 {count} 分钟收听播客。每一分钟都没有白费！' },

  'comparison.up': '与 {year} 年相比，您的收听时长增加了 {percent}%。',
  'comparison.down': '与 {year} 年相比，您的收听时长减少了 {percent}%。',
  'comparison.same': '与 {year} 年相比，您的收听时长基本持平。',
  'duration.days': { other: '{count} 天' },
  'duration.hours': { other: '{count} 小时' },
  'duration.minutes': { other: '{count} 分钟' },
  'duration.pair': '{first} {second}',

  'completion.title': '您开始收听的单集中，有 {percent}% 听到了最后',
  'completion.detail': { other: '在您开始收听的 {count} 集中，您听完了其中 {completed} 集。' },

  'rolesIntro.title': '这些是您的数据。那么，您的播客性格是什么呢？',
  'rolesIntro.body': '一起来看看吧',

  'archetype.title': '您的性格是……',
  'archetype.collector.name': '收藏家',
  'archetype.collector.body': '您独树一帜，总能发掘别人错过的播客，无论它们的听众有多少。',
  'archetype.avantGardist.name': '先锋派',
  'archetype.avantGardist.body': '您走在潮流前沿，天生好奇，总是快人一步，在新播客走红之前就发现了它们。',
  'archetype.aficionado.name': '发烧友',
  'archetype.aficionado.body': '您对打动自己的事物充满热情。当别人在各种类型间游走时，您专注深耕一个主题。',
  'archetype.anthologist.name': '多面手',
  'archetype.anthologist.body': '您包罗万象，兴趣横跨无数类型，却始终忠于自我。',
  'archetype.flaneur.name': '漫游者',
  'archetype.flaneur.body': '您是如饥似渴的听众，四处漫游，在成千上万的播客中寻找下一个心头好。',

  'summary.title': 'Playback {year}',
  'summary.cards': '您的 Playback 卡片',
  'summary.card': '第 {index} 张卡片，共 {count} 张',
  'summary.topShows': '热门播客',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': '收听分钟数',
  'summary.role': '您的性格',
  'summary.footer': 'Playback’{yy}',
  'summary.share': '分享',
  'summary.skip': '跳过',

  'outro.title': '感谢您与 Pocket Casts 共度这一年',
  'outro.body': '与朋友分享您的 Playback，向陪伴您一整年的创作者们表达喜爱吧。',
  'outro.again': '再看一次',

  'empty.title': '收听数据还不够',
  'empty.body': '再收听几集，您的 Playback 就可以生成了。',
  'empty.close': '关闭',

  'error.title': '无法加载您的 Playback',
  'error.close': '关闭',
};
