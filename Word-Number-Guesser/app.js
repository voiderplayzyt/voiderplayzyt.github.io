(()=>{'use strict';
const $=id=>document.getElementById(id);
const el={wordMode:$('wordMode'),numberMode:$('numberMode'),wordSetup:$('wordSetup'),numberSetup:$('numberSetup'),topic:$('topic'),wordLength:$('wordLength'),digits:$('digits'),min:$('minNumber'),max:$('maxNumber'),secretDifficulty:$('secretDifficulty'),secretModeRow:$('secretModeRow'),customSetup:$('customSetup'),customWords:$('customWords'),customFile:$('customFile'),poolInfo:$('poolInfo'),configStatus:$('configStatus'),secretValue:$('secretValue'),secretCaption:$('secretCaption'),revealSecret:$('revealSecret'),friendGuess:$('friendGuess'),judgeResult:$('judgeResult'),remainingCount:$('remainingCount'),attemptsCount:$('attemptsCount'),nextMetric:$('nextMetric'),solverState:$('solverState'),solverGuess:$('solverGuess'),exactTab:$('exactTab'),countsTab:$('countsTab'),exactFeedback:$('exactFeedback'),countsFeedback:$('countsFeedback'),editableTiles:$('editableTiles'),codeFeedback:$('codeFeedback'),green:$('greenCount'),yellow:$('yellowCount'),red:$('redCount'),total:$('countTotalText'),feedbackMessage:$('feedbackMessage'),candidateList:$('candidateList'),historyList:$('historyList')};
const state={mode:'WORD',feedback:'exact',all:[],possible:[],secret:'',secretVisible:false,suggested:'',history:[],busy:false,sequence:0};
const lengthCounts={"2":475,"3":2815,"4":8384,"5":18582,"6":29270,"7":35186,"8":34075,"9":30560,"10":24897,"11":17822,"12":11954,"13":7562,"14":4282,"15":2352,"16":1192,"17":581,"18":240,"19":112,"20":25};
const TOTAL_WORDS=230366;
const dictionaryCache=new Map();
let nounsPromise=null;
let nounTypesPromise=null;
async function getNounType(topic,n){
 if(!nounTypesPromise){
  nounTypesPromise=(async()=>{
   const path='dictionary/noun-types.json';
   const response=await fetch(path);
   if(!response.ok)throw Error(`Could not load ${path} (HTTP ${response.status}). Upload the noun-types.json file.`);
   const value=await response.json();
   if(!value||!value.categories||!value.categories.NOUN_SINGULAR||!value.categories.NOUN_PLURAL)throw Error('Noun categories data is missing or invalid.');
   return value.categories;
  })();
 }
 try{
  const categories=await nounTypesPromise;
  if(!Array.isArray(categories[topic]))throw Error('Unknown noun topic: '+topic);
  return categories[topic].filter(w=>w.length===n);
 }catch(e){nounTypesPromise=null;throw e;}
}
const isExtendedTopic=()=>state.mode==='WORD'&&(el.topic.value==='NORMAL'||el.topic.value.startsWith('NOUN_'));

for(let n=2;n<=20;n++){const opt=document.createElement('option');opt.value=String(n);opt.textContent=`${n} letters (${lengthCounts[n].toLocaleString()} words)`;if(n===5)opt.selected=true;el.wordLength.append(opt);}
for(let n=1;n<=8;n++){const opt=document.createElement('option');opt.value=String(n);opt.textContent=n+' digit'+(n===1?'':'s');if(n===4)opt.selected=true;el.digits.append(opt);}
const normalize=x=>String(x||'').trim().toUpperCase();
const sums=c=>[c.split('').filter(x=>x==='G').length,c.split('').filter(x=>x==='Y').length];
const take=(a,n)=>a.length<=n?a:a.length>0?Array.from({length:n},(_,i)=>a[Math.min(a.length-1,Math.floor((i+.5)*a.length/n))]):[];
const random=(a)=>a[Math.floor(Math.random()*a.length)];
const wordLen=()=>Number(el.wordLength.value);
const len=()=>state.mode==='WORD'?wordLen():Number(el.digits.value);
const goodChars=s=>state.mode==='WORD'?/^[A-Z]+$/.test(s):/^[0-9]+$/.test(s);
const filterLetters=(value)=>value.toUpperCase().replace(state.mode==='WORD'?/[^A-Z]/g:/[^0-9]/g,'').slice(0,len());
const cleanList=arr=>Array.from(new Set(arr.map(normalize).filter(x=>x.length===len()&&/^[A-Z]+$/.test(x)))).sort();
function feedback(secret,guess){
 const out=Array(guess.length).fill('R'),remaining={};
 for(let i=0;i<guess.length;i++){
  if(secret[i]===guess[i])out[i]='G';
  else remaining[secret[i]]=(remaining[secret[i]]||0)+1;
 }
 for(let i=0;i<guess.length;i++)if(out[i]==='R'&&(remaining[guess[i]]||0)>0){out[i]='Y';remaining[guess[i]]--;}
 return out.join('');
}
function fail(message){el.poolInfo.textContent=message;say(message,'error');}
function say(msg,variant=''){el.feedbackMessage.textContent=msg;el.feedbackMessage.className='message'+(variant?' '+variant:'');}
async function getDictionary(n){
 if(dictionaryCache.has(n))return dictionaryCache.get(n);
 const promise=(async()=>{
  const path=`dictionary/words-${n}.txt`;
  const response=await fetch(path);
  if(!response.ok)throw Error(`Could not load ${path} (HTTP ${response.status}). Upload the entire dictionary/ folder.`);
  const raw=await response.text();
  const words=raw.split(/\s+/).map(w=>w.trim().toUpperCase()).filter(w=>w.length===n&&/^[A-Z]+$/.test(w));
  if(!words.length)throw Error(`Dictionary ${path} is empty or invalid.`);
  return [...new Set(words)].sort();
 })();
 dictionaryCache.set(n,promise);
 try{return await promise;}catch(e){dictionaryCache.delete(n);throw e;}
}
async function getNouns(n){
 if(!nounsPromise){
  nounsPromise=(async()=>{
   const path='dictionary/nouns.txt';
   const response=await fetch(path);
   if(!response.ok)throw Error(`Could not load ${path} (HTTP ${response.status}). Upload the nouns.txt file.`);
   const text=await response.text();
   return [...new Set(text.split(/\s+/).map(w=>w.trim().toUpperCase()).filter(w=>/^[A-Z]{2,20}$/.test(w)))].sort();
  })();
 }
 try{return (await nounsPromise).filter(w=>w.length===n);}
 catch(e){nounsPromise=null;throw e;}
}
function parseCustom(){return el.customWords.value.toUpperCase().split(/[^A-Z]+/).filter(Boolean);}
async function createPool(){
 if(state.mode==='WORD'){
  const n=len(),topic=el.topic.value;
  if(topic==='NORMAL')return await getDictionary(n);
   if(topic==='NOUNS')return await getNounType('NOUN_SINGULAR',n);
   if(topic.startsWith('NOUN_'))return await getNounType(topic,n);
  if(topic==='CUSTOM')return cleanList(parseCustom());
  const words=topic==='ALL_TOPICS'?Object.values(TOPIC_WORDS).flat():TOPIC_WORDS[topic]||[];
  return cleanList(words);
 }
 const n=len(),a=Number(el.min.value),b=Number(el.max.value),upper=10**n-1;
 if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||a>upper||b<0||b>upper||b<a)throw Error(`Enter whole-number bounds from 0 to ${upper}, with minimum ≤ maximum.`);
 if(b-a+1>100000)throw Error('Select a maximum of 100,000 numbers at a time. Narrow the range.');
 return Array.from({length:b-a+1},(_,i)=>String(a+i).padStart(n,'0'));
}
function secretCandidates(){
 if(!isExtendedTopic()||el.secretDifficulty.value==='ALL')return state.all;
 const allowed=new Set(state.all),common=Object.values(TOPIC_WORDS).flat().filter(w=>allowed.has(w));
 return common.length?[...new Set(common)]:state.all;
}
function placeTiles(container,guess,code,clickable=false){
 container.replaceChildren();
 for(let i=0;i<guess.length;i++){
  const t=document.createElement(clickable?'button':'span'),mark=code[i]||'R';
  t.className='tile '+mark.toLowerCase()+(clickable?' clickable':'');t.dataset.feedback=mark;t.textContent=guess[i];
  if(clickable){t.type='button';t.setAttribute('aria-label',`Position ${i+1} ${guess[i]}, ${mark==='G'?'green':mark==='Y'?'yellow':'red'}. Click to cycle.`);
   t.addEventListener('click',()=>{let arr=el.codeFeedback.value.split('');arr[i]=arr[i]==='R'?'Y':arr[i]==='Y'?'G':'R';setColors(arr.join(''));});}
  container.append(t);
 }
}
function setColors(code){el.codeFeedback.value=code;paintEditor();}
function paintEditor(){const guess=normalize(el.solverGuess.value).padEnd(len(),'·').slice(0,len());const code=(el.codeFeedback.value||'').padEnd(len(),'R').slice(0,len());placeTiles(el.editableTiles,guess,code,true);}
function showSecret(){el.secretValue.textContent=state.secretVisible?state.secret:'•'.repeat(len());el.secretValue.classList.toggle('hidden',!state.secretVisible);el.secretCaption.textContent=state.secretVisible?'Keep this away from your friend':'Hidden — reveal only when you’re ready';el.revealSecret.textContent=state.secretVisible?'◉ Hide secret':'◉ Reveal secret';}
function updateCounts(){const g=Number(el.green.value),y=Number(el.yellow.value),r=len()-g-y;el.red.value=r>=0?String(r):'—';el.total.textContent=`${len()} tiles total`+(r<0?' · TOO MANY COLORS':'');}
function validateGuess(s){if(s.length!==len()||!goodChars(s))throw Error(`Guess must be exactly ${len()} ${state.mode==='WORD'?'letters':'digits'}.`);}
function startingGuess(){
 if(!isExtendedTopic()||state.history.length)return null;
 const starts={3:'ARE',4:'RATE',5:'SLATE',6:'CANDLE',7:'STATION',8:'TRIANGLE',9:'CHOCOLATE',10:'UNDERSTAND'};
 const w=starts[len()];return w&&state.all.includes(w)?w:null;
}
function bestGuess(candidates){
 if(!candidates.length)return '';
 if(candidates.length===1)return candidates[0];
 const first=startingGuess();if(first)return first;
 // Large candidate pools are sampled for interactive performance.
 const targets=take(candidates,Math.min(250,candidates.length));
 let guessCandidates=take(candidates,Math.min(95,candidates.length));
 if(state.mode==='WORD'&&candidates.length>300){
  const common=Object.values(TOPIC_WORDS).flat().filter(w=>w.length===len());
  const extras=take([...new Set(common)].sort(),90);
  guessCandidates=[...new Set(guessCandidates.concat(extras))];
 }
 let best=guessCandidates[0],bestScore=-Infinity;
 const possibleSet=new Set(candidates.length<=300?candidates:[]);
 for(const guess of guessCandidates){
  const buckets=new Map();
  for(const answer of targets){const pattern=feedback(answer,guess),key=state.feedback==='exact'?pattern:sums(pattern).join(':');buckets.set(key,(buckets.get(key)||0)+1);}
  let score=0;for(const count of buckets.values()){const p=count/targets.length;score-=p*Math.log2(p);}
  score+=0.001*new Set(guess).size;
  if(possibleSet.has(guess))score+=0.02;
  if(score>bestScore){bestScore=score;best=guess;}
 }
 return best;
}
function suggest(force=false){
 if(state.busy||!state.possible.length){state.suggested='';el.nextMetric.textContent='—';return;}
 const current=normalize(el.solverGuess.value);
 if(force||current.length!==len()||!goodChars(current)){
  state.suggested=bestGuess(state.possible);el.solverGuess.value=state.suggested;
 }
 el.nextMetric.textContent=state.suggested||current||'—';paintEditor();
}
function render(){
 el.remainingCount.textContent=state.possible.length.toLocaleString();el.attemptsCount.textContent=state.history.length;
 el.solverState.textContent=state.busy?'LOADING DICTIONARY':state.possible.length===1?'ONE ANSWER LEFT':state.history.length?'CLUES APPLIED':'READY TO GUESS';
 el.candidateList.replaceChildren();
 const shown=take(state.possible,80);
 for(const word of shown){const e=document.createElement('span');e.className='candidate';e.textContent=word;el.candidateList.append(e);}
 if(!shown.length){const e=document.createElement('div');e.className='empty-state';e.textContent='No possibilities loaded.';el.candidateList.append(e);}
 if(state.possible.length>80){const e=document.createElement('div');e.className='empty-state';e.textContent=`Showing 80 examples from ${state.possible.length.toLocaleString()} possibilities`;el.candidateList.append(e);}
 el.historyList.replaceChildren();
 if(!state.history.length){const e=document.createElement('div');e.className='empty-state';e.textContent='No guesses yet.';el.historyList.append(e);}
 for(let i=state.history.length-1;i>=0;i--){
  const r=state.history[i],row=document.createElement('div'),left=document.createElement('div'),idx=document.createElement('span'),count=document.createElement('span');
  row.className='history-item';left.className='history-left';idx.className='history-number';idx.textContent='#'+(i+1);left.append(idx);
  if(r.kind==='exact'){const t=document.createElement('div');t.className='tiles';placeTiles(t,r.guess,r.code);for(const child of t.children)child.classList.add('wide');left.append(t);}
  else{const strong=document.createElement('strong');strong.textContent=r.guess;left.append(strong);}
  count.className='history-count';count.textContent=r.kind==='counts'?`${r.green}🟩 ${r.yellow}🟨`:'IN ORDER';row.append(left,count);el.historyList.append(row);
 }
}
function setupPlaceholders(){const example=state.mode==='WORD'?'TIGER':'5678';el.solverGuess.placeholder=example.slice(0,len()).padEnd(len(),state.mode==='WORD'?'A':'0');el.friendGuess.placeholder=el.solverGuess.placeholder;el.friendGuess.maxLength=len();el.solverGuess.maxLength=len();el.codeFeedback.maxLength=len();el.green.max=len();el.yellow.max=len();}
function isMatch(answer,entry){const pattern=feedback(answer,entry.guess);if(entry.kind==='exact')return pattern===entry.code;const [g,y]=sums(pattern);return g===entry.green&&y===entry.yellow;}
async function newRound(){
 const current=++state.sequence;state.busy=true;el.poolInfo.textContent=state.mode==='WORD'&&el.topic.value==='NORMAL'?`Loading ${lengthCounts[wordLen()].toLocaleString()} words of length ${wordLen()}…`:'Preparing round…';el.configStatus.textContent=state.mode==='WORD'?'WORD • '+el.topic.value:`NUMBER • ${el.digits.value} DIGITS`;
 el.secretModeRow.classList.toggle('hidden-section',!isExtendedTopic());
 el.customSetup.classList.toggle('hidden-section',state.mode!=='WORD'||el.topic.value!=='CUSTOM');
 try{
  const all=await createPool();if(current!==state.sequence)return;
  if(!all.length)throw Error(`No ${len()}-${state.mode==='WORD'?'letter words':'digit numbers'} found for this selection. Try a different length or topic.`);
  state.all=all;state.possible=all.slice();state.history=[];state.secret=random(secretCandidates());state.secretVisible=false;
  state.busy=false;el.friendGuess.value='';el.judgeResult.replaceChildren();el.solverGuess.value='';el.codeFeedback.value='R'.repeat(len());el.green.value=0;el.yellow.value=0;updateCounts();setupPlaceholders();showSecret();render();suggest(true);
  el.poolInfo.textContent=`${state.all.length.toLocaleString()} possible ${state.mode==='WORD'?'words':'numbers'} of ${len()} ${state.mode==='WORD'?'letters':'digits'}.`+(state.mode==='WORD'&&el.topic.value==='NORMAL'?` Bundled dictionary: ${TOTAL_WORDS.toLocaleString()} entries total.`:state.mode==='WORD'&&el.topic.value.startsWith('NOUN_')?' WordNet-based noun-only category; verb forms excluded.':'');
  say('New round started! Try the suggestion, then enter the feedback.','good');
 }catch(e){if(current!==state.sequence)return;state.busy=false;state.all=[];state.possible=[];state.secret='';state.suggested='';el.nextMetric.textContent='—';render();fail(e.message+(location.protocol==='file:'?' Run this website on GitHub Pages or a local HTTP server (not by double-clicking the HTML).':''));}
}
function switchMode(mode){state.mode=mode;const word=mode==='WORD';el.wordMode.classList.toggle('active',word);el.numberMode.classList.toggle('active',!word);el.wordMode.setAttribute('aria-pressed',String(word));el.numberMode.setAttribute('aria-pressed',String(!word));el.wordSetup.classList.toggle('hidden-section',!word);el.numberSetup.classList.toggle('hidden-section',word);newRound();}
function switchFeedback(mode){state.feedback=mode;const exact=mode==='exact';el.exactTab.classList.toggle('active',exact);el.countsTab.classList.toggle('active',!exact);el.exactTab.setAttribute('aria-pressed',String(exact));el.countsTab.setAttribute('aria-pressed',String(!exact));el.exactFeedback.classList.toggle('hidden-section',!exact);el.countsFeedback.classList.toggle('hidden-section',exact);if(!state.busy&&state.possible.length){el.solverGuess.value='';suggest(true);}}
function applyClue(){
 if(state.busy){say('Dictionary is still loading.','warn');return;}
 if(!state.possible.length){say('No candidates loaded. Start a new round.','error');return;}
 const guess=normalize(el.solverGuess.value);try{validateGuess(guess);}catch(e){say(e.message,'error');return;}
 let entry;
 if(state.feedback==='exact'){
  const code=el.codeFeedback.value.toUpperCase().replace(/\s/g,'');
  if(code.length!==len()||/[^GYR]/.test(code)){say('Enter G, Y or R for every tile.','error');return;}
  entry={kind:'exact',guess,code};
 }else{
  const g=Number(el.green.value),y=Number(el.yellow.value);
  if(!Number.isInteger(g)||!Number.isInteger(y)||g<0||y<0||g+y>len()){say('Green and yellow totals must be whole numbers adding up to the word length or less.','error');return;}
  entry={kind:'counts',guess,green:g,yellow:y};
 }
 const kept=state.possible.filter(ans=>isMatch(ans,entry));
 if(!kept.length){say('No answers match this clue. Check feedback, duplicate letters, the selected topic, and word length. Clue was NOT saved.','error');return;}
 state.history.push(entry);state.possible=kept;render();
 if(entry.kind==='exact'&&entry.code==='G'.repeat(len())||entry.kind==='counts'&&entry.green===len()){
  state.suggested=guess;el.nextMetric.textContent=guess;say(`🎉 Solved in ${state.history.length} guesses! Answer: ${guess}`,'good');return;
 }
 el.solverGuess.value='';el.codeFeedback.value='R'.repeat(len());el.green.value=0;el.yellow.value=0;updateCounts();suggest(true);
 say(`${kept.length.toLocaleString()} possible answer${kept.length===1?'':'s'} left. Suggested guess: ${state.suggested}.`,'good');
}
function undo(){if(!state.history.length){say('Nothing to undo.','warn');return;}state.history.pop();state.possible=state.all.slice();for(const item of state.history)state.possible=state.possible.filter(answer=>isMatch(answer,item));el.solverGuess.value='';el.codeFeedback.value='R'.repeat(len());render();suggest(true);say('Last clue removed. All matching candidates restored.','good');}
function judge(){
 if(state.busy||!state.secret){el.judgeResult.textContent='Wait for a valid round to load.';return;}
 const guess=normalize(el.friendGuess.value);try{validateGuess(guess);}catch(e){el.judgeResult.textContent=e.message;el.judgeResult.style.color='var(--red)';return;}
 const code=feedback(state.secret,guess),[g,y]=sums(code);el.judgeResult.replaceChildren();el.judgeResult.style.color='';
 const t=document.createElement('div');t.className='tiles';placeTiles(t,guess,code);const count=document.createElement('div');count.className='note';count.textContent=`${g} green • ${y} yellow • ${len()-g-y} red | ${code}`;el.judgeResult.append(t,count);
}
function updateBounds(){const n=len(),first=n===1?0:10**(n-1),last=Math.min(10**n-1,first+9999);el.min.min='0';el.max.min='0';el.min.max=String(10**n-1);el.max.max=String(10**n-1);el.min.value=String(first);el.max.value=String(last);newRound();}
el.wordMode.addEventListener('click',()=>switchMode('WORD'));el.numberMode.addEventListener('click',()=>switchMode('NUMBER'));
el.topic.addEventListener('change',newRound);el.secretDifficulty.addEventListener('change',()=>{if(isExtendedTopic())newRound();});el.wordLength.addEventListener('change',newRound);el.digits.addEventListener('change',updateBounds);el.min.addEventListener('change',newRound);el.max.addEventListener('change',newRound);el.customWords.addEventListener('change',()=>{if(el.topic.value==='CUSTOM')newRound();});
el.customFile.addEventListener('change',async()=>{const f=el.customFile.files?.[0];if(!f)return;el.customWords.value=await f.text();if(el.topic.value==='CUSTOM')newRound();});
$('newRound').addEventListener('click',newRound);
$('resetSolver').addEventListener('click',()=>{if(!state.all.length)return;state.history=[];state.possible=state.all.slice();el.solverGuess.value='';el.codeFeedback.value='R'.repeat(len());render();suggest(true);say('Clues reset. Your secret stays the same.','good');});
el.revealSecret.addEventListener('click',()=>{state.secretVisible=!state.secretVisible;showSecret();});
$('rerollSecret').addEventListener('click',()=>{if(!state.secret)return;state.secret=random(secretCandidates());state.secretVisible=false;showSecret();el.judgeResult.replaceChildren();say('Secret rerolled. Guesser clues were kept.','good');});
$('copySecret').addEventListener('click',async()=>{if(!state.secret)return;try{await navigator.clipboard.writeText(state.secret);el.secretCaption.textContent='Copied! Share privately with your opponent.';}catch{state.secretVisible=true;showSecret();el.secretCaption.textContent='Clipboard unavailable; copy the revealed secret.';}});
$('judgeBtn').addEventListener('click',judge);el.friendGuess.addEventListener('keydown',event=>{if(event.key==='Enter')judge();});
el.exactTab.addEventListener('click',()=>switchFeedback('exact'));el.countsTab.addEventListener('click',()=>switchFeedback('counts'));
el.green.addEventListener('input',updateCounts);el.yellow.addEventListener('input',updateCounts);
el.solverGuess.addEventListener('input',()=>{el.solverGuess.value=filterLetters(el.solverGuess.value);paintEditor();});
el.codeFeedback.addEventListener('input',()=>{el.codeFeedback.value=el.codeFeedback.value.toUpperCase().replace(/[^GYR]/g,'').slice(0,len());paintEditor();});
$('suggestBtn').addEventListener('click',()=>suggest(true));$('applyClue').addEventListener('click',applyClue);$('undoClue').addEventListener('click',undo);
newRound();
})();
