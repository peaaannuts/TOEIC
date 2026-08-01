const { chromium } = require('playwright');
const URL = 'http://localhost:8099/index.html';

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL);

  const cases = await page.evaluate(() => {
    return [1, 19, 20, 21, 22, 24, 25, 29, 30, 79, 80, 99, 100, 150].map((lv) => [lv, titleForLevel(lv)]);
  });
  const map = Object.fromEntries(cases);

  check('レベル22は600点スレイヤーのまま(25未満)', map[22] === '600点スレイヤー', JSON.stringify(map[22]));
  check('レベル24は600点スレイヤーのまま', map[24] === '600点スレイヤー', JSON.stringify(map[24]));
  check('レベル25で伝説の受験者に進化', map[25] === '伝説の受験者', JSON.stringify(map[25]));
  check('レベル29はまだ伝説の受験者', map[29] === '伝説の受験者', JSON.stringify(map[29]));
  check('レベル30で730点ハンターに進化(以前は100まで伝説の受験者のままだった不具合の修正)',
    map[30] === '730点ハンター', JSON.stringify(map[30]));
  check('レベル80は満点ハンター', map[80] === '満点ハンター', JSON.stringify(map[80]));
  check('レベル99はまだ990点の覇者', map[99] === '990点の覇者', JSON.stringify(map[99]));
  check('レベル100でTOEICの神(最終称号)に到達', map[100] === 'TOEICの神', JSON.stringify(map[100]));
  check('レベル100超も最終称号のまま(配列末尾を維持)', map[150] === 'TOEICの神', JSON.stringify(map[150]));

  // TITLES配列自体の健全性(重複無し・レベル昇順・レベル100を含む)
  const meta = await page.evaluate(() => ({
    levels: TITLES.map((t) => t[0]),
    names: TITLES.map((t) => t[1]),
    hasLevel100: TITLES.some((t) => t[0] === 100),
  }));
  const sorted = [...meta.levels].sort((a, b) => a - b);
  check('TITLES配列はレベル昇順に並んでいる', JSON.stringify(meta.levels) === JSON.stringify(sorted), JSON.stringify(meta.levels));
  check('TITLESの称号名に重複が無い', new Set(meta.names).size === meta.names.length, JSON.stringify(meta.names));
  check('TITLESにレベル100のエントリが含まれる', meta.hasLevel100);

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
