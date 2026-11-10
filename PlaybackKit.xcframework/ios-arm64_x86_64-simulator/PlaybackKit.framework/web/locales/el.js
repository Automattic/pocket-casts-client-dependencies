// Greek. Machine-translated draft (Claude, 2026-11-04) from the placeholder English; not reviewed.
//
// Review first:
// - The five names are nouns of common gender, with no article, so they fit anyone:
//   Κυνηγός θησαυρών (Collector, "treasure hunter"), Πρωτοπόρος (Avant-gardist), Λάτρης
//   (Aficionado), Ανθολόγος (Anthologist), Φλανέρ (Flâneur, the indeclinable loanword).
// - Gender: no adjective or participle agrees with the listener ("Πάμε να βουτήξουμε;"
//   for "Ready to dig in?", "Ακούς αχόρταγα" for "a voracious listener").
// - `bestMonth.detail` relies on Intl giving the month in the genitive (Δεκεμβρίου):
//   "κατά τη διάρκεια του {month}". If month names ever come in the nominative, it breaks.
// - Wordplay: "And you made them count!" → "Και άξιζε το καθένα!" (every one was worth it).
// - "Play again" is "Δες ξανά" (watch again: it restarts the story); "Your role" is "Ο ρόλος σου", as in English.

export default {
  'chrome.close': 'Κλείσιμο',
  'chrome.back': 'Πίσω',
  'chrome.next': 'Επόμενο',
  'chrome.share': 'Μοιράσου την ιστορία',
  'chrome.shareBadge': 'Pocket Casts',
  'chrome.progress': 'Βήμα {current} από {total}',

  'intro.logo': 'Pocket Casts',
  'intro.title': 'Playback {year}',
  'intro.tagline': 'Η χρονιά σου στα podcasts. Πάμε να βουτήξουμε;',
  'intro.loading': 'Φόρτωση της εμπειρίας σου…',
  'intro.body': 'Τι άκουσες. Τα podcasts που αγάπησες. Τι σε κάνει να ξεχωρίζεις.',

  'count.shows': { one: '{count} podcast', other: '{count} podcasts' },
  'count.episodes': { one: '{count} επεισόδιο', other: '{count} επεισόδια' },
  'shows.title': 'Άκουσες {episodes} από {shows}',
  'shows.artwork': 'Τα κορυφαία σου podcasts',

  'topPodcast.quizTitle': 'Ένα podcast όμως κέρδισε την περισσότερη προσοχή σου. Μαντεύεις ποιο;',
  'topPodcast.quizHint': 'Διάλεξε ένα',
  'topPodcast.confirm': 'Αυτό!',
  'topPodcast.correct': 'Ακριβώς!',
  'topPodcast.wrong': 'Όχι ακριβώς!',
  'topPodcast.timeout': 'Τέλος χρόνου!',
  'topPodcast.direct': 'Το κορυφαίο σου podcast',
  'topPodcast.episodes': 'Άκουσες {episodes} φέτος.',
  'topPodcast.listened': { one: '{count} λεπτό ακρόασης', other: '{count} λεπτά ακρόασης' },

  'topShows.title': { one: 'Το κορυφαίο σου podcast', other: 'Τα κορυφαία σου {count}' },
  'topShows.rank': '#{rank}',
  'topShows.listened': 'Άκουσες {episodes}',

  'bestMonth.quizTitle': 'Φέτος υπήρξε ένας μήνας που άκουσες περισσότερο από κάθε άλλον. Μαντεύεις ποιος;',
  'bestMonth.quizHint': 'Διάλεξε έναν',
  'bestMonth.confirm': 'Αυτόν!',
  'bestMonth.months': 'Μήνες',
  'bestMonth.correct': 'Ακριβώς!',
  'bestMonth.wrong': 'Όχι ακριβώς!',
  'bestMonth.timeout': 'Τέλος χρόνου!',
  'bestMonth.direct': 'Ο κορυφαίος σου μήνας',
  'bestMonth.detail': { one: 'Άκουσες {count} λεπτό κατά τη διάρκεια του {month}', other: 'Άκουσες {count} λεπτά κατά τη διάρκεια του {month}' },

  'minutes.title': {
    one: 'Φέτος πέρασες {count} λεπτό ακούγοντας podcasts. Και άξιζε!',
    other: 'Φέτος πέρασες {count} λεπτά ακούγοντας podcasts. Και άξιζε το καθένα!',
  },

  'comparison.up': 'Σε σύγκριση με το {year}, ο χρόνος ακρόασής σου αυξήθηκε κατά {percent}%.',
  'comparison.down': 'Σε σύγκριση με το {year}, ο χρόνος ακρόασής σου μειώθηκε κατά {percent}%.',
  'comparison.same': 'Σε σύγκριση με το {year}, ο χρόνος ακρόασής σου έμεινε περίπου ίδιος.',
  'duration.days': { one: '{count} μέρα', other: '{count} μέρες' },
  'duration.hours': { one: '{count} ώρα', other: '{count} ώρες' },
  'duration.minutes': { one: '{count} λεπτό', other: '{count} λεπτά' },
  'duration.pair': '{first} {second}',

  'completion.title': 'Άκουσες μέχρι το τέλος το {percent}% των επεισοδίων σου',
  'completion.detail': {
    one: 'Από το {count} επεισόδιο που ξεκίνησες, ολοκλήρωσες {completed}.',
    other: 'Από τα {count} επεισόδια που ξεκίνησες, ολοκλήρωσες {completed}.',
  },

  'rolesIntro.title': 'Αυτά είναι τα νούμερά σου. Ποια είναι όμως η προσωπικότητά σου στα podcasts;',
  'rolesIntro.body': 'Ας ρίξουμε μια ματιά',

  'archetype.title': 'Η προσωπικότητά σου είναι…',
  'archetype.collector.name': 'Κυνηγός θησαυρών',
  'archetype.collector.body': 'Κανείς δεν σου μοιάζει: ανακαλύπτεις τα podcasts που προσπερνούν οι άλλοι, όσο μικρό κι αν είναι το κοινό τους.',
  'archetype.avantGardist.name': 'Πρωτοπόρος',
  'archetype.avantGardist.body': 'Η περιέργεια είναι στη φύση σου: είσαι πάντα ένα βήμα μπροστά και βρίσκεις νέα podcasts πριν γίνουν γνωστά.',
  'archetype.aficionado.name': 'Λάτρης',
  'archetype.aficionado.body': 'Αφοσιώνεσαι σε ό,τι σε συγκινεί: εμβαθύνεις σε ένα θέμα, ενώ οι άλλοι πηδούν από είδος σε είδος.',
  'archetype.anthologist.name': 'Ανθολόγος',
  'archetype.anthologist.body': 'Χωράς ολόκληρους κόσμους: συνδυάζεις αμέτρητα ενδιαφέροντα από κάθε είδος και μένεις πάντα ο εαυτός σου.',
  'archetype.flaneur.name': 'Φλανέρ',
  'archetype.flaneur.body': 'Ακούς αχόρταγα και περιπλανιέσαι παντού για να βρεις το επόμενο αγαπημένο σου ανάμεσα σε χιλιάδες.',

  'summary.title': 'Playback {year}',
  'summary.shareTitle': 'Το Playback {year} μου',
  'summary.cards': 'Οι κάρτες Playback σου',
  'summary.card': 'Κάρτα {index} από {count}',
  'summary.topShows': 'Κορυφαία podcasts',
  'summary.rank': '{rank}.{title}',
  'summary.minutes': 'Λεπτά ακρόασης',
  'summary.role': 'Ο ρόλος σου',
  'summary.footer': 'Playback’{yy}',
  'summary.share': 'Κοινοποίηση',
  'summary.skip': 'Παράλειψη',

  'outro.title': 'Ευχαριστούμε που πέρασες τη χρονιά σου με το Pocket Casts',
  'outro.body': 'Μοιράσου το Playback σου με φίλους και δείξε την αγάπη σου στους δημιουργούς που σου κράτησαν συντροφιά όλη τη χρονιά.',
  'outro.again': 'Δες ξανά',

  'empty.title': 'Δεν έχεις ακούσει αρκετά ακόμα',
  'empty.body': 'Άκου μερικά επεισόδια ακόμα και το Playback σου θα είναι έτοιμο.',
  'empty.close': 'Κλείσιμο',

  'error.title': 'Δεν ήταν δυνατή η φόρτωση του Playback σου',
  'error.close': 'Κλείσιμο',
};
