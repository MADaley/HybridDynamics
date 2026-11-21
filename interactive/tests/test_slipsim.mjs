// test_slipsim.mjs
// Compares the JavaScript simulator (js/slipsim.js) with reference results
// exported from the MATLAB toolkit (tools/exportWebReference.m).
// Run from the repository root:  node interactive/tests/test_slipsim.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Sim = require(join(here, '..', 'js', 'slipsim.js'));
const ref = JSON.parse(readFileSync(join(here, '..', 'data', 'reference.json'), 'utf8'));
const asArray = (v) => (v === null || v === undefined) ? [] : (Array.isArray(v) ? v : [v]);

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  if (ok) { passed++; } else { failed++; console.log('FAIL  ' + label + (detail ? '  ' + detail : '')); }
}
function close(label, a, b, tol, rel) {
  // MATLAB writes Inf as null in JSON.
  if (b === null && a === Infinity) { check(label, true); return; }
  const err = Math.abs(a - b);
  const lim = rel ? tol * Math.max(Math.abs(b), 1e-12) : tol;
  check(label, err <= lim, `js ${a}  matlab ${b}  diff ${err.toExponential(2)}`);
}

// ----- SLIP cases: events, apex sequences, exit reasons -----
for (const c of asArray(ref.slip.cases)) {
  const p = c.p;
  const evRef = asArray(c.firstStride.events);
  const r = Sim.simulateStride(p, { y: c.apex.y, vx: c.apex.vx });
  const evJs = r.events;
  check(`${c.name}: event sequence`, evJs.map(e => e.guard).join(',') === evRef.map(e => e.guard).join(','),
    `js ${evJs.map(e => e.guard)} matlab ${evRef.map(e => e.guard)}`);
  for (let i = 0; i < Math.min(evJs.length, evRef.length); i++) {
    close(`${c.name}: ${evRef[i].guard} time`, evJs[i].time, evRef[i].time, 1e-8);
  }
  const seq = asArray(c.apexSequence);
  const run = Sim.simulateStrides(p, { y: c.apex.y, vx: c.apex.vx }, seq.length - 1 + (c.exitReason === 'cycleLimit' ? 0 : 1));
  const reasonRef = c.exitReason.replace('terminal:', '');
  check(`${c.name}: exit reason`, run.reason === reasonRef, `js ${run.reason} matlab ${reasonRef}`);
  for (let i = 1; i < seq.length && i < run.apexSeq.length; i++) {
    close(`${c.name}: apex height, stride ${i}`, run.apexSeq[i].y, seq[i].y, 1e-7);
    close(`${c.name}: apex speed, stride ${i}`, run.apexSeq[i].vx, seq[i].vx, 1e-7);
  }
  if (c.metrics && typeof c.metrics === 'object' && !Array.isArray(c.metrics)) {
    const M = Sim.metrics(p, { y: c.apex.y, vx: c.apex.vx });
    for (const [k, v] of Object.entries(c.metrics)) {
      close(`${c.name}: ${k}`, M[k], v, 1e-5, true);
    }
    close(`${c.name}: lambda`, Sim.lambda(p, c.apex), c.lambda, 1e-4);
    const d = Sim.dropTest(p, c.apex, Sim.range(0.01, 0.50, 0.01), 20);
    close(`${c.name}: largest drop survived`, d.maxDrop, c.maxDrop, 1e-9);
    check(`${c.name}: drop failure mode`, d.dropFailure === String(c.dropFailure || '').replace('terminal:', ''),
      `js ${d.dropFailure} matlab ${c.dropFailure}`);
    const D = Sim.normalizedMaxDrop(p, c.apex, { referenceRetractionDegPerS: c.nmd.referenceRetractionDegPerS });
    close(`${c.name}: NMD estimate`, D.estimateNMD, c.nmd.estimate, 1e-6, true);
    close(`${c.name}: NMD estimate at reference rate`, D.estimateDropAtReference / p.L0, c.nmd.atReference, 1e-6, true);
    close(`${c.name}: NMD simulated`, D.simulatedNMD, c.nmd.simulated, 2e-4);
  }
}

// ----- Gait solver reproduces the baseline preset -----
{
  const pr = asArray(ref.slip.presets).find(x => x.name === 'human');
  const p = { m: pr.m, L0: pr.L0, k: pr.k, g: pr.g, legAngleDeg: 66, retractionDegPerS: pr.retractionDegPerS };
  const g = Sim.findGait(p, { meanSpeed: pr.meanSpeed, hold: 'stepFrequency', stepFrequency: pr.stepFrequency },
    { y: 0.93, vx: 4.08, legAngleDeg: 66 });
  check('findGait converged', g.ok, g.info.message);
  close('findGait leg angle', g.p.legAngleDeg, pr.legAngleDeg, 1e-6);
  close('findGait apex height', g.y, pr.apexHeight, 1e-7);
}

