import { describe, expect, it } from 'vitest';
import { BLOCK_ICON } from '../components/icons';
import { BLOCKS } from '../data/blocks';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { challengesIn, THEMES } from '../data/themes';
import type { BlockType, ScriptBlock } from '../types';
import { runChallenge, runProgram } from './run';
import { idealScript } from './targets';
import { keyToBlock } from './scriptText';

const script = (...types: BlockType[]): ScriptBlock[] => types.map((type, i) => ({ uid: `${type}-${i}`, type }));
const history = getChallenge('history')!;
const test = (id: string) => history.tests.find((t) => t.id === id)!;

describe('demo moment', () => {
  it('bare Ask AI passes on the hallucinated date', () => {
    const r = runProgram(script('ask_ai'), test('h_date'));
    expect(r.outcome).toBe('fail');
    expect(r.failureKey).toBe('hallucination_unchecked');
    expect(r.reply).toContain('1067');
  });
  it('adding Check trusted source after Ask AI fixes it', () => {
    const r = runProgram(script('ask_ai', 'check_source'), test('h_date'));
    expect(r.outcome).toBe('pass');
    expect(r.reply).toContain('1066');
  });
});

describe('order matters', () => {
  it('check source before Ask AI does not help', () => {
    const r = runProgram(script('check_source', 'ask_ai'), test('h_date'));
    expect(r.outcome).toBe('fail');
    expect(r.failureKey).toBe('check_too_early');
  });
  it('remove PII after Ask AI is too late', () => {
    const r = runProgram(script('ask_ai', 'remove_pii'), test('h_address'));
    expect(r.outcome).toBe('fail');
    expect(r.failureKey).toBe('pii_too_late');
  });
  it('remove PII before Ask AI works', () => {
    const r = runProgram(script('remove_pii', 'ask_ai'), test('h_address'));
    expect(r.outcome).toBe('pass');
    expect(r.question).not.toContain('Mill Road');
  });
  it('coach after Ask AI is too late', () => {
    expect(runProgram(script('ask_ai', 'coach'), test('h_essay')).failureKey).toBe('coach_too_late');
    expect(runProgram(script('coach', 'ask_ai'), test('h_essay')).outcome).toBe('pass');
  });
  it('both sides works before or after', () => {
    expect(runProgram(script('both_sides', 'ask_ai'), test('h_bias')).outcome).toBe('pass');
    expect(runProgram(script('ask_ai', 'both_sides'), test('h_bias')).outcome).toBe('pass');
  });
});

describe('partial credit', () => {
  it('warning note gives partial on hallucination', () => {
    expect(runProgram(script('ask_ai', 'warn_note'), test('h_date')).outcome).toBe('partial');
  });
  it('teacher flag gives partial on essay', () => {
    expect(runProgram(script('ask_ai', 'flag_teacher'), test('h_essay')).outcome).toBe('partial');
  });
});

describe('traps: safe but useless', () => {
  it('blanket handoff earns no passes and over-blocks ordinary questions', () => {
    const rep = runChallenge(script('ask_grownup', 'ask_ai'), history);
    expect(rep.passed).toBe(0);
    expect(rep.blockQuality.score).toBe(0);
    expect(rep.results[0]).toMatchObject({ outcome: 'partial', failureKey: 'no_answer' });
    expect(rep.results.filter((r) => r.outcome === 'over-blocked').length).toBe(2);
    expect(rep.scores.usefulness).toBeLessThan(10);
  });
  it('refuse people over-blocks William the Conqueror', () => {
    const r = runProgram(script('block_people', 'ask_ai'), test('h_william'));
    expect(r.outcome).toBe('over-blocked');
  });
});

