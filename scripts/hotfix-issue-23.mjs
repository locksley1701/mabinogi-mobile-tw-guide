import fs from 'node:fs';

const readJson = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const writeJson = (path, value) => fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const skillsPath = 'data/profession-skills.json';
const skills = readJson(skillsPath);
const swordsman = skills.swordsman;
if (!swordsman) throw new Error('Missing swordsman data');

const wrongSkill = swordsman.active.find(skill => skill.name === '鋼梭');
const alreadyCorrect = swordsman.active.find(skill => skill.name === '鋼楔');
if (!wrongSkill && !alreadyCorrect) throw new Error('Cannot find 鋼梭/鋼楔 skill');
if (wrongSkill) wrongSkill.name = '鋼楔';

for (const skill of [...swordsman.active, ...swordsman.passive]) {
  if (typeof skill.description === 'string') {
    skill.description = skill.description.replaceAll('鋼梭', '鋼楔');
  }
}
writeJson(skillsPath, skills);

const namesPath = 'data/names.json';
const names = readJson(namesPath);
const definitionId = 'combat-skill-swordsman-steel-wedge';
const existing = names.find(item => item.id === definitionId);
const definition = {
  id: definitionId,
  targetType: 'combatSkill',
  targetId: 'swordsman:鋼楔',
  scope: 'entity',
  canonical: '鋼楔',
  aliases: [{ name: '鋼梭', kind: 'common-typo' }],
  source: '台版遊戲內容'
};
if (existing) Object.assign(existing, definition);
else names.push(definition);
writeJson(namesPath, names);

const validatorPath = 'scripts/validate-name-normalization.mjs';
let validator = fs.readFileSync(validatorPath, 'utf8');
if (!validator.includes("['鋼梭', '鋼楔']")) {
  validator = validator.replace(
    "  ['攜著吃的點心', '擠著吃的點心']",
    "  ['攜著吃的點心', '擠著吃的點心'],\n  ['鋼梭', '鋼楔']"
  );
}
fs.writeFileSync(validatorPath, validator, 'utf8');

const changelogPath = 'data/changelog.json';
const changelog = readJson(changelogPath);
if (!changelog.some(item => item.item === '劍術士技能名稱更正')) {
  changelog.unshift({
    date: '2026-07-29',
    item: '劍術士技能名稱更正',
    change: '依台版遊戲內容將誤植的「鋼梭」更正為正式名稱「鋼楔」，並同步修正秘劍與集中技能說明；原誤稱僅保留為搜尋別名。',
    basis: '法那提歐實機核對'
  });
}
writeJson(changelogPath, changelog);

const serialized = fs.readFileSync(skillsPath, 'utf8');
if (serialized.includes('鋼梭')) throw new Error('profession-skills.json still contains 鋼梭');

fs.rmSync('scripts/hotfix-issue-23.mjs');
fs.rmSync('.github/workflows/hotfix-issue-23.yml');
console.log('Issue #23 data correction applied.');
