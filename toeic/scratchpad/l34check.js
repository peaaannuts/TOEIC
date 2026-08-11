const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--no-sandbox']});
  const p=await b.newPage();
  const errors=[]; p.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); p.on('pageerror',e=>errors.push('PE:'+e.message));
  await p.goto('http://localhost:8099/index.html');
  // stub TTS so playback doesn't hang, and force distinct voices path harmlessly
  await p.evaluate(()=>{ let onend=null;
    window.speechSynthesis.speak=(u)=>{ if(u&&u.onend) setTimeout(()=>u.onend(),1); };
    window.speechSynthesis.cancel=()=>{};
    window.speechSynthesis.getVoices=()=>[]; });
  const info=await p.evaluate(()=>({p3:PART3.length,p4:PART4.length}));
  console.log('PART3/PART4 loaded:',info.p3,'/',info.p4);
  await p.click('[data-tab="listen"]'); await p.waitForTimeout(150);
  const sum3=await p.textContent('#part3-summary'); console.log('part3-summary:', (sum3||'').replace(/\s+/g,' ').trim());
  // start Part 3
  await p.click('#part3-start-btn'); await p.waitForTimeout(300);
  const sessionVisible=await p.evaluate(()=>!document.getElementById('listen34-session').classList.contains('hidden'));
  console.log('Part3 session visible:', sessionVisible);
  // answer all questions until result appears (2 conversations x 3 = 6)
  let answered=0;
  for(let i=0;i<12;i++){
    const done=await p.evaluate(()=>!document.getElementById('listen34-result').classList.contains('hidden'));
    if(done) break;
    const hasChoices=await p.$('#listen34-choices .choice-btn');
    if(hasChoices){ await p.click('#listen34-choices .choice-btn'); answered++; await p.waitForTimeout(80);
      // click next
      await p.click('#listen34-next-btn').catch(()=>{}); await p.waitForTimeout(120); }
    else { await p.waitForTimeout(120); }
  }
  const resultVisible=await p.evaluate(()=>!document.getElementById('listen34-result').classList.contains('hidden'));
  const resultText=await p.textContent('#listen34-result-text').catch(()=>'');
  console.log('answered questions:',answered,' result visible:',resultVisible);
  console.log('result text:', (resultText||'').replace(/\s+/g,' ').trim().slice(0,80));
  // estimate score includes part3: seed part3Stats and check listening estimate not null
  const est=await p.evaluate(()=>{ state.part3Stats={0:{lv:1,next:todayKey(),seen:12,ok:9}}; return estimateScore(); });
  console.log('estimateScore listenSeen:',est.listenSeen,' listen:',est.listen);
  console.log('console errors:',errors.length, errors.slice(0,4).join(' | '));
  await b.close(); process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
