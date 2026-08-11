const { chromium } = require('playwright');
const URL = 'http://localhost:8099/index.html';
const KEY = 'toeic600-v1';

function fmt(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function mondayOf(date){const d=new Date(date);const off=(d.getDay()+6)%7;d.setDate(d.getDate()-off);return fmt(d);}
function addDaysN(key,n){const [y,m,dd]=key.split('-').map(Number);return fmt(new Date(y,m-1,dd+n));}
const thisMon = mondayOf(new Date());
const lastMon = mondayOf(new Date(Date.now()-7*86400000));
const ym = fmt(new Date()).slice(0,7);

const results=[];
function check(name,cond,detail){results.push({name,pass:!!cond,detail});console.log(`${cond?'PASS':'FAIL'}  ${name}${detail?'  — '+detail:''}`);}

(async()=>{
  const b=await chromium.launch({args:['--no-sandbox']});
  const p=await b.newPage();
  const errors=[];
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  p.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));

  async function seedReload(seed){
    await p.goto(URL);
    await p.evaluate(([k,s])=>localStorage.setItem(k,JSON.stringify(s)),[KEY,seed]);
    await p.reload();
  }
  async function readState(){return await p.evaluate(()=>JSON.parse(localStorage.getItem('toeic600-v1')));}

  // 1) Weekly quests: fill the whole week generously so all 3 active quests complete
  const wlog={};
  for(let i=0;i<6;i++){wlog[addDaysN(thisMon,i)]={words:20,quiz:15,correct:12,listen:15,listenOk:10,read:5,readOk:4};}
  await seedReload({log:wlog, gems:0, monthly:{ym,points:0}});
  let st=await p.evaluate(()=>{window.checkWeeklyQuests();window.saveState();return JSON.parse(localStorage.getItem('toeic600-v1'));});
  check('1 weekly quests: all 3 claimed', st.weekly.claimed.length===3, `claimed=${st.weekly.claimed.length}`);
  check('1 weekly quests: gems awarded', st.gems>0, `gems=${st.gems}`);
  check('1 weekly quests: monthly points +3', st.monthly.points===3, `points=${st.monthly.points}`);

  // 2) Weekly quests idempotent (no double claim on re-run)
  st=await p.evaluate(()=>{const g=JSON.parse(localStorage.getItem('toeic600-v1')).gems;window.checkWeeklyQuests();window.saveState();const after=JSON.parse(localStorage.getItem('toeic600-v1'));return {before:g,after:after.gems,claimed:after.weekly.claimed.length};});
  check('2 weekly quests: no double-claim', st.claimed===3 && st.before===st.after, `gems ${st.before}->${st.after}`);

  // 3) Monthly badge awarded at target
  await seedReload({monthly:{ym,points:MONTHLYm1()},monthlyBadges:[],gems:0});
  st=await p.evaluate(()=>{window.addMonthlyPoints(1);window.saveState();return JSON.parse(localStorage.getItem('toeic600-v1'));});
  check('3 monthly badge: awarded at target', st.monthlyBadges.length===1 && st.monthlyBadges[0].ym===ym, `badges=${JSON.stringify(st.monthlyBadges)}`);
  check('3 monthly badge: +100 gems', st.gems===100, `gems=${st.gems}`);

  // 4) Ghost league rollover WIN (this week beat last week's ghost)
  await seedReload({league:{week:lastMon,xp:200,prevXp:100,pendingResult:null},gems:0});
  st=await readState();
  check('4 league WIN: +50 gems on rollover', st.gems===50, `gems=${st.gems}`);
  check('4 league WIN: ghost becomes 200, week reset', st.league.prevXp===200 && st.league.xp===0 && st.league.week===thisMon, `prev=${st.league.prevXp} xp=${st.league.xp}`);

  // 5) Ghost league rollover LOSE (no gems)
  await seedReload({league:{week:lastMon,xp:40,prevXp:100,pendingResult:null},gems:0});
  st=await readState();
  check('5 league LOSE: no bonus gems', st.gems===0 && st.league.prevXp===40, `gems=${st.gems} prev=${st.league.prevXp}`);

  // 6) addXp accumulates into this week's league bucket
  await seedReload({league:{week:thisMon,xp:10,prevXp:100,pendingResult:null}});
  st=await p.evaluate(()=>{window.addXp(5);window.saveState();return JSON.parse(localStorage.getItem('toeic600-v1'));});
  check('6 addXp: league.xp 10 -> 15', st.league.xp===15, `xp=${st.league.xp}`);

  // 7) home renders new card, no errors
  await seedReload({league:{week:thisMon,xp:120,prevXp:80,pendingResult:null},gems:60});
  const txt=await p.textContent('#league-text');
  check('7 home league text renders', /先週の自分を超えた|先週超え|記録を作ろう/.test(txt||''), `text="${txt}"`);

  check('no console/page errors', errors.length===0, errors.slice(0,5).join(' | '));

  await b.close();
  const failed=results.filter(r=>!r.pass);
  console.log(`\n${results.length-failed.length}/${results.length} passed`);
  process.exit(failed.length?1:0);

  function MONTHLYm1(){return 39;} // MONTHLY_TARGET(40) - 1
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