// ----- Same-speed stiffness family (no drop test, for speed) -----
{
  const fam = ref.slip.family;
  const rowsRef = asArray(fam.rows);
  const pr = asArray(ref.slip.presets).find(x => x.name === 'human');
  const base = { p: { m: pr.m, L0: pr.L0, k: pr.k, g: pr.g, legAngleDeg: pr.legAngleDeg,
    retractionDegPerS: pr.retractionDegPerS }, y: pr.apexHeight, vx: pr.apexSpeed };
  const kValues = rowsRef.map(r => r.k);
  const rows = await Sim.stiffnessFamily(base, kValues, fam.target,
    { drop: false, retractionRule: fam.retraction.rule, retractionValue: fam.retraction.value,
      referenceRetractionDegPerS: fam.referenceRetractionDegPerS });
  rows.forEach((r, i) => {
    check(`family k=${r.k}: solved`, r.ok);
    if (r.ok) {
      close(`family k=${r.k}: leg angle at apex`, r.legAngleDeg, rowsRef[i].legAngleDeg, 1e-6);
      close(`family k=${r.k}: retraction rate`, r.retractionDegPerS, rowsRef[i].retractionDegPerS, 1e-5);
      close(`family k=${r.k}: apex clearance`, r.apexClearance, rowsRef[i].apexClearance, 1e-9);
      close(`family k=${r.k}: NMD estimate`, r.nmdEstimate, rowsRef[i].nmdEstimate, 1e-6, true);
      close(`family k=${r.k}: NMD at reference rate`, r.nmdEstimateAtReference, rowsRef[i].nmdEstimateAtReference, 1e-6, true);
      close(`family k=${r.k}: NMD simulated`, r.nmdSimulated, rowsRef[i].nmdSimulated, 2e-4);
      close(`family k=${r.k}: peak vertical force`, r.peakVerticalForceBW, rowsRef[i].peakVerticalForceBW, 1e-5, true);
      close(`family k=${r.k}: lambda`, r.lambda, rowsRef[i].lambda, 1e-4);
    }
  });
}

// ----- Retraction rules and sweep for each preset -----
{
  const rules = asArray(ref.slip.retractionRules).map(r => ({ name: r.name, rule: r.rule, value: r.value }));
  for (const rp of asArray(ref.slip.retractionByPreset)) {
    const pr = asArray(ref.slip.presets).find(x => x.name === rp.name);
    const p = { m: pr.m, L0: pr.L0, k: pr.k, g: pr.g, legAngleDeg: pr.legAngleDeg, retractionDegPerS: pr.retractionDegPerS };
    const apex = { y: pr.apexHeight, vx: pr.apexSpeed };
    const C = Sim.compareRetractionRules(p, apex, rules, { dropHeight: rp.dropHeight, terrain: false });
    asArray(rp.rules).forEach((r, i) => {
      const lab = `${rp.name} / ${r.name}`;
      close(`${lab}: rate`, C[i].retractionDegPerS, r.retractionDegPerS, 1e-4);
      close(`${lab}: rate per cycle`, C[i].retractionDegPerCycle, r.retractionDegPerCycle, 1e-4);
      close(`${lab}: apex clearance`, C[i].apexClearance, r.apexClearance, 1e-7);
      close(`${lab}: GSM`, C[i].groundSpeedMatching, r.groundSpeedMatching, 1e-6);
      close(`${lab}: lambda`, C[i].lambda, r.lambda, 1e-4);
      close(`${lab}: NMD estimate`, C[i].nmdEstimate, r.nmdEstimate, 1e-5, true);
      close(`${lab}: NMD simulated`, C[i].nmdSimulated, r.nmdSimulated, 2e-4);
      close(`${lab}: peak force after drop`, C[i].peakForceAfterDropBW, r.peakForceAfterDropBW, 1e-4, true);
    });
    const W = Sim.retractionSweep(p, apex, asArray(rp.sweep).map(r => r.retractionDegPerS), { dropHeight: rp.dropHeight });
    asArray(rp.sweep).forEach((r, i) => {
      const lab = `${rp.name} sweep ${r.retractionDegPerS} deg/s`;
      // Relative tolerance: at fast retraction |lambda| > 1 and the map is steep.
      close(`${lab}: lambda`, W[i].lambda, r.lambda, 5e-4, true);
      close(`${lab}: GSM`, W[i].groundSpeedMatching, r.groundSpeedMatching, 1e-6);
      close(`${lab}: NMD estimate`, W[i].nmdEstimate, r.nmdEstimate, 1e-5, true);
      close(`${lab}: NMD simulated`, W[i].nmdSimulated, r.nmdSimulated, 2e-4);
      close(`${lab}: peak force after drop`, W[i].peakForceAfterDropBW, r.peakForceAfterDropBW, 1e-4, true);
    });
  }
}

// ----- Retraction for a foot clearance -----
{
  const cc = ref.slip.clearanceCase;
  const r = Sim.retractionForClearance(cc.p, cc.apex, cc.clearance);
  close('clearance: leg angle at apex', r.p.legAngleDeg, cc.legAngleDeg, 1e-8);
  close('clearance: retraction rate', r.p.retractionDegPerS, cc.retractionDegPerS, 1e-6);
  close('clearance: fall time', r.fallTime, cc.fallTime, 1e-9);
  const m0 = Sim.returnMap(cc.p, cc.apex), m1 = Sim.returnMap(r.p, cc.apex);
  close('clearance: periodic gait unchanged (apex height)', m1.y, m0.y, 1e-9);
  close('clearance: periodic gait unchanged (period)', m1.period, m0.period, 1e-9);
}

// ----- Ball in a box: impact sequence and times -----
{
  const spec = asArray(ref.ball.spec);
  const v = Object.fromEntries(spec.map(s => [s.name, s.value]));
  const p = { g: v.g, radius: v.radius, restitution: v.restitution,
    xMin: v.xMin, xMax: v.xMax, yMin: v.yMin, yMax: v.yMax };
  const r = Sim.simulateBall(p, ref.ball.x0, 6);
  const evRef = asArray(ref.ball.events);
  check('ball: number of impacts', r.events.length === evRef.length, `js ${r.events.length} matlab ${evRef.length}`);
  evRef.forEach((e, i) => {
    if (r.events[i]) {
      check(`ball impact ${i + 1}: wall`, r.events[i].guard === e.guard);
      close(`ball impact ${i + 1}: time`, r.events[i].time, e.time, 1e-8);
    }
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
