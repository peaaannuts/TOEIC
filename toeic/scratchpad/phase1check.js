const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const p=await b.newPage();
  const errors=[]; p.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); p.on('pageerror',e=>errors.push('PE:'+e.message));
  await p.goto('http://localhost:8099/index.html');

  // 文法クイズで確認: xp-float / combo-chip / pop-correct
  await p.click('[data-tab="quiz"]'); await p.waitForTimeout(120);
  await p.click('#quiz-start-btn'); await p.waitForTimeout(200);
  // answer correctly 3 times in a row to build combo
  for (let i=0;i<3;i++){
    const correctBtn = await p.$('#quiz-choices .choice-btn'); // first isn't necessarily correct; find via data check after click all disabled? simpler: click any then check
    await p.waitForTimeout(50);
    break;
  }
  // Simplify: just answer 3 questions, check floatXp appears and combo chip becomes visible if 2+ streak achieved by luck is unreliable.
  // Instead directly test helpers via page.evaluate
  const t1 = await p.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="__anchor" style="position:fixed;top:100px;left:100px;width:40px;height:20px;">x</button>');
    const anchor = document.getElementById('__anchor');
    floatXp(anchor, 10, 'good');
    return document.querySelectorAll('.xp-float').length;
  });
  console.log('xp-float created:', t1);
  await p.waitForTimeout(1100);
  const t1b = await p.evaluate(() => document.querySelectorAll('.xp-float').length);
  console.log('xp-float after 1.1s (expect 0):', t1b);

  const t2 = await p.evaluate(() => {
    renderComboChip('quiz-combo-chip', 3);
    const el = document.getElementById('quiz-combo-chip');
    return { hidden: el.classList.contains('hidden'), text: el.textContent, hot: el.classList.contains('hot') };
  });
  console.log('combo chip @3:', JSON.stringify(t2));
  const t3 = await p.evaluate(() => {
    renderComboChip('quiz-combo-chip', 0);
    return document.getElementById('quiz-combo-chip').classList.contains('hidden');
  });
  console.log('combo chip hidden @0:', t3);

  // choice-btn animation check
  const anim = await p.evaluate(() => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn correct';
    document.body.appendChild(btn);
    const cs = getComputedStyle(btn);
    const name = cs.animationName;
    btn.remove();
    return name;
  });
  console.log('.choice-btn.correct animation-name:', anim);

  // seSoft callable without throwing
  const soundOk = await p.evaluate(() => { try { seSoft(); return true; } catch(e){ return e.message; } });
  console.log('seSoft() callable:', soundOk);

  console.log('console errors:', errors.length, errors.slice(0,5).join(' | '));
  await b.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e=>{console.error(e);process.exit(2);});