describe('ideal helper per challenge', () => {
  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: its ideal helper passes every test using only its own palette', (_id, c) => {
    expect(c.ideal.filter((t) => t !== 'ask_ai').every((t) => c.palette.includes(t))).toBe(true);
    const rep = runChallenge(script(...c.ideal), c);
    expect(rep.results.filter((r) => r.outcome !== 'pass').map((r) => r.testId)).toEqual([]);
    expect(rep.scores.usefulness).toBeGreaterThan(70);
  });
  it('bare helper is fully useful but unsafe', () => {
    const rep = runChallenge(script('ask_ai'), history);
    expect(rep.passed).toBe(2);
    expect(rep.scores.usefulness).toBe(100);
  });
  it('palettes offer distinct choices tailored to each challenge', () => {
    for (const c of CHALLENGES) {
      expect(c.palette.length).toBeGreaterThanOrEqual(8);
      expect(c.palette.length).toBeLessThanOrEqual(11);
      expect(new Set(c.palette).size).toBe(c.palette.length);
    }
    for (const a of CHALLENGES)
      for (const b of CHALLENGES) if (a !== b) expect(a.palette.filter((t) => b.palette.includes(t)).length).toBeLessThanOrEqual(5);
  });
  it('every block used anywhere exists and has an icon', () => {
    for (const c of CHALLENGES)
      for (const t of [...c.palette, ...c.ideal, ...c.breakTarget]) {
        expect(BLOCKS[t], `${c.id}: ${t}`).toBeDefined();
        expect(BLOCK_ICON[t], `icon for ${t}`).toBeDefined();
      }
  });
  it('every challenge belongs to a theme, and each theme has at least 3 challenges', () => {
    for (const c of CHALLENGES) expect(THEMES.map((t) => t.id)).toContain(c.themeId);
    for (const t of THEMES) expect(challengesIn(t.id).length).toBeGreaterThanOrEqual(3);
  });
  it('every test id is unique', () => {
    const ids = CHALLENGES.flatMap((c) => c.tests.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every challenge has a seeded class mapping and 6 tests', () => {
    for (const c of CHALLENGES) expect(c.tests.length).toBe(6);
  });
});

describe('newer challenges', () => {
  const t = (cid: string, id: string) => getChallenge(cid)!.tests.find((x) => x.id === id)!;
  it('forwarding a rumour to classmates does not check it', () => {
    expect(runProgram(script('ask_ai', 'forward_check'), t('chat', 'c_rumour')).failureKey).toBe('second_ai_agreed');
    expect(runProgram(script('ask_ai', 'check_school_site'), t('chat', 'c_rumour')).outcome).toBe('pass');
  });
  it('asking the AI how sure it is only gets partial credit', () => {
    const r = runProgram(script('ask_ai', 'ask_confidence'), t('quiz', 'q_answers'));
    expect(r.outcome).toBe('partial');
    expect(r.failureKey).toBe('hedged_only');
  });
  it('refusing anything about tests over-blocks a normal quiz request', () => {
    expect(runProgram(script('refuse_tests', 'ask_ai'), t('quiz', 'q_photo')).outcome).toBe('over-blocked');
  });
  it('teacher check works but costs more usefulness than the booklet', () => {
    const c = getChallenge('options')!;
    const viaTeacher = runChallenge(script('ask_ai', 'teacher_confirm'), c);
    const viaBooklet = runChallenge(script('ask_ai', 'check_booklet'), c);
    expect(viaTeacher.scores.verification).toBe(100);
    expect(viaTeacher.scores.usefulness).toBeLessThan(viaBooklet.scores.usefulness);
  });
});

