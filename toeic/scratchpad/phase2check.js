const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const p=await b.newPage();
  const errors=[]; p.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); p.on('pageerror',e=>errors.push('PE:'+e.message));
  await p.goto('http://localhost:8099/index.html');

  // 文法1セット: ドット生成・正誤マーキング・初回ミスでperfect解除を確認
  await p.click('[data-tab="quiz"]'); await p.waitForTimeout(120);
  await p.click('#quiz-start-btn'); await p.waitForTimeout(150);
  const dotCount = await p.$$eval('#quiz-qdots .qdot', els => els.length);
  const perfectAtStart = await p.evaluate(() => document.getElementById('quiz-qdots').classList.contains('perfect'));
  console.log('quiz dots created:', dotCount, '(expect 10) | perfect at start:', perfectAtStart);

  let firstMissSeen = false;
  let answered = 0;
  for (let i=0;i<15;i++){
    const done = await p.evaluate(()=>!document.getElementById('quiz-result').classList.contains('hidden'));
    if (done) break;
    const btns = await p.$$('#quiz-choices .choice-btn:not([disabled])');
    if (btns.length) {
      // 意図的に最初の選択肢(不正解の可能性が高い)を押して、少なくとも1回は誤答を作る
      await btns[0].click();
      answered++;
      await p.waitForTimeout(60);
      const perfectNow = await p.evaluate(() => document.getElementById('quiz-qdots').classList.contains('perfect'));
      if (!perfectNow && !firstMissSeen) { firstMissSeen = true; console.log('perfect broke at answer #' + answered); }
      await p.click('#quiz-next-btn').catch(()=>{});
      await p.waitForTimeout(70);
    } else await p.waitForTimeout(70);
  }
  const hitCount = await p.$$eval('#quiz-qdots .qdot.hit', els => els.length);
  const missCount = await p.$$eval('#quiz-qdots .qdot.miss', els => els.length);
  const upcomingLeft = await p.$$eval('#quiz-qdots .qdot.upcoming', els => els.length);
  console.log('answered:', answered, '| hit:', hitCount, '| miss:', missCount, '| upcoming left:', upcomingLeft, '| first-miss detected:', firstMissSeen);
  const label = await p.textContent('#quiz-qdots-label').catch(()=>null);
  console.log('label text (should be empty since a miss occurred):', JSON.stringify(label));

  // Part 3/4: バッチ採点で複数ドットが一度に確定するか
  await p.evaluate(()=>{ window.speechSynthesis.speak=(u)=>{if(u&&u.onend)setTimeout(()=>u.onend(),1);}; window.speechSynthesis.cancel=()=>{}; window.speechSynthesis.getVoices=()=>[]; });
  await p.click('[data-tab="listen"]'); await p.waitForTimeout(120);
  await p.click('#part3-start-btn'); await p.waitForTimeout(300);
  const l34DotsTotal = await p.$$eval('#listen34-qdots .qdot', els => els.length);
  console.log('listen34 dots created (expect sum of qs over 2 sets):', l34DotsTotal);
  // answer all 3 in first set
  for (const btn of await p.$$('#listen34-choices .choice-btn')) {} // no-op placeholder
  const blocks = await p.$$('#listen34-questions .l34-qblock');
  for (const bl of blocks) { const c = await bl.$('.choice-btn'); await c.click(); await p.waitForTimeout(30); }
  await p.click('#listen34-check-btn'); await p.waitForTimeout(500); // wait for staggered reveal
  const l34Hit = await p.$$eval('#listen34-qdots .qdot.hit', els => els.length);
  const l34Miss = await p.$$eval('#listen34-qdots .qdot.miss', els => els.length);
  console.log('after grading set1: hit+miss =', l34Hit + l34Miss, '(expect 3, first set size)');

  console.log('console errors:', errors.length, errors.slice(0,6).join(' | '));
  await b.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e=>{console.error(e);process.exit(2);});
