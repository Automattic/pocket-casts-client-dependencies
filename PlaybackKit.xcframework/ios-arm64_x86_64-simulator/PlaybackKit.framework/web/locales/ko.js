// Korean. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - The personality names: 컬렉터, 선구자, 마니아, 올라운더, 탐험가 (the Flâneur as an explorer, the
//   P2's older name for it; the Anthologist as an all-rounder).
// - Register: 합니다체 with honorific -셨습니다 and -세요, as the app; titles and labels speak as
//   the listener ("나의 TOP 5", "나의 성향"), as Korean recaps usually do.
// - "And you made them count!" adapted as "every minute was precious time" (minutes.title).
// - flaneur.body uses 최애 (one's favourite), casual but common; swap for 가장 좋아할 if too slangy.
// - outro.again is 다시 보기 (watch the story again), not the app's 다시 재생 (audio playback).

export default {
  'chrome.close': '닫기',
  'chrome.back': '이전',
  'chrome.next': '다음',
  'chrome.share': '이 스토리 공유',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': '{total}단계 중 {current}단계',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': '팟캐스트로 돌아보는 올해. 함께 살펴볼까요?',
  'intro.loading': '나만의 경험을 불러오는 중입니다…',
  'intro.body': '어떤 에피소드를 들었는지, 어떤 팟캐스트를 사랑했는지, 그리고 어떤 청취자인지까지.',

  'count.shows': { other: '팟캐스트 {count}개' },
  'count.episodes': { other: '에피소드 {count}개' },
  'shows.title': '{shows}에서 {episodes}를 들으셨습니다',
  'shows.artwork': '가장 많이 들은 팟캐스트',

  'topPodcast.quizTitle': '그중에서도 유독 빠져든 팟캐스트가 있습니다. 어떤 팟캐스트일까요?',
  'topPodcast.quizHint': '하나를 선택하세요',
  'topPodcast.confirm': '이거예요!',
  'topPodcast.correct': '정답입니다!',
  'topPodcast.wrong': '아깝네요!',
  'topPodcast.timeout': '시간 초과!',
  'topPodcast.direct': '가장 많이 들은 팟캐스트',
  'topPodcast.episodes': '올해 {episodes}를 들으셨습니다.',
  'topPodcast.listened': { other: '{count}분 청취' },

  'topShows.title': { other: '나의 TOP {count}' },
  'topShows.rank': '{rank}위',
  'topShows.listened': '{episodes} 청취',

  'bestMonth.quizTitle': '올해 유난히 많이 들은 달이 있습니다. 몇 월일까요?',
  'bestMonth.quizHint': '하나를 선택하세요',
  'bestMonth.confirm': '이거예요!',
  'bestMonth.months': '월 목록',
  'bestMonth.correct': '정답입니다!',
  'bestMonth.wrong': '아깝네요!',
  'bestMonth.timeout': '시간 초과!',
  'bestMonth.direct': '가장 많이 들은 달',
  'bestMonth.detail': { other: '{month}에 {count}분 들으셨습니다' },

  'minutes.title': { other: '올해 팟캐스트를 {count}분 들으셨습니다. 1분 1분이 모두 소중한 시간이었죠!' },

  'comparison.up': '{year}년보다 청취 시간이 {percent}% 늘었습니다.',
  'comparison.down': '{year}년보다 청취 시간이 {percent}% 줄었습니다.',
  'comparison.same': '{year}년과 청취 시간이 거의 비슷합니다.',
  'duration.days': { other: '{count}일' },
  'duration.hours': { other: '{count}시간' },
  'duration.minutes': { other: '{count}분' },
  'duration.pair': '{first} {second}',

  'completion.title': '시작한 에피소드의 {percent}%를 끝까지 들으셨습니다',
  'completion.detail': { other: '시작한 에피소드 {count}개 중 {completed}개를 끝까지 들으셨습니다.' },

  'rolesIntro.title': '숫자로 본 한 해는 여기까지입니다. 그렇다면 나의 팟캐스트 성향은?',
  'rolesIntro.body': '함께 알아볼까요',

  'archetype.title': '나의 성향은…',
  'archetype.collector.name': '컬렉터',
  'archetype.collector.body': '남들이 놓치는 팟캐스트도, 청취자가 아무리 적어도 빠짐없이 모으는 단 하나뿐인 청취자입니다.',
  'archetype.avantGardist.name': '선구자',
  'archetype.avantGardist.body': '타고난 호기심으로 늘 한발 앞서, 뜨기 전의 새로운 팟캐스트를 먼저 찾아냅니다.',
  'archetype.aficionado.name': '마니아',
  'archetype.aficionado.body': '마음을 움직이는 것에 열정을 쏟습니다. 다른 사람들이 장르를 오갈 때 한 주제를 깊이 파고듭니다.',
  'archetype.anthologist.name': '올라운더',
  'archetype.anthologist.body': '다채로운 면모를 지닌 청취자. 수많은 장르의 관심사를 아우르면서도 자신만의 색을 잃지 않습니다.',
  'archetype.flaneur.name': '탐험가',
  'archetype.flaneur.body': '왕성한 청취자. 수천 개의 팟캐스트를 두루 누비며 다음 최애를 찾아 나섭니다.',

  'summary.title': 'Playback {year}',
  'summary.shareTitle': '나의 Playback {year}',
  'summary.cards': '나의 Playback 카드',
  'summary.card': '카드 {count}장 중 {index}번째',
  'summary.topShows': 'TOP 팟캐스트',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': '청취 시간(분)',
  'summary.role': '나의 성향',
  'summary.footer': 'Playback’{yy}',
  'summary.share': '공유',
  'summary.skip': '건너뛰기',

  'outro.title': '올 한 해 Pocket Casts와 함께해 주셔서 감사합니다',
  'outro.body': '친구들과 Playback을 공유하고, 한 해 동안 곁을 지켜 준 크리에이터들에게 사랑을 전해 보세요.',
  'outro.again': '다시 보기',

  'empty.title': '아직 청취 기록이 부족합니다',
  'empty.body': '에피소드를 몇 개 더 들으시면 Playback을 만들어 드릴 수 있습니다.',
  'empty.close': '닫기',

  'error.title': 'Playback을 불러오지 못했습니다',
  'error.close': '닫기',
};