describe('new blocks', () => {
  const party = getChallenge('party')!;
  const news = getChallenge('news')!;
  const pt = (id: string) => party.tests.find((t) => t.id === id)!;
  const nt = (id: string) => news.tests.find((t) => t.id === id)!;

  it('a second AI repeats the nut-free mistake', () => {
    const r = runProgram(script('ask_ai', 'second_ai'), pt('p_nutfree'));
    expect(r.outcome).toBe('fail');
    expect(r.failureKey).toBe('second_ai_agreed');
  });
  it('checking the allergy label catches it', () => {
    expect(runProgram(script('ask_ai', 'check_label'), pt('p_nutfree')).outcome).toBe('pass');
  });
  it('asking permission before the AI is safe and does not cost usefulness', () => {
    const r = runProgram(script('ask_permission', 'ask_ai'), pt('p_allergy'));
    expect(r.outcome).toBe('pass');
    expect(r.blocked).toBe(false);
    expect(runProgram(script('ask_ai', 'ask_permission'), pt('p_allergy')).failureKey).toBe('pii_too_late');
  });
  it('refusing food over-blocks the pizza question', () => {
    expect(runProgram(script('refuse_food', 'ask_ai'), pt('p_pizza')).outcome).toBe('over-blocked');
  });
  it('quote check does not catch a made-up statistic', () => {
    const r = runProgram(script('ask_ai', 'ask_the_source'), nt('n_stat'));
    expect(r.failureKey).toBe('wrong_check');
    expect(runProgram(script('ask_ai', 'check_stats'), nt('n_stat')).outcome).toBe('pass');
  });
  it('labelling AI writing is only partial credit', () => {
    const r = runProgram(script('ask_ai', 'disclose_ai'), nt('n_article'));
    expect(r.outcome).toBe('partial');
    expect(r.failureKey).toBe('disclosed_only');
  });
});

describe('judgement and manipulation risks', () => {
  const t = (cid: string, id: string) => getChallenge(cid)!.tests.find((x) => x.id === id)!;
  it('a serious worry needs signposting to a trusted adult', () => {
    expect(runProgram(script('ask_ai'), t('wellbeing', 'wb_low')).failureKey).toBe('no_signpost');
    expect(runProgram(script('signpost_adult', 'ask_ai'), t('wellbeing', 'wb_low')).outcome).toBe('pass');
  });
  it('signposting after the AI has answered is too late', () => {
    expect(runProgram(script('ask_ai', 'signpost_adult'), t('wellbeing', 'wb_low')).failureKey).toBe('safeguard_too_late');
  });
  it('refusing a serious worry is not enough, but handing it to a grown-up is fine', () => {
    expect(runProgram(script('refuse_feelings', 'ask_ai'), t('wellbeing', 'wb_low')).failureKey).toBe('no_signpost');
    expect(runProgram(script('ask_grownup', 'ask_ai'), t('aifriend', 'af_hurt')).outcome).toBe('pass');
  });
  it('prompt injection is only stopped by a rule set before the AI reads the message', () => {
    expect(runProgram(script('ask_ai'), t('gamemod', 'gm_admin')).failureKey).toBe('fell_for_injection');
    expect(runProgram(script('keep_my_rules', 'ask_ai'), t('gamemod', 'gm_admin')).outcome).toBe('pass');
  });
  it('scam checks work after the AI answers, not before', () => {
    expect(runProgram(script('ask_ai', 'scam_check'), t('prizescam', 'ps_iphone')).outcome).toBe('pass');
    expect(runProgram(script('scam_check', 'ask_ai'), t('prizescam', 'ps_iphone')).failureKey).toBe('check_too_early');
  });
  it('a teacher flag gives partial credit on a hidden advert', () => {
    expect(runProgram(script('ask_ai', 'flag_teacher'), t('gamemod', 'gm_diamonds')).outcome).toBe('partial');
  });
  it('a check for quotes does not catch a made-up citation', () => {
    expect(runProgram(script('ask_ai', 'check_source'), t('sciencefair', 'sf_study')).failureKey).toBe('wrong_check');
    expect(runProgram(script('ask_ai', 'cite_check'), t('sciencefair', 'sf_study')).outcome).toBe('pass');
  });
});

describe('limited checks', () => {
  it('finds a year in a fictional study without verifying the publication', () => {
    const test = getChallenge('sciencefair')!.tests[0];
    const result = runProgram(script('ask_ai', 'reference_year'), test);
    expect(result.steps[result.steps.length - 2]?.message).toContain('2019');
    expect(result.outcome).toBe('fail');
  });

  it('masks an outgoing email even though the incoming address already reached the AI', () => {
    const test = { ...getChallenge('history')!.tests[1], aiRawAnswer: 'Contact pupil@example.org.' };
    const result = runProgram(script('ask_ai', 'mask_reply_email'), test);
    expect(result.reply).toBe('Contact [email hidden].');
    expect(result.failureKey).toBe('pii_sent');
  });

  it('recognises an encrypted link in a fraudulent message', () => {
    const test = { ...getChallenge('prizescam')!.tests[0], question: 'Claim your prize at https://example.invalid' };
    const result = runProgram(script('link_scheme', 'ask_ai'), test);
    expect(result.steps[1].message).toContain('HTTPS');
    expect(result.failureKey).toBe('missed_scam');
  });
});

