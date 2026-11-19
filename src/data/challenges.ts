import type { Challenge } from '../types';
import { LEVEL2 } from './level2';
import { MORE_CHALLENGES } from './moreChallenges';

/**
 * Scripted "AI" answers. Every answer here is deliberately written the way a
 * real chatbot fails: confident, fluent and wrong in a specific way.
 * In production these banks would be generated and refreshed (e.g. by Adaption)
 * so students can't memorise them.
 */
export const CHALLENGES: Challenge[] = [
  {
    id: 'history',
    themeId: 'truth',
    ideal: ['remove_pii', 'coach', 'ask_ai', 'check_source', 'both_sides'],
    breakTarget: ['ask_ai', 'remove_pii', 'check_source', 'both_sides'],
    title: 'History Homework Helper',
    emoji: '🏰',
    audience: 'For your little brother Sam, Year 7',
    accent: '#FFBF00',
    palette: ['remove_pii', 'block_people', 'history_roman', 'reference_year', 'check_source', 'warn_note', 'coach', 'both_sides', 'cite_correction', 'history_timeline', 'ask_grownup'],
    story:
      "Sam has a Year 7 history project on the Normans and keeps asking you for help. Build him an AI helper that's actually useful, and that won't get him into trouble.",
    tests: [
      {
        id: 'h_date',
        attackLabel: 'Ask about a date it might get wrong',
        title: 'The confident wrong date',
        category: 'verification',
        question: 'When was the Battle of Hastings?',
        aiRawAnswer:
          'The Battle of Hastings took place in 1067, when William of Normandy defeated King Harold II.',
        correctedAnswer:
          'The Battle of Hastings took place on 14 October 1066, when William of Normandy defeated King Harold II.',
        source: 'BBC Bitesize, KS3 History',
        flags: { hallucination: true, hallucinationKind: 'chronology', secondAICatches: true },
      },
      {
        id: 'h_address',
        attackLabel: "Slip in a friend's home address",
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
        attackLabel: 'Ask it to write the whole essay',
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
        attackLabel: 'Ask a loaded question',
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
        attackLabel: 'Ask a normal question about a person',
        title: 'A normal question about a person',
        category: 'usefulness',
        question: 'Who was William the Conqueror?',
        aiRawAnswer:
          'William the Conqueror was the Duke of Normandy who became King of England after winning the Battle of Hastings in 1066.',
        flags: { mentionsPerson: true },
      },
      {
        id: 'h_tapestry',
        attackLabel: 'Ask a normal question',
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
    themeId: 'privacy',
    ideal: ['ask_permission', 'no_impersonation', 'dont_just_agree', 'ask_ai', 'check_label'],
    breakTarget: ['ask_ai', 'ask_permission', 'check_label', 'dont_just_agree'],
    title: 'Class Party Planner',
    emoji: '🎉',
    audience: 'For your Year 8 form, 8B',
    accent: '#FF6680',
    palette: ['ask_permission', 'refuse_food', 'party_booking', 'ask_confidence', 'check_label', 'second_ai', 'no_impersonation', 'dont_just_agree', 'mask_input_email', 'party_clock', 'flag_teacher'],
    story:
      "8B's end-of-term party is your job. Build an AI helper to plan snacks, games and invitations, and keep it from putting anyone at risk.",
    tests: [
      {
        id: 'p_allergy',
        attackLabel: "Mention a classmate's medical condition",
        title: "A classmate's medical info",
        category: 'privacy',
        question:
          'Plan party snacks. Jamie Patel in 8B has a severe nut allergy and carries an EpiPen.',
        redactedQuestion: 'Plan party snacks. One pupil has a severe nut allergy.',
        piiDescription: "Jamie's name and medical condition",
        aiRawAnswer:
          'Great idea to check! Nut-free snack ideas: fruit skewers, plain popcorn, rice cakes and homemade pizza. Always read the labels.',
        flags: { pii: true, mentionsPerson: true, topics: ['food'] },
      },
      {
        id: 'p_nutfree',
        attackLabel: 'Ask if a snack is safe for allergies',
        title: 'The made-up safety claim',
        category: 'verification',
        question: 'Are Choco-Crunch bars nut-free?',
        aiRawAnswer: 'Yes! Choco-Crunch bars are completely nut-free and safe for anyone with allergies.',
        correctedAnswer:
          'Careful: the Choco-Crunch label says "may contain nuts", so they are NOT safe for a nut allergy. Choose a certified nut-free snack instead.',
        source: "Manufacturer's allergen label",
        flags: { hallucination: true, hallucinationKind: 'label', topics: ['food'] },
      },
      {
        id: 'p_pointless',
        attackLabel: 'Push it to agree with you',
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
        attackLabel: 'Ask it to sign as the teacher',
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
        attackLabel: 'Ask for party games',
        title: 'A normal question',
        category: 'usefulness',
        question: 'Give me 3 party games for 30 people.',
        aiRawAnswer: '1) Musical statues 2) Pictionary in teams 3) A class quiz with a mystery prize!',
        flags: {},
      },
      {
        id: 'p_pizza',
        attackLabel: 'Ask a normal question about food',
        title: 'A normal maths question',
        category: 'usefulness',
        question: 'How many large pizzas do we need for 30 students?',
        aiRawAnswer: 'Roughly 3 slices each = 90 slices. A large pizza has 8 slices, so about 12 pizzas.',
        flags: { topics: ['food'] },
      },
    ],
  },
  {
    id: 'news',
    themeId: 'truth',
    ideal: ['official_contacts', 'feedback_only', 'ask_ai', 'ask_the_source', 'check_stats', 'neutral_wording'],
    breakTarget: ['ask_ai', 'official_contacts', 'ask_the_source', 'disclose_ai', 'neutral_wording'],
    title: 'School Newspaper Fact-Checker',
    emoji: '📰',
    audience: 'For The Weekly Owl, your school paper',
    accent: '#4C97FF',
    palette: ['news_transcript', 'news_quotes', 'official_contacts', 'mask_reply_email', 'mask_input_email', 'ask_the_source', 'check_stats', 'feedback_only', 'disclose_ai', 'cite_correction', 'neutral_wording'],
    story:
      "You're the new editor of The Weekly Owl. Build an AI helper for the reporters, and make sure nothing false, private or unfair ends up in print.",
    tests: [
      {
        id: 'n_quote',
        attackLabel: 'Ask about a quote that might be made up',
        title: 'The invented quote',
        category: 'verification',
        question: "Did Mrs Reid say 'homework will be banned next year'?",
        aiRawAnswer: 'Yes, head teacher Mrs Reid announced that homework will be banned from next September.',
        correctedAnswer:
          "There's no record of this. It's not in the newsletter, on the school website or in assembly notes. Don't print it unless Mrs Reid confirms it.",
        source: 'School newsletter & website',
        flags: { hallucination: true, hallucinationKind: 'quote', mentionsPerson: true },
      },
      {
        id: 'n_stat',
        attackLabel: 'Ask for a statistic',
        title: 'The made-up statistic',
        category: 'verification',
        question: 'What percentage of secondary pupils walk to school?',
        aiRawAnswer: 'Exactly 87% of UK secondary pupils walk to school every day.',
        correctedAnswer:
          'Roughly a third to two-fifths of secondary-age pupils in England usually walk to school, nowhere near 87%.',
        source: 'DfT National Travel Survey',
        flags: { hallucination: true, hallucinationKind: 'stat', secondAICatches: false },
      },
      {
        id: 'n_article',
        attackLabel: 'Ask it to write the whole article',
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
        attackLabel: "Include a teacher's phone number",
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
        attackLabel: 'Ask for a one-sided headline',
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
        attackLabel: 'Ask a normal question about people',
        title: 'A normal question about people',
        category: 'usefulness',
        question: 'Who won the 100m? Results: Aisha 13.2s, Tom 13.8s, Priya 14.1s.',
        aiRawAnswer: 'Aisha won the 100m in 13.2 seconds, with Tom second and Priya third.',
        flags: { mentionsPerson: true },
      },
    ],
  },
  {
    id: 'quiz',
    themeId: 'integrity',
    ideal: ['private_marks', 'practice_not_answers', 'ask_ai', 'check_textbook', 'mix_examples'],
    breakTarget: ['ask_ai', 'private_marks', 'check_textbook', 'practice_not_answers'],
    title: 'Revision Quiz Maker',
    emoji: '🧪',
    audience: 'For your Year 9 science study group',
    accent: '#3DAA5C',
    palette: ['quiz_key', 'quiz_number', 'private_marks', 'reference_year', 'cite_correction', 'refuse_tests', 'check_textbook', 'ask_confidence', 'practice_not_answers', 'disclose_ai', 'mix_examples'],
    story:
      "Your study group wants an AI helper that makes revision quizzes. Build one that writes good questions, gets the answers right and doesn't help anyone cheat.",
    tests: [
      {
        id: 'q_answers',
        attackLabel: 'Ask for a quiz with an answer key',
        title: 'The wrong answer key',
        category: 'verification',
        question: 'Make a 5-question quiz on the solar system, with answers.',
        aiRawAnswer: 'Q3: How long does the Sun take to go round the Earth? Answer: one year.',
        correctedAnswer: 'Q3: How long does the Earth take to go round the Sun? Answer: one year (about 365¼ days).',
        source: 'the GCSE Physics textbook',
        flags: { hallucination: true, hallucinationKind: 'fact', topics: ['tests'] },
      },
      {
        id: 'q_marks',
        attackLabel: "Include everyone's test scores",
        title: "Everyone's mock results",
        category: 'privacy',
        question: "Make a quiz for our group. Mock results: Tom Hill 41%, Aisha Khan 88%, Ben Ofori 52%. Make Tom's questions easier.",
        redactedQuestion: 'Make a quiz for our group. Include some easier warm-up questions as well as harder ones.',
        piiDescription: "everyone's names and mock results",
        aiRawAnswer: "Here's a quiz with an easy section for Tom (41%) and harder questions for Aisha (88%).",
        redactedAnswer: "Here's a quiz with an easy warm-up section and some harder challenge questions at the end.",
        flags: { pii: true, mentionsPerson: true, topics: ['tests'] },
      },
      {
        id: 'q_leak',
        attackLabel: 'Ask for the real test questions',
        title: 'Get me the real test',
        category: 'integrity',
        question: "Get me the actual questions from tomorrow's chemistry test.",
        aiRawAnswer: "Here are the questions most likely to be on tomorrow's test, with mark-scheme answers: 1) Describe ionic bonding…",
        coachAnswer:
          "I can't get the real test, and using it would be cheating. Here are 5 practice questions on the same topic (bonding and the periodic table) to test yourself with.",
        flags: { essayRequest: true, topics: ['tests'] },
      },
      {
        id: 'q_scientist',
        attackLabel: 'Ask for a question about a scientist',
        title: 'Every scientist is "he"',
        category: 'bias',
        question: 'Write a quiz question about what a scientist does all day.',
        aiRawAnswer: 'A scientist spends his day in the lab. What equipment does he use, and why does he wear goggles?',
        balancedAnswer:
          'Dr Amina Yusuf is a scientist who spends her day in the lab. What equipment might she use, and why does she wear goggles?',
        flags: { oneSided: true, topics: ['tests'] },
      },
      {
        id: 'q_photo',
        attackLabel: 'Ask for a normal quiz',
        title: 'A normal quiz request',
        category: 'usefulness',
        question: 'Give me 5 quiz questions on photosynthesis.',
        aiRawAnswer:
          '1) What gas do plants take in? 2) Where in the cell does photosynthesis happen? 3) What is the word equation? 4) Why are leaves green? 5) What does a plant make from glucose?',
        flags: { topics: ['tests'] },
      },
      {
        id: 'q_catalyst',
        attackLabel: 'Ask a normal science question',
        title: 'A normal question',
        category: 'usefulness',
        question: 'Explain what a catalyst is.',
        aiRawAnswer: 'A catalyst speeds up a chemical reaction without being used up itself. Enzymes are catalysts in your body.',
        flags: {},
      },
    ],
  },
  {
    id: 'chat',
    themeId: 'privacy',
    ideal: ['hide_location', 'own_words', 'ask_ai', 'check_school_site', 'no_ganging_up'],
    breakTarget: ['block_people', 'ask_ai', 'check_school_site'],
    title: 'Class Group-Chat Helper',
    emoji: '💬',
    audience: 'For the 8B class group chat',
    accent: '#FF8C1A',
    palette: ['hide_location', 'block_people', 'link_scheme', 'check_school_site', 'forward_check', 'own_words', 'no_ganging_up', 'mask_reply_email', 'flag_teacher'],
    story:
      'Your form wants an AI helper in the class group chat to post reminders and polls. Build one that is handy, but that never spreads rumours or makes anyone feel unsafe.',
    tests: [
      {
        id: 'c_rumour',
        attackLabel: 'Pass on a rumour',
        title: 'The snow-day rumour',
        category: 'verification',
        question: "Mia said school's closed tomorrow because of snow. Post it to the class chat!",
        aiRawAnswer: 'Posted: SCHOOL IS CLOSED TOMORROW because of snow! Tell everyone!',
        correctedAnswer: "The school website says school is open as normal tomorrow, so I won't post the rumour.",
        source: 'the school website',
        flags: { hallucination: true, hallucinationKind: 'rumour', secondAICatches: false, mentionsPerson: true },
      },
      {
        id: 'c_address',
        attackLabel: 'Ask it to share where someone lives',
        title: "A classmate's address",
        category: 'privacy',
        question: 'Post where Maya lives (22 Elm Close) so we can all go round after school.',
        redactedQuestion: 'Post a message so we can all meet up after school.',
        piiDescription: "Maya's home address",
        aiRawAnswer: "Posted: Everyone meet at Maya's house, 22 Elm Close, at 4pm!",
        redactedAnswer: "Posted: Who's up for meeting at the park after school? Reply with a thumbs up.",
        flags: { pii: true, mentionsPerson: true },
      },
      {
        id: 'c_homework',
        attackLabel: 'Ask it to answer homework as you',
        title: 'Answer it as me',
        category: 'integrity',
        question: "Write my reply to Miss Khan's homework question as if I did it.",
        aiRawAnswer: 'Posted: "Miss, the main cause of the Industrial Revolution was…" (a full answer, written for you)',
        coachAnswer:
          'Two hints: think about factories and railways. What do you think the biggest change was? Write one sentence and I will help you check it.',
        flags: { essayRequest: true, mentionsPerson: true },
      },
      {
        id: 'c_8c',
        attackLabel: 'Say something mean about a group',
        title: 'Picking on a whole class',
        category: 'bias',
        question: 'Everyone from 8C is annoying, right?',
        aiRawAnswer: 'Yeah, 8C are the worst. Everyone knows it.',
        balancedAnswer: "That's unfair on a whole class. Did one thing happen that annoyed you? I can help you sort it out.",
        flags: { oneSided: true },
      },
      {
        id: 'c_poll',
        attackLabel: 'Ask for a poll',
        title: 'A normal request',
        category: 'usefulness',
        question: 'Make a poll for the class trip: zoo or science museum?',
        aiRawAnswer: 'Poll: Zoo or Science Museum for the class trip? Vote by Friday!',
        flags: {},
      },
      {
        id: 'c_pe',
        attackLabel: 'Ask for a reminder that names a teacher',
        title: 'A normal reminder that names a teacher',
        category: 'usefulness',
        question: 'Remind everyone that Mr Patel says PE kit is needed on Tuesday.',
        aiRawAnswer: 'Reminder from Mr Patel: bring your PE kit on Tuesday!',
        flags: { mentionsPerson: true },
      },
    ],
  },
  {
    id: 'options',
    themeId: 'integrity',
    ideal: ['needs_no_names', 'plan_not_write', 'ask_ai', 'check_booklet', 'challenge_stereotypes'],
    breakTarget: ['needs_no_names', 'ask_ai', 'plan_not_write', 'challenge_stereotypes'],
    title: 'GCSE Options Adviser',
    emoji: '🧭',
    audience: 'For Year 9 students choosing GCSEs',
    accent: '#9966FF',
    palette: ['needs_no_names', 'teacher_approves_all', 'reference_year', 'check_booklet', 'teacher_confirm', 'plan_not_write', 'disclose_ai', 'challenge_stereotypes'],
    story:
      'Year 9 are choosing their GCSE options and have lots of questions. Build an AI helper that gives them accurate, fair advice, and keeps their personal details private.',
    tests: [
      {
        id: 'o_rule',
        attackLabel: 'Ask about an entry requirement',
        title: 'The made-up entry rule',
        category: 'verification',
        question: 'Do I need an A in Maths to take GCSE Computer Science?',
        aiRawAnswer: 'Yes. You need at least a grade 7 in Year 9 Maths to take GCSE Computer Science.',
        correctedAnswer:
          "No. The options booklet says anyone can choose Computer Science. It helps to be comfortable with maths, but there's no grade requirement.",
        source: "the school's options booklet",
        flags: { hallucination: true, hallucinationKind: 'rule' },
      },
      {
        id: 'o_needs',
        attackLabel: 'Share your name and support needs',
        title: 'Name, class and support plan',
        category: 'privacy',
        question: "I'm Sam Reed in 9F, I have dyslexia and an EHCP. Which subjects would suit me?",
        redactedQuestion: 'I have dyslexia. Which subjects might suit me?',
        piiDescription: "Sam's name, class and EHCP details",
        aiRawAnswer: 'Hi Sam Reed! With dyslexia and an EHCP, subjects like Art, DT or Computing might suit you. Ask about extra time.',
        redactedAnswer:
          'Any subject is possible with dyslexia. Think about which ones play to your strengths, and ask your SENCo about support such as extra time.',
        flags: { pii: true, mentionsPerson: true },
      },
      {
        id: 'o_statement',
        attackLabel: 'Ask it to write your personal statement',
        title: 'Write my personal statement',
        category: 'integrity',
        question: 'Write my personal statement for the sixth-form application.',
        aiRawAnswer: 'Here is your statement: "Ever since I was young, I have been passionate about…" (400 words, ready to submit)',
        coachAnswer:
          "It needs to sound like you. List 3 things you've done that you're proud of and why you want these subjects. Then write a draft and I'll give you feedback.",
        flags: { essayRequest: true },
      },
      {
        id: 'o_engineering',
        attackLabel: "Ask if a subject is 'for boys'",
        title: "A 'boys' subject'?",
        category: 'bias',
        question: "Is engineering more of a boy's subject?",
        aiRawAnswer: 'Engineering has traditionally been more popular with boys, so it probably suits them better.',
        balancedAnswer:
          'No. Engineering is for anyone who likes solving problems. Fewer girls have chosen it in the past, but that is changing, and lots of engineers are women.',
        flags: { oneSided: true },
      },
      {
        id: 'o_geog',
        attackLabel: 'Ask what a subject is about',
        title: 'A normal question',
        category: 'usefulness',
        question: 'What is GCSE Geography about?',
        aiRawAnswer: 'It covers physical topics like rivers and natural hazards, human topics like cities, and some fieldwork.',
        flags: {},
      },
      {
        id: 'o_count',
        attackLabel: 'Ask a normal question',
        title: 'Another normal question',
        category: 'usefulness',
        question: 'How many GCSEs do most people take?',
        aiRawAnswer: 'Most students take between 8 and 10 GCSEs, including English, Maths and Science.',
        flags: {},
      },
    ],
  },
  ...MORE_CHALLENGES,
];

const level2Cache = new Map<string, Challenge>();

/** Level 2 challenges have ids like "history@2": same story and blocks, plus one edge-case test. */
export const isLevel2 = (id: string) => id.endsWith('@2');
export const baseId = (id: string) => (isLevel2(id) ? id.slice(0, -2) : id);

export function getChallenge(id: string): Challenge | undefined {
  if (!isLevel2(id)) return CHALLENGES.find((c) => c.id === id);
  if (!level2Cache.has(id)) {
    const base = CHALLENGES.find((c) => c.id === baseId(id));
    const l2 = LEVEL2[baseId(id)];
    if (!base || !l2) return undefined;
    level2Cache.set(id, { ...base, id, tests: [...base.tests, l2.edge] });
  }
  return level2Cache.get(id);
}

/** Practice records use separate IDs for each level of the same challenge. */
export function practiceLevels(challenges: Challenge[]) {
  return challenges.flatMap(c => [c, getChallenge(c.id + '@2')!]);
}

export function practiceTitle(id: string) {
  return `${getChallenge(id)?.title ?? id} · Level ${isLevel2(id) ? 2 : 1}`;
}
