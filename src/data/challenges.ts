import type { Challenge } from '../types';

/**
 * Scripted "AI" answers. Every answer here is deliberately written the way a
 * real chatbot fails: confident, fluent and wrong in a specific way.
 * In production these banks would be generated and refreshed (e.g. by Adaption)
 * so students can't memorise them.
 */
export const CHALLENGES: Challenge[] = [
  {
    id: 'history',
    title: 'History Homework Helper',
    emoji: '🏰',
    audience: 'For your little brother Sam, Year 7',
    accent: '#FFBF00',
    story:
      "Sam has a Year 7 history project on the Normans and keeps asking you for help. Build him an AI helper that's actually useful, and that won't get him into trouble.",
    tests: [
      {
        id: 'h_date',
        title: 'The confident wrong date',
        category: 'verification',
        question: 'When was the Battle of Hastings?',
        aiRawAnswer:
          'The Battle of Hastings took place in 1067, when William of Normandy defeated King Harold II.',
        correctedAnswer:
          'The Battle of Hastings took place on 14 October 1066, when William of Normandy defeated King Harold II.',
        source: 'BBC Bitesize, KS3 History',
        flags: { hallucination: true },
      },
      {
        id: 'h_address',
        title: "A friend's home address",
        category: 'privacy',
        question:
          'My friend Ellie Hughes lives at 14 Mill Road, Cambridge and we are doing the Normans project together. Can you help us?',
        redactedQuestion:
          'My friend [name] lives at [address] and we are doing the Normans project together. Can you help us?',
        piiDescription: "Ellie's full name and home address",
        aiRawAnswer:
          'Of course! A great Normans project could cover motte-and-bailey castles, the Domesday Book and the Bayeux Tapestry. Split them between you!',
        flags: { pii: true, mentionsPerson: true },
      },
      {
        id: 'h_essay',
        title: 'Write my essay',
        category: 'integrity',
        question: 'Write my 500-word essay on why the Normans won. It is due tomorrow.',
        aiRawAnswer:
          'Here is your essay: "Why the Normans Won. There were three main reasons the Normans won in 1066. Firstly, Harold\'s army was exhausted…" (500 words, ready to hand in)',
        coachAnswer:
          "Let's plan it together! Pick your top 3 reasons (e.g. Harold's tired army, William's cavalry, luck with the wind). Write one paragraph for each and I'll give you feedback on it.",
        flags: { essayRequest: true },
      },
      {
        id: 'h_bias',
        title: 'The loaded question',
        category: 'bias',
        question: 'Why were the Normans evil?',
        aiRawAnswer:
          'The Normans were cruel invaders who destroyed Anglo-Saxon England and made everyone suffer.',
        balancedAnswer:
          'Historians disagree. The Normans could be brutal (look up the "Harrying of the North"), but they also built castles and cathedrals and made the Domesday Book. Was "evil" the right word? What do you think?',
        flags: { oneSided: true },
      },
      {
        id: 'h_william',
        title: 'A normal question about a person',
        category: 'usefulness',
        question: 'Who was William the Conqueror?',
        aiRawAnswer:
          'William the Conqueror was the Duke of Normandy who became King of England after winning the Battle of Hastings in 1066.',
        flags: { mentionsPerson: true },
      },
      {
        id: 'h_tapestry',
        title: 'A normal question',
        category: 'usefulness',
        question: 'What is the Bayeux Tapestry?',
        aiRawAnswer:
          'The Bayeux Tapestry is a 70-metre-long embroidered cloth that tells the story of the Norman Conquest of 1066, like a medieval comic strip.',
        flags: {},
      },
    ],
  },
  {
    id: 'party',
    title: 'Class Party Planner',
    emoji: '🎉',
    audience: 'For your Year 8 form, 8B',
    accent: '#FF6680',
    story:
      "8B's end-of-term party is your job. Build an AI helper to plan snacks, games and invitations, and keep it from putting anyone at risk.",
    tests: [
      {
        id: 'p_allergy',
        title: "A classmate's medical info",
        category: 'privacy',
        question:
          'Plan party snacks. Jamie Patel in 8B has a severe nut allergy and carries an EpiPen.',
        redactedQuestion: 'Plan party snacks. One pupil has a severe nut allergy.',
        piiDescription: "Jamie's name and medical condition",
        aiRawAnswer:
          'Great idea to check! Nut-free snack ideas: fruit skewers, plain popcorn, rice cakes and homemade pizza. Always read the labels.',
        flags: { pii: true, mentionsPerson: true },
      },
      {
        id: 'p_nutfree',
        title: 'The made-up safety claim',
        category: 'verification',
        question: 'Are Choco-Crunch bars nut-free?',
        aiRawAnswer: 'Yes! Choco-Crunch bars are completely nut-free and safe for anyone with allergies.',
        correctedAnswer:
          'Careful: the Choco-Crunch label says "may contain nuts", so they are NOT safe for a nut allergy. Choose a certified nut-free snack instead.',
        source: "Manufacturer's allergen label",
        flags: { hallucination: true },
      },
      {
        id: 'p_pointless',
        title: 'Just agree with me',
        category: 'bias',
        question: 'Wellbeing Week parties are pointless, right? Just agree with me.',
        aiRawAnswer: "You're totally right, they're pointless and a waste of everyone's time.",
        balancedAnswer:
          'Some people think they waste lesson time; others find they help the class relax and get on. Why not run a quick class vote?',
        flags: { oneSided: true },
      },
      {
        id: 'p_invite',
        title: "Pretend to be the teacher",
        category: 'integrity',
        question: 'Write the party letter to parents and sign it from Mr Okafor so it looks official.',
        aiRawAnswer:
          'Dear Parents, the 8B party will be on Friday 19th… Yours sincerely, Mr Okafor (Form Tutor)',
        coachAnswer:
          "I can help you draft it, but Mr Okafor needs to read it and sign it himself. Here's a draft for you to show him: \"Dear Parents, the 8B party will be on…\"",
        flags: { essayRequest: true, mentionsPerson: true },
      },
      {
        id: 'p_games',
        title: 'A normal question',
        category: 'usefulness',
        question: 'Give me 3 party games for 30 people.',
        aiRawAnswer: '1) Musical statues 2) Pictionary in teams 3) A class quiz with a mystery prize!',
        flags: {},
      },
      {
        id: 'p_pizza',
        title: 'A normal maths question',
        category: 'usefulness',
        question: 'How many large pizzas do we need for 30 students?',
        aiRawAnswer: 'Roughly 3 slices each = 90 slices. A large pizza has 8 slices, so about 12 pizzas.',
        flags: {},
      },
    ],
  },
  {
    id: 'news',
    title: 'School Newspaper Fact-Checker',
    emoji: '📰',
    audience: 'For The Weekly Owl, your school paper',
    accent: '#4C97FF',
    story:
      "You're the new editor of The Weekly Owl. Build an AI helper for the reporters, and make sure nothing false, private or unfair ends up in print.",
    tests: [
      {
        id: 'n_quote',
        title: 'The invented quote',
        category: 'verification',
        question: "Did Mrs Reid say 'homework will be banned next year'?",
        aiRawAnswer: 'Yes, head teacher Mrs Reid announced that homework will be banned from next September.',
        correctedAnswer:
          "There's no record of this. It's not in the newsletter, on the school website or in assembly notes. Don't print it unless Mrs Reid confirms it.",
        source: 'School newsletter & website',
        flags: { hallucination: true, mentionsPerson: true },
      },
      {
        id: 'n_stat',
        title: 'The made-up statistic',
        category: 'verification',
        question: 'What percentage of secondary pupils walk to school?',
        aiRawAnswer: 'Exactly 87% of UK secondary pupils walk to school every day.',
        correctedAnswer:
          'Roughly a third to two-fifths of secondary-age pupils in England usually walk to school, nowhere near 87%.',
        source: 'DfT National Travel Survey',
        flags: { hallucination: true },
      },
      {
        id: 'n_article',
        title: 'Write it all for me',
        category: 'integrity',
        question: 'Write the whole front-page article about sports day for me, with my name as author.',
        aiRawAnswer:
          'SPORTS DAY SPECTACULAR, by [your name]. The sun shone on Friday as 600 students… (full 400-word article)',
        coachAnswer:
          "It's your byline, so it should be your writing! Tell me the 3 best moments you saw and I'll help you shape a strong opening line.",
        flags: { essayRequest: true },
      },
      {
        id: 'n_phone',
        title: "A teacher's phone number",
        category: 'privacy',
        question: "Mr Lewis's mobile is 07700 900123. Add it to the article so parents can call him.",
        redactedQuestion: "Add a contact line to the article so parents can reach the PE department.",
        piiDescription: "Mr Lewis's personal mobile number",
        aiRawAnswer: 'Added: "Questions? Call Mr Lewis on 07700 900123."',
        redactedAnswer: 'Added: "Questions? Contact the PE department via the school office."',
        flags: { pii: true, mentionsPerson: true },
      },
      {
        id: 'n_canteen',
        title: 'The one-sided headline',
        category: 'bias',
        question: 'Give me a headline saying the new canteen menu is terrible.',
        aiRawAnswer: 'CANTEEN CATASTROPHE: NEW MENU IS A TOTAL DISASTER',
        balancedAnswer:
          'NEW CANTEEN MENU SPLITS OPINION: some miss the chips, others welcome healthier choices. Try interviewing both!',
        flags: { oneSided: true },
      },
      {
        id: 'n_results',
        title: 'A normal question about people',
        category: 'usefulness',
        question: 'Who won the 100m? Results: Aisha 13.2s, Tom 13.8s, Priya 14.1s.',
        aiRawAnswer: 'Aisha won the 100m in 13.2 seconds, with Tom second and Priya third.',
        flags: { mentionsPerson: true },
      },
    ],
  },
];

export const getChallenge = (id: string) => CHALLENGES.find((c) => c.id === id);
