const { mergeRollModes, rollProfiles } = require('../modifiers');
const { computeEffects } = require('../conditions');
const { makeSkills, makeCharacter } = require('../../rules/__helpers__/rules');

const mod = (over) => ({
  id: 'm1', target: 'intuition', mode: 'adv', value: 0, situational: false, note: '',
  node_title: 'Шосте чуття', ...over,
});

// Ефекти станів без жодного стану — щоб профіль лишався «чистим».
const cleanEffects = (conditions = []) =>
  computeEffects(conditions, makeSkills(), 'fighter', makeCharacter({ conditions }));

describe('mergeRollModes — розділ 1.1.4', () => {
  it('лишає звичайний кидок без факторів', () => {
    expect(mergeRollModes([])).toBe('normal');
  });

  it('перевага й перешкода нівелюють одне одного', () => {
    expect(mergeRollModes(['adv', 'dis'])).toBe('normal');
  });

  it('два однакові фактори роблять режим подвійним', () => {
    expect(mergeRollModes(['adv', 'adv'])).toBe('wadv');
    expect(mergeRollModes(['dis', 'dis'])).toBe('wdis');
  });

  it('потрійної переваги чи перешкоди не буває', () => {
    expect(mergeRollModes(['adv', 'adv', 'adv'])).toBe('wadv');
    expect(mergeRollModes(['dis', 'dis', 'dis', 'dis'])).toBe('wdis');
  });

  it('подвійний фактор важить удвічі й перебиває одинарний протилежний', () => {
    expect(mergeRollModes(['wadv', 'dis'])).toBe('adv');
    expect(mergeRollModes(['wdis', 'adv'])).toBe('dis');
    expect(mergeRollModes(['wadv', 'wdis'])).toBe('normal');
  });

  it('Баланс і Екстремум діють лише коли перевага з перешкодою знулилися', () => {
    expect(mergeRollModes(['bal'])).toBe('bal');
    expect(mergeRollModes(['ext'])).toBe('ext');
    expect(mergeRollModes(['adv', 'dis', 'bal'])).toBe('bal');
    expect(mergeRollModes(['adv', 'bal'])).toBe('adv');
  });

  it('Баланс і Екстремум разом нівелюються як протилежні режими', () => {
    expect(mergeRollModes(['bal', 'ext'])).toBe('normal');
  });

  it('ігнорує невідомі значення', () => {
    expect(mergeRollModes(['adv', 'bogus', undefined])).toBe('adv');
  });
});

describe('rollProfiles', () => {
  it('дає профіль на кожну з 20 навичок і 6 бойових цілей', () => {
    const profiles = rollProfiles([], cleanEffects(), makeSkills());
    expect(Object.keys(profiles)).toHaveLength(26);
    expect(profiles.evasion).toMatchObject({ die: 'd4', mode: 'normal', bonus: 0, d20: true });
  });

  it('вішає перевагу вузла на названу навичку й підписує джерело', () => {
    const profiles = rollProfiles([mod()], cleanEffects(), makeSkills());
    expect(profiles.intuition.mode).toBe('adv');
    expect(profiles.intuition.sources).toContain('Шосте чуття');
    expect(profiles.will.mode).toBe('normal');
  });

  it('нівелює перевагу вузла перешкодою Втоми 2 (правило 1.1.4)', () => {
    const profiles = rollProfiles([mod()], cleanEffects([{ type: 'fatigue', level: 2 }]), makeSkills());
    expect(profiles.intuition.mode).toBe('normal');
    // Гравець має бачити, що фактори були — просто знулилися.
    expect(profiles.intuition.sources).toEqual(expect.arrayContaining(['Втома 2', 'Шосте чуття']));
    // Навичка без модифікатора лишається з перешкодою.
    expect(profiles.will.mode).toBe('dis');
  });

  it('перешкода Втоми не чіпає рятівний кидок, таймер і Імунітет — вони не d20', () => {
    const profiles = rollProfiles([], cleanEffects([{ type: 'fatigue', level: 4 }]), makeSkills());
    expect(profiles.will.mode).toBe('wdis');
    expect(profiles.attack.mode).toBe('wdis');
    expect(profiles.death_save.mode).toBe('normal');
    expect(profiles.endurance_timer.mode).toBe('normal');
    expect(profiles.immunity_check.mode).toBe('normal');
    expect(profiles.initiative.mode).toBe('normal');
  });

  it('Втома зсуває ініціативу числом, а не режимом', () => {
    const profiles = rollProfiles([], cleanEffects([{ type: 'fatigue', level: 3 }]), makeSkills());
    expect(profiles.initiative.bonus).toBe(-3);
    expect(profiles.initiative.mode).toBe('normal');
  });

  it('кубик ініціативи береться з рівня Спритності', () => {
    const skills = makeSkills({ evasion: 12, acrobatics: 12, stealth: 12, sleight_of_hand: 12 });
    expect(rollProfiles([], cleanEffects(), skills).initiative.die).toBe('d20');
  });

  it('складає плоскі бонуси й піднімає ранг кубика', () => {
    const profiles = rollProfiles([
      mod({ target: 'strength', mode: 'bonus', value: 2, node_title: 'А' }),
      mod({ target: 'strength', mode: 'bonus', value: 1, node_title: 'Б' }),
      mod({ target: 'strength', mode: 'rank_up', value: 1, node_title: 'В' }),
    ], cleanEffects(), makeSkills());
    expect(profiles.strength.bonus).toBe(3);
    expect(profiles.strength.die).toBe('d6'); // d4 → на ранг вище
  });

  it('Майстерність за замовчуванням 1 кубик і зростає лише вузлами', () => {
    expect(rollProfiles([], cleanEffects(), makeSkills()).damage_dice.count).toBe(1);
    const profiles = rollProfiles([
      mod({ target: 'damage_dice', mode: 'bonus', value: 2, node_title: 'Вершина ремесла' }),
    ], cleanEffects(), makeSkills());
    expect(profiles.damage_dice.count).toBe(3);
    expect(profiles.damage_dice.sources).toContain('Вершина ремесла: +2');
  });

  it('ситуативний модифікатор не застосовується сам, а чекає на вибір гравця', () => {
    const profiles = rollProfiles([
      mod({ target: 'attack', situational: true, note: 'проти звірів', node_title: 'Месник' }),
    ], cleanEffects(), makeSkills());
    expect(profiles.attack.mode).toBe('normal');
    expect(profiles.attack.situational).toEqual([
      expect.objectContaining({ mode: 'adv', note: 'проти звірів', source: 'Месник' }),
    ]);
  });

  it('вимкнена Травмою навичка лишається недоступною попри модифікатор вузла', () => {
    const conditions = [{ type: 'trauma', level: 4, skill_keys: ['intuition'] }];
    const profiles = rollProfiles([mod()], cleanEffects(conditions), makeSkills());
    expect(profiles.intuition).toMatchObject({ disabled: true, die: null });
  });

  it('влучання власного кубика не має — його дає навичка зброї', () => {
    expect(rollProfiles([], cleanEffects(), makeSkills()).attack.die).toBeNull();
  });
});