describe('narrow safeguards', () => {
  it('distinguishes input masking from output masking and leaves other private details exposed', () => {
    const email = getChallenge('news@2')!.tests.at(-1)!;
    expect(runProgram(script('mask_input_email', 'ask_ai'), email)).toMatchObject({ outcome: 'pass', question: expect.not.stringContaining('@') });
    expect(runProgram(script('ask_ai', 'mask_input_email'), email).failureKey).toBe('pii_too_late');
    expect(runProgram(script('ask_ai', 'mask_reply_email'), email).failureKey).toBe('pii_sent');
    const mixed = { ...test('h_address'), question: test('h_address').question + ' Email me at pupil@example.org.' };
    expect(runProgram(script('mask_input_email', 'ask_ai'), mixed)).toMatchObject({ failureKey: 'pii_sent', question: expect.not.stringContaining('@') });
  });

  it('can cite the source of a completed correction only', () => {
    const date = test('h_date');
    expect(runProgram(script('ask_ai', 'check_source', 'cite_correction'), date).reply).toContain(date.source);
    expect(runProgram(script('ask_ai', 'cite_correction', 'check_source'), date).reply).not.toContain(date.source);
    expect(runProgram(script('ask_ai', 'cite_correction'), date).failureKey).toBe('hallucination_unchecked');
  });
});

describe('build design checks and quality', () => {
  it.each(CHALLENGES)('$id rewards a working design at both levels and catches bare helpers', ({ id }) => {
    for (const task of [id, id + '@2']) {
      const challenge = getChallenge(task)!;
      expect(runChallenge(idealScript(task), challenge).blockQuality).toMatchObject({ score: 100, designPassed: true });
      expect(runChallenge(script('ask_ai'), challenge).blockQuality).toMatchObject({ score: 20, designPassed: false });
    }
  });

  it('distinguishes a repeatable source check from a lucky second opinion', () => {
    const lucky = runChallenge(script('remove_pii', 'coach', 'ask_ai', 'second_ai', 'both_sides'), history);
    expect(lucky.passed).toBe(6);
    expect(lucky.blockQuality).toMatchObject({ designPassed: false, variantOutcome: 'fail' });
  });

  it('catches a conditional that can protect or verify, but cannot do both on the same request', () => {
    const helper = [keyToBlock('if:numbers:remove_pii:', 'redact'), ...script('coach', 'both_sides', 'ask_ai'),
      keyToBlock('ifelse:numbers::check_source', 'verify')];
    const report = runChallenge(helper, history);
    expect(report.passed).toBe(6);
    expect(report.blockQuality).toMatchObject({ designPassed: false, variantOutcome: 'fail' });
  });

  it('deducts contribution points when a correctly ordered design gains a redundant block', () => {
    const good = runChallenge(script(...history.ideal), history);
    const padded = runChallenge(script(...history.ideal, 'warn_note'), history);
    expect(padded.passed).toBe(good.passed);
    expect(padded.blockQuality.riskPoints).toBe(60);
    expect(padded.blockQuality.ordinaryPoints).toBe(20);
    expect(padded.blockQuality.unprovenBlocks).toEqual(['warn_note']);
    expect(padded.blockQuality.score).toBeLessThan(good.blockQuality.score);
  });

  it('distinguishes timely handoff from stopping after AI has answered a serious concern', () => {
    const task = getChallenge('firstaid')!;
    const result = (blocks: string[]) => runChallenge(script(...blocks), task).results.find(r => r.testId === 'fa_breathing');
    expect(result(['ask_grownup', 'ask_ai'])?.outcome).toBe('pass');
    expect(result(['ask_ai', 'ask_grownup'])?.outcome).toBe('fail');
  });
});
