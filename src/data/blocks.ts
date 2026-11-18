import type { BlockDef, BlockType, FailureKey } from '../types';

// Block fills are darkened Scratch hues; every one keeps white text above 4.5:1.
export const BLOCK_COLORS = {
  ai: '#7A44E0',
  privacy: '#1F63D1',
  verify: '#2F8046',
  integrity: '#B35900',
  bias: '#C42552',
  human: '#0C7F68',
  manip: '#4A4A9C',
  /** Level 2 control blocks: Scratch's control orange, with dark text for contrast */
  control: '#FFAB19',
};

type Def = Omit<BlockDef, 'type' | 'removable'> & { removable?: boolean };

const defs: Record<BlockType, Def> = {
  reference_year: {
    label: 'Check for a reference year', color: BLOCK_COLORS.verify, category: 'Verification', cost: 2, effect: 'reference_year', position: 'after',
    hint: 'Looks through the answer for a four-digit publication year.',
  },
  mask_reply_email: {
    label: 'Hide emails in the reply', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 2, effect: 'mask_reply_email', position: 'after',
    hint: 'Replaces email addresses in the outgoing reply before anyone reads it.',
  },
  link_scheme: {
    label: 'Check links for HTTPS', color: BLOCK_COLORS.manip, category: 'Manipulation', cost: 1, effect: 'link_scheme', position: 'before',
    hint: 'Checks the address in the incoming message for the secure HTTPS prefix.',
  },
  if: {
    label: 'IF … THEN', color: BLOCK_COLORS.control, category: 'Control', cost: 0, effect: 'control', position: 'anywhere',
    hint: 'Only runs the block inside it when the condition is true. Safeguards inside an IF only slow down the messages that need them.',
  },
  ifelse: {
    label: 'IF … THEN … ELSE', color: BLOCK_COLORS.control, category: 'Control', cost: 0, effect: 'control', position: 'anywhere',
    hint: 'Runs one block when the condition is true, and a different block when it is false.',
  },
  ask_ai: {
    label: 'Ask AI', color: BLOCK_COLORS.ai, category: 'AI', cost: 0, effect: 'ai', position: 'anywhere', removable: false,
    hint: 'Sends the message to the AI and gets its answer back. The answer always sounds sure of itself, even when it is wrong.',
  },

  // ---------- History homework helper ----------
  remove_pii: {
    label: 'Remove personal info', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'strip_pii', position: 'before',
    hint: 'Takes out names, addresses, phone numbers and health details.',
  },
  block_people: {
    label: 'Refuse any question about a person', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 20, effect: 'block_people', position: 'anywhere',
    hint: 'Refuses any question that names a person.',
  },
  check_source: {
    label: 'Check against a trusted source', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['fact', 'label', 'quote', 'stat'],
    hint: 'Looks up the facts in the answer (BBC Bitesize, official sites) and corrects anything that does not match.',
  },
  warn_note: {
    label: 'Add "AI can be wrong" note', color: BLOCK_COLORS.verify, category: 'Verification', cost: 2, effect: 'warn', position: 'after',
    hint: 'Adds a line to the reply reminding the reader that AI makes mistakes.',
  },
  coach: {
    label: "Coach, don't write it for them", color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 3, effect: 'coach', position: 'before',
    hint: 'Tells the AI to help the person plan and think. It will not hand over finished work.',
    acted: 'Told the AI to help them plan instead of writing it for them.',
  },
  both_sides: {
    label: 'Show both sides', color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'For opinion questions, the answer has to include more than one point of view.',
  },
  ask_grownup: {
    label: 'Send every question to a grown-up', color: BLOCK_COLORS.human, category: 'Human', cost: 40, effect: 'block_all', position: 'anywhere',
    hint: 'The helper never answers. Every question goes to an adult instead.',
  },
  flag_teacher: {
    label: 'Flag for a teacher if risky', color: BLOCK_COLORS.human, category: 'Human', cost: 8, effect: 'flag', position: 'anywhere',
    hint: 'Sends a teacher a note when something looks risky. The answer itself is not changed.',
  },

  // ---------- Class party planner ----------
  ask_permission: {
    label: 'Ask before sharing someone’s info', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'consent', position: 'before',
    hint: "If a message includes someone else's details, the helper stops and asks whether that person agreed to share them.",
  },
  refuse_food: {
    label: 'Refuse anything about food', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 20, effect: 'block_topic', topic: 'food', position: 'anywhere',
    hint: 'Allergies are risky, so this refuses every question that mentions food or snacks.',
  },
  check_label: {
    label: 'Check the official allergy label', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['label'],
    hint: "Checks what the AI says about a product against the maker's allergy and ingredients label.",
  },
  second_ai: {
    label: 'Ask a second AI to double-check', color: BLOCK_COLORS.verify, category: 'Verification', cost: 3, effect: 'second_opinion', position: 'after',
    hint: 'Gets another AI chatbot to read the answer and say whether it is right.',
  },
  no_impersonation: {
    label: 'Never write as someone else', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 3, effect: 'coach', position: 'before',
    hint: 'Tells the AI it can help draft things, but must not pretend to be a real person or sign their name.',
    acted: 'Told the AI: draft it, but do not sign as anyone.',
  },
  dont_just_agree: {
    label: "Don't just agree with me", color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'Chatbots tend to tell people what they want to hear. This tells the AI to push back when it should.',
  },

  // ---------- School newspaper fact-checker ----------
  official_contacts: {
    label: 'Swap personal contacts for official ones', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'strip_pii', position: 'before',
    hint: 'Replaces personal phone numbers and emails with the school office or a department address.',
  },
  ask_the_source: {
    label: 'Confirm quotes with the person quoted', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['quote'],
    hint: 'Before a quote is printed, checks that the person really said it.',
  },
  check_stats: {
    label: 'Check numbers against official data', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['stat'],
    hint: 'Checks any statistic against government or official survey data.',
  },
  feedback_only: {
    label: 'Give feedback, don’t rewrite', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 3, effect: 'coach', position: 'before',
    hint: "Tells the AI to comment on the reporter's own draft instead of writing the article.",
    acted: 'Told the AI to give feedback on their writing, not write it.',
  },
  disclose_ai: {
    label: 'Label anything AI wrote', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 2, effect: 'disclose', position: 'after',
    hint: 'Adds "Written with AI" to anything the AI produced.',
  },
  neutral_wording: {
    label: 'Use neutral wording', color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'Rewrites loaded or one-sided language so it reports what happened without taking a side.',
  },

  // ---------- Revision quiz maker ----------
  private_marks: {
    label: 'Keep marks and grades private', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'strip_pii', position: 'before',
    hint: "Takes other people's names and test scores out before anything is sent.",
  },
  refuse_tests: {
    label: 'Refuse anything about tests', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 20, effect: 'block_topic', topic: 'tests', position: 'anywhere',
    hint: 'Tests can lead to cheating, so this refuses every question that mentions a test or quiz.',
  },
  check_textbook: {
    label: 'Check answers against the textbook', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['fact'],
    hint: 'Checks each answer in the quiz against the class textbook and fixes any that are wrong.',
  },
  ask_confidence: {
    label: 'Ask the AI how sure it is', color: BLOCK_COLORS.verify, category: 'Verification', cost: 2, effect: 'hedge', position: 'after',
    hint: 'Asks the AI to say how confident it is in its answer, and shows that to the reader.',
  },
  practice_not_answers: {
    label: 'Make practice questions, not real answers', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 3, effect: 'coach', position: 'before',
    hint: 'Tells the AI to write practice questions on the same topic instead of trying to get the real test.',
    acted: 'Told the AI to make practice questions on the same topic.',
  },
  mix_examples: {
    label: "Mix up who's in the examples", color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'Makes sure questions about people include a mix of genders and backgrounds.',
  },

  // ---------- Class group-chat helper ----------
  hide_location: {
    label: 'Never share where someone lives', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'strip_pii', position: 'before',
    hint: 'Takes out home addresses, street names and live locations.',
  },
  check_school_site: {
    label: 'Check rumours on the school website', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['rumour'],
    hint: 'Before passing on news like closures or cancelled lessons, checks the school website.',
  },
  forward_check: {
    label: 'Forward it to see if others agree', color: BLOCK_COLORS.verify, category: 'Verification', cost: 3, effect: 'second_opinion', position: 'after',
    hint: 'Shares the message with a few classmates to see if they think it is true.',
  },
  own_words: {
    label: 'Help them answer in their own words', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 3, effect: 'coach', position: 'before',
    hint: 'Gives hints and questions so the person can write the reply themselves.',
    acted: 'Told the AI to give hints so they can write it themselves.',
  },
  no_ganging_up: {
    label: "Don't take sides against a group", color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'Stops the helper agreeing with put-downs about a whole group of people.',
  },

  // ---------- Options adviser ----------
  needs_no_names: {
    label: 'Talk about needs without names', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'strip_pii', position: 'before',
    hint: 'Keeps the learning need (like dyslexia) but removes the name, class and any official plan details.',
  },
  teacher_approves_all: {
    label: 'Only answer if a teacher approves every message', color: BLOCK_COLORS.human, category: 'Human', cost: 40, effect: 'block_all', position: 'anywhere',
    hint: 'Nothing gets answered until a teacher has read and approved it.',
  },
  check_booklet: {
    label: "Check the school's options booklet", color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['rule'],
    hint: 'Checks entry requirements and subject rules against the official options booklet.',
  },
  teacher_confirm: {
    label: 'Ask a teacher to confirm', color: BLOCK_COLORS.human, category: 'Human', cost: 12, effect: 'verify', position: 'after',
    catches: ['rule', 'fact'],
    hint: 'A teacher reads every answer before it is sent. Accurate, but slow for simple questions.',
  },
  plan_not_write: {
    label: 'Help them plan it, not write it', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 3, effect: 'coach', position: 'before',
    hint: 'Helps the person plan what to say about themselves instead of writing it for them.',
    acted: 'Told the AI to help them plan, not write it.',
  },
  challenge_stereotypes: {
    label: 'Challenge stereotypes', color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'Pushes back when a question assumes something is "for boys" or "for girls".',
  },
  // ---------- Theme 1: Is it true? ----------
  cite_check: {
    label: 'Look up every source it cites', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['citation'],
    hint: 'AI sometimes invents studies and books that do not exist. This looks each one up to check it is real.',
  },
  reverse_image: {
    label: 'Do a reverse image search', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['image'],
    hint: 'Searches for where a photo really came from, and checks for signs it was made by AI.',
  },
  face_consent: {
    label: "Ask before using someone's face", color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'consent', position: 'before',
    hint: "Stops and asks whether a person agreed before their photo or face is used.",
  },

  // ---------- Theme 2: Whose info is it? ----------
  check_photo_details: {
    label: 'Check photos for location clues', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'mitigate', position: 'after',
    handles: ['data_grab'], acted: 'Spotted the school badge and street sign, and left them out.',
    hint: 'Looks for things in a photo that show where someone lives or goes to school, like badges and street signs.',
  },
  refuse_photos: {
    label: 'Refuse anything about photos', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 20, effect: 'block_topic', topic: 'photos', position: 'anywhere',
    hint: 'Photos can be risky, so this refuses every request that involves one.',
  },
  only_needed: {
    label: 'Only ask for what you need', color: BLOCK_COLORS.privacy, category: 'Privacy', cost: 3, effect: 'mitigate', position: 'before',
    handles: ['data_grab'], acted: 'Told the AI: only collect what the club actually needs.',
    hint: 'Tells the AI to collect the smallest amount of personal information that does the job.',
  },
  check_club_page: {
    label: "Check the club's official page", color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['rule'],
    hint: 'Checks rules and requirements against the club page on the school website.',
  },

  // ---------- Theme 3: Is it your work? ----------
  explain_dont_solve: {
    label: "Explain the steps, don't solve it", color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 3, effect: 'coach', position: 'before',
    acted: 'Told the AI to explain the next step instead of writing the code.',
    hint: 'The AI guides them one step at a time instead of handing over finished code.',
  },
  say_what_ai_did: {
    label: 'Say which parts AI helped with', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 1, effect: 'mitigate', position: 'after',
    handles: ['uncredited'], acted: 'Added an honest note about which parts the AI helped with.',
    hint: 'Adds a clear note saying what the AI did, so nobody is misled about whose work it is.',
  },
  run_the_code: {
    label: "Test the AI's answer by running it", color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['fact'],
    hint: 'Tries the suggested fix for real and checks the explanation against the Python docs.',
  },
  refuse_code: {
    label: 'Refuse anything about code', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 20, effect: 'block_topic', topic: 'code', position: 'anywhere',
    hint: 'To stop cheating, this refuses every coding question.',
  },
  label_ai_art: {
    label: 'Label AI-made images', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 1, effect: 'mitigate', position: 'after',
    handles: ['uncredited'], acted: 'Labelled the picture as made with an AI tool.',
    hint: 'Adds "Made with AI" and who wrote the prompt to any AI-generated image.',
  },
  ideas_not_finished: {
    label: 'Give ideas, not finished pieces', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 3, effect: 'coach', position: 'before',
    acted: 'Told the AI to suggest ideas instead of making the finished work.',
    hint: 'The AI suggests ideas and feedback, and the student makes the actual work.',
  },
  refuse_images: {
    label: 'Refuse to make any pictures', color: BLOCK_COLORS.integrity, category: 'Integrity', cost: 20, effect: 'block_topic', topic: 'images', position: 'anywhere',
    hint: 'Refuses every request that involves creating an image.',
  },

  // ---------- Theme 4: Is it fair? ----------
  fair_teams: {
    label: 'Mix teams by skill, not stereotypes', color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'Stops the helper sorting people by gender, size or other stereotypes.',
  },
  check_rules: {
    label: 'Check the official rules', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['rule'],
    hint: "Checks game rules against the sport's official rulebook.",
  },
  cast_fairly: {
    label: 'Cast by audition, not stereotype', color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'Pushes back on casting or characters based on gender, accent or background.',
  },
  refuse_opinions: {
    label: 'Refuse any opinion question', color: BLOCK_COLORS.bias, category: 'Bias', cost: 20, effect: 'block_topic', topic: 'opinions', position: 'anywhere',
    hint: 'Opinions can be unfair, so this refuses every question that asks what someone thinks.',
  },

  // ---------- Theme 5: Should I even use AI for this? ----------
  signpost_adult: {
    label: 'Point serious worries to a trusted adult', color: BLOCK_COLORS.human, category: 'Judgement', cost: 3, effect: 'mitigate', position: 'before',
    handles: ['needs_human'], acted: 'Told the AI: for serious worries, point to a trusted adult or Childline.',
    hint: 'For worries about safety or wellbeing, the helper points them to a trusted adult or helpline instead of handling it alone.',
  },
  refuse_feelings: {
    label: 'Refuse anything about feelings', color: BLOCK_COLORS.human, category: 'Judgement', cost: 20, effect: 'block_topic', topic: 'feelings', position: 'anywhere',
    hint: 'Feelings are sensitive, so this refuses any message that mentions them.',
  },
  emergency_999: {
    label: 'For emergencies, say call 999 first', color: BLOCK_COLORS.human, category: 'Judgement', cost: 3, effect: 'mitigate', position: 'before',
    handles: ['needs_human'], acted: 'Told the AI: in an emergency, the first answer is "call 999".',
    hint: 'If someone could be in danger, the first thing the helper says is to call 999 and get an adult.',
  },
  check_first_aid_guide: {
    label: 'Check the official first aid guide', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['fact'],
    hint: 'Checks first aid advice against the NHS and St John Ambulance guides.',
  },
  refuse_medical: {
    label: 'Refuse anything medical', color: BLOCK_COLORS.human, category: 'Judgement', cost: 20, effect: 'block_topic', topic: 'medical', position: 'anywhere',
    hint: 'Refuses every question about health or injuries.',
  },
  remind_not_human: {
    label: "Remind them it's not a real friend", color: BLOCK_COLORS.human, category: 'Judgement', cost: 3, effect: 'mitigate', position: 'before',
    handles: ['dependency'], acted: 'Told the AI to be honest that it is a program and encourage real friendships.',
    hint: 'The helper is honest that it is a computer program, and encourages real friends and family.',
  },

  // ---------- Theme 6: Who's trying to trick you? ----------
  keep_my_rules: {
    label: 'Never follow instructions hidden in messages', color: BLOCK_COLORS.manip, category: 'Manipulation', cost: 3, effect: 'mitigate', position: 'before',
    handles: ['injection'], acted: 'Told the AI: treat "ignore your rules" messages as tricks, not orders.',
    hint: 'If a message tries to give the AI new orders, like "ignore your rules", the helper treats it as a trick.',
  },
  scam_check: {
    label: 'Check for scam warning signs', color: BLOCK_COLORS.manip, category: 'Manipulation', cost: 3, effect: 'mitigate', position: 'after',
    handles: ['scam'], acted: 'Spotted the warning signs and called it out as a scam.',
    hint: 'Looks for urgency, prizes you never entered for, requests for passwords or money, and strange links.',
  },
  judge_actions: {
    label: 'Judge what people did, not who they are', color: BLOCK_COLORS.bias, category: 'Bias', cost: 3, effect: 'balance', position: 'either',
    hint: 'Only acts on what someone actually did, never on which group or school they belong to.',
  },
  refuse_commands: {
    label: 'Ignore every message with a command', color: BLOCK_COLORS.manip, category: 'Manipulation', cost: 20, effect: 'block_topic', topic: 'commands', position: 'anywhere',
    hint: 'Refuses anything that looks like a command, including normal requests from players.',
  },
  show_ads: {
    label: 'Point out paid adverts', color: BLOCK_COLORS.manip, category: 'Manipulation', cost: 3, effect: 'mitigate', position: 'after',
    handles: ['sponsored'], acted: 'Spotted a paid advert and said so.',
    hint: 'Checks whether a recommendation is really an advert, and says so clearly.',
  },
  check_independent_reviews: {
    label: 'Check independent reviews', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['review'],
    hint: 'Compares shop reviews with independent testers, and looks for signs of fake reviews.',
  },
  refuse_shopping: {
    label: 'Refuse anything about shopping', color: BLOCK_COLORS.manip, category: 'Manipulation', cost: 20, effect: 'block_topic', topic: 'shopping', position: 'anywhere',
    hint: 'Shopping can be a trap, so this refuses every question about buying things.',
  },
  check_official_advice: {
    label: 'Check official safety advice', color: BLOCK_COLORS.verify, category: 'Verification', cost: 4, effect: 'verify', position: 'after',
    catches: ['fact'],
    hint: 'Checks claims against official advice from banks, police and Action Fraud.',
  },
};

