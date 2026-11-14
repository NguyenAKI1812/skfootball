import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, stepMatch, matchSnapshot, MATCH_STEP } from '../src/utils/matchEngine.js';
import { projectLiveFrame, interpolateLiveFrame, acceptMatchPacket } from '../src/utils/matchPresentation.js';
const slots = ['gk','lb','lcb','rcb','rb','cm1','cm2','cam','lw','st','rw'];
const manager = (id, ovr = 85) => ({ name: id, squad: Object.fromEntries(slots.map(slot => [slot, { id: `${id}-${slot}`, name: `${id} ${slot}`, ovr, club:'Club',nation:'Nation' }])) });
const create = options => createMatch({ player1: manager('A'), player2: manager('B'), seed: 7, ...options });
function finish(s, maxSteps = 60000, check = false) {
  let count = 0;
  while (s.phase !== 'finished' && count++ < maxSteps) {
    const previous = check ? s.players.map(p => ({...p})) : null;
    const ball = {...s.ball};
    const oldScore = s.score[1] + s.score[2];
    stepMatch(s);
    if (check) {
      s.players.forEach((p,i) => {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(Math.hypot(p.x-previous[i].x,(p.y-previous[i].y)*0.64) < 11*MATCH_STEP+0.001, 'player jumped');
      });
      assert.ok(Math.hypot(s.ball.x-ball.x,(s.ball.y-ball.y)*0.64) < 33*MATCH_STEP+0.001, 'ball jumped');
      if (s.score[1]+s.score[2] > oldScore) {
        assert.equal(s.phase,'goal');
        assert.ok(s.ball.x >= 97 || s.ball.x <= 3);
        assert.ok(s.ball.y>=41 && s.ball.y<=59);
      }
    }
  }
  assert.equal(s.phase,'finished',`stalled in ${s.phase} at ${s.clock}`);
}

test('scores arise only from shots crossing the goal line, motion is bounded throughout a match', () => {
  const s=create(); finish(s,60000,true);
  assert.ok(s.stats[1].shots>=s.score[1]); assert.ok(s.stats[2].shots>=s.score[2]);
  assert.ok(s.stats[1].passes+s.stats[2].passes>0);
  assert.ok(s.stats[1].tackles+s.stats[2].tackles>0);
  assert.equal(s.clock,s.duration); assert.ok(s.mvp);
});
test('seeded fixed-step matches are deterministic and snapshots cannot mutate engine state', () => {
  const a=create(),b=create(); finish(a); finish(b);
  assert.deepEqual(matchSnapshot(a),matchSnapshot(b));
  const snapshot=matchSnapshot(a); snapshot.players[0].x=999; snapshot.score[1]=999;
  assert.notEqual(a.players[0].x,999); assert.notEqual(a.score[1],999);
});
test('tactical choice changes positioning and the resulting play', () => {
  const a=create({tactics:{1:'attack'}}), b=create({tactics:{1:'counter'}});
  for(let i=0;i<600;i++){stepMatch(a);stepMatch(b);}
  assert.notDeepEqual(a.players.map(p=>p.x),b.players.map(p=>p.x));
});
test('varied seeds finish including penalties without predetermined winners', () => {
  let penalties=0; const outcomes=new Set();
  for(let seed=1;seed<=16;seed++) {
    const s=create({seed,duration:45});finish(s);
    penalties+=s.penalties.length>0?1:0;outcomes.add(s.winner);
    if(s.penalties.length){assert.notEqual(s.penScore[1],s.penScore[2]);assert.equal(s.penScore[1],s.penalties.filter(k=>k.team===1&&k.scored).length);}
  }
  assert.ok(penalties>0);assert.equal(outcomes.size,2);
});
test('a shot in flight completes before the final whistle', () => {
  const s=create();
  for(let i=0;i<30000&&s.flight?.kind!=='shot';i++)stepMatch(s);
  assert.equal(s.flight.kind,'shot');s.clock=s.duration;
  stepMatch(s);assert.notEqual(s.phase,'finished');
  finish(s);
});
test('a pass cannot award possession to a distant receiver', () => {
  const s=create();
  for(let i=0;i<12000;i++){
    const before=s.carrier;stepMatch(s);
    if(s.carrier&&s.carrier!==before){const p=s.players.find(p=>p.key===s.carrier);assert.ok(Math.hypot(p.x-s.ball.x,(p.y-s.ball.y)*0.64)<4,'distant owner');}
    if(s.phase==='finished')break;
  }
});
test('snapshot validation rejects duplicate, reordered and foreign match messages', () => {
  const p={...matchSnapshot(create()),matchId:'one',sequence:4};
  assert.ok(acceptMatchPacket(p,null,-1));
  assert.ok(!acceptMatchPacket(p,'one',4));assert.ok(!acceptMatchPacket(p,'one',5));assert.ok(!acceptMatchPacket(p,'other',1));
  assert.ok(!acceptMatchPacket({...p,players:[]},'one',1));
});
test('guest projection mirrors coordinates but preserves ownership and scorer identity', () => {
  const s=create();const snapshot=matchSnapshot(s);snapshot.carrier='2-st';
  const base=[{key:'left-st',slotId:'st',side:'left',player:{id:'B-st'}},{key:'right-st',slotId:'st',side:'right',player:{id:'A-st'}}];
  const guest=projectLiveFrame(snapshot,base,2);const actual=s.players.find(p=>p.key==='2-st');
  assert.equal(guest.tokens[0].x,100-actual.x);assert.equal(guest.carrierKey,'left-st');
  const distant={...guest,ballX:99,tokens:guest.tokens.map(p=>({...p,x:99}))};
  const smooth=interpolateLiveFrame(guest,distant,1/60);
  assert.ok(Math.abs(smooth.tokens[0].x-guest.tokens[0].x)<=28/60+0.001);
  assert.ok(Math.abs(smooth.ballX-guest.ballX)<=85/60+0.001);
});
