/*
 * slipsim.js
 * Spring-loaded inverted pendulum (SLIP) runner and ball-in-a-box models for
 * the HybridDynamics interactive page. Mirrors the MATLAB toolkit
 * (models/slip/slip_model.m, slip_returnMap.m, slip_metrics.m,
 * slip_findGait.m, slip_stability.m, slip_stiffnessFamily.m) and is checked
 * against reference cases exported from MATLAB (tests/test_slipsim.mjs).
 *
 * Numerical method
 *   Flight phases use the exact ballistic solution. Touchdown is found by
 *   scanning the foot height on a fine time grid and then bisecting, so a
 *   short dip of the foot below the ground during leg retraction is found.
 *   Stance uses an adaptive Dormand-Prince 5(4) integrator with event
 *   location by bisection within the step.
 *
 * Works in a browser (global SlipSim) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SlipSim = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEG = Math.PI / 180;
  const FOOT_TOL = 1e-6;      // foot below ground at apex by more than this: stumble
  const ENTRY_TOL = 1e-9;     // guard already past zero by more than this fires at once
  const SCAN_DT = 2e-4;       // flight scan step for the touchdown guard (s)
  const REL_TOL = 1e-10;
  const ABS_TOL = 1e-12;
  const MAX_STANCE_STEP = 1e-3;
  const MAX_PHASE_TIME = 5;   // as the 5 s time limit of slip_returnMap.m
  const MIN_STEP = 1e-15;

  /* ===================== Dormand-Prince 5(4) ===================== */
  const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
  const A = [
    [],
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]
  ];
  const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
  const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

  function rkStep(f, y, h) {
    const n = y.length;
    const k = new Array(7);
    k[0] = f(y);
    for (let s = 1; s < 7; s++) {
      const ys = new Array(n);
      for (let i = 0; i < n; i++) {
        let acc = y[i];
        for (let j = 0; j < s; j++) acc += h * A[s][j] * k[j][i];
        ys[i] = acc;
      }
      k[s] = f(ys);
    }
    const y5 = new Array(n);
    const err = new Array(n);
    for (let i = 0; i < n; i++) {
      let a5 = y[i], a4 = y[i];
      for (let j = 0; j < 7; j++) {
        a5 += h * B5[j] * k[j][i];
        a4 += h * B4[j] * k[j][i];
      }
      y5[i] = a5;
      err[i] = a5 - a4;
    }
    return { y: y5, err: err, dy0: k[0], dy1: k[6] };
  }

  /* ===================== Model pieces ===================== */
  function stanceFlow(p) {
    return function (s) {
      const L = Math.hypot(s[0], s[1]);
      const F = p.k * Math.max(p.L0 - L, 0);
      return [s[2], s[3], F / p.m * s[0] / L, F / p.m * s[1] / L - p.g];
    };
  }

  // Guards in stance (local state s = [px, py, vx, vy] relative to the foot).
  // Each fires when its value crosses zero from positive to negative.
  function stanceGuards(p, s) {
    return [p.L0 - Math.hypot(s[0], s[1]), s[2], s[1]];
  }
  const STANCE_GUARD_NAMES = ['takeoff', 'reversal', 'fall'];

  function apexState(p, y, vx) {
    const a0 = p.legAngleDeg * DEG;
    return [0, y, vx, 0, p.L0 * Math.cos(a0), y - p.L0 * Math.sin(a0)];
  }

  function legAngleDeg(x) {
    return Math.atan2(x[1] - x[5], x[4] - x[0]) / DEG;
  }

  /* ===================== One stride, apex to apex ===================== */
  /*
   * simulateStride(p, start, opts)
   *   p     : {m, L0, k, g, legAngleDeg, retractionDegPerS}
   *   start : full state [x, y, vx, vy, xFoot, yFoot] at apex (after the leg
   *           reset), or {y, vx} for an apex state at x = 0
   *   opts  : {trace: false, traceDt: 1e-3, t0: 0, scanDt: 2e-4}
   *           scanDt is the step of the touchdown scan in descending
   *           flight. Values of several milliseconds reproduce the missed
   *           touchdown of a solver that steps over the foot's dip below
   *           the ground (lesson on numerical methods).
   * Returns {ok, reason, events: [{time, guard, from, to, x}], xEnd, tEnd,
   *          apexNext: {y, vx}, period, stepLength, meanSpeed, minLegLength,
   *          trace}
   */
  function simulateStride(p, start, opts) {
    opts = opts || {};
    const traceOn = !!opts.trace;
    const traceDt = opts.traceDt || 1e-3;
    const t0 = opts.t0 || 0;
    const scanDt = opts.scanDt || SCAN_DT;
    let x = Array.isArray(start) ? start.slice() : apexState(p, start.y, start.vx);
    const xStart = x.slice();
    const out = {
      ok: false, reason: '', events: [], xEnd: null, tEnd: t0,
      apexNext: null, period: NaN, stepLength: NaN, meanSpeed: NaN,
      minLegLength: NaN, trace: null
    };
    const tr = traceOn ? { t: [], x: [], phase: [] } : null;
    const push = function (t, state, phase) {
      if (tr) { tr.t.push(t); tr.x.push(state.slice()); tr.phase.push(phase); }
    };
    const omega = p.retractionDegPerS * DEG;
    const a0 = Math.atan2(x[1] - x[5], x[4] - x[0]);

    /* ----- Phase 1: descending flight (closed form) ----- */
    const y0 = x[1], vy0 = x[3];
    const footH = function (t) {
      return y0 + vy0 * t - 0.5 * p.g * t * t - p.L0 * Math.sin(a0 + omega * t);
    };
    const flightState = function (t) {
      const a = a0 + omega * t;
      const xb = x[0] + x[2] * t, yb = y0 + vy0 * t - 0.5 * p.g * t * t;
      return [xb, yb, x[2], vy0 - p.g * t, xb + p.L0 * Math.cos(a), yb - p.L0 * Math.sin(a)];
    };
    const h0 = footH(0);
    if (h0 < -FOOT_TOL) {
      out.reason = 'footBelowGround';
      out.events.push({ time: t0, guard: 'footBelowGround', from: 'flightDown', to: 'END', x: x.slice() });
      out.xEnd = x; out.tEnd = t0;
      if (tr) push(t0, x, 'flightDown');
      out.trace = tr;
      return out;
    }
    const tFall = (vy0 + Math.sqrt(vy0 * vy0 + 2 * p.g * y0)) / p.g;
    if (!(isFinite(tFall) && tFall >= 0) || tFall > MAX_PHASE_TIME) {
      out.reason = 'timeLimit';
      out.xEnd = x; out.tEnd = t0; out.trace = tr;
      return out;
    }
    let tTD = NaN;
    if (h0 < -ENTRY_TOL) {
      tTD = 0;
    } else {
      let tPrev = 0, hPrev = h0;
      while (tPrev < tFall) {
        const tNext = Math.min(tPrev + scanDt, tFall);
        const hNext = footH(tNext);
        if (hPrev > 0 && hNext <= 0) {
          let lo = tPrev, hi = tNext;
          for (let i = 0; i < 80; i++) {
            const mid = 0.5 * (lo + hi);
            if (footH(mid) > 0) lo = mid; else hi = mid;
          }
          tTD = hi;
          break;
        }
        tPrev = tNext; hPrev = hNext;
      }
    }
    if (tr) {
      const tEndFlight = isNaN(tTD) ? tFall : tTD;
      for (let t = 0; t < tEndFlight; t += traceDt) push(t0 + t, flightState(t), 'flightDown');
      push(t0 + tEndFlight, flightState(tEndFlight), 'flightDown');
    }
    if (isNaN(tTD)) {
      const xf = flightState(tFall);
      out.reason = 'fall';
      out.events.push({ time: t0 + tFall, guard: 'fall', from: 'flightDown', to: 'END', x: xf });
      out.xEnd = xf; out.tEnd = t0 + tFall; out.trace = tr;
      return out;
    }
    x = flightState(tTD);
    let t = t0 + tTD;
    out.events.push({ time: t, guard: 'touchdown', from: 'flightDown', to: 'stance', x: x.slice() });

    /* ----- Phase 2: stance (Dormand-Prince with event location) ----- */
    const foot = [x[4], x[5]];
    const f = stanceFlow(p);
    let s = [x[0] - foot[0], x[1] - foot[1], x[2], x[3]];
    const toGlobal = function (sl) {
      return [sl[0] + foot[0], sl[1] + foot[1], sl[2], sl[3], foot[0], foot[1]];
    };
    let h = 1e-4;
    let gPrev = stanceGuards(p, s);
    let minL = Math.hypot(s[0], s[1]);
    let fired = -1;
    const tStance0 = t;
    const steps = tr ? [{ t: t, s: s.slice(), ds: f(s) }] : null;
    while (fired < 0) {
      if (t - tStance0 > MAX_PHASE_TIME || h < MIN_STEP) {
        out.reason = h < MIN_STEP ? 'stepTooSmall' : 'timeLimit';
        out.xEnd = toGlobal(s); out.tEnd = t; out.trace = tr;
        return out;
      }
      h = Math.min(h, MAX_STANCE_STEP);
      const step = rkStep(f, s, h);
      let errNorm = 0;
      for (let i = 0; i < 4; i++) {
        const sc = ABS_TOL + REL_TOL * Math.max(Math.abs(s[i]), Math.abs(step.y[i]));
        errNorm = Math.max(errNorm, Math.abs(step.err[i]) / sc);
      }
      if (!isFinite(errNorm)) {
        h *= 0.2;
        continue;
      }
      if (errNorm > 1) {
        h *= Math.max(0.2, 0.9 * Math.pow(errNorm, -0.2));
        continue;
      }
      const gNew = stanceGuards(p, step.y);
      let crossing = -1;
      for (let i = 0; i < 3; i++) {
        if (gPrev[i] > 0 && gNew[i] <= 0) { crossing = i; break; }
      }
      if (crossing >= 0) {
        // Locate the first guard crossing within the step by bisection on
        // the step size; check every guard on the shortened step.
        let lo = 0, hi = 1;
        const firstCross = function (theta) {
          const g = stanceGuards(p, rkStep(f, s, theta * h).y);
          for (let i = 0; i < 3; i++) if (gPrev[i] > 0 && g[i] <= 0) return i;
          return -1;
        };
        for (let i = 0; i < 60; i++) {
          const mid = 0.5 * (lo + hi);
          if (firstCross(mid) >= 0) hi = mid; else lo = mid;
        }
        fired = firstCross(hi);
        const sEv = rkStep(f, s, hi * h).y;
        t += hi * h;
        s = sEv;
      } else {
        t += h;
        s = step.y;
        gPrev = gNew;
      }
      const L = Math.hypot(s[0], s[1]);
      if (L < minL) minL = L;
      if (steps) steps.push({ t: t, s: s.slice(), ds: f(s) });
      if (fired < 0) {
        h *= Math.min(5, Math.max(0.2, 0.9 * Math.pow(Math.max(errNorm, 1e-12), -0.2)));
      }
    }
    // Exact minimum leg length: radial velocity changes sign once in stance.
    if (steps) {
      for (let i = 1; i < steps.length; i++) {
        const a = steps[i - 1], b = steps[i];
        const ra = a.s[0] * a.s[2] + a.s[1] * a.s[3];
        const rb = b.s[0] * b.s[2] + b.s[1] * b.s[3];
        if (ra < 0 && rb >= 0) {
          let lo = 0, hi = 1;
          const H = b.t - a.t;
          for (let j = 0; j < 60; j++) {
            const mid = 0.5 * (lo + hi);
            const sm = rkStep(f, a.s, mid * H).y;
            if (sm[0] * sm[2] + sm[1] * sm[3] < 0) lo = mid; else hi = mid;
          }
          const sm = rkStep(f, a.s, lo * H).y;
          minL = Math.min(minL, Math.hypot(sm[0], sm[1]));
          break;
        }
      }
    }
    out.minLegLength = minL;
    if (tr) {
      // Resample stance with cubic Hermite interpolation between solver steps.
      let j = 0;
      for (let tt = Math.ceil(tStance0 / traceDt) * traceDt; tt < t; tt += traceDt) {
        while (j < steps.length - 2 && steps[j + 1].t < tt) j++;
        const a = steps[j], b = steps[j + 1];
        push(tt, toGlobal(hermite(a, b, tt)), 'stance');
      }
      push(t, toGlobal(s), 'stance');
      tr.stanceSteps = steps.map(function (st) { return { t: st.t, x: toGlobal(st.s) }; });
    }
    x = toGlobal(s);
    const gName = STANCE_GUARD_NAMES[fired];
    if (gName !== 'takeoff') {
      out.reason = gName;
      out.events.push({ time: t, guard: gName, from: 'stance', to: 'END', x: x.slice() });
      out.xEnd = x; out.tEnd = t; out.trace = tr;
      return out;
    }
    out.events.push({ time: t, guard: 'takeoff', from: 'stance', to: 'flightUp', x: x.slice() });

    /* ----- Phase 3: ascending flight (closed form) ----- */
    const takeoffAngle = Math.atan2(x[1] - x[5], x[4] - x[0]);
    let tUp = 0;
    if (x[3] > 0) tUp = x[3] / p.g;
    const upState = function (tt) {
      const xb = x[0] + x[2] * tt, yb = x[1] + x[3] * tt - 0.5 * p.g * tt * tt;
      return [xb, yb, x[2], x[3] - p.g * tt,
        xb + p.L0 * Math.cos(takeoffAngle), yb - p.L0 * Math.sin(takeoffAngle)];
    };
    if (tr) {
      for (let tt = Math.ceil(t / traceDt) * traceDt - t; tt < tUp; tt += traceDt) {
        push(t + tt, upState(tt), 'flightUp');
      }
    }
    x = upState(tUp);
    x[3] = 0;
    t += tUp;
    if (tr) push(t, x, 'flightUp');

    /* ----- Apex reset: place the leg at the apex angle ----- */
    const before = x.slice();
    const aApex = p.legAngleDeg * DEG;
    x[4] = x[0] + p.L0 * Math.cos(aApex);
    x[5] = x[1] - p.L0 * Math.sin(aApex);
    out.events.push({ time: t, guard: 'apex', from: 'flightUp', to: 'flightDown', x: before, xAfter: x.slice() });
    if (tr) push(t, x, 'flightDown');

    out.ok = true;
    out.reason = 'cycleLimit';
    out.xEnd = x;
    out.tEnd = t;
    out.apexNext = { y: x[1], vx: x[2] };
    out.period = t - t0;
    out.stepLength = x[0] - xStart[0];
    out.meanSpeed = out.stepLength / out.period;
    out.trace = tr;
    return out;
  }

  function hermite(a, b, t) {
    const H = b.t - a.t;
    const u = (t - a.t) / H;
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u;
    const h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    const r = new Array(4);
    for (let i = 0; i < 4; i++) {
      r[i] = h00 * a.s[i] + h10 * H * a.ds[i] + h01 * b.s[i] + h11 * H * b.ds[i];
    }
    return r;
  }

  /* ===================== Several strides ===================== */
  function simulateStrides(p, apex, n, opts) {
    opts = opts || {};
    let x = apexState(p, apex.y, apex.vx);
    let t = 0;
    const strides = [];
    const apexSeq = [{ y: apex.y, vx: apex.vx }];
    const trace = opts.trace ? { t: [], x: [], phase: [], events: [] } : null;
    let reason = 'cycleLimit';
    let drop = null;
    for (let i = 0; i < n; i++) {
      if (opts.dropAfterStride !== undefined && i === opts.dropAfterStride) {
        // Lower the ground at this apex: the body is higher above the new
        // ground at the same speed. Heights after this point are measured
        // from the new ground; drop.x and drop.time locate the step down.
        const xPos = x[0];
        x = apexState(p, x[1] + opts.dropHeight, x[2]);
        x[0] += xPos;
        x[4] += xPos;
        drop = { x: xPos, time: t, height: opts.dropHeight };
      }
      const r = simulateStride(p, x, { trace: opts.trace, traceDt: opts.traceDt, t0: t, scanDt: opts.scanDt });
      strides.push(r);
      if (trace && r.trace) {
        Array.prototype.push.apply(trace.t, r.trace.t);
        Array.prototype.push.apply(trace.x, r.trace.x);
        Array.prototype.push.apply(trace.phase, r.trace.phase);
        Array.prototype.push.apply(trace.events, r.events);
      }
      if (!r.ok) { reason = r.reason; break; }
      x = r.xEnd;
      t = r.tEnd;
      apexSeq.push({ y: x[1], vx: x[2] });
    }
    return { strides: strides, apexSeq: apexSeq, reason: reason, trace: trace, drop: drop };
  }

  /* ===================== Return map and measures ===================== */
  function returnMap(p, apex) {
    const r = simulateStride(p, apexState(p, apex.y, apex.vx));
    if (!r.ok) return { ok: false, reason: r.reason, y: NaN, vx: NaN };
    return { ok: true, reason: r.reason, y: r.apexNext.y, vx: r.apexNext.vx,
      period: r.period, meanSpeed: r.meanSpeed, stepLength: r.stepLength };
  }

  function metrics(p, apex, traceDt) {
    const r = simulateStride(p, apexState(p, apex.y, apex.vx), { trace: true, traceDt: traceDt || 1e-4 });
    const M = { ok: r.ok, reason: r.reason, stride: r };
    if (!r.ok) return M;
    const W = p.m * p.g;
    const ev = {};
    r.events.forEach(function (e) { ev[e.guard] = e; });
    M.period = r.period;
    M.contactTime = ev.takeoff.time - ev.touchdown.time;
    M.flightTime = M.period - M.contactTime;
    M.stepFrequency = 1 / M.period;
    M.stepLength = r.stepLength;
    M.meanSpeed = r.meanSpeed;
    M.dutyFactor = M.contactTime / (2 * M.period);
    M.touchdownAngleDeg = legAngleDeg(ev.touchdown.x);
    M.takeoffAngleDeg = legAngleDeg(ev.takeoff.x);
    M.sweepAngleDeg = M.takeoffAngleDeg - M.touchdownAngleDeg;
    // Forces along the leg in stance, from the resampled trace.
    const tr = r.trace;
    tr.Fx = []; tr.Fy = []; tr.legLength = [];
    let maxF = 0, maxFy = 0, minFx = 0, maxFx = 0, minY = Infinity;
    for (let i = 0; i < tr.t.length; i++) {
      const s = tr.x[i];
      const px = s[0] - s[4], py = s[1] - s[5];
      const L = Math.hypot(px, py);
      const F = tr.phase[i] === 'stance' ? p.k * Math.max(p.L0 - L, 0) : 0;
      const Fx = F * px / L, Fy = F * py / L;
      tr.Fx.push(Fx); tr.Fy.push(Fy); tr.legLength.push(tr.phase[i] === 'stance' ? L : p.L0);
      if (F > maxF) maxF = F;
      if (Fy > maxFy) maxFy = Fy;
      if (Fx < minFx) minFx = Fx;
      if (Fx > maxFx) maxFx = Fx;
      if (tr.phase[i] === 'stance' && s[1] < minY) minY = s[1];
    }
    const compression = p.L0 - r.minLegLength;
    M.legCompression = compression;
    M.legCompressionPct = 100 * compression / p.L0;
    M.peakLegForceBW = p.k * compression / W;
    M.peakVerticalForceBW = maxFy / W;
    M.peakBrakingForceBW = -minFx / W;
    M.peakPropulsiveForceBW = maxFx / W;
    M.comDropStance = ev.touchdown.x[1] - minY;
    M.verticalStiffness = maxFy / M.comDropStance;
    M.peakElasticEnergy = 0.5 * p.k * compression * compression;
    M.positiveWorkPerDistance = M.peakElasticEnergy / (p.m * M.stepLength);
    M.forceTimeCostIndex = 1 / M.contactTime;
    M.froude = M.meanSpeed * M.meanSpeed / (p.g * p.L0);
    M.relativeStiffness = p.k * p.L0 / W;
    // Energy components and the conservation check.
    const E = { kinetic: [], potential: [], elastic: [], total: [] };
    for (let i = 0; i < tr.t.length; i++) {
      const s = tr.x[i];
      const L = tr.legLength[i];
      const ke = 0.5 * p.m * (s[2] * s[2] + s[3] * s[3]);
      const pe = p.m * p.g * s[1];
      const el = tr.phase[i] === 'stance' ? 0.5 * p.k * Math.pow(Math.max(p.L0 - L, 0), 2) : 0;
      E.kinetic.push(ke); E.potential.push(pe); E.elastic.push(el); E.total.push(ke + pe + el);
    }
    tr.energy = E;
    M.energyChange = E.total[E.total.length - 1] - E.total[0];
    M.trace = tr;
    return M;
  }

  /* ===================== Stability ===================== */
  function lambda(p, apex) {
    const E = p.m * p.g * apex.y + 0.5 * p.m * apex.vx * apex.vx;
    const f = function (y) {
      const vx2 = 2 * (E / p.m - p.g * y);
      if (vx2 <= 0) return NaN;
      const r = returnMap(p, { y: y, vx: Math.sqrt(vx2) });
      return r.y;
    };
    const h = 1e-4;   // as slip_stability.m
    return (f(apex.y + h) - f(apex.y - h)) / (2 * h);
  }

  function apexMapAtEnergy(p, apex, yValues) {
    const E = p.m * p.g * apex.y + 0.5 * p.m * apex.vx * apex.vx;
    return yValues.map(function (y) {
      const vx2 = 2 * (E / p.m - p.g * y);
      if (vx2 <= 0) return NaN;
      return returnMap(p, { y: y, vx: Math.sqrt(vx2) }).y;
    });
  }

  function stridesSurvived(p, apex, nMax) {
    let s = { y: apex.y, vx: apex.vx };
    for (let i = 0; i < nMax; i++) {
      const r = returnMap(p, s);
      if (!r.ok) return i;
      s = { y: r.y, vx: r.vx };
    }
    return nMax;
  }

  function dropTest(p, apex, heights, nStrides) {
    nStrides = nStrides || 20;
    const rows = heights.map(function (h) {
      const n = stridesSurvived(p, { y: apex.y + h, vx: apex.vx }, nStrides);
      return { height: h, survived: n === nStrides, strides: n };
    });
    let maxDrop = heights[heights.length - 1];
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].survived) { maxDrop = i === 0 ? 0 : heights[i - 1]; break; }
    }
    return { maxDrop: maxDrop, rows: rows };
  }

  /* ===================== Solvers ===================== */
  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      const tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
      if (Math.abs(M[c][c]) < 1e-300) return null;
      for (let r = c + 1; r < n; r++) {
        const fct = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= fct * M[c][k];
      }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let acc = M[r][n];
      for (let k = r + 1; k < n; k++) acc -= M[r][k] * x[k];
      x[r] = acc / M[r][r];
    }
    return x;
  }

  function norm(v) { return Math.sqrt(v.reduce(function (a, b) { return a + b * b; }, 0)); }
  function finite(v) { return v.every(function (x) { return isFinite(x); }); }

  // Damped Gauss-Newton (Levenberg-Marquardt), as hde.newtonSolve.
  function newtonSolve(F, z0, opts) {
    opts = Object.assign({ tol: 1e-11, acceptTol: 1e-8, maxIter: 60, fdStep: 1e-6 }, opts || {});
    let z = z0.slice();
    const n = z.length;
    let r = F(z);
    const info = { converged: false, residualNorm: norm(r), iterations: 0, message: '' };
    if (!finite(r)) { info.message = 'Model failed at the starting guess.'; return { z: z, info: info }; }
    let lam = 1e-3;
    for (let iter = 1; iter <= opts.maxIter; iter++) {
      info.iterations = iter;
      if (norm(r) < opts.tol) { info.message = 'Residual below tolerance.'; break; }
      const J = r.map(function () { return new Array(n).fill(0); });
      let bad = false;
      for (let j = 0; j < n; j++) {
        const zp = z.slice(), zm = z.slice();
        zp[j] += opts.fdStep; zm[j] -= opts.fdStep;
        const rp = F(zp), rm = F(zm);
        if (!finite(rp) || !finite(rm)) { bad = true; break; }
        for (let i = 0; i < r.length; i++) J[i][j] = (rp[i] - rm[i]) / (2 * opts.fdStep);
      }
      if (bad) { info.message = 'Model failed near the current point.'; break; }
      const JtJ = [], Jtr = [];
      for (let a = 0; a < n; a++) {
        JtJ.push(new Array(n).fill(0));
        let acc = 0;
        for (let i = 0; i < r.length; i++) acc += J[i][a] * r[i];
        Jtr.push(-acc);
        for (let b = 0; b < n; b++) {
          let s = 0;
          for (let i = 0; i < r.length; i++) s += J[i][a] * J[i][b];
          JtJ[a][b] = s;
        }
      }
      let accepted = false, dz = null, rNew = null;
      for (let tries = 0; tries < 12; tries++) {
        const Aa = JtJ.map(function (row, a) {
          return row.map(function (v, b) { return a === b ? v + lam * Math.max(v, 1e-300) : v; });
        });
        dz = solveLinear(Aa, Jtr);
        if (dz && finite(dz)) {
          rNew = F(z.map(function (v, i) { return v + dz[i]; }));
          if (finite(rNew) && norm(rNew) < norm(r)) { accepted = true; break; }
        }
        lam *= 10;
      }
      if (!accepted) { info.message = 'No step reduced the residual.'; break; }
      z = z.map(function (v, i) { return v + dz[i]; });
      r = rNew;
      lam = Math.max(lam / 10, 1e-12);
      if (norm(dz) < 1e-12 * (1 + norm(z))) { info.message = 'Step size below tolerance.'; break; }
    }
    info.residualNorm = norm(r);
    if (!info.message) info.message = 'Iteration limit reached.';
    info.converged = info.residualNorm < opts.tol ||
      (info.residualNorm < opts.acceptTol && info.message !== 'Model failed near the current point.');
    return { z: z, info: info };
  }

  /*
   * findGait(p, target, guess): periodic gait at target.meanSpeed, holding
   * target.hold = 'stepFrequency' | 'apexHeight' | 'legAngle', as
   * slip_findGait.m. Returns {ok, p, y, vx, meanSpeed, period, info}.
   */
  function findGait(p, target, guess) {
    const hold = target.hold || 'stepFrequency';
    let unpack, z0;
    if (hold === 'apexHeight') {
      unpack = function (z) { return [target.apexHeight, z[0], z[1]]; };
      z0 = [guess.vx, guess.legAngleDeg];
    } else if (hold === 'stepFrequency') {
      unpack = function (z) { return [z[0], z[1], z[2]]; };
      z0 = [guess.y, guess.vx, guess.legAngleDeg];
    } else {
      unpack = function (z) { return [z[0], z[1], p.legAngleDeg]; };
      z0 = [guess.y, guess.vx];
    }
    const F = function (z) {
      const u = unpack(z);
      const q = Object.assign({}, p, { legAngleDeg: u[2] });
      const m = returnMap(q, { y: u[0], vx: u[1] });
      if (!m.ok) return hold === 'stepFrequency' ? [NaN, NaN, NaN] : [NaN, NaN];
      const res = [m.y - u[0], m.meanSpeed - target.meanSpeed];
      if (hold === 'stepFrequency') res.push(1 / m.period - target.stepFrequency);
      return res;
    };
    const sol = newtonSolve(F, z0);
    const u = unpack(sol.z);
    const q = Object.assign({}, p, { legAngleDeg: u[2] });
    const m = returnMap(q, { y: u[0], vx: u[1] });
    return { ok: sol.info.converged && m.ok, p: q, y: u[0], vx: u[1],
      meanSpeed: m.meanSpeed, period: m.period, info: sol.info };
  }

  /*
   * stiffnessFamily(base, kValues, target, opts): continuation in leg
   * stiffness from a periodic base gait, as slip_stiffnessFamily.m.
   * opts: {drop: false, heights, nStrides, onProgress(fraction)}
   * Returns an array of rows (one per k), or a Promise when opts.async.
   */
  function familyRow(k, g, opts) {
    const row = { k: k, ok: false };
    if (!g) return row;
    const M = metrics(g.p, { y: g.y, vx: g.vx });
    ['relativeStiffness', 'meanSpeed', 'contactTime', 'flightTime', 'stepFrequency',
      'stepLength', 'dutyFactor', 'touchdownAngleDeg', 'sweepAngleDeg', 'legCompressionPct',
      'comDropStance', 'peakVerticalForceBW', 'peakLegForceBW', 'peakBrakingForceBW',
      'peakElasticEnergy', 'positiveWorkPerDistance', 'forceTimeCostIndex'].forEach(function (f) {
      row[f] = M[f];
    });
    row.ok = true;
    row.legAngleDeg = g.p.legAngleDeg;
    row.apexHeight = g.y;
    row.apexSpeed = g.vx;
    row.lambda = lambda(g.p, { y: g.y, vx: g.vx });
    if (opts.drop) {
      row.maxDrop = dropTest(g.p, { y: g.y, vx: g.vx }, opts.heights, opts.nStrides).maxDrop;
    }
    return row;
  }

  async function stiffnessFamily(base, kValues, target, opts) {
    opts = Object.assign({ drop: false, heights: range(0.01, 0.50, 0.01), nStrides: 20 }, opts || {});
    const n = kValues.length;
    const gaits = new Array(n).fill(null);
    let i0 = 0;
    kValues.forEach(function (k, i) {
      if (Math.abs(k - base.p.k) < Math.abs(kValues[i0] - base.p.k)) i0 = i;
    });
    let done = 0;
    const tick = async function () {
      done++;
      if (opts.onProgress) opts.onProgress(done / (2 * n));
      await new Promise(function (res) { setTimeout(res, 0); });
    };
    for (const dir of [1, -1]) {
      let last = [base.y, base.vx, base.p.legAngleDeg], kLast = base.p.k;
      let prev = null, kPrev = null;
      const idx = [];
      if (dir === 1) { for (let i = i0; i < n; i++) idx.push(i); }
      else { for (let i = i0 - 1; i >= 0; i--) idx.push(i); }
      for (const i of idx) {
        const guesses = [last];
        if (prev) {
          const slope = last.map(function (v, j) { return (v - prev[j]) / (kLast - kPrev); });
          guesses.unshift(last.map(function (v, j) { return v + slope[j] * (kValues[i] - kLast); }));
        }
        for (const zg of guesses) {
          const q = Object.assign({}, base.p, { k: kValues[i], legAngleDeg: zg[2] });
          const g = findGait(q, target, { y: zg[0], vx: zg[1], legAngleDeg: zg[2] });
          if (g.ok) {
            gaits[i] = g;
            prev = last; kPrev = kLast;
            last = [g.y, g.vx, g.p.legAngleDeg]; kLast = kValues[i];
            break;
          }
        }
        await tick();
      }
    }
    const rows = [];
    for (let i = 0; i < n; i++) {
      rows.push(familyRow(kValues[i], gaits[i], opts));
      await tick();
    }
    return rows;
  }

  function range(a, b, step) {
    const out = [];
    for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1e9) / 1e9);
    return out;
  }

  /* ===================== Ball in a box (closed form) ===================== */
  /*
   * simulateBall(p, x0, tEnd, traceDt)
   *   p  : {g, radius, restitution, restSpeed, xMin, xMax, yMin, yMax}
   *        A floor rebound slower than restSpeed (default 0.01 m/s) puts
   *        the ball at rest on the floor (rolling), as ballInBox_model.m.
   *   x0 : [x, y, vx, vy]
   * Returns {events: [{time, guard, xBefore, xAfter}], trace: {t, x}}
   */
  function simulateBall(p, x0, tEnd, traceDt) {
    traceDt = traceDt || 0.005;
    let s = x0.slice(), t = 0;
    const events = [], tr = { t: [], x: [] };
    let resting = false;
    const ballistic = function (st, dt) {
      return [st[0] + st[2] * dt, resting ? st[1] : st[1] + st[3] * dt - 0.5 * p.g * dt * dt,
        st[2], resting ? 0 : st[3] - p.g * dt];
    };
    for (let guard = 0; guard < 5000 && t < tEnd; guard++) {
      const cands = [];
      if (s[2] < 0) cands.push([(s[0] - p.radius - p.xMin) / -s[2], 'leftWall']);
      if (s[2] > 0) cands.push([(p.xMax - p.radius - s[0]) / s[2], 'rightWall']);
      if (!resting) {
        const floorT = firstRoot(-0.5 * p.g, s[3], s[1] - (p.yMin + p.radius));
        if (floorT !== null) cands.push([floorT, 'floor']);
        const ceilT = firstRoot(-0.5 * p.g, s[3], s[1] - (p.yMax - p.radius));
        if (ceilT !== null && s[3] > 0) cands.push([ceilT, 'ceiling']);
      }
      let best = null;
      cands.forEach(function (c) { if (c[0] > 1e-12 && (!best || c[0] < best[0])) best = c; });
      const dt = best ? Math.min(best[0], tEnd - t) : tEnd - t;
      for (let tt = Math.ceil(t / traceDt) * traceDt; tt < t + dt; tt += traceDt) {
        tr.t.push(tt); tr.x.push(ballistic(s, tt - t));
      }
      const before = ballistic(s, dt);
      t += dt;
      tr.t.push(t); tr.x.push(before);
      if (!best || best[0] > dt) break;
      const after = before.slice();
      if (best[1] === 'leftWall' || best[1] === 'rightWall') after[2] = -p.restitution * before[2];
      else after[3] = -p.restitution * before[3];
      const restSpeed = p.restSpeed !== undefined ? p.restSpeed : 0.01;
      if (best[1] === 'floor' && Math.abs(after[3]) < restSpeed) {
        after[3] = 0; after[1] = p.yMin + p.radius; resting = true;
      }
      events.push({ time: t, guard: best[1], xBefore: before, xAfter: after });
      s = after;
    }
    return { events: events, trace: tr };
  }

  // Smallest positive root of a t^2 + b t + c = 0 (a < 0), or null.
  function firstRoot(a, b, c) {
    const d = b * b - 4 * a * c;
    if (d < 0) return null;
    const r1 = (-b + Math.sqrt(d)) / (2 * a), r2 = (-b - Math.sqrt(d)) / (2 * a);
    const roots = [r1, r2].filter(function (r) { return r > 1e-12; }).sort(function (u, v) { return u - v; });
    return roots.length ? roots[0] : null;
  }

  return {
    DEG: DEG,
    apexState: apexState,
    legAngleDeg: legAngleDeg,
    simulateStride: simulateStride,
    simulateStrides: simulateStrides,
    returnMap: returnMap,
    metrics: metrics,
    lambda: lambda,
    apexMapAtEnergy: apexMapAtEnergy,
    stridesSurvived: stridesSurvived,
    dropTest: dropTest,
    newtonSolve: newtonSolve,
    findGait: findGait,
    stiffnessFamily: stiffnessFamily,
    simulateBall: simulateBall,
    range: range
  };
}));