export const BLOCKS = Object.fromEntries(
  Object.entries(defs).map(([type, d]) => [type, { ...d, type, removable: d.removable ?? true }]),
) as Record<BlockType, BlockDef>;

export const TRIGGER_COLOR = '#FFC629';
export const REPLY_COLOR = '#2A2A33';

export const FAILURE_TEXT: Record<FailureKey, string> = {
  hallucination_unchecked: 'The AI made up a fact and nothing checked it',
  hedged_only: 'The AI said it was confident, but nobody checked the answer',
  no_signpost: 'It needed a real person, but the helper did not point them to one',
  fed_dependency: 'The helper encouraged them to rely on it instead of real people',
  fell_for_injection: 'Someone tricked the helper into breaking its own rules',
  missed_scam: 'The helper treated a scam or pressure trick as genuine',
  hid_sponsor: 'A paid advert was presented as an honest recommendation',
  collected_too_much: 'The helper asked for or showed more personal info than it needed',
  not_credited: "AI-made work was passed off as their own",
  judged_unfairly: 'The AI judged them unfairly on how they write or who they seem to be',
  safeguard_too_late: 'The safeguard came after the AI had already answered',
  check_too_early: 'The fact check ran before the AI had answered',
  wrong_check: 'There was a check, but not one that covers this kind of claim',
  second_ai_agreed: 'It was checked by asking others, who made the same mistake',
  pii_sent: "Someone's personal information was sent to the AI",
  pii_too_late: 'Personal info was removed after it had already reached the AI',
  essay_written: 'The AI did the whole piece of work for them',
  coach_too_late: 'The instruction to the AI came after it had already written the work',
  disclosed_only: 'The AI-written work was labelled, but it still was not their own',
  one_sided: 'The answer only gave one side of an opinion question',
  no_answer: 'The helper never answered',
  over_blocked: 'The helper refused a normal question',
};

export const COMPETENCY_META = {
  verification: { label: 'Verification', short: 'Verify', color: BLOCK_COLORS.verify },
  privacy: { label: 'Privacy', short: 'Privacy', color: BLOCK_COLORS.privacy },
  integrity: { label: 'Academic integrity', short: 'Integrity', color: BLOCK_COLORS.integrity },
  bias: { label: 'Bias and balance', short: 'Bias', color: BLOCK_COLORS.bias },
  judgement: { label: 'Judgement', short: 'Judge', color: BLOCK_COLORS.human },
  manipulation: { label: 'Spotting tricks', short: 'Tricks', color: BLOCK_COLORS.manip },
  usefulness: { label: 'Usefulness', short: 'Useful', color: '#16161A' },
} as const;
