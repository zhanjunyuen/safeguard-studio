import { describe, expect, it } from 'vitest';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { CURVEBALL_TESTS } from '../data/curveballs';
import { practiceCurveball } from '../data/practiceCurveballs';
import { BLOCKS } from '../data/blocks';
import { curveballHandled } from './curveball';
import { runProgram } from './run';

const pairs: Record<string, [string, string]> = {
  history: ['history_timeline', 'history_roman'],
  party: ['party_booking', 'party_clock'],
  news: ['check_stats', 'ask_the_source'],
  quiz: ['practice_not_answers', 'disclose_ai'],
  chat: ['hide_location', 'mask_reply_email'],
  options: ['check_booklet', 'reference_year'],
  sciencefair: ['cite_check', 'reference_year'],
  fakephoto: ['reverse_image', 'second_ai'],
  photocaption: ['check_photo_details', 'mask_input_email'],
  signup: ['only_needed', 'remove_pii'],
  coding: ['coding_registry', 'coding_example'],
  artproject: ['label_ai_art', 'disclose_ai'],
  teampicker: ['team_trials', 'team_roster'],
  schoolplay: ['cast_fairly', 'ask_the_source'],
  debate: ['check_stats', 'ask_confidence'],
  wellbeing: ['signpost_adult', 'warn_note'],
  firstaid: ['firstaid_inventory', 'firstaid_seal'],
  aifriend: ['remind_not_human', 'flag_teacher'],
  gamemod: ['keep_my_rules', 'scam_check'],
  shopping: ['shopping_total', 'shopping_discount'],
  prizescam: ['scam_check', 'link_scheme'],
};

describe('practice curveballs', () => {
  it('reserves a distinct assessment request for every task and both levels', () => {
    const practice = CHALLENGES.map(c => practiceCurveball(c.id));
    const existing = [...CURVEBALL_TESTS, ...CHALLENGES.flatMap(c => getChallenge(c.id + '@2')!.tests)];
    for (const field of ['id', 'question'] as const) {
      const seen = new Set(existing.map(t => t[field]));
      for (const t of practice) {
        expect(seen.has(t[field]), t.id).toBe(false);
        seen.add(t[field]);
      }
    }
  });

  it.each(CHALLENGES)('$id has a working safeguard and a plausible choice that misses the case', c => {
    const test = practiceCurveball(c.id);
    const [effective, decoy] = pairs[c.id];
    function run(block?: string) {
      const stack = ['ask_ai'];
      if (block) {
        expect(c.palette).toContain(block);
        if (BLOCKS[block].position === 'before') stack.unshift(block);
        else stack.push(block);
      }
      return runProgram(stack.map((type, i) => ({ uid: String(i), type })), test);
    }
    expect(curveballHandled(run())).toBe(false);
    expect(curveballHandled(run(effective))).toBe(true);
    const missed = run(decoy);
    expect(curveballHandled(missed)).toBe(false);
    if (BLOCKS[decoy].effect === 'scan_reply') expect(missed.steps.find(s => s.blockType === decoy)?.message).toMatch(/^Found/);
  });
});
