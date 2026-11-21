/*
 * app.js  Spring-Mass Running Lab
 * User interface for the HybridDynamics interactive page. Builds the settings
 * from the MATLAB setting tables (js/reference.js), runs the simulator
 * (js/slipsim.js), draws plots (js/plot.js) and the animation, and presents
 * the guided lessons (js/lessons.js).
 */
(function () {
  'use strict';

  /* ===================== Constants and helpers ===================== */
  var REPO_URL = 'https://github.com/MADaley/HybridDynamics';
  var REF = window.HDS_REFERENCE;
  var DEG = Math.PI / 180;

  function asArray(v) {
    if (v === null || v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  }
  function $(id) { return document.getElementById(id); }
  function fmt(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return 'n/a';
    var s = Number(v).toFixed(d);
    return s === '-0' || /^-0\.0*$/.test(s) ? s.slice(1) : s;
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }
  function linspace(a, b, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(n === 1 ? a : a + (b - a) * i / (n - 1));
    return out;
  }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function pause() { return new Promise(function (res) { setTimeout(res, 0); }); }
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SPEC = asArray(REF.slip.spec);
  var PRESETS = asArray(REF.slip.presets);
  var MATLAB_FAMILY = asArray(REF.slip.family.rows);
  var FAMILY_TARGET = REF.slip.family.target;
  var BALL_SPEC = asArray(REF.ball.spec);

  function preset(name) {
    return PRESETS.filter(function (p) { return p.name === name; })[0];
  }
  function presetState(name) {
    var r = preset(name);
    return {
      p: { m: r.m, L0: r.L0, k: r.k, g: r.g, legAngleDeg: r.legAngleDeg, retractionDegPerS: r.retractionDegPerS },
      apex: { y: r.apexHeight, vx: r.apexSpeed }
    };
  }

  var REASONS = {
    cycleLimit: 'completed the stride',
    fall: 'the body reached the ground',
    reversal: 'forward speed reached zero',
    footBelowGround: 'the apex fell below the height needed to place the leg (foot below the ground at apex)',
    missedStance: 'the leg touched down with the body moving away from the foot and could not be loaded (missed stance)',
    timeLimit: 'no touchdown within 5 s',
    stepTooSmall: 'the integrator step became too small'
  };
  // Failure modes arrive as "fall" from the browser simulator and as
  // "terminal:fall" from MATLAB; both map to the same text.
  function reasonText(r) {
    if (!r) return 'none';
    var key = String(r).replace('terminal:', '');
    return REASONS[key] || key;
  }

  /* ----- Normalized maximum drop (Daley and Usherwood 2010) -----
     NMD = dHmax / L with dHmax = (g / 2) (Phi / omega)^2, where Phi is the
     stance half-angle (90 deg minus the touchdown angle) and omega the leg
     retraction rate. JSON null stands for an infinite value. */
  var RULES = asArray(REF.slip.retractionRules);
  var SWING = asArray(REF.data.swingLeg);
  var RULE_UNITS = { commonPerCycle: 'deg per gait cycle', common: 'deg/s', clearance: 'm' };
  // Arrow increment of the rule value box: 1 deg, 1 deg/s, 1 cm.
  var RULE_SPIN = { commonPerCycle: 1, common: 1, clearance: 0.01 };
  var RULE_SHORT = { fixed: 'fixed', commonPerCycle: 'human', common: 'common', clearance: '5 cm',
    fastestRecovery: 'fastest', groundSpeedMatching: 'GSM' };
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function ruleNeedsValue(rule) { return rule === 'commonPerCycle' || rule === 'common' || rule === 'clearance'; }
  // The measured human row whose leg rotation per gait cycle equals v.
  function humanRowFor(v) {
    return SWING.filter(function (r) { return r.species === 'human' && Math.abs(r.legRotation_degPerCycle - v) < 1e-6; })[0] || null;
  }
  function nmdEstimate(p, touchdownAngleDeg, retractionDegPerS) {
    var phi = (90 - touchdownAngleDeg) * DEG, om = retractionDegPerS * DEG;
    if (!(om > 0)) return Infinity;
    if (!(phi > 0)) return 0;
    return 0.5 * p.g * Math.pow(phi / om, 2) / p.L0;
  }
  function nmdText(v, kind, d) {
    if (v === null || v === undefined || v === Infinity) return kind === 'simulated' ? '> 5' : 'no limit';
    return fmt(v, d === undefined ? 3 : d);
  }
  function finiteOrNaN(v) { return v === null || v === undefined || !isFinite(v) ? NaN : Number(v); }

  /* ===================== Application state ===================== */
  var init = presetState('human');
  var S = {
    model: 'slip',
    tab: 'stride',
    presetName: 'human',
    p: init.p,
    apex: init.apex,
    nStrides: 5,
    target: { meanSpeed: round(FAMILY_TARGET.meanSpeed, 3), stepFrequency: round(FAMILY_TARGET.stepFrequency, 3) },
    run: null,
    M: null,
    periodic: false,
    lambda: NaN,
    cobwebStart: 0.01,
    ruleIndex: 1,
    portrait: { on: false, dy: 0.02, n: 6, follow: 'gait', run: null, key: '', tA: null, tB: null, failed: '' },
    retr: null,
    nmd: null,
    family: { rows: MATLAB_FAMILY, source: 'matlab' },
    perturb: { drop: 0.05, strides: 15, run: null, compare: null },
    grid: { result: null, stale: false, busy: false },
    ball: ballDefaults(),
    ballRun: null,
    anim: { source: null, t: 0, playing: false, speed: 0.25, lastTs: null, kind: 'slip' },
    lesson: null
  };
  function round(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }

  function ballDefaults() {
    var v = {};
    BALL_SPEC.forEach(function (r) { v[r.name] = r.value; });
    return {
      p: { g: v.g, radius: v.radius, restitution: v.restitution, restSpeed: v.restSpeed,
        xMin: v.xMin, xMax: v.xMax, yMin: v.yMin, yMax: v.yMax },
      x0: [v.x0, v.y0, v.vx0, v.vy0]
    };
  }

  /* ===================== Sidebar controls ===================== */
  var SLIP_GROUPS = [
    ['initial condition', 'Initial conditions (apex of flight)'],
    ['contact condition', 'Contact conditions'],
    ['parameter', 'Parameters']
  ];
  var SLIP_STEPS = { m: 0.5, L0: 0.01, k: 100, g: 0.01, legAngleDeg: 0.01,
    retractionDegPerS: 1, apexHeight: 0.001, apexSpeed: 0.001 };
  // One click on the arrows of a number box (or the up and down keys) moves
  // the value by this amount; typed values keep full precision.
  var SLIP_SPIN = { m: 1, L0: 0.01, k: 500, g: 0.01, legAngleDeg: 0.1,
    retractionDegPerS: 1, apexHeight: 0.01, apexSpeed: 0.1 };
  var BALL_SPIN = { g: 0.01, radius: 0.01, restitution: 0.01, restSpeed: 0.001,
    xMax: 0.1, yMax: 0.1, x0: 0.1, y0: 0.1, vx0: 0.1, vy0: 0.1 };
  var SLIP_LABELS = { m: 'Body mass', L0: 'Leg length', k: 'Leg stiffness', g: 'Gravity',
    legAngleDeg: 'Leg angle at apex', retractionDegPerS: 'Leg retraction rate',
    apexHeight: 'Apex height', apexSpeed: 'Forward speed at apex' };
  var BALL_LABELS = { g: 'Gravity', radius: 'Ball radius', restitution: 'Coefficient of restitution',
    restSpeed: 'Rest speed on the floor',
    xMax: 'Box width', yMax: 'Box height', x0: 'Initial x position', y0: 'Initial height',
    vx0: 'Initial horizontal velocity', vy0: 'Initial vertical velocity' };
  var controlInputs = {};   // name -> {range, number}

  function getSlipValue(name) {
    if (name === 'apexHeight') return S.apex.y;
    if (name === 'apexSpeed') return S.apex.vx;
    return S.p[name];
  }
  function setSlipValue(name, v) {
    if (name === 'apexHeight') S.apex.y = v;
    else if (name === 'apexSpeed') S.apex.vx = v;
    else S.p[name] = v;
  }
  var BALL_X0 = { x0: 0, y0: 1, vx0: 2, vy0: 3 };
  function getBallValue(name) {
    return BALL_X0[name] !== undefined ? S.ball.x0[BALL_X0[name]] : S.ball.p[name];
  }
  function setBallValue(name, v) {
    if (BALL_X0[name] !== undefined) S.ball.x0[BALL_X0[name]] = v; else S.ball.p[name] = v;
  }

  function makeControl(row, label, step, getter, setter, onChange, spin) {
    var id = 'ctl-' + row.name;
    var wrap = el('div', { 'class': 'control' });
    var head = el('div', { 'class': 'control-head' });
    var lab = el('label', { 'for': id + '-num' }, label + ' (' + row.units + ')');
    var num = el('input', { type: 'number', id: id + '-num', step: spin || 'any', min: row.min, max: row.max,
      'aria-describedby': id + '-desc' });
    head.appendChild(lab);
    head.appendChild(num);
    var rng = el('input', { type: 'range', id: id, min: row.min, max: row.max, step: step,
      'aria-label': label + ' slider', 'aria-describedby': id + '-desc' });
    var desc = el('p', { 'class': 'desc', id: id + '-desc' }, row.description);
    wrap.appendChild(head);
    wrap.appendChild(rng);
    wrap.appendChild(desc);
    var v = getter(row.name);
    rng.value = v;
    num.value = cleanNumber(v, step);
    rng.addEventListener('input', function () {
      var x = parseFloat(rng.value);
      num.value = cleanNumber(x, step);
      setter(row.name, x);
      onChange();
    });
    num.addEventListener('change', function () {
      var x = parseFloat(num.value);
      if (!isFinite(x)) { num.value = cleanNumber(getter(row.name), step); return; }
      x = clamp(x, row.min, row.max);
      num.value = cleanNumber(x, step);
      rng.value = x;
      setter(row.name, x);
      onChange();
    });
    controlInputs[row.name] = { range: rng, number: num, step: step };
    return wrap;
  }
  function cleanNumber(v, step) {
    var d = Math.max(0, Math.min(6, Math.ceil(-Math.log10(step)) + 2));
    var t = Number(v).toFixed(d);
    return t.indexOf('.') >= 0 ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
  }
  function syncControls() {
    Object.keys(controlInputs).forEach(function (name) {
      var c = controlInputs[name];
      var v = S.model === 'slip' ? getSlipValue(name) : getBallValue(name);
      c.range.value = v;
      c.number.value = cleanNumber(v, c.step);
    });
  }

  function buildSlipSidebar() {
    var side = $('sidebar');
    side.innerHTML = '';
    controlInputs = {};
    side.appendChild(el('h2', null, 'Running model settings'));

    // Preset
    var pw = el('div', { 'class': 'control' });
    pw.appendChild(el('label', { 'for': 'presetSelect' }, 'Preset gait'));
    var sel = el('select', { id: 'presetSelect' });
    PRESETS.forEach(function (p) {
      var o = el('option', { value: p.name }, p.label + ' (' + fmt(p.k / 1000, 0) + ' kN/m)');
      sel.appendChild(o);
    });
    sel.value = S.presetName;
    sel.addEventListener('change', function () { loadPreset(sel.value); });
    pw.appendChild(sel);
    pw.appendChild(el('p', { 'class': 'desc' }, 'Each preset is a periodic gait at ' +
      fmt(FAMILY_TARGET.meanSpeed, 1) + ' m/s and ' + fmt(FAMILY_TARGET.stepFrequency, 1) +
      ' steps per second, solved in MATLAB. All presets use one swing-leg retraction rate, ' + fmt(REF.slip.family.retraction.value, 1) +
      ' deg per gait cycle (' + fmt(REF.slip.family.retraction.degPerS, 1) + ' deg/s), the human rate at about 4 m/s (Blum et al. 2011). The leg lands at the same angle and time as with a fixed leg angle, so the gait is the same.'));
    side.appendChild(pw);

    SLIP_GROUPS.forEach(function (g) {
      var fs = el('fieldset');
      fs.appendChild(el('legend', null, g[1]));
      SPEC.filter(function (r) { return r.group === g[0]; }).forEach(function (r) {
        fs.appendChild(makeControl(r, SLIP_LABELS[r.name] || r.name, SLIP_STEPS[r.name] || 0.01,
          getSlipValue, setSlipValue, onSlipChange, SLIP_SPIN[r.name]));
      });
      if (g[0] === 'contact condition') fs.appendChild(ruleBlock());
      side.appendChild(fs);
    });

    // Strides shown
    var fsRun = el('fieldset');
    fsRun.appendChild(el('legend', null, 'Run'));
    var row = el('div', { 'class': 'target-row' });
    row.appendChild(el('label', { 'for': 'nStrides' }, 'Strides to simulate'));
    var ns = el('input', { type: 'number', id: 'nStrides', min: 1, max: 20, step: 1, value: S.nStrides });
    ns.addEventListener('change', function () {
      S.nStrides = clamp(Math.round(parseFloat(ns.value) || 5), 1, 20);
      ns.value = S.nStrides;
      onSlipChange();
    });
    row.appendChild(ns);
    fsRun.appendChild(row);
    side.appendChild(fsRun);

    // Periodic gait search
    var fsG = el('fieldset');
    fsG.appendChild(el('legend', null, 'Find a periodic gait'));
    fsG.appendChild(el('p', { 'class': 'desc' }, 'Adjusts the apex state and the leg angle at apex so that the stride repeats at the target average speed and step frequency. Stiffness, mass, leg length, gravity and retraction rate stay fixed.'));
    [['meanSpeed', 'Target average speed (m/s)', 0.01], ['stepFrequency', 'Target step frequency (1/s)', 0.01]].forEach(function (t) {
      var r = el('div', { 'class': 'target-row' });
      r.appendChild(el('label', { 'for': 'target-' + t[0] }, t[1]));
      var inp = el('input', { type: 'number', id: 'target-' + t[0], step: t[2], value: S.target[t[0]] });
      inp.addEventListener('change', function () {
        var v = parseFloat(inp.value);
        if (isFinite(v) && v > 0) S.target[t[0]] = v; else inp.value = S.target[t[0]];
      });
      r.appendChild(inp);
      fsG.appendChild(r);
    });
    var br = el('div', { 'class': 'button-row' });
    var fb = el('button', { type: 'button', 'class': 'btn', id: 'findGaitBtn' }, 'Find periodic gait');
    fb.addEventListener('click', findGait);
    var rb = el('button', { type: 'button', 'class': 'btn btn-quiet' }, 'Reset to preset');
    rb.addEventListener('click', function () { loadPreset(S.presetName); });
    br.appendChild(fb);
    br.appendChild(rb);
    fsG.appendChild(br);
    side.appendChild(fsG);

    // Readouts
    var fsR = el('fieldset');
    fsR.appendChild(el('legend', null, 'Derived quantities'));
    var dl = el('dl', { 'class': 'readouts', id: 'readouts' });
    fsR.appendChild(dl);
    side.appendChild(fsR);
  }

  // Set the retraction rate of the current periodic gait by one of the rules.
  function ruleBlock() {
    var wrap = el('div', { 'class': 'control' });
    wrap.appendChild(el('label', { 'for': 'ruleSelect' }, 'Set retraction by rule'));
    var sel = el('select', { id: 'ruleSelect' });
    RULES.forEach(function (r, i) { sel.appendChild(el('option', { value: String(i) }, cap(r.name))); });
    sel.value = String(S.ruleIndex);
    wrap.appendChild(sel);
    var row = el('div', { 'class': 'target-row' });
    var lab = el('label', { 'for': 'ruleValue', id: 'ruleValueLabel' }, '');
    var inp = el('input', { type: 'number', id: 'ruleValue', step: 'any' });
    row.appendChild(lab);
    row.appendChild(inp);
    wrap.appendChild(row);
    var sync = function () {
      var r = RULES[parseInt(sel.value, 10)];
      S.ruleIndex = parseInt(sel.value, 10);
      row.hidden = !ruleNeedsValue(r.rule);
      lab.textContent = 'Value (' + (RULE_UNITS[r.rule] || '') + ')';
      inp.step = RULE_SPIN[r.rule] || 'any';
      if (ruleNeedsValue(r.rule)) inp.value = r.value;
    };
    sel.addEventListener('change', sync);
    sync();
    var br = el('div', { 'class': 'button-row' });
    var b = el('button', { type: 'button', 'class': 'btn btn-quiet', id: 'ruleApply' }, 'Apply');
    b.addEventListener('click', applyRule);
    br.appendChild(b);
    wrap.appendChild(br);
    wrap.appendChild(el('p', { 'class': 'desc' }, 'Each rule sets the retraction rate for the current periodic gait. Retraction changes only the leg angle at apex; the leg lands at the same angle and the same time.'));
    return wrap;
  }

  function applyRule() {
    var r = RULES[S.ruleIndex];
    var v = ruleNeedsValue(r.rule) ? parseFloat($('ruleValue').value) : r.value;
    if (!S.periodic) {
      updateStatus('The current apex state is not periodic. Press Find periodic gait or load a preset, then apply the rule.', true);
      return;
    }
    if (ruleNeedsValue(r.rule) && !isFinite(v)) {
      updateStatus('Enter a value for this rule.', true);
      return;
    }
    var btn = $('ruleApply');
    btn.disabled = true;
    setTimeout(function () {
      try {
        var info = SlipSim.retractionRule(S.p, S.apex, r.rule, v);
        S.p.legAngleDeg = info.p.legAngleDeg;
        S.p.retractionDegPerS = info.p.retractionDegPerS;
        syncControls();
        recomputeSlip();
        updateStatus('Rule applied (' + r.name + '): retraction ' + fmt(info.retractionDegPerS, 1) + ' deg/s (' +
          fmt(info.retractionDegPerCycle, 1) + ' deg per gait cycle), leg angle at apex ' + fmt(info.p.legAngleDeg, 2) +
          ' deg, foot clearance at apex ' + fmt(info.apexClearance * 100, 1) + ' cm, ground speed matching ' +
          fmt(info.gsm * 100, 0) + ' %, lambda ' + fmt(info.lambda, 3) + '.' + (info.note ? ' Note: ' + info.note + '.' : ''), true);
      } catch (e) {
        updateStatus('Rule not applied: ' + e.message, true);
      }
      btn.disabled = false;
    }, 20);
  }

  function buildBallSidebar() {
    var side = $('sidebar');
    side.innerHTML = '';
    controlInputs = {};
    side.appendChild(el('h2', null, 'Ball in a box settings'));
    SLIP_GROUPS.forEach(function (g) {
      var fs = el('fieldset');
      fs.appendChild(el('legend', null, g[1].replace(' (apex of flight)', '')));
      BALL_SPEC.filter(function (r) {
        return r.group === g[0] && r.max > r.min && BALL_LABELS[r.name];
      }).forEach(function (r) {
        fs.appendChild(makeControl(r, BALL_LABELS[r.name], r.name === 'restSpeed' ? 0.001 : 0.01,
          getBallValue, setBallValue, onBallChange, BALL_SPIN[r.name]));
      });
      side.appendChild(fs);
    });
    var br = el('div', { 'class': 'button-row' });
    var rb = el('button', { type: 'button', 'class': 'btn btn-quiet' }, 'Reset');
    rb.addEventListener('click', function () { S.ball = ballDefaults(); syncControls(); onBallChange(); });
    br.appendChild(rb);
    side.appendChild(br);
  }

  /* ===================== Running model: computation ===================== */
  var onSlipChange = debounce(function () {
    S.grid.stale = !!S.grid.result;
    recomputeSlip();
  }, 100);

  function loadPreset(name) {
    S.presetName = name;
    S.retr = null;
    var st = presetState(name);
    S.p = st.p;
    S.apex = st.apex;
    var sel = $('presetSelect');
    if (sel) sel.value = name;
    syncControls();
    S.grid.stale = !!S.grid.result;
    recomputeSlip();
  }

  function recomputeSlip() {
    var run = SlipSim.simulateStrides(S.p, S.apex, S.nStrides, { trace: true, traceDt: 0.002 });
    var M = SlipSim.metrics(S.p, S.apex, 2e-4);
    S.run = run;
    S.M = M;
    S.nmd = null;
    var first = run.apexSeq[1];
    S.periodic = !!first && Math.abs(first.y - S.apex.y) < 1e-6 && Math.abs(first.vx - S.apex.vx) < 1e-6;
    S.lambda = M.ok ? SlipSim.lambda(S.p, S.apex) : NaN;
    updateReadouts();
    if (S.tab !== 'perturb') setAnimSource(slipSource(run), false);
    renderActiveTab();
    updateStatus();
  }

  function updateReadouts() {
    var dl = $('readouts');
    if (!dl) return;
    var M = S.M, p = S.p;
    var E = p.m * p.g * S.apex.y + 0.5 * p.m * S.apex.vx * S.apex.vx;
    var first = S.run && S.run.apexSeq[1];
    var rows = [
      ['Touchdown angle', M && M.ok ? fmt(M.touchdownAngleDeg, 2) + ' deg' : 'n/a'],
      ['Foot clearance at apex', fmt(SlipSim.apexClearance(p, S.apex) * 100, 2) + ' cm'],
      ['Ground speed matching', M && M.ok ? fmt(M.groundSpeedMatching * 100, 1) + ' %' : 'n/a'],
      ['Average speed', M && M.ok ? fmt(M.meanSpeed, 3) + ' m/s' : 'n/a'],
      ['Step frequency', M && M.ok ? fmt(M.stepFrequency, 3) + ' 1/s' : 'n/a'],
      ['Froude number v^2/(g L0)', M && M.ok ? fmt(M.froude, 3) : 'n/a'],
      ['Relative stiffness k L0/(m g)', fmt(p.k * p.L0 / (p.m * p.g), 2)],
      ['Mechanical energy', fmt(E, 1) + ' J'],
      ['Periodic over one stride', S.periodic ? 'yes' : (first ? 'no, apex height changes by ' +
        fmt((first.y - S.apex.y) * 1000, 2) + ' mm' : 'no, the stride fails')],
      ['Eigenvalue lambda', fmt(S.lambda, 3)]
    ];
    dl.innerHTML = '';
    rows.forEach(function (r) { dl.appendChild(el('dt', null, r[0])); dl.appendChild(el('dd', null, r[1])); });
  }

  function updateStatus(extra, only) {
    if (extra && only) { $('status').textContent = extra; return; }
    var msg;
    if (S.model === 'ball') {
      var r = S.ballRun;
      msg = r ? r.events.length + ' impacts in ' + fmt(r.trace.t[r.trace.t.length - 1], 1) + ' s.' : '';
    } else {
      var run = S.run, M = S.M;
      var done = run ? run.apexSeq.length - 1 : 0;
      if (!run) msg = '';
      else if (run.reason === 'cycleLimit') {
        msg = done + ' strides completed. Contact time ' + fmt(M.contactTime, 3) + ' s, peak vertical force ' +
          fmt(M.peakVerticalForceBW, 2) + ' body weights, lambda ' + fmt(S.lambda, 2) + '.';
      } else {
        msg = 'The run stopped after ' + done + ' completed strides: ' + reasonText(run.reason) + '.';
      }
    }
    $('status').textContent = extra ? extra + ' ' + msg : msg;
  }

  function findGait() {
    var btn = $('findGaitBtn');
    btn.disabled = true;
    btn.textContent = 'Searching...';
    setTimeout(function () {
      var target = { meanSpeed: S.target.meanSpeed, hold: 'stepFrequency', stepFrequency: S.target.stepFrequency };
      var g = SlipSim.findGait(S.p, target, { y: S.apex.y, vx: S.apex.vx, legAngleDeg: S.p.legAngleDeg });
      btn.disabled = false;
      btn.textContent = 'Find periodic gait';
      if (g.ok) {
        S.p.legAngleDeg = g.p.legAngleDeg;
        S.apex = { y: g.y, vx: g.vx };
        syncControls();
        recomputeSlip();
        updateStatus('Periodic gait found: leg angle at apex ' + fmt(g.p.legAngleDeg, 3) + ' deg, apex height ' +
          fmt(g.y, 4) + ' m, apex speed ' + fmt(g.vx, 4) + ' m/s.');
      } else {
        updateStatus('No periodic gait found from this starting point (' + g.info.message +
          '). Move the leg angle or apex height closer to a working gait, or load a preset, and try again.');
      }
    }, 20);
  }

  /* ===================== Animation ===================== */
  function slipSource(run, drop) {
    var tr = run.trace;
    drop = drop || run.drop || null;
    // Index of the first sample measured from the new ground: the stride
    // after the drop starts at the drop time with the apex raised by the
    // drop height.
    var dropIndex = Infinity;
    if (drop) {
      for (var k = 1; k < tr.t.length; k++) {
        if (tr.t[k] >= drop.time - 1e-12 &&
            Math.abs(tr.x[k][1] - tr.x[k - 1][1] - drop.height) < 1e-6) { dropIndex = k; break; }
      }
    }
    return { kind: 'slip', t: tr.t, x: tr.x, phase: tr.phase, events: tr.events,
      reason: run.reason, drop: drop, dropIndex: dropIndex, p: run.p || S.p, runRef: run };
  }

  function setAnimSource(src, autoplay) {
    S.anim.source = src;
    S.anim.kind = src.kind;
    S.anim.t = src.t.length ? src.t[0] : 0;
    if (autoplay !== undefined && !reducedMotion) setPlaying(autoplay || S.anim.playing);
    drawFrame();
  }

  function setPlaying(on) {
    S.anim.playing = on;
    S.anim.lastTs = null;
    var b = $('playBtn');
    b.textContent = on ? 'Pause' : 'Play';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function tick(ts) {
    var A = S.anim;
    if (A.playing && A.source && A.source.t.length) {
      if (A.lastTs !== null) {
        var dt = Math.min((ts - A.lastTs) / 1000, 0.1) * A.speed;
        A.t += dt;
        var tEnd = A.source.t[A.source.t.length - 1];
        if (A.t > tEnd + 0.4 * A.speed) A.t = A.source.t[0];
      }
      A.lastTs = ts;
      drawFrame();
    }
    requestAnimationFrame(tick);
  }

  function indexAt(arr, t) {
    var lo = 0, hi = arr.length - 1;
    if (t <= arr[0]) return 0;
    if (t >= arr[hi]) return hi;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (arr[mid] <= t) lo = mid; else hi = mid;
    }
    return lo;
  }

  function drawFrame() {
    var src = S.anim.source;
    var canvas = $('anim');
    var prep = Plot.prepare(canvas, canvas.clientHeight || 300);
    if (!src || !src.t.length) return;
    var C = Plot.colors();
    if (src.kind === 'ball') drawBallFrame(prep, src, C);
    else drawSlipFrame(prep, src, C);
  }

  function drawSlipFrame(prep, src, C) {
    var ctx = prep.ctx, w = prep.w, h = prep.h;
    var t = S.anim.t;
    var i = indexAt(src.t, t);
    var x = src.x[i];
    var p = src.p;
    var drop = src.drop;
    var dropH = drop ? drop.height : 0;
    var shifted = drop && i >= src.dropIndex;
    var shiftOf = function (k) { return drop && k >= src.dropIndex ? -dropH : 0; };
    var viewH = 1.35 * p.L0 + dropH;
    var scale = (h - 34) / viewH;
    var groundY = h - 22 - dropH * scale;
    var camX = x[0] - (w / scale) * 0.4;
    var X = function (v) { return (v - camX) * scale; };
    var Y = function (v) { return groundY - v * scale; };

    // Ground (steps down at the drop)
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (drop) {
      ctx.moveTo(0, Y(0));
      ctx.lineTo(X(drop.x + 0.35 * p.L0), Y(0));
      ctx.lineTo(X(drop.x + 0.35 * p.L0), Y(-dropH));
      ctx.lineTo(w, Y(-dropH));
    } else {
      ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0));
    }
    ctx.stroke();
    // Ground hatching for depth cue
    ctx.strokeStyle = C.grey;
    ctx.lineWidth = 1;
    var hatch = 0.12 * p.L0;
    var start = Math.floor(camX / hatch) * hatch;
    for (var gx = start; gx < camX + w / scale; gx += hatch) {
      var gy = drop && gx >= drop.x + 0.35 * p.L0 ? -dropH : 0;
      ctx.beginPath(); ctx.moveTo(X(gx), Y(gy)); ctx.lineTo(X(gx) - 7, Y(gy) + 7); ctx.stroke();
    }

    // Center-of-mass trail: stance thick, flight thin (color and width)
    for (var k = 1; k <= i; k++) {
      var st = src.phase[k] === 'stance';
      ctx.strokeStyle = st ? C.series[1] : C.series[2];
      ctx.lineWidth = st ? 3 : 1.3;
      ctx.beginPath();
      ctx.moveTo(X(src.x[k - 1][0]), Y(src.x[k - 1][1] + shiftOf(k - 1)));
      ctx.lineTo(X(src.x[k][0]), Y(src.x[k][1] + shiftOf(k)));
      ctx.stroke();
    }

    // Spring leg as a zigzag from foot to body
    var off = shifted ? -dropH : 0;
    var bx = X(x[0]), by = Y(x[1] + off), fx = X(x[4]), fy = Y(x[5] + off);
    drawSpring(ctx, fx, fy, bx, by, 0.035 * p.L0 * scale, C.ink, src.phase[i] === 'stance');
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(fx, fy, 3.5, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = C.series[0];
    ctx.beginPath(); ctx.arc(bx, by, Math.max(6, 0.06 * p.L0 * scale), 0, 2 * Math.PI); ctx.fill();

    // Labels
    var phaseName = src.phase[i];
    var ended = i === src.t.length - 1 && src.reason !== 'cycleLimit';
    ctx.fillStyle = C.text;
    ctx.font = '13px ' + getComputedStyle(document.documentElement).getPropertyValue('--font');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(PHASE_LABEL[phaseName] + (ended ? ' (run stopped: ' + src.reason + ')' : ''), 10, 8);
    $('timeReadout').textContent = 't = ' + fmt(src.t[i], 3) + ' s';
    highlightPhase(ended ? 'END' : phaseName);
    drawPortraitDots();
  }

  var PHASE_LABEL = { flightDown: 'Descending flight', stance: 'Stance', flightUp: 'Ascending flight' };

  function drawSpring(ctx, x0, y0, x1, y1, amp, color, stance) {
    var dx = x1 - x0, dy = y1 - y0;
    var L = Math.hypot(dx, dy);
    if (L < 1) return;
    var ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    var coils = 9, endFrac = 0.15;
    ctx.strokeStyle = color;
    ctx.lineWidth = stance ? 2.4 : 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    var a = endFrac * L, b = (1 - endFrac) * L;
    ctx.lineTo(x0 + ux * a, y0 + uy * a);
    for (var c = 0; c < coils * 2; c++) {
      var s = a + (b - a) * (c + 0.5) / (coils * 2);
      var side = c % 2 === 0 ? 1 : -1;
      ctx.lineTo(x0 + ux * s + nx * amp * side, y0 + uy * s + ny * amp * side);
    }
    ctx.lineTo(x0 + ux * b, y0 + uy * b);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function drawBallFrame(prep, src, C) {
    var ctx = prep.ctx, w = prep.w, h = prep.h;
    var p = src.p;
    var bw = p.xMax - p.xMin, bh = p.yMax - p.yMin;
    var scale = Math.min((w - 20) / bw, (h - 20) / bh);
    var ox = (w - bw * scale) / 2, oy = (h - bh * scale) / 2;
    var X = function (v) { return ox + (v - p.xMin) * scale; };
    var Y = function (v) { return oy + (p.yMax - v) * scale; };
    var i = indexAt(src.t, S.anim.t);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(X(p.xMin), Y(p.yMax), bw * scale, bh * scale);
    // Path so far
    ctx.strokeStyle = C.series[2];
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (var k = 0; k <= i; k++) {
      if (k === 0) ctx.moveTo(X(src.x[k][0]), Y(src.x[k][1])); else ctx.lineTo(X(src.x[k][0]), Y(src.x[k][1]));
    }
    ctx.stroke();
    // Impact points so far
    ctx.fillStyle = C.series[1];
    src.events.forEach(function (e) {
      if (e.time <= src.t[i]) {
        ctx.beginPath(); ctx.arc(X(e.xBefore[0]), Y(e.xBefore[1]), 3.5, 0, 2 * Math.PI); ctx.fill();
      }
    });
    var x = src.x[i];
    ctx.fillStyle = C.series[0];
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(X(x[0]), Y(x[1]), p.radius * scale, 0, 2 * Math.PI); ctx.fill();
    ctx.globalAlpha = 1;
    $('timeReadout').textContent = 't = ' + fmt(src.t[i], 3) + ' s';
    var lastEv = null;
    src.events.forEach(function (e) { if (e.time <= src.t[i]) lastEv = e; });
    highlightPhase(lastEv && lastEv.resting ? 'rolling' : 'flight');
  }

  function nextEvent() {
    var src = S.anim.source;
    if (!src) return;
    setPlaying(false);
    var t = S.anim.t + 1e-9;
    var times = src.events.map(function (e) { return e.time; }).filter(function (v) { return v > t; });
    S.anim.t = times.length ? Math.min.apply(null, times) : src.t[0];
    drawFrame();
  }

  /* ===================== Hybrid model diagram ===================== */
  function arrowDefs() {
    return '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path class="ad-arrow" d="M0,0 L10,5 L0,10 z"/></marker></defs>';
  }
  function node(id, cx, cy, w, h, label) {
    return '<g class="ad-node" id="node-' + id + '"><rect x="' + (cx - w / 2) + '" y="' + (cy - h / 2) + '" width="' + w +
      '" height="' + h + '" rx="8"/><text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="12">' + label + '</text></g>';
  }
  function edge(d, cls) {
    return '<path class="ad-edge ' + (cls || '') + '" d="' + d + '" marker-end="url(#arrow)"/>';
  }
  function label(x, y, text, anchor, cls) {
    return '<text class="ad-label ' + (cls || '') + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '">' + text + '</text>';
  }

  function buildSlipDiagram() {
    var s = '<svg viewBox="0 0 400 250" role="img" aria-labelledby="adTitle adDesc">' +
      '<title id="adTitle">Hybrid model of the spring-mass runner</title>' +
      '<desc id="adDesc">Three phases: descending flight, stance and ascending flight, and a stop state. Touchdown leads from descending flight to stance, takeoff from stance to ascending flight, and apex from ascending flight back to descending flight, with the leg reset to the apex angle. Fall and foot below ground stop the run from descending flight; fall and reversal stop it from stance.</desc>' +
      arrowDefs() +
      node('flightDown', 85, 80, 128, 36, 'Descending flight') +
      node('stance', 315, 80, 110, 36, 'Stance') +
      node('flightUp', 200, 212, 128, 36, 'Ascending flight') +
      node('END', 200, 22, 70, 28, 'Stop') +
      edge('M149,80 L258,80') + label(203, 73, 'touchdown') +
      edge('M325,98 C330,160 300,200 266,208') + label(330, 158, 'takeoff', 'start') +
      edge('M136,212 C95,205 70,160 78,100') + label(68, 150, 'apex', 'end') +
      label(68, 164, 'reset: leg set', 'end', 'reset') + label(68, 177, 'to apex angle', 'end', 'reset') +
      edge('M85,62 C90,30 130,22 163,22', 'fail') + label(100, 34, 'fall, foot', 'end', 'reset') + label(100, 46, 'below ground', 'end', 'reset') +
      edge('M315,62 C310,30 270,22 237,22', 'fail') + label(300, 34, 'fall,', 'start', 'reset') + label(300, 46, 'reversal', 'start', 'reset') +
      '</svg>';
    $('automaton').innerHTML = s;
    $('automatonText').textContent = 'Each box is a phase with its own equations of motion. Each arrow is a guard: an event that ends the phase. The apex arrow carries a reset that places the leg at the apex angle. The highlighted box is the current phase of the animation.';
    $('trailKey').textContent = 'Body path: thick magenta line in stance, thin teal line in flight.';
  }

  function buildBallDiagram() {
    var s = '<svg viewBox="0 0 400 230" role="img" aria-labelledby="adTitleB adDescB">' +
      '<title id="adTitleB">Hybrid model of the ball in a box</title>' +
      '<desc id="adDescB">One flight phase with four guards, one per wall. Each impact returns to flight after a reset that reverses the normal velocity and scales it by the coefficient of restitution. A slow rebound from the floor leads to sliding on the floor, where only the side walls act.</desc>' +
      arrowDefs() +
      node('flight', 140, 115, 110, 40, 'Flight') +
      node('rolling', 330, 115, 110, 40, 'Sliding on floor') +
      edge('M110,95 C95,40 185,40 170,95') + label(140, 38, 'left wall, right wall,') + label(140, 51, 'ceiling, floor') +
      label(140, 175, 'reset: normal velocity', 'middle', 'reset') + label(140, 188, 'times minus restitution', 'middle', 'reset') +
      edge('M195,115 L273,115') + label(234, 106, 'floor,') + label(234, 135, 'slow rebound', 'middle', 'reset') +
      edge('M305,135 C290,195 370,195 355,135') + label(330, 210, 'side walls', 'middle', 'reset') +
      '</svg>';
    $('automaton').innerHTML = s;
    $('automatonText').textContent = 'The flight phase has four guards, one per wall. Each impact applies a reset and returns to flight. The highlighted box is the current phase of the animation.';
    $('trailKey').textContent = 'Ball path: teal line. Magenta dots mark impacts.';
  }

  var activeNode = null;
  function highlightPhase(name) {
    if (activeNode === name) return;
    activeNode = name;
    var nodes = document.querySelectorAll('#automaton .ad-node');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('active');
    var n = document.getElementById('node-' + name);
    if (n) n.classList.add('active');
  }

  /* ===================== Tabs ===================== */
  var TABS = ['stride', 'returnMap', 'family', 'retraction', 'perturb', 'map'];

  function selectTab(name, focus) {
    S.tab = name;
    TABS.forEach(function (t) {
      var tab = $('tab-' + t), panel = $('panel-' + t);
      var on = t === name;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
      if (on && focus) tab.focus();
    });
    if (name === 'perturb') runPerturbation();
    else if (S.run) setAnimSource(slipSource(S.run), false);
    renderActiveTab();
  }

  function setupTabs() {
    TABS.forEach(function (t, i) {
      var tab = $('tab-' + t);
      tab.addEventListener('click', function () { selectTab(t, false); });
      tab.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = TABS.length - 1;
        if (j !== null) { e.preventDefault(); selectTab(TABS[j], true); }
      });
    });
  }

  function renderActiveTab() {
    if (S.model !== 'slip') return;
    if (S.tab === 'stride') renderStride();
    else if (S.tab === 'returnMap') renderReturnMap();
    else if (S.tab === 'family') renderFamily();
    else if (S.tab === 'retraction') renderRetraction();
    else if (S.tab === 'perturb') renderPerturbation();
    else if (S.tab === 'map') renderGrid();
  }

  /* ----- Stride tab ----- */
  function renderStride() {
    renderPortraits();
    var M = S.M, msg = $('strideMessage');
    var table = $('measuresTable');
    if (!M || !M.ok) {
      msg.hidden = false;
      msg.textContent = 'The first stride did not complete: ' + reasonText(M && M.reason) +
        '. Change the settings, load a preset, or press Find periodic gait.';
      Plot.render($('strideCanvas'), { panels: [], panelHeight: 10 });
      table.innerHTML = '';
      return;
    }
    msg.hidden = true;
    var tr = M.trace, W = S.p.m * S.p.g;
    var ev = {};
    M.stride.events.forEach(function (e) { ev[e.guard] = e.time; });
    var shade = [{ x0: ev.touchdown, x1: ev.takeoff }];
    var t = tr.t;
    var E = tr.energy;
    var d = function (a) { var a0 = a[0]; return a.map(function (v) { return v - a0; }); };
    Plot.render($('strideCanvas'), {
      panelHeight: 175,
      alt: 'Vertical force peaks at ' + fmt(M.peakVerticalForceBW, 2) + ' body weights during a contact of ' +
        fmt(M.contactTime, 3) + ' s. Horizontal force brakes the body in early stance and propels it in late stance. Total mechanical energy stays constant while kinetic, gravitational and elastic energy exchange.',
      panels: [
        { yLabel: 'Vertical force (BW)', series: [{ x: t, y: tr.Fy.map(function (v) { return v / W; }), style: 0 }],
          refs: [{ y: 1 }], shade: shade },
        { yLabel: 'Horizontal force (BW)', series: [{ x: t, y: tr.Fx.map(function (v) { return v / W; }), style: 1 }],
          refs: [{ y: 0 }], shade: shade },
        { yLabel: 'Energy change (J)', xLabel: 'Time (s)', legend: 'outside', refs: [{ y: 0 }], shade: shade,
          series: [
            { x: t, y: d(E.kinetic), label: 'kinetic', style: 0 },
            { x: t, y: d(E.potential), label: 'gravitational', style: 1 },
            { x: t, y: d(E.elastic), label: 'elastic', style: 2 },
            { x: t, y: d(E.total), label: 'total', style: 3 }
          ] }
      ]
    });
    var rows = [
      ['Contact time', M.contactTime, 3, 's'],
      ['Flight time', M.flightTime, 3, 's'],
      ['Step frequency', M.stepFrequency, 3, '1/s'],
      ['Step length', M.stepLength, 3, 'm'],
      ['Average speed', M.meanSpeed, 3, 'm/s'],
      ['Duty factor (biped)', M.dutyFactor, 3, '-'],
      ['Touchdown angle', M.touchdownAngleDeg, 2, 'deg'],
      ['Leg sweep in stance', M.sweepAngleDeg, 2, 'deg'],
      ['Leg compression', M.legCompressionPct, 2, '% of L0'],
      ['Peak vertical force', M.peakVerticalForceBW, 3, 'BW'],
      ['Peak braking force', M.peakBrakingForceBW, 3, 'BW'],
      ['Peak elastic energy', M.peakElasticEnergy, 1, 'J'],
      ['Positive leg work per distance', M.positiveWorkPerDistance, 3, 'J/(kg m)'],
      ['Force-time cost index (1/contact time)', M.forceTimeCostIndex, 3, '1/s'],
      ['Energy change over the stride', M.energyChange, 2, 'J (check, ideally 0)'],
      ['Ground speed matching at touchdown', M.groundSpeedMatching * 100, 1, '%'],
      ['Stance half-angle (90 deg minus touchdown angle)', 90 - M.touchdownAngleDeg, 2, 'deg'],
      ['NMD estimate at the current retraction rate', 'NMD', 3, 'fraction of leg length']
    ];
    var html = '<thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Units</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var v = r[0] === 'Energy change over the stride' ? Number(r[1]).toExponential(r[2]) :
        (r[1] === 'NMD' ? nmdText(nmdEstimate(S.p, M.touchdownAngleDeg, S.p.retractionDegPerS), 'estimate') : fmt(r[1], r[2]));
      html += '<tr><td>' + r[0] + '</td><td>' + v + '</td><td>' + r[3] + '</td></tr>';
    });
    table.innerHTML = html + '</tbody>';
    renderNmdResult();
  }

  function renderNmdResult() {
    var out = $('nmdResult');
    var R = S.nmd;
    if (!R) {
      out.textContent = 'The simulated first-contact limit follows the ballistic path after drops of increasing height and finds the largest drop whose first touchdown loads the leg. It takes about a tenth of a second.';
      return;
    }
    out.textContent = 'Simulated first-contact limit: ' + nmdText(R.simulatedNMD, 'simulated') + ' leg lengths. Estimate at the current retraction rate of ' +
      fmt(S.p.retractionDegPerS, 1) + ' deg/s: ' + nmdText(R.estimateNMD, 'estimate') + '. The simulated value follows the actual ballistic path, so it includes the downward speed at touchdown and the change in hip height, which the estimate leaves out.';
  }

  function computeNmd() {
    var btn = $('nmdBtn');
    btn.disabled = true;
    setTimeout(function () {
      try {
        S.nmd = SlipSim.normalizedMaxDrop(S.p, S.apex);
        renderNmdResult();
        updateStatus($('nmdResult').textContent, true);
      } catch (e) {
        updateStatus('The first-contact limit could not be computed: ' + e.message, true);
      }
      btn.disabled = false;
    }, 20);
  }

  /* ----- Phase portraits (Stride tab) ----- */
  // Body height against vertical velocity (A) and leg length against leg
  // angle (B) for the run in the animation, with an optional perturbed start
  // at the same energy, as plotting/plotPhasePortraits.m.
  var PHASES = ['flightDown', 'stance', 'flightUp'];
  var PHASE_WIDTH = [2, 3, 1.3];

  function legAngleOf(x) { return Math.atan2(x[1] - x[5], x[4] - x[0]) / DEG; }
  function legLengthOf(x) { return Math.hypot(x[0] - x[4], x[1] - x[5]); }

  function portraitTrace(run, y0) {
    var tr = run.trace;
    var T = { y: [], vy: [], a: [], L: [], phase: tr.phase, apexY: [y0], resets: [] };
    tr.x.forEach(function (x) { T.y.push(x[1]); T.vy.push(x[3]); T.a.push(legAngleOf(x)); T.L.push(legLengthOf(x)); });
    tr.events.forEach(function (e) {
      if (e.guard === 'apex') {
        T.apexY.push(e.xAfter[1]);
        T.resets.push([legAngleOf(e.x), legAngleOf(e.xAfter)]);
      }
    });
    return T;
  }

  // One series per phase. Descending flight and stance also take the first
  // point of the next phase, so the loop closes at touchdown and takeoff;
  // ascending flight ends at apex, where the leg reset is a jump.
  function phaseSeries(X, Y, phase, widths, C) {
    return PHASES.map(function (ph, k) {
      var xs = [], ys = [];
      for (var i = 0; i < X.length; i++) {
        var on = phase[i] === ph || (ph !== 'flightUp' && i > 0 && phase[i - 1] === ph && phase[i] !== ph);
        xs.push(on ? X[i] : null);
        ys.push(on ? Y[i] : null);
      }
      return { x: xs, y: ys, color: C.series[k], width: widths[k] };
    });
  }

  function perturbedRun() {
    var P = S.portrait, p = S.p, a = S.apex;
    var key = JSON.stringify([p, a, P.dy, P.n]);
    if (P.key === key) return P.run;
    var E = p.m * p.g * a.y + 0.5 * p.m * a.vx * a.vx;
    var y1 = a.y + P.dy;
    var vx2 = 2 * (E / p.m - p.g * y1);
    P.key = key;
    if (!(vx2 > 0)) { P.run = null; P.failed = 'energy'; return null; }
    P.failed = '';
    P.run = SlipSim.simulateStrides(p, { y: y1, vx: Math.sqrt(vx2) }, P.n, { trace: true, traceDt: 1e-3 });
    return P.run;
  }

  function renderPortraits() {
    if (!S.run) return;
    var C = Plot.colors();
    var G = portraitTrace(S.run, S.apex.y);
    var P = S.portrait;
    var pert = P.on ? perturbedRun() : null;
    var R = pert ? portraitTrace(pert, S.apex.y + P.dy) : null;
    var thin = [0.6, 0.6, 0.6];

    // Panel A: body height against vertical velocity
    var seriesA = [];
    if (R) seriesA = seriesA.concat(phaseSeries(R.vy, R.y, R.phase, thin, C));
    seriesA = seriesA.concat(phaseSeries(G.vy, G.y, G.phase, PHASE_WIDTH, C));
    seriesA.push({ x: G.apexY.map(function () { return 0; }), y: G.apexY, points: true, color: C.series[1], radius: 4.5 });
    var labelsA = [];
    if (R) {
      seriesA.push({ x: R.apexY.map(function () { return 0; }), y: R.apexY, points: true, color: C.series[2], radius: 3.5 });
      // Even-numbered apex points to the right of the section line and odd
      // ones to the left, fanned out so close points stay readable.
      R.apexY.forEach(function (y, i) {
        var right = i % 2 === 0, step = 8 + 10 * Math.floor(i / 2);
        labelsA.push({ x: 0, y: y, text: String(i), dx: right ? step : -step, align: right ? 'left' : 'right', color: C.text });
      });
    }
    var outA = Plot.render($('portraitA'), {
      panelHeight: 300,
      alt: 'Phase portrait A: body height against vertical velocity for the run in the animation' + (R ? ', with a perturbed start drawn thin.' : '.'),
      panels: [{ xLabel: 'Vertical velocity (m/s)', yLabel: 'Body height (m)', title: 'A. Body height and vertical velocity',
        refs: [{ x: 0, label: 'apex section' }], series: seriesA, labels: labelsA }]
    });

    // Panel B: leg length against leg angle from the ground
    var seriesB = [];
    if (R) seriesB = seriesB.concat(phaseSeries(R.a, R.L, R.phase, thin, C));
    seriesB = seriesB.concat(phaseSeries(G.a, G.L, G.phase, PHASE_WIDTH, C));
    var rx = [], ry = [];
    G.resets.forEach(function (r) { rx.push(r[0], r[1], null); ry.push(S.p.L0, S.p.L0, null); });
    if (rx.length) seriesB.push({ x: rx, y: ry, dotted: true });
    var labelsB = G.resets.length ? [{ x: 0.5 * (G.resets[0][0] + G.resets[0][1]), y: S.p.L0, text: 'apex reset', align: 'center', dx: 0, dy: -9, color: C.grey }] : [];
    var outB = Plot.render($('portraitB'), {
      panelHeight: 300,
      alt: 'Phase portrait B: leg length against leg angle from the ground for the run in the animation' + (R ? ', with a perturbed start drawn thin.' : '.'),
      panels: [{ xLabel: 'Leg angle from ground (deg)', yLabel: 'Leg length (m)', title: 'B. Leg angle and leg length',
        series: seriesB, labels: labelsB }]
    });
    P.tA = outA.transforms[0];
    P.tB = outB.transforms[0];

    $('pertFollow').disabled = !P.on;
    portraitCaption(G, R, pert);
    // The animation follows the perturbed start when asked to.
    if (S.tab === 'stride') {
      var want = P.on && P.follow === 'perturbed' && pert ? pert : S.run;
      if (!S.anim.source || S.anim.source.runRef !== want) setAnimSource(slipSource(want), undefined);
    }
    drawPortraitDots();
  }

  function portraitCaption(G, R, pert) {
    var P = S.portrait;
    var n = S.run.apexSeq.length - 1;
    var t = 'A: body height against vertical velocity for the ' + n + ' strides in the animation. One stride of a periodic gait traces a closed loop, and the apex, where vertical velocity crosses zero in flight (dotted line), is the section of the apex return map. ' +
      'B: leg length against leg angle from the ground, as in the stride phase plots of Blum et al. (2011). Flight runs at rest length while the leg retracts, stance dips as the leg compresses and sweeps rearward, and the dotted line marks the leg reset at apex.';
    if (!S.periodic) t += ' The current apex state is not periodic, so successive strides trace different loops.';
    if (P.on) {
      var sign = P.dy >= 0 ? '+' : '';
      if (!pert) {
        t += ' The perturbed start (apex height ' + sign + fmt(P.dy * 100, 1) + ' cm) needs more energy than the current gait has; choose a smaller apex height change.';
      } else {
        var done = pert.apexSeq.length - 1;
        t += ' The perturbed start (apex height ' + sign + fmt(P.dy * 100, 1) + ' cm at the same energy, thin lines, apex points numbered) ' +
          (pert.reason === 'cycleLimit' ? 'completed all ' + done + ' strides.' : 'stopped after ' + done + ' completed strides: ' + reasonText(pert.reason) + '.');
        var dev = pert.apexSeq.map(function (a) { return a.y - S.apex.y; });
        if (dev.length >= 3) {
          var alt = true;
          for (var i = 1; i < dev.length; i++) if (Math.sign(dev[i]) === Math.sign(dev[i - 1])) alt = false;
          var ratio = Math.abs(dev[dev.length - 1]) / Math.abs(dev[0]);
          t += ' Its apex heights ' + (alt ? 'alternate above and below' : 'do not alternate around') + ' the ' + (S.periodic ? 'periodic apex' : 'starting apex height') +
            ', and the deviation ' + (ratio < 1 ? 'shrinks' : 'grows') + ' to ' + fmt(ratio, 2) + ' times its starting size after ' + (dev.length - 1) +
            ' strides. The Return map tab gives lambda, the factor per stride.';
        }
      }
    }
    $('portraitCaption').textContent = t;
  }

  // Overlay canvases matched to the portrait canvases.
  function overlayCtx(base, over) {
    var dpr = window.devicePixelRatio || 1;
    var w = base.clientWidth, h = base.clientHeight;
    if (over.width !== Math.round(w * dpr) || over.height !== Math.round(h * dpr)) {
      over.width = Math.round(w * dpr);
      over.height = Math.round(h * dpr);
      over.style.height = h + 'px';
    }
    var ctx = over.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  // One orange dot per portrait at the state of the current animation frame.
  function drawPortraitDots() {
    var P = S.portrait, src = S.anim.source;
    if (S.model !== 'slip' || S.tab !== 'stride' || !P.tA || !src || src.kind !== 'slip' || !src.t.length) return;
    var x = src.x[indexAt(src.t, S.anim.t)];
    var C = Plot.colors();
    [[ $('portraitA'), $('portraitADot'), P.tA, x[3], x[1] ], [ $('portraitB'), $('portraitBDot'), P.tB, legAngleOf(x), legLengthOf(x) ]].forEach(function (d) {
      var ctx = overlayCtx(d[0], d[1]);
      var T = d[2], X = T.sx(d[3]), Y = T.sy(d[4]);
      if (X < T.plot.x - 2 || X > T.plot.x + T.plot.w + 2 || Y < T.plot.y - 2 || Y > T.plot.y + T.plot.h + 2) return;
      ctx.fillStyle = C.series[4];
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X, Y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
  }

  /* ----- Return map tab ----- */
  function renderReturnMap() {
    var p = S.p, a = S.apex;
    var E = p.m * p.g * a.y + 0.5 * p.m * a.vx * a.vx;
    var lo = a.y - 0.03, hi = a.y + 0.03;
    var ys = linspace(lo, hi, 61);
    var map = SlipSim.apexMapAtEnergy(p, a, ys);
    var next = function (y) {
      var vx2 = 2 * (E / p.m - p.g * y);
      if (vx2 <= 0) return NaN;
      return SlipSim.returnMap(p, { y: y, vx: Math.sqrt(vx2) }).y;
    };
    // Cobweb at constant energy
    var y0 = a.y + S.cobwebStart;
    var cx = [y0], cy = [lo], yn = y0;
    for (var i = 0; i < 12; i++) {
      var y1 = next(yn);
      if (!isFinite(y1)) break;
      cx.push(yn, y1); cy.push(y1, y1);
      yn = y1;
    }
    var mapCanvas = $('mapCanvas');
    var w = mapCanvas.clientWidth || 360;
    Plot.render(mapCanvas, {
      panelHeight: Math.min(Math.max(w * 0.9, 260), 420),
      alt: 'Return map of apex height at constant energy, with the identity line and a cobweb from a start ' +
        fmt(S.cobwebStart * 100, 1) + ' cm from the current apex height. Slope lambda ' + fmt(S.lambda, 3) + '.',
      panels: [{
        xLabel: 'Apex height, stride n (m)', yLabel: 'Apex height, stride n+1 (m)',
        xLim: [lo, hi], yLim: [lo, hi], refs: [{ identity: true }], legend: 'tl', includeRefs: false,
        series: [
          { x: ys, y: map, label: 'return map', style: 0 },
          { x: cx, y: cy, label: 'cobweb', style: 1 },
          { x: [y0], y: [lo], points: true, style: 1 }
        ]
      }]
    });
    var seq = S.run ? S.run.apexSeq : [];
    var n = seq.map(function (_, k) { return k; });
    Plot.render($('seqCanvas'), {
      panelHeight: 170,
      alt: 'Apex height and apex speed for each stride of the current run.',
      panels: [
        { yLabel: 'Apex height (m)', series: [{ x: n, y: seq.map(function (s) { return s.y; }), style: 0, points: true, line: true }] },
        { yLabel: 'Apex speed (m/s)', xLabel: 'Stride', series: [{ x: n, y: seq.map(function (s) { return s.vx; }), style: 1, points: true, line: true }] }
      ]
    });
    var lam = S.lambda, txt;
    if (!isFinite(lam)) {
      txt = 'The stride fails from this apex state, so the slope of the return map is not defined here.';
    } else {
      txt = 'lambda = ' + fmt(lam, 3) + ', the slope of the return map at the current apex height with the energy held fixed. ';
      if (Math.abs(lam) < 1) txt += 'Because |lambda| < 1, a small error in apex height shrinks each stride. ';
      else txt += 'Because |lambda| > 1, a small error in apex height grows each stride. ';
      txt += lam < 0 ? 'Because lambda < 0, the error changes sign from stride to stride. ' : 'Because lambda > 0, the error keeps its sign. ';
      if (!S.periodic) txt += 'The current apex state is not periodic, so lambda describes the map at this point only; press Find periodic gait for the slope at a fixed point.';
    }
    $('lambdaText').textContent = txt;
  }

  /* ----- Same speed, different legs ----- */
  function okRow(r) { return r && r.legAngleDeg !== null && r.legAngleDeg !== undefined && isFinite(r.legAngleDeg) && r.ok !== false; }
  function num(v) { return v === null || v === undefined ? NaN : Number(v); }

  // Summary of a stiffness family, computed from its rows.
  function familyStats(rows) {
    var ok = rows.filter(okRow);
    if (!ok.length) return null;
    var k = function (r) { return r.k / 1000; };
    var lam = ok.map(function (r) { return num(r.lambda); });
    var stableSeg = [], seg = null;
    ok.forEach(function (r, i) {
      if (Math.abs(lam[i]) < 1) { if (!seg) { seg = [k(r), k(r)]; stableSeg.push(seg); } else seg[1] = k(r); }
      else seg = null;
    });
    var iBest = 0, iMin = 0, iMax = 0;
    lam.forEach(function (v, i) {
      if (Math.abs(v) < Math.abs(lam[iBest])) iBest = i;
      if (v < lam[iMin]) iMin = i;
      if (v > lam[iMax]) iMax = i;
    });
    var crossings = [];
    for (var i = 1; i < ok.length; i++) {
      if (lam[i - 1] < 0 && lam[i] >= 0 || lam[i - 1] >= 0 && lam[i] < 0) {
        var f = lam[i - 1] / (lam[i - 1] - lam[i]);
        crossings.push({ k: k(ok[i - 1]) + f * (k(ok[i]) - k(ok[i - 1])), up: lam[i] > lam[i - 1] });
      }
    }
    var retr = ok.filter(function (r) { return num(r.retractionDegPerS) > 1e-9; });
    var clear = ok.map(function (r) { return num(r.apexClearance); }).filter(isFinite);
    return {
      ok: ok, kMin: k(ok[0]), kMax: k(ok[ok.length - 1]), n: ok.length,
      stableSeg: stableSeg, allStable: stableSeg.length === 1 && stableSeg[0][0] === k(ok[0]) && stableSeg[0][1] === k(ok[ok.length - 1]),
      kStableMin: stableSeg.length ? stableSeg[0][0] : NaN, kStableMax: stableSeg.length ? stableSeg[stableSeg.length - 1][1] : NaN,
      kBest: k(ok[iBest]), lambdaBest: lam[iBest],
      kLambdaMin: k(ok[iMin]), lambdaMin: lam[iMin], kLambdaMax: k(ok[iMax]), lambdaMax: lam[iMax],
      crossings: crossings,
      nRetract: retr.length,
      retrFirst: retr.length ? retr[0] : null, retrLast: retr.length ? retr[retr.length - 1] : null,
      clearanceMin: clear.length ? Math.min.apply(null, clear) : NaN,
      speed: ok[0].meanSpeed, frequency: ok[0].stepFrequency
    };
  }

  function trendWord(rows, field) {
    var a = num(rows[0][field]), b = num(rows[rows.length - 1][field]);
    return b > a ? 'rises' : 'falls';
  }

  // Stability description written from the rows.
  function stabilityText(st) {
    var t = '';
    if (st.allStable) t += 'Every gait in this family has |lambda| < 1, so small errors in apex height decay. ';
    else if (st.stableSeg.length) {
      t += '|lambda| < 1, so small errors decay, for ' + st.stableSeg.map(function (sg) {
        return sg[0] === sg[1] ? fmt(sg[0], 0) + ' kN/m' : fmt(sg[0], 0) + ' to ' + fmt(sg[1], 0) + ' kN/m';
      }).join(' and ') + '; errors grow at the other stiffnesses. ';
    } else t += 'No gait in this family has |lambda| < 1. ';
    if (!st.crossings.length) {
      t += st.lambdaMax < 0 ? 'lambda is negative for every gait, so errors change sign from stride to stride. ' :
        'lambda is positive for every gait, so errors keep their sign. ';
    } else {
      t += st.crossings.map(function (c) {
        return 'lambda changes from ' + (c.up ? 'negative to positive' : 'positive to negative') + ' near ' + fmt(c.k, 1) + ' kN/m';
      }).join('; ') + ': errors change sign from stride to stride where lambda < 0 and keep their sign where lambda > 0. ';
    }
    t += 'lambda is most negative (' + fmt(st.lambdaMin, 3) + ') at ' + fmt(st.kLambdaMin, 0) + ' kN/m and largest (' +
      fmt(st.lambdaMax, 3) + ') at ' + fmt(st.kLambdaMax, 0) + ' kN/m; |lambda| is smallest (' + fmt(Math.abs(st.lambdaBest), 3) +
      ') at ' + fmt(st.kBest, 0) + ' kN/m, where errors decay fastest.';
    return t;
  }

  // How the family sets swing-leg retraction, written from its rule and rows.
  function familyRetractionText(rows) {
    var R = S.family.source === 'matlab' ? REF.slip.family.retraction : S.family.retraction;
    var a = rows[0], b = rows[rows.length - 1];
    var tail = ' Retraction leaves each periodic gait unchanged and changes only its stability and its response to perturbations.';
    if (!R || R.rule === 'fixed') return 'Every gait in this family uses a fixed leg angle (no swing-leg retraction).';
    if (R.rule === 'commonPerCycle') {
      var src = humanRowFor(R.value);
      return 'Every gait in this family uses one retraction rate, ' + fmt(R.value, 1) + ' deg per gait cycle' +
        (src ? ', the human leg rotation rate at touchdown at ' + fmt(src.speed_mps, 2) + ' m/s (Blum et al. 2011)' : '') +
        ', which is ' + fmt(a.retractionDegPerS, 1) + ' deg/s for these gaits (gait cycle ' + fmt(2 / a.stepFrequency, 3) + ' s, two steps).' + tail;
    }
    if (R.rule === 'common') return 'Every gait in this family uses one retraction rate of ' + fmt(R.value, 1) + ' deg/s.' + tail;
    var what = { clearance: 'the rate that places the foot ' + fmt(R.value * 100, 1) + ' cm above the ground at apex',
      fastestRecovery: 'the rate for fastest recovery (lambda = 0, or no retraction where lambda is already negative)',
      groundSpeedMatching: 'the rate for the largest ground speed matching' }[R.rule] || 'its own retraction rate';
    return 'Each gait in this family uses ' + what + ', from ' + fmt(a.retractionDegPerS, 1) + ' deg/s at ' + fmt(a.k / 1000, 0) +
      ' kN/m to ' + fmt(b.retractionDegPerS, 1) + ' deg/s at ' + fmt(b.k / 1000, 0) + ' kN/m.' + tail;
  }

  function renderFamily() {
    var rows = S.family.rows.filter(okRow);
    var st = familyStats(S.family.rows);
    if (!st) { $('familyIntro').textContent = 'No gaits in this family.'; return; }
    var kk = rows.map(function (r) { return r.k / 1000; });
    var col = function (f) { return rows.map(function (r) { return num(r[f]); }); };
    var presetSeries = function () { return []; };
    if (S.family.source === 'matlab') {
      presetSeries = function (field) {
        return PRESETS.slice().sort(function (a, b) { return a.k - b.k; }).map(function (pr, j) {
          var r = rows.filter(function (q) { return Math.abs(q.k - pr.k) < 1; })[0];
          // Marker colors magenta, teal, orange stay distinct from the family line in both themes.
          var C = Plot.colors();
          var colr = [C.series[1], C.series[2], C.series[4]][j % 3];
          return { x: [pr.k / 1000], y: [r ? num(r[field]) : NaN], points: true, style: j + 1, color: colr,
            radius: [6.5, 5.5, 4.5][j % 3], label: pr.label };
        });
      };
    }
    var panel = function (field, ylab, refs, legend, scale) {
      var sc = scale || 1;
      var cur = rows.filter(function (r) { return Math.abs(r.k - S.p.k) < 1; })[0];
      var scaled = function (arr) { return arr.map(function (v) { return v * sc; }); };
      return {
        xLabel: 'Leg stiffness (kN/m)', yLabel: ylab, refs: refs || [], legend: legend || null,
        series: [{ x: kk, y: scaled(col(field)), style: 0, width: 2 }].concat(presetSeries(field).map(function (s) {
          return Object.assign(s, { y: scaled(s.y) });
        })),
        marks: S.family.source !== 'matlab' && cur ? [{ x: cur.k / 1000, y: num(cur[field]) * sc }] : []
      };
    };
    var canvas = $('familyCanvas');
    var w = canvas.clientWidth || 600;
    var cols = w >= 980 ? 4 : (w >= 700 ? 3 : (w >= 460 ? 2 : 1));
    var panels = [
      panel('touchdownAngleDeg', 'Touchdown angle (deg)', [], 'tl'),
      panel('apexClearance', 'Foot clearance at apex (cm)', [], null, 100),
      panel('peakVerticalForceBW', 'Peak vertical force (BW)'),
      panel('contactTime', 'Contact time (s)'),
      panel('positiveWorkPerDistance', 'Positive leg work (J/(kg m))'),
      panel('forceTimeCostIndex', 'Force-time cost index (1/s)'),
      panel('lambda', 'Eigenvalue lambda', [{ y: -1 }, { y: 0 }, { y: 1 }])
    ];
    Plot.render(canvas, {
      cols: cols, panelHeight: 210, panels: panels,
      alt: 'Panels against leg stiffness from ' + fmt(st.kMin, 0) + ' to ' + fmt(st.kMax, 0) +
        ' kN/m at one average speed: touchdown angle, foot clearance at apex, peak vertical force, contact time, positive leg work per distance, force-time cost index and eigenvalue lambda.'
    });

    renderFamilyNmd(rows, st);

    var src = S.family.source === 'matlab' ? 'computed in MATLAB (tools/exportWebReference.m)' : 'computed in this browser for the current body';
    $('familyIntro').textContent = 'Every gait in this family is periodic at an average speed of ' + fmt(st.speed, 2) +
      ' m/s and ' + fmt(st.frequency, 2) + ' steps per second. Each leg stiffness reaches that speed with its own touchdown angle and apex height, so one speed admits many solutions. ' +
      familyRetractionText(rows) + ' Family ' + src + '.';

    var first = rows[0], last = rows[rows.length - 1];
    var parts = [];
    parts.push('From ' + fmt(st.kMin, 0) + ' to ' + fmt(st.kMax, 0) + ' kN/m, the leg angle at touchdown ' + trendWord(rows, 'touchdownAngleDeg') +
      ' from ' + fmt(first.touchdownAngleDeg, 1) + ' to ' + fmt(last.touchdownAngleDeg, 1) + ' deg, contact time ' + trendWord(rows, 'contactTime') +
      ' from ' + fmt(first.contactTime, 3) + ' to ' + fmt(last.contactTime, 3) + ' s, and peak vertical force ' + trendWord(rows, 'peakVerticalForceBW') +
      ' from ' + fmt(first.peakVerticalForceBW, 2) + ' to ' + fmt(last.peakVerticalForceBW, 2) + ' body weights. The average vertical force over a stride equals body weight, so a shorter contact needs a higher peak.');
    parts.push('The model conserves mechanical energy, so the legs do no net work over a stride and any energy cost needs a proxy. Positive leg work per distance, the mechanical work by the legs if the spring returned no energy, ' +
      trendWord(rows, 'positiveWorkPerDistance') + ' from ' + fmt(first.positiveWorkPerDistance, 3) + ' to ' + fmt(last.positiveWorkPerDistance, 3) +
      ' J/(kg m). The force-time cost index, the inverse of contact time from the force-time hypothesis of Kram and Taylor (1990), ' +
      trendWord(rows, 'forceTimeCostIndex') + ' from ' + fmt(first.forceTimeCostIndex, 2) + ' to ' + fmt(last.forceTimeCostIndex, 2) + ' 1/s. The two proxies rank the gaits in opposite order.');
    parts.push(stabilityText(st));
    nmdParagraphs(rows).forEach(function (x) { parts.push(x); });
    var ft = $('familyText');
    ft.innerHTML = '';
    parts.forEach(function (x) { ft.appendChild(el('p', null, x)); });

    // Comparison table of the presets (MATLAB family): one row per measure,
    // one column per gait, ordered by leg stiffness.
    var tbl = $('familyTable');
    var gaits = PRESETS.slice().sort(function (a, b) { return a.k - b.k; }).map(function (pr) {
      return { pr: pr, r: MATLAB_FAMILY.filter(function (q) { return Math.abs(q.k - pr.k) < 1; })[0] || {} };
    });
    var measures = [
      ['Leg stiffness (kN/m)', function (g) { return fmt(g.pr.k / 1000, 0); }],
      ['Apex height (m)', function (g) { return fmt(g.pr.apexHeight, 4); }],
      ['Leg angle at apex (deg)', function (g) { return fmt(g.pr.legAngleDeg, 2); }],
      ['Retraction rate (deg/s)', function (g) { return fmt(g.pr.retractionDegPerS, 1); }],
      ['Retraction rate (deg per gait cycle)', function (g) { return fmt(g.pr.retractionDegPerS * 2 / g.pr.stepFrequency, 1); }],
      ['Touchdown angle (deg)', function (g) { return fmt(g.pr.touchdownAngleDeg, 2); }],
      ['Stance half-angle Phi (deg)', function (g) { return fmt(g.pr.stanceHalfAngleDeg, 2); }],
      ['Foot clearance at apex (cm)', function (g) { return fmt(g.pr.apexClearance * 100, 1); }],
      ['Contact time (s)', function (g) { return fmt(g.r.contactTime, 3); }],
      ['Duty factor', function (g) { return fmt(g.r.dutyFactor, 3); }],
      ['Peak vertical force (BW)', function (g) { return fmt(g.r.peakVerticalForceBW, 2); }],
      ['Leg compression (% of L0)', function (g) { return fmt(g.r.legCompressionPct, 1); }],
      ['Positive leg work (J/(kg m))', function (g) { return fmt(g.r.positiveWorkPerDistance, 3); }],
      ['Force-time cost index (1/s)', function (g) { return fmt(g.r.forceTimeCostIndex, 2); }],
      ['Eigenvalue lambda', function (g) { return fmt(g.pr.lambda, 3); }],
      ['group', 'Unexpected drop (fraction of leg length)'],
      ['NMD estimate', function (g) { return nmdText(g.pr.nmdEstimate, 'estimate', 2); }],
      ['Simulated first-contact limit', function (g) { return nmdText(g.pr.nmdSimulated, 'simulated', 2); }]
    ];
    var html = '<caption>Values from the MATLAB family. Load sets the sidebar to that gait.</caption><thead><tr><th scope="col">Measure</th>' +
      gaits.map(function (g) { return '<th scope="col">' + g.pr.label + '</th>'; }).join('') + '</tr></thead><tbody>';
    measures.forEach(function (m) {
      if (m[0] === 'group') {
        html += '<tr class="group"><th scope="colgroup" colspan="' + (gaits.length + 1) + '">' + m[1] + '</th></tr>';
        return;
      }
      html += '<tr' + (m[2] ? ' class="' + m[2] + '"' : '') + '><th scope="row">' + m[0] + '</th>' +
        gaits.map(function (g) { return '<td>' + m[1](g) + '</td>'; }).join('') + '</tr>';
    });
    html += '<tr><td></td>' + gaits.map(function (g) {
      return '<td><button type="button" class="btn btn-quiet load-preset" data-preset="' + g.pr.name +
        '" aria-label="Load ' + g.pr.label + '">Load</button></td>';
    }).join('') + '</tr>';
    tbl.innerHTML = html + '</tbody>';
    Array.prototype.forEach.call(tbl.querySelectorAll('.load-preset'), function (b) {
      b.addEventListener('click', function () {
        loadPreset(b.getAttribute('data-preset'));
        setPlaying(!reducedMotion);
        updateStatus('Loaded ' + preset(b.getAttribute('data-preset')).label + '.');
      });
    });
  }

  // NMD against stiffness: three series, clipped at 3 leg lengths.
  function renderFamilyNmd(rows, st) {
    var NMD_CAP = 3;
    var kk = rows.map(function (r) { return r.k / 1000; });
    var col = function (f) { return rows.map(function (r) { return finiteOrNaN(r[f]); }); };
    var own = col('nmdEstimate'), sim = col('nmdSimulated');
    // Scale the axis to the data (10 percent headroom); cap it only when the
    // values exceed the cap.
    var finiteVals = own.concat(sim).filter(isFinite);
    var dataMax = finiteVals.length ? Math.max.apply(null, finiteVals) : 1;
    var NMD_TOP = Math.min(1.1 * dataMax, NMD_CAP);
    var capped = 1.1 * dataMax > NMD_CAP;
    Plot.render($('familyNmdCanvas'), {
      panelHeight: 250,
      alt: 'Normalized maximum drop against leg stiffness: the closed-form estimate and the simulated first-contact limit.',
      panels: [{
        xLabel: 'Leg stiffness (kN/m)', yLabel: 'NMD (fraction of leg length)', yLim: [0, NMD_TOP], legend: 'outside',
        series: [
          { x: kk, y: own, style: 0, label: 'estimate' },
          { x: kk, y: sim, style: 1, label: 'simulated first contact' }
        ]
      }]
    });
    var above = function (arr) { return kk.filter(function (k, i) { return arr[i] > NMD_TOP; }); };
    var notFinite = function (v) { return v === null || v === undefined || v === Infinity; };
    var noLimitOwn = rows.filter(function (r) { return notFinite(r.nmdEstimate); }).length;
    var beyondSim = rows.filter(function (r) { return notFinite(r.nmdSimulated); }).map(function (r) { return r.k / 1000; });
    var note = capped ? 'The axis stops at ' + NMD_CAP + ' leg lengths.' : '';
    var a1 = above(own), a2 = above(sim);
    if (a1.length) note += ' The estimate exceeds it from ' + fmt(a1[0], 0) + ' kN/m.';
    if (a2.length) note += ' The simulated limit exceeds it from ' + fmt(a2[0], 0) + ' kN/m.';
    if (beyondSim.length) note += ' From ' + fmt(beyondSim[0], 0) + ' kN/m the simulated limit lies beyond the 5 m search and is left out.';
    if (noLimitOwn) note += ' Gaits with a fixed leg angle have no estimate limit and are left out.';
    $('familyNmdNote').textContent = note.trim();
  }

  function orderText(list, field, d) {
    return list.map(function (g) { return g.label + ' (' + nmdText(g[field], field === 'nmdSimulated' ? 'simulated' : 'estimate', d) + ')'; }).join(' to ');
  }

  // Explanation of NMD, computed from the preset and family rows.
  function nmdParagraphs(rows) {
    var out = [];
    out.push('Real animals do not behave as a perfect conservative spring-mass system. After an unexpected drop they have time to recover with non-conservative dynamics, such as muscle work and damping, provided the leg makes contact and takes load in the stance right after the drop. The normalized maximum drop of Daley and Usherwood (2010) measures that first-contact limit: NMD = dHmax / L, with dHmax = (g / 2) (Phi / omega)^2, where Phi is the stance half-angle (90 deg minus the touchdown angle), omega the leg retraction rate and L the leg length. For a larger drop the leg rotates past vertical before the foot reaches the ground and misses stance.');
    var P = PRESETS.map(function (pr) {
      return { label: pr.label, k: pr.k, rate: pr.retractionDegPerS, nmdEstimate: finiteOrNaN(pr.nmdEstimate),
        nmdSimulated: finiteOrNaN(pr.nmdSimulated) };
    });
    var by = function (f) { return P.filter(function (g) { return isFinite(g[f]); }).sort(function (a, b) { return a[f] - b[f]; }); };
    var est = by('nmdEstimate'), sim = by('nmdSimulated');
    var compliant = P.reduce(function (a, b) { return b.k < a.k ? b : a; });
    var common = P.every(function (g) { return Math.abs(g.rate - P[0].rate) < 1e-6; });
    var t = (common ? 'With every preset at the same retraction rate of ' + fmt(P[0].rate, 1) + ' deg/s, the' : 'The') +
      ' NMD estimate rises from ' + orderText(est, 'nmdEstimate', 2) + '.';
    if (common && est.length && est[est.length - 1].label === compliant.label) {
      t += ' At a common rate the most compliant leg, with the widest stance half-angle, has the largest NMD, the outcome Daley and Usherwood (2010) predicted.';
    }
    out.push(t);
    var ratios = P.filter(function (g) { return isFinite(g.nmdSimulated) && isFinite(g.nmdEstimate) && g.nmdEstimate > 0; })
      .map(function (g) { return g.nmdSimulated / g.nmdEstimate; });
    var t2 = 'The simulated first-contact limit follows the actual ballistic path and rises from ' + orderText(sim, 'nmdSimulated', 2) + '.';
    if (ratios.length && ratios.every(function (r) { return r > 1; })) {
      t2 += ' It exceeds the estimate in every preset, by a factor of ' + fmt(Math.min.apply(null, ratios), 2) + ' to ' + fmt(Math.max.apply(null, ratios), 2) +
        ', because it includes the downward speed of the body at touchdown and the change in hip height, which the estimate leaves out.';
    }
    var first = rows[0], last = rows[rows.length - 1];
    if (first && last && isFinite(finiteOrNaN(first.nmdEstimate)) && isFinite(finiteOrNaN(last.nmdEstimate))) {
      t2 += ' Across the family, the estimate ' + (finiteOrNaN(last.nmdEstimate) > finiteOrNaN(first.nmdEstimate) ? 'rises' : 'falls') +
        ' from ' + nmdText(first.nmdEstimate, 'estimate', 2) + ' at ' + fmt(first.k / 1000, 0) + ' kN/m to ' +
        nmdText(last.nmdEstimate, 'estimate', 2) + ' at ' + fmt(last.k / 1000, 0) + ' kN/m.';
    }
    out.push(t2);
    return out;
  }

  async function recomputeFamily() {
    var btn = $('familyRecompute'), prog = $('familyProgress');
    var target = { meanSpeed: S.target.meanSpeed, hold: 'stepFrequency', stepFrequency: S.target.stepFrequency };
    var rule = $('familyRule').value;
    var rv = parseFloat($('familyRuleValue').value);
    if (ruleNeedsValue(rule) && !isFinite(rv)) {
      updateStatus('Enter a value for the retraction rule.', true);
      return;
    }
    btn.disabled = true;
    updateStatus('Finding the periodic gait at the target speed and step frequency...', true);
    await pause();
    var g = SlipSim.findGait(S.p, target, { y: S.apex.y, vx: S.apex.vx, legAngleDeg: S.p.legAngleDeg });
    if (!g.ok) {
      btn.disabled = false;
      updateStatus('No periodic gait at the target speed from the current settings. Press Find periodic gait first, or load a preset.', true);
      return;
    }
    S.p.legAngleDeg = g.p.legAngleDeg;
    S.apex = { y: g.y, vx: g.vx };
    syncControls();
    var scale = (S.p.m * S.p.g / S.p.L0) / (80 * 9.81 / 1);
    var kValues = MATLAB_FAMILY.map(function (r) { return Math.round(r.k * scale); });
    prog.hidden = false;
    prog.value = 0;
    var rows;
    try {
      rows = await SlipSim.stiffnessFamily({ p: g.p, y: g.y, vx: g.vx }, kValues, target, {
        retractionRule: rule,
        retractionValue: ruleNeedsValue(rule) ? rv : NaN,
        onProgress: function (f) { prog.value = f; }
      });
    } catch (e) {
      prog.hidden = true;
      btn.disabled = false;
      updateStatus('The family could not be computed: ' + e.message, true);
      return;
    }
    prog.hidden = true;
    btn.disabled = false;
    S.family = { rows: rows, source: 'browser', retraction: { rule: rule, value: rv } };
    recomputeSlip();
    updateStatus('Family recomputed: ' + rows.filter(okRow).length + ' of ' + rows.length + ' gaits solved' +
      ', retraction rule: ' + $('familyRule').selectedOptions[0].textContent.toLowerCase() + '.', true);
  }

  /* ----- Retraction rate tab ----- */
  // Results for the current preset from MATLAB, or for the current gait
  // computed in the browser.
  function retrData() {
    if (S.retr && S.retr.source === 'browser') return S.retr;
    var e = asArray(REF.slip.retractionByPreset).filter(function (x) { return x.name === S.presetName; })[0];
    var pr = preset(S.presetName);
    return { source: 'matlab', label: pr.label, presetName: S.presetName, base: presetState(S.presetName),
      rules: asArray(e.rules), sweep: asArray(e.sweep), dropHeight: e.dropHeight,
      cycle: 2 / pr.stepFrequency, k: pr.k, speed: pr.meanSpeed };
  }

  function retrRowValue(v) { return v === null || v === undefined ? Infinity : v; }

  function renderRetraction() {
    var D = retrData();
    var rules = D.rules, sweep = D.sweep;
    var hum = SWING.filter(function (r) { return r.species === 'human'; });
    var phe = SWING.filter(function (r) { return r.species === 'pheasant'; });
    var h4 = humanRowFor(REF.slip.family.retraction.value);
    $('retrIntro').textContent = 'Five rules set the swing-leg retraction rate for the ' + D.label.toLowerCase() + ' gait (leg stiffness ' +
      fmt(D.k / 1000, 0) + ' kN/m, average speed ' + fmt(D.speed, 2) + ' m/s, gait cycle ' + fmt(D.cycle, 3) +
      ' s, two steps). Retraction leaves the periodic gait unchanged: every rule keeps the same touchdown angle, stance, speed and step frequency, and changes only the leg angle at apex. ' +
      (D.source === 'matlab' ? 'Results computed in MATLAB for this preset; load another preset to compare.' : 'Results computed in this browser for the current gait.');

    // Rule comparison table: one row per measure, one column per rule.
    var measures = [
      ['Retraction rate (deg/s)', function (r) { return fmt(r.retractionDegPerS, 1); }],
      ['Retraction rate (deg per gait cycle)', function (r) { return fmt(r.retractionDegPerCycle, 1); }],
      ['Leg angle at apex (deg)', function (r) { return fmt(r.apexLegAngleDeg, 2); }],
      ['Foot clearance at apex (cm)', function (r) { return fmt(r.apexClearance * 100, 1); }],
      ['Ground speed matching (%)', function (r) { return fmt(r.groundSpeedMatching * 100, 1); }],
      ['Eigenvalue lambda', function (r) { return fmt(r.lambda, 3); }],
      ['NMD estimate', function (r) { return nmdText(r.nmdEstimate, 'estimate', 2); }],
      ['Simulated first-contact limit', function (r) { return nmdText(r.nmdSimulated, 'simulated', 2); }],
      ['Peak leg force after a ' + fmt(D.dropHeight * 100, 0) + ' cm drop (BW)', function (r) { return fmt(r.peakForceAfterDropBW, 2); }],
      ['Peak leg force in the steady gait (BW)', function (r) { return fmt(r.peakForceSteadyBW, 2); }],
      ['Note', function (r) { return r.note ? r.note : ''; }, 'wrap']
    ];
    var html = '<caption>Retraction rules for the ' + D.label.toLowerCase() + ' gait. Load sets the sidebar to that rule.</caption><thead><tr><th scope="col">Measure</th>' +
      rules.map(function (r) { return '<th scope="col">' + cap(r.name) + '</th>'; }).join('') + '</tr></thead><tbody>';
    measures.forEach(function (m) {
      html += '<tr' + (m[2] ? ' class="' + m[2] + '"' : '') + '><th scope="row">' + m[0] + '</th>' +
        rules.map(function (r) { return '<td>' + m[1](r) + '</td>'; }).join('') + '</tr>';
    });
    html += '<tr><td></td>' + rules.map(function (r, i) {
      return '<td><button type="button" class="btn btn-quiet load-rule" data-index="' + i + '" aria-label="Load ' + r.name + '">Load</button></td>';
    }).join('') + '</tr>';
    var tbl = $('retrTable');
    tbl.innerHTML = html + '</tbody>';
    Array.prototype.forEach.call(tbl.querySelectorAll('.load-rule'), function (b) {
      b.addEventListener('click', function () { loadRule(D, rules[parseInt(b.getAttribute('data-index'), 10)]); });
    });

    // Small multiples against retraction rate
    var w = sweep.map(function (r) { return r.retractionDegPerS; });
    var col = function (f, scale) { return sweep.map(function (r) { return finiteOrNaN(r[f]) * (scale || 1); }); };
    var toRate = function (perCycle) { return perCycle / D.cycle; };
    var span = function (rows, label) {
      var v = rows.map(function (r) { return toRate(r.legRotation_degPerCycle); });
      return { x0: Math.min.apply(null, v), x1: Math.max.apply(null, v), label: label };
    };
    var hSpeeds = hum.map(function (r) { return r.speed_mps; });
    var spans = [span(hum, 'humans ' + fmt(Math.min.apply(null, hSpeeds), 0) + ' to ' + fmt(Math.max.apply(null, hSpeeds), 0) + ' m/s'), span(phe, 'pheasants')];
    // Span labels appear in the first panel only; the note names them.
    var spansPlain = spans.map(function (sp) { return { x0: sp.x0, x1: sp.x1 }; });
    var C = Plot.colors();
    var markerColor = C.series[1];
    var ruleMarks = function (field, scale) {
      var pts = rules.map(function (r) { return { x: r.retractionDegPerS, y: finiteOrNaN(r[field]) * (scale || 1), name: RULE_SHORT[r.rule] || r.name }; });
      // Rules at nearly the same rate get their labels staggered.
      var sorted = pts.slice().sort(function (a, b) { return a.x - b.x; });
      var range = Math.max.apply(null, w) || 1;
      sorted.forEach(function (p, i) {
        var close = i > 0 && p.x - sorted[i - 1].x < 0.12 * range;
        p.dy = (i % 2 === 0 ? -1 : 1) * (close ? 15 : 10);
      });
      return {
        series: [{ x: pts.map(function (p) { return p.x; }), y: pts.map(function (p) { return p.y; }), points: true, style: 1, color: markerColor, radius: 4.5 }],
        labels: pts.map(function (p) { return { x: p.x, y: p.y, text: p.name, dy: p.dy, color: C.text }; })
      };
    };
    var humanRate = h4 ? toRate(h4.legRotation_degPerCycle) : NaN;
    var panel = function (field, scale, ylab, extra) {
      var M = ruleMarks(field, scale);
      var P = { xLabel: 'Retraction rate (deg/s)', yLabel: ylab, xLim: [0, Math.max.apply(null, w)], shade: spansPlain,
        series: [{ x: w, y: col(field, scale), style: 0, width: 2 }].concat(M.series), labels: M.labels };
      return Object.assign(P, extra || {});
    };
    var steady = rules.length ? rules[0].peakForceSteadyBW : NaN;
    var nmdM = ruleMarks('nmdEstimate', 1);
    var NMD_TOP = 3;
    var humanLabel = h4 ? 'humans, ' + fmt(h4.speed_mps, 0) + ' m/s' : '';
    var panels = [
      panel('apexClearance', 100, 'Foot clearance at apex (cm)', { shade: spans }),
      panel('groundSpeedMatching', 100, 'Ground speed matching (%)', h4 ? { whiskers: [{ x: humanRate, y: h4.groundSpeedMatching_pct,
        lo: h4.groundSpeedMatching_pct - h4.groundSpeedMatchingSD_pct, hi: h4.groundSpeedMatching_pct + h4.groundSpeedMatchingSD_pct,
        label: humanLabel, align: 'right', dx: -7 }] } : {}),
      panel('lambda', 1, 'Eigenvalue lambda', { refs: [{ y: -1 }, { y: 0 }, { y: 1 }] }),
      { xLabel: 'Retraction rate (deg/s)', yLabel: 'NMD (fraction of leg length)', xLim: [0, Math.max.apply(null, w)], yLim: [0, NMD_TOP],
        shade: spansPlain, legend: 'tr',
        series: [{ x: w, y: col('nmdEstimate'), style: 0, width: 2, label: 'estimate' },
          { x: w, y: col('nmdSimulated'), style: 2, label: 'simulated first contact' }].concat(nmdM.series)
          .concat(h4 ? [{ x: [], y: [], points: true, color: C.ink, radius: 3.5, label: humanLabel + ' (mean +/- SD)' }] : []),
        labels: nmdM.labels,
        whiskers: h4 ? [{ x: humanRate, y: h4.nmd, lo: h4.nmd - h4.nmdSD, hi: h4.nmd + h4.nmdSD }] : [] },
      panel('peakForceAfterDropBW', 1, 'Peak leg force after a ' + fmt(D.dropHeight * 100, 0) + ' cm drop (BW)', { refs: [{ y: steady }] })
    ];
    var canvas = $('retrCanvas');
    var cw = canvas.clientWidth || 600;
    Plot.render(canvas, { cols: cw >= 900 ? 3 : (cw >= 460 ? 2 : 1), panelHeight: 230, panels: panels,
      alt: 'Foot clearance, ground speed matching, eigenvalue lambda, normalized maximum drop and peak leg force after a drop against retraction rate, with the five rules marked and the measured human and pheasant ranges shaded.' });
    var above = sweep.filter(function (r) { return retrRowValue(r.nmdEstimate) > NMD_TOP; }).map(function (r) { return r.retractionDegPerS; });
    $('retrNote').textContent = 'Shaded spans in every panel: measured leg rotation at touchdown in humans (' + fmt(Math.min.apply(null, hSpeeds), 2) + ' to ' +
      fmt(Math.max.apply(null, hSpeeds), 2) + ' m/s, left span) and pheasants (right span) (Blum et al. 2011), converted from deg per gait cycle to deg/s with this gait\'s cycle of ' +
      fmt(D.cycle, 3) + ' s. Rates per gait cycle compare animals of different size through dynamic similarity; at dynamically similar speeds large birds use relatively higher stride frequencies than small birds (Daley and Birn-Jeffery 2018), so this scaling is an approximation. The NMD axis stops at ' + NMD_TOP + ' leg lengths' + (above.length ? '; the estimate exceeds it below ' + fmt(Math.max.apply(null, above) + 5, 0) + ' deg/s and has no limit at 0 deg/s' : '') +
      '. The point with whiskers on the ground speed matching and NMD panels is the mean +/- SD measured in humans at ' +
      (h4 ? fmt(h4.speed_mps, 2) : '4') + ' m/s (Blum et al. 2011). The labeled filled points mark the five rules. The dotted line on the force panel is the peak leg force in the steady gait.';
    renderRetrText(D, h4, humanRate);
    renderSwingTable(D);
  }

  // Interpretation computed from the rule rows and the sweep.
  function renderRetrText(D, h4, humanRate) {
    var rules = D.rules, sweep = D.sweep;
    var byRate = rules.slice().sort(function (a, b) { return a.retractionDegPerS - b.retractionDegPerS; });
    var parts = [];
    parts.push('Ordered by retraction rate: ' + byRate.map(function (r) { return r.name + ' (' + fmt(r.retractionDegPerS, 1) + ' deg/s)'; }).join(', ') + '.');
    var first = sweep[0], last = sweep[sweep.length - 1];
    var fin = sweep.filter(function (r) { return isFinite(retrRowValue(r.nmdEstimate)); });
    var nmdFalls = fin.length > 1 && fin[fin.length - 1].nmdEstimate < fin[0].nmdEstimate;
    var forceFalls = last.peakForceAfterDropBW < first.peakForceAfterDropBW;
    var t = 'As the retraction rate rises from ' + fmt(fin.length ? fin[0].retractionDegPerS : first.retractionDegPerS, 0) + ' to ' + fmt(last.retractionDegPerS, 0) + ' deg/s, the NMD estimate ' +
      (nmdFalls ? 'falls' : 'rises') + ' from ' + nmdText(fin.length ? fin[0].nmdEstimate : NaN, 'estimate', 2) + ' to ' + nmdText(last.nmdEstimate, 'estimate', 2) +
      ' (it has no limit at 0 deg/s). From ' + fmt(first.retractionDegPerS, 0) + ' to ' + fmt(last.retractionDegPerS, 0) + ' deg/s the peak leg force after a ' +
      fmt(D.dropHeight * 100, 0) + ' cm drop ' + (forceFalls ? 'falls' : 'rises') + ' from ' + fmt(first.peakForceAfterDropBW, 2) + ' to ' +
      fmt(last.peakForceAfterDropBW, 2) + ' body weights (steady gait ' + fmt(rules[0].peakForceSteadyBW, 2) + ').';
    if (nmdFalls && forceFalls) {
      t += ' This is the trade-off of Daley and Usherwood (2010): slow retraction keeps a large first-contact margin (lower fall risk) and loads the leg harder after a drop; fast retraction lowers the force after a drop (lower injury risk) and shrinks the first-contact margin.';
    }
    parts.push(t);
    var over = sweep.filter(function (r) { return r.lambda < -1; });
    parts.push(over.length ? 'In this conservative model, lambda falls below -1 above about ' + fmt(over[0].retractionDegPerS, 0) +
      ' deg/s: fast retraction overcorrects, and errors in apex height grow with alternating sign.' :
      'lambda stays above -1 at every tested rate.');
    var fr = rules.filter(function (r) { return r.rule === 'fastestRecovery'; })[0];
    if (fr) parts.push(fr.note ? 'Fastest recovery: ' + fr.note + ', so this rule uses no retraction (lambda ' + fmt(fr.lambda, 2) + ').' :
      'Fastest recovery needs ' + fmt(fr.retractionDegPerS, 1) + ' deg/s here, where lambda reaches 0.');
    var hr = rules.filter(function (r) { return r.rule === 'commonPerCycle'; })[0];
    var gr = rules.filter(function (r) { return r.rule === 'groundSpeedMatching'; })[0];
    if (hr && h4) {
      var within = function (v, m, sd) { return Math.abs(v - m) <= sd; };
      var tx = 'At the human rate (' + fmt(hr.retractionDegPerS, 1) + ' deg/s), the model has ground speed matching of ' + fmt(hr.groundSpeedMatching * 100, 0) +
        ' % and an NMD estimate of ' + nmdText(hr.nmdEstimate, 'estimate', 2) + ', against ' + h4.groundSpeedMatching_pct + ' +/- ' + h4.groundSpeedMatchingSD_pct +
        ' % and ' + fmt(h4.nmd, 2) + ' +/- ' + fmt(h4.nmdSD, 2) + ' measured in humans at ' + fmt(h4.speed_mps, 2) + ' m/s (Blum et al. 2011)';
      var bothWithin = within(hr.groundSpeedMatching * 100, h4.groundSpeedMatching_pct, h4.groundSpeedMatchingSD_pct) && within(hr.nmdEstimate, h4.nmd, h4.nmdSD);
      tx += bothWithin ? ', both within one standard deviation of the measured means.' : '.';
      if (fr && gr && hr.retractionDegPerS > fr.retractionDegPerS && hr.retractionDegPerS < gr.retractionDegPerS) {
        tx += ' The human rate lies between the rates for fastest recovery and for ground speed matching, with lambda = ' + fmt(hr.lambda, 2) + '.';
      }
      parts.push(tx);
    }
    var box = $('retrText');
    box.innerHTML = '';
    parts.forEach(function (x) { box.appendChild(el('p', null, x)); });
  }

  function renderSwingTable(D) {
    $('swingLegNote').textContent = 'Source: ' + REF.data.swingLegSource + '. The scaled column divides each rate per gait cycle by this gait\'s cycle of ' +
      fmt(D.cycle, 3) + ' s, so all rates compare over one gait cycle of the model.';
    var html = '<thead><tr>' + ['Species', 'Speed (m/s)', 'Froude number', 'Leg length (m)', 'Gait cycle (s)', 'Touchdown angle (deg)',
      'Leg rotation (deg per gait cycle)', 'Scaled to this gait (deg/s)', 'Leg length change (L0 per gait cycle)', 'Ground speed matching (%)', 'NMD']
      .map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
    var pm = function (m, sd, d) { return m === null || m === undefined ? 'n/a' : fmt(m, d) + (sd === null || sd === undefined ? '' : ' +/- ' + fmt(sd, d)); };
    SWING.forEach(function (r) {
      html += '<tr><td>' + r.species + '</td><td>' + fmt(r.speed_mps, 2) + '</td><td>' + fmt(r.froude, 2) + '</td><td>' + fmt(r.legLength_m, 2) +
        '</td><td>' + fmt(r.gaitCycle_s, 2) + '</td><td>' + fmt(r.touchdownAngle_deg, 1) + '</td><td>' + pm(r.legRotation_degPerCycle, r.legRotationSD_degPerCycle, 1) +
        '</td><td>' + fmt(r.legRotation_degPerCycle / D.cycle, 1) + '</td><td>' + fmt(r.legLengthChange_L0PerCycle, 2) + '</td><td>' +
        pm(r.groundSpeedMatching_pct, r.groundSpeedMatchingSD_pct, 0) + '</td><td>' + pm(r.nmd, r.nmdSD, 2) + '</td></tr>';
    });
    $('swingLegTable').innerHTML = html + '</tbody>';
  }

  function loadRule(D, r) {
    var st = D.source === 'matlab' ? presetState(D.presetName) : { p: Object.assign({}, D.base.p), apex: Object.assign({}, D.base.apex) };
    if (D.source === 'matlab') S.presetName = D.presetName;
    S.p = st.p;
    S.apex = st.apex;
    S.p.legAngleDeg = r.apexLegAngleDeg;
    S.p.retractionDegPerS = r.retractionDegPerS;
    var sel = $('presetSelect');
    if (sel) sel.value = S.presetName;
    syncControls();
    recomputeSlip();
    updateStatus('Loaded rule "' + r.name + '": retraction ' + fmt(r.retractionDegPerS, 1) + ' deg/s, leg angle at apex ' + fmt(r.apexLegAngleDeg, 2) + ' deg.', true);
  }

  async function recomputeRetraction() {
    if (!S.periodic) {
      updateStatus('The current apex state is not periodic. Press Find periodic gait or load a preset first.', true);
      return;
    }
    var btn = $('retrRecompute'), prog = $('retrProgress');
    btn.disabled = true;
    prog.hidden = false;
    prog.value = 0;
    var p = Object.assign({}, S.p), apex = Object.assign({}, S.apex);
    var omegas = SlipSim.range(0, 250, 5);
    var total = RULES.length + omegas.length, done = 0;
    var rules = [], sweep = [];
    try {
      for (var i = 0; i < RULES.length; i++) {
        rules = rules.concat(SlipSim.compareRetractionRules(p, apex, [RULES[i]], { dropHeight: 0.05, terrain: false }));
        prog.value = ++done / total;
        await pause();
      }
      for (var j = 0; j < omegas.length; j++) {
        sweep = sweep.concat(SlipSim.retractionSweep(p, apex, [omegas[j]], { dropHeight: 0.05 }));
        prog.value = ++done / total;
        if (j % 3 === 2) await pause();
      }
    } catch (e) {
      prog.hidden = true;
      btn.disabled = false;
      updateStatus('The comparison could not be computed: ' + e.message, true);
      return;
    }
    prog.hidden = true;
    btn.disabled = false;
    S.retr = { source: 'browser', label: 'Current', base: { p: p, apex: apex }, rules: rules, sweep: sweep, dropHeight: 0.05,
      cycle: 2 / S.M.stepFrequency, k: p.k, speed: S.M.meanSpeed };
    renderRetraction();
    updateStatus('Retraction rules recomputed for the current gait.', true);
  }

  /* ----- Perturbation tab ----- */
  function runPerturbation() {
    var h = S.perturb.drop;
    var run = SlipSim.simulateStrides(S.p, S.apex, S.perturb.strides + 1, {
      trace: true, traceDt: 0.002, dropAfterStride: 1, dropHeight: h });
    S.perturb.run = run;
    S.perturb.compare = null;
    setAnimSource(slipSource(run), undefined);
  }

  // Outcome of the strides after the drop, reported as an event. Stride 1
  // runs on the original ground; strides after it are numbered from the drop.
  function dropOutcome(run) {
    var completed = run.apexSeq.length - 1;
    if (run.reason === 'cycleLimit') return { ok: true, after: completed - 1 };
    var failStride = completed;            // index of the stride that did not complete
    var key = String(run.reason).replace('terminal:', '');
    return { ok: false, beforeDrop: failStride === 0, strideAfter: failStride, key: key, text: reasonText(key) };
  }

  function laterStridesText(run) {
    var o = dropOutcome(run);
    if (o.ok) return 'run continues through the ' + o.after + ' strides simulated after the drop';
    if (o.beforeDrop) return 'run stops before the drop: ' + o.text;
    return 'run stops at stride ' + o.strideAfter + ' after the drop: ' + o.text;
  }

  // First stance after the drop: contact, touchdown angle and peak leg force,
  // against the steady gait (SlipSim.dropResponse, as
  // slip_dropResponse.m). apexAtDrop is the apex state where the ground drops.
  // The fixed-leg-angle comparison keeps the same gait (same touchdown angle
  // in the steady gait) with no retraction.
  function firstStance(p, apexAtDrop, h) {
    var d = SlipSim.dropResponse(p, apexAtDrop, h);
    var s0 = SlipSim.dropResponse(p, apexAtDrop, 0);
    // Contact counts as a first stance only with the leg at or in front of
    // vertical, the first-contact criterion of the simulated NMD.
    var F = { h: h, contact: d.contact, pastVertical: d.contact && d.touchdownAngleDeg > 90,
      outcome: d.outcome, angle: d.touchdownAngleDeg, force: d.peakLegForceBW,
      angle0: s0.touchdownAngleDeg, force0: s0.peakLegForceBW, retracting: p.retractionDegPerS > 0,
      fixedContact: false, fixedForce: NaN };
    if (F.retracting) {
      try {
        var df = SlipSim.dropResponse(SlipSim.setRetraction(p, apexAtDrop, 0), apexAtDrop, h);
        F.fixedContact = df.contact;
        F.fixedForce = df.peakLegForceBW;
      } catch (e) { /* no fixed-angle comparison for this state */ }
    }
    return F;
  }

  // Simulated first-contact limit of the sidebar gait, cached: it does not
  // depend on the drop height.
  var simNmdCache = { key: '', value: NaN };
  function simulatedNmd(p, apex) {
    var key = JSON.stringify([p, apex]);
    if (simNmdCache.key !== key) {
      simNmdCache.key = key;
      try { simNmdCache.value = SlipSim.normalizedMaxDrop(p, apex).simulatedNMD; } catch (e) { simNmdCache.value = NaN; }
    }
    return simNmdCache.value;
  }

  function firstStanceSentence(F, label, nmdSim, L0) {
    var who = label ? label + ': ' : '';
    if (F.pastVertical) {
      return who + 'the leg reaches the ground only after rotating past vertical (touchdown at ' + fmt(F.angle, 1) +
        ' deg), so by the first-contact criterion of Daley and Usherwood (2010) the first stance after a ' + fmt(F.h * 100, 1) + ' cm drop is missed' +
        (isFinite(nmdSim) ? '; the drop is ' + fmt(F.h / L0, 2) + ' leg lengths against a simulated first-contact limit of ' + nmdText(nmdSim, 'simulated', 2) : '') + '.';
    }
    if (!F.contact) {
      return who + 'the leg misses the first stance after a ' + fmt(F.h * 100, 1) + ' cm drop (' + reasonText(F.outcome) + ')' +
        (isFinite(nmdSim) ? '; the drop is ' + fmt(F.h / L0, 2) + ' leg lengths against a simulated first-contact limit of ' + nmdText(nmdSim, 'simulated', 2) : '') + '.';
    }
    return who + 'the leg touches down ' + (F.angle > F.angle0 + 1e-6 ? 'at a steeper angle, ' : 'at ') + fmt(F.angle, 1) + ' deg (' + fmt(F.angle0, 1) + ' deg in the steady gait), ' +
      'and the peak leg force reaches ' + fmt(F.force, 2) + ' body weights (' +
      fmt(F.force0, 2) + ' in the steady gait' + (F.retracting && isFinite(F.fixedForce) ? '; ' + fmt(F.fixedForce, 2) + ' with a fixed leg angle' : '') + ')' +
      (isFinite(nmdSim) ? '; the drop is ' + fmt(F.h / L0, 2) + ' leg lengths, ' + fmt(100 * F.h / (nmdSim * L0), 0) + ' % of the simulated first-contact limit' : '') + '.';
  }

  function perturbTable(rows) {
    var head = ['Gait', 'First stance', 'Touchdown angle (deg)', 'Steady gait (deg)', 'Peak leg force (BW)',
      'Steady gait (BW)', 'Fixed leg angle, same drop (BW)', 'NMD estimate', 'Simulated first-contact limit', 'Later strides'];
    var html = '<caption>Drop of ' + fmt(S.perturb.drop * 100, 1) + ' cm after stride 1. NMD values in leg lengths.</caption><thead><tr>' +
      head.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var F = r.F;
      var stance = !F.contact ? 'missed stance' : (F.pastVertical ? 'missed (leg past vertical)' : 'contact');
      var ok = F.contact && !F.pastVertical;
      html += '<tr><td>' + r.label + '</td><td>' + stance + '</td><td>' + (F.contact ? fmt(F.angle, 1) : 'n/a') +
        '</td><td>' + fmt(F.angle0, 1) + '</td><td>' + (ok ? fmt(F.force, 2) : 'n/a') + '</td><td>' + fmt(F.force0, 2) +
        '</td><td>' + (!F.retracting ? 'same gait' : (F.fixedContact ? fmt(F.fixedForce, 2) : 'missed stance')) +
        '</td><td>' + nmdText(r.nmdEst, 'estimate', 2) + '</td><td>' + nmdText(r.nmdSim, 'simulated', 2) +
        '</td><td class="wrap-cell">' + laterStridesText(r.run) + '</td></tr>';
    });
    $('perturbTable').innerHTML = html + '</tbody>';
  }

  function perturbSeries(run, h) {
    // Apex height above the ground that the next landing meets.
    var y = run.apexSeq.map(function (s, k) { return k === 1 ? s.y + h : s.y; });
    var y0 = y[0];
    return { n: y.map(function (_, k) { return k; }), dy: y.map(function (v) { return v - y0; }),
      vx: run.apexSeq.map(function (s) { return s.vx; }) };
  }

  function apexAtDrop(run, apex0) {
    var a = run.apexSeq[1] || apex0;
    return { y: a.y, vx: a.vx };
  }

  function renderPerturbation() {
    var h = S.perturb.drop;
    var panels, text, rows;
    if (S.perturb.compare) {
      var series1 = [], series2 = [];
      S.perturb.compare.forEach(function (c, j) {
        var s = perturbSeries(c.run, h);
        series1.push({ x: s.n, y: s.dy, label: c.label, style: j, points: true, line: true });
        series2.push({ x: s.n, y: s.vx, style: j, points: true, line: true });
      });
      panels = [
        { yLabel: 'Apex height change (m)', series: series1, legend: 'tr', refs: [{ y: 0 }] },
        { yLabel: 'Apex speed (m/s)', xLabel: 'Stride (drop after stride 1)', series: series2 }
      ];
      rows = S.perturb.compare.map(function (c) {
        var st = presetState(c.name), pr = preset(c.name);
        return { label: c.label, run: c.run, F: firstStance(st.p, apexAtDrop(c.run, st.apex), h),
          nmdEst: pr.nmdEstimate, nmdSim: pr.nmdSimulated, L0: st.p.L0 };
      });
      text = 'First stance after a ' + fmt(h * 100, 1) + ' cm drop. ' + rows.map(function (r) {
        return firstStanceSentence(r.F, r.label, finiteOrNaN(r.nmdSim), r.L0);
      }).join(' ');
    } else {
      var run = S.perturb.run;
      if (!run) return;
      var s = perturbSeries(run, h);
      panels = [
        { yLabel: 'Apex height change (m)', series: [{ x: s.n, y: s.dy, style: 0, points: true, line: true }], refs: [{ y: 0 }] },
        { yLabel: 'Apex speed (m/s)', xLabel: 'Stride (drop after stride 1)', series: [{ x: s.n, y: s.vx, style: 1, points: true, line: true }] }
      ];
      var a = apexAtDrop(run, S.apex);
      var F = firstStance(S.p, a, h);
      var est = F.angle0 > 0 ? nmdEstimate(S.p, F.angle0, S.p.retractionDegPerS) : NaN;
      var sim = simulatedNmd(S.p, a);
      rows = [{ label: 'Current gait', run: run, F: F, nmdEst: est, nmdSim: sim, L0: S.p.L0 }];
      text = 'First stance after the drop: ' + firstStanceSentence(F, '', sim, S.p.L0) + ' Later strides: the ' + laterStridesText(run) + '.';
    }
    perturbTable(rows);
    $('perturbText').textContent = text;
    Plot.render($('perturbCanvas'), { panelHeight: 190, panels: panels,
      alt: 'Apex height change and apex speed for each stride after the drop. ' + text });
  }

  function comparePresets() {
    var h = S.perturb.drop;
    S.perturb.compare = PRESETS.slice().sort(function (a, b) { return a.k - b.k; }).map(function (pr) {
      var st = presetState(pr.name);
      return { name: pr.name, label: pr.label, run: SlipSim.simulateStrides(st.p, st.apex, S.perturb.strides + 1,
        { dropAfterStride: 1, dropHeight: h }) };
    });
    renderPerturbation();
    updateStatus($('perturbText').textContent, true);
  }

  /* ----- Parameter map tab ----- */
  async function computeGrid() {
    if (S.grid.busy) return;
    var n = parseInt($('gridRes').value, 10);
    var aMin = parseFloat($('gridAMin').value), aMax = parseFloat($('gridAMax').value);
    var kMin = parseFloat($('gridKMin').value), kMax = parseFloat($('gridKMax').value);
    if (!(aMax > aMin) || !(kMax > kMin) || aMin <= 0 || aMax >= 90 || kMin <= 0) {
      updateStatus('Check the map ranges: leg angle between 0 and 90 deg, stiffness above 0, and each upper limit above its lower limit.', true);
      return;
    }
    S.grid.busy = true;
    var btn = $('gridBtn'), prog = $('gridProgress');
    btn.disabled = true;
    prog.hidden = false;
    var da = (aMax - aMin) / n, dk = (kMax - kMin) / n;
    var values = new Array(n * n).fill(null);
    var p0 = Object.assign({}, S.p), apex = { y: S.apex.y, vx: S.apex.vx };
    var t0 = Date.now();
    for (var j = 0; j < n; j++) {
      for (var i = 0; i < n; i++) {
        var q = Object.assign({}, p0, { legAngleDeg: aMin + (i + 0.5) * da, k: (kMin + (j + 0.5) * dk) * 1000 });
        values[j * n + i] = SlipSim.stridesSurvived(q, apex, 20);
      }
      prog.value = (j + 1) / n;
      if (Date.now() - t0 > 40) { await pause(); t0 = Date.now(); }
    }
    S.grid = { result: { n: n, aMin: aMin, aMax: aMax, kMin: kMin, kMax: kMax, values: values,
      p: p0, apex: apex }, stale: false, busy: false };
    prog.hidden = true;
    btn.disabled = false;
    renderGrid();
    var full = values.filter(function (v) { return v === 20; }).length;
    updateStatus('Map computed: ' + full + ' of ' + values.length + ' cells completed all 20 strides.', true);
  }

  function renderGrid() {
    var R = S.grid.result;
    var txt = $('gridText');
    if (!R) {
      txt.textContent = 'Press Compute map. A 20 x 20 map takes a few seconds. The map uses the current retraction rate (' +
        fmt(S.p.retractionDegPerS, 1) + ' deg/s).';
      Plot.render($('gridCanvas'), { panels: [], panelHeight: 10 });
      return;
    }
    txt.textContent = 'Darker cells complete more strides; the darkest cells complete all 20. The open circle marks the current leg angle at apex and stiffness. ' +
      'Start: apex height ' + fmt(R.apex.y, 3) + ' m, apex speed ' + fmt(R.apex.vx, 3) + ' m/s. Every cell uses the retraction rate of ' +
      fmt(R.p.retractionDegPerS, 1) + ' deg/s from the sidebar, so the leg rotates from the angle on the x axis until touchdown.' +
      (S.grid.stale ? ' The settings have changed since this map was computed.' : '');
    var canvas = $('gridCanvas');
    var w = canvas.clientWidth || 500;
    Plot.render(canvas, {
      panelHeight: Math.min(Math.max(w * 0.7, 300), 480),
      alt: 'Map of strides completed out of 20 over leg angle and leg stiffness.',
      panels: [{
        xLabel: 'Leg angle at apex (deg)', yLabel: 'Leg stiffness (kN/m)',
        heat: { x0: R.aMin, x1: R.aMax, y0: R.kMin, y1: R.kMax, nx: R.n, ny: R.n, values: R.values,
          vmin: 0, vmax: 20, label: 'Strides completed' },
        marks: [{ x: S.p.legAngleDeg, y: S.p.k / 1000 }].filter(function (m) {
          return m.x >= R.aMin && m.x <= R.aMax && m.y >= R.kMin && m.y <= R.kMax;
        })
      }]
    });
  }

  /* ===================== Ball in a box ===================== */
  var onBallChange = debounce(function () { recomputeBall(); }, 100);

  function recomputeBall() {
    var b = S.ball;
    if (b.x0[0] - b.p.radius < b.p.xMin || b.x0[0] + b.p.radius > b.p.xMax ||
        b.x0[1] - b.p.radius < b.p.yMin || b.x0[1] + b.p.radius > b.p.yMax) {
      $('status').textContent = 'The ball must start inside the box: keep the initial position at least one radius from every wall.';
      return;
    }
    var r = SlipSim.simulateBall(b.p, b.x0, 10, 0.004);
    S.ballRun = r;
    r.events.forEach(function (e) { e.resting = e.guard === 'floor' && e.xAfter[3] === 0; });
    setAnimSource({ kind: 'ball', t: r.trace.t, x: r.trace.x, events: r.events, p: Object.assign({}, b.p) }, undefined);
    renderBall();
    updateStatus();
  }

  function renderBall() {
    var r = S.ballRun;
    if (!r) return;
    var p = S.ball.p;
    var E = r.trace.x.map(function (x) { return 0.5 * (x[2] * x[2] + x[3] * x[3]) + p.g * x[1]; });
    Plot.render($('ballEnergyCanvas'), {
      panelHeight: 220,
      alt: 'Mechanical energy per unit mass against time; each impact with restitution below 1 removes energy.',
      panels: [{ xLabel: 'Time (s)', yLabel: 'Energy per unit mass (J/kg)',
        series: [{ x: r.trace.t, y: E, style: 0 }] }]
    });
    var html = '<thead><tr><th scope="col">Impact</th><th scope="col">Time (s)</th><th scope="col">Wall</th>' +
      '<th scope="col">Speed before (m/s)</th><th scope="col">Speed after (m/s)</th></tr></thead><tbody>';
    var names = { leftWall: 'left wall', rightWall: 'right wall', floor: 'floor', ceiling: 'ceiling' };
    r.events.slice(0, 60).forEach(function (e, i) {
      var sb = Math.hypot(e.xBefore[2], e.xBefore[3]), sa = Math.hypot(e.xAfter[2], e.xAfter[3]);
      html += '<tr><td>' + (i + 1) + '</td><td>' + fmt(e.time, 3) + '</td><td>' + names[e.guard] + (e.resting ? ', comes to rest' : '') +
        '</td><td>' + fmt(sb, 3) + '</td><td>' + fmt(sa, 3) + '</td></tr>';
    });
    $('ballEvents').innerHTML = html + '</tbody>';
    var note = 'Each wall is a guard and each impact a reset: the velocity component normal to the wall reverses and scales by the coefficient of restitution (' +
      fmt(p.restitution, 2) + '). ';
    note += p.restitution < 1 ? 'With restitution below 1, the floor bounces shorten and their number becomes infinite within a finite time (Zeno behavior).' :
      'With restitution 1, every impact conserves energy.';
    if (p.restitution < 1) note += ' A floor rebound slower than the rest speed (' + fmt(p.restSpeed, 3) + ' m/s) leaves the ball sliding on the floor.';
    $('ballNote').textContent = note;
  }

  /* ===================== Model switch ===================== */
  function setModel(m) {
    S.model = m;
    $('model-' + m).checked = true;
    $('slipTabs').hidden = m !== 'slip';
    $('ballPanel').hidden = m !== 'ball';
    activeNode = null;
    if (m === 'slip') {
      buildSlipSidebar();
      buildSlipDiagram();
      recomputeSlip();
      if (S.tab === 'perturb') { runPerturbation(); renderPerturbation(); }
    } else {
      buildBallSidebar();
      buildBallDiagram();
      recomputeBall();
    }
  }

  /* ===================== Lessons ===================== */
  var LESSONS = [];

  function memo(fn) {
    var cache = {};
    return function (k) { if (!(k in cache)) cache[k] = fn(k); return cache[k]; };
  }
  // The same preset gait with a fixed leg angle (no retraction).
  // First stance after drops of DROP_HEIGHTS (m), with the preset retraction
  // and with a fixed leg angle (same touchdown angle, no retraction).
  var DROP_HEIGHTS = [0, 0.05, 0.10, 0.20];
  function dropResponses(st) {
    var fixed = SlipSim.setRetraction(st.p, st.apex, 0);
    return DROP_HEIGHTS.map(function (h) {
      var d = SlipSim.dropResponse(st.p, st.apex, h), df = SlipSim.dropResponse(fixed, st.apex, h);
      return { h: h, contact: d.contact, outcome: d.outcome, angle: d.touchdownAngleDeg, force: d.peakLegForceBW,
        fixedContact: df.contact, fixedAngle: df.touchdownAngleDeg, fixedForce: df.peakLegForceBW };
    });
  }

  function fixedPresetState(n) {
    var st = presetState(n);
    st.p.legAngleDeg = preset(n).touchdownAngleDeg;
    st.p.retractionDegPerS = 0;
    return st;
  }


  function buildLessons() {
    var st = familyStats(MATLAB_FAMILY) || {};
    var R = {
      preset: function (n) { return preset(n); },
      fam: st,
      f: fmt,
      retraction: REF.slip.family.retraction,
      human4: humanRowFor(REF.slip.family.retraction.value),
      swing: SWING,
      rulesDrop: asArray(REF.slip.retractionByPreset)[0].dropHeight,
      rules: function (n) {
        var e = asArray(REF.slip.retractionByPreset).filter(function (x) { return x.name === n; })[0];
        var out = {};
        asArray(e.rules).forEach(function (r) { out[r.rule] = r; });
        return out;
      },
      sweep: function (n) {
        return asArray(asArray(REF.slip.retractionByPreset).filter(function (x) { return x.name === n; })[0].sweep);
      },
      fixedLambda: memo(function (n) { var st = fixedPresetState(n); return SlipSim.lambda(st.p, st.apex); }),
      dropHeights: DROP_HEIGHTS,
      dropResponses: memo(function (n) { return dropResponses(presetState(n)); })
    };
    LESSONS = HDS_LESSONS.build(R);
    var list = $('lessonList');
    list.innerHTML = '';
    LESSONS.forEach(function (L, i) {
      var li = el('li');
      var b = el('button', { type: 'button', 'data-index': i }, L.title);
      b.addEventListener('click', function () { applyLesson(i); });
      li.appendChild(b);
      list.appendChild(li);
    });
    $('lessonContent').innerHTML = '<p>Choose a lesson. Each one loads its model and settings, opens the matching analysis, and ends with a check question.</p>';
  }

  function applyLesson(i) {
    var L = LESSONS[i];
    S.lesson = i;
    Array.prototype.forEach.call(document.querySelectorAll('#lessonList button'), function (b, j) {
      b.setAttribute('aria-current', j === i ? 'true' : 'false');
    });
    if (L.model === 'ball') {
      S.ball = ballDefaults();
      setModel('ball');
    } else {
      if (S.model !== 'slip') setModel('slip');
      var st = presetState(L.preset || 'human');
      S.presetName = L.preset || 'human';
      S.p = st.p;
      S.apex = st.apex;
      if (L.settings) Object.keys(L.settings).forEach(function (k) { setSlipValue(k, L.settings[k]); });
      var sel = $('presetSelect');
      if (sel) sel.value = S.presetName;
      syncControls();
      recomputeSlip();
      selectTab(L.tab || 'stride', false);
    }
    var c = $('lessonContent');
    c.innerHTML = '';
    c.appendChild(el('h3', null, L.title));
    c.appendChild(el('p', { 'class': 'goal' }, 'Goal: ' + L.goal));
    L.body.forEach(function (para) { c.appendChild(el('p', null, para)); });
    c.appendChild(el('h3', null, 'Try this'));
    var ol = el('ol');
    L.tasks.forEach(function (t) { ol.appendChild(el('li', null, t)); });
    c.appendChild(ol);
    c.appendChild(el('h3', null, 'Check your understanding'));
    c.appendChild(el('p', null, L.question));
    var ans = el('p', { 'class': 'answer', id: 'lessonAnswer' }, L.answer);
    ans.hidden = true;
    var sb = el('button', { type: 'button', 'class': 'btn btn-quiet', 'aria-expanded': 'false', 'aria-controls': 'lessonAnswer' }, 'Show answer');
    sb.addEventListener('click', function () {
      ans.hidden = !ans.hidden;
      sb.setAttribute('aria-expanded', ans.hidden ? 'false' : 'true');
      sb.textContent = ans.hidden ? 'Show answer' : 'Hide answer';
    });
    c.appendChild(sb);
    c.appendChild(ans);
    var nav = el('div', { 'class': 'lesson-buttons' });
    if (i > 0) {
      var pb = el('button', { type: 'button', 'class': 'btn btn-quiet' }, 'Previous lesson');
      pb.addEventListener('click', function () { applyLesson(i - 1); });
      nav.appendChild(pb);
    }
    if (i < LESSONS.length - 1) {
      var nb = el('button', { type: 'button', 'class': 'btn' }, 'Next lesson');
      nb.addEventListener('click', function () { applyLesson(i + 1); });
      nav.appendChild(nb);
    }
    c.appendChild(nav);
  }

  function toggleLessons(open) {
    var panel = $('lessonPanel'), btn = $('lessonsToggle');
    var show = open === undefined ? panel.hidden : open;
    panel.hidden = !show;
    btn.setAttribute('aria-expanded', show ? 'true' : 'false');
    btn.textContent = show ? 'Hide lessons' : 'Lessons';
    if (show) panel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ===================== Theme ===================== */
  var THEMES = ['auto', 'light', 'dark'];
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    $('themeToggle').textContent = 'Theme: ' + t;
    try { localStorage.setItem('hds-theme', t); } catch (e) { /* storage unavailable */ }
    redrawAll();
  }

  function redrawAll() {
    drawFrame();
    if (S.model === 'slip') renderActiveTab(); else renderBall();
  }

  /* ===================== References and about ===================== */
  var REFERENCES = [
    ['Blickhan R (1989) The spring-mass model for running and hopping. J Biomech 22:1217-1227.', '10.1016/0021-9290(89)90224-8'],
    ['Blum Y, Lipfert SW, Rummel J, Seyfarth A (2010) Swing leg control in human running. Bioinspir Biomim 5:026006.', '10.1088/1748-3182/5/2/026006'],
    ['Blum Y, Birn-Jeffery A, Daley MA, Seyfarth A (2011) Does a crouched leg posture enhance running stability and robustness? J Theor Biol 281:97-106.', '10.1016/j.jtbi.2011.04.029'],
    ['Blum Y, Vejdani HR, Birn-Jeffery AV, Hubicki CM, Hurst JW, Daley MA (2014) Swing-leg trajectory of running guinea fowl suggests task-level priority of force regulation rather than disturbance rejection. PLoS One 9:e100399.', '10.1371/journal.pone.0100399'],
    ['Daley MA, Biewener AA (2006) Running over rough terrain reveals limb control for intrinsic stability. Proc Natl Acad Sci USA 103:15681-15686.', '10.1073/pnas.0601473103'],
    ['Daley MA, Birn-Jeffery A (2018) Scaling of avian bipedal locomotion reveals independent effects of body mass and leg posture on gait. J Exp Biol 221:jeb152538.', '10.1242/jeb.152538'],
    ['Daley MA, Usherwood JR (2010) Two explanations for the compliant running paradox: reduced work of bouncing viscera and increased stability in uneven terrain. Biol Lett 6:418-421.', '10.1098/rsbl.2010.0175'],
    ['Holmes P, Full RJ, Koditschek D, Guckenheimer J (2006) The dynamics of legged locomotion: models, analyses, and challenges. SIAM Rev 48:207-304.', '10.1137/S0036144504445133'],
    ['Kram R, Taylor CR (1990) Energetics of running: a new perspective. Nature 346:265-267.', '10.1038/346265a0'],
    ['McMahon TA, Cheng GC (1990) The mechanics of running: how does stiffness couple with speed? J Biomech 23 Suppl 1:65-78.', '10.1016/0021-9290(90)90042-2'],
    ['M\u00fcller R, Birn-Jeffery AV, Blum Y (2016) Human and avian running on uneven ground: a model-based comparison. J R Soc Interface 13:20160529.', '10.1098/rsif.2016.0529'],
    ['Seyfarth A, Geyer H, Guenther M, Blickhan R (2002) A movement criterion for running. J Biomech 35:649-655. PMID 11955504.', null],
    ['Seyfarth A, Geyer H, Herr H (2003) Swing-leg retraction: a simple control model for stable running. J Exp Biol 206:2547-2555.', '10.1242/jeb.00463'],
    ['Vejdani HR, Blum Y, Daley MA, Hurst JW (2013) Bio-inspired swing leg control for spring-mass robots running on ground with unexpected height disturbance. Bioinspir Biomim 8:046006.', '10.1088/1748-3182/8/4/046006']
  ];

  function buildFooter() {
    var ol = $('references');
    REFERENCES.forEach(function (r) {
      var li = el('li', null, r[0] + ' ');
      if (r[1]) {
        var a = el('a', { href: 'https://doi.org/' + r[1], rel: 'noopener' }, 'doi:' + r[1]);
        li.appendChild(a);
      } else {
        li.appendChild(el('a', { href: 'https://pubmed.ncbi.nlm.nih.gov/11955504/', rel: 'noopener' }, 'PubMed'));
      }
      ol.appendChild(li);
    });
    var about = $('aboutText');
    about.textContent = 'This page runs the spring-mass and ball-in-a-box models of the HybridDynamics toolkit in the browser. The presets and the stiffness family come from the MATLAB toolkit, and the browser simulator is tested against reference cases exported from MATLAB. Source code, MATLAB examples and live scripts: ';
    about.appendChild(el('a', { href: REPO_URL, rel: 'noopener' }, REPO_URL));
    about.appendChild(document.createTextNode('.'));
  }

  /* ===================== Wiring ===================== */
  function wire() {
    $('model-slip').addEventListener('change', function () { setModel('slip'); });
    $('model-ball').addEventListener('change', function () { setModel('ball'); });
    $('lessonsToggle').addEventListener('click', function () { toggleLessons(); });
    $('themeToggle').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'auto';
      applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
    });
    $('playBtn').addEventListener('click', function () { setPlaying(!S.anim.playing); });
    $('nextEventBtn').addEventListener('click', nextEvent);
    $('restartBtn').addEventListener('click', function () {
      if (S.anim.source) S.anim.t = S.anim.source.t[0];
      drawFrame();
    });
    $('speedSelect').addEventListener('change', function () { S.anim.speed = parseFloat($('speedSelect').value); });

    // Return map cobweb start
    var cs = $('cobwebStart'), csn = $('cobwebStartNum');
    var setCob = function (v) {
      v = clamp(v, -3, 3);
      cs.value = v; csn.value = v;
      S.cobwebStart = v / 100;
      renderReturnMap();
    };
    cs.addEventListener('input', function () { setCob(parseFloat(cs.value)); });
    csn.addEventListener('change', function () { setCob(parseFloat(csn.value) || 0); });

    // Family
    var FR_DEFAULT = { commonPerCycle: REF.slip.family.retraction.value, common: REF.slip.family.retraction.degPerS, clearance: 0.05 };
    var syncFamilyRule = function () {
      var r = $('familyRule').value;
      var need = ruleNeedsValue(r);
      $('familyRuleValue').hidden = !need;
      $('familyRuleValueLabel').hidden = !need;
      $('familyRuleValueLabel').textContent = 'Value (' + (RULE_UNITS[r] || '') + ')';
      $('familyRuleValue').step = RULE_SPIN[r] || 'any';
      if (need) $('familyRuleValue').value = round(FR_DEFAULT[r], 2);
    };
    $('familyRule').addEventListener('change', syncFamilyRule);
    syncFamilyRule();
    $('nmdBtn').addEventListener('click', computeNmd);

    // Phase portraits: perturbed start
    var rerenderPortraits = debounce(function () { if (S.tab === 'stride') renderPortraits(); }, 120);
    $('pertOn').addEventListener('change', function () {
      S.portrait.on = $('pertOn').checked;
      if (!S.portrait.on) S.portrait.follow = 'gait', $('pertFollow').value = 'gait';
      rerenderPortraits();
    });
    var setDy = function (v) {
      v = clamp(isFinite(v) ? v : 2, -3, 3);
      $('pertDy').value = v; $('pertDyNum').value = v;
      S.portrait.dy = v / 100;
      rerenderPortraits();
    };
    $('pertDy').addEventListener('input', function () { setDy(parseFloat($('pertDy').value)); });
    $('pertDyNum').addEventListener('change', function () { setDy(parseFloat($('pertDyNum').value)); });
    $('pertN').addEventListener('change', function () {
      S.portrait.n = clamp(Math.round(parseFloat($('pertN').value) || 6), 1, 10);
      $('pertN').value = S.portrait.n;
      rerenderPortraits();
    });
    $('pertFollow').addEventListener('change', function () {
      S.portrait.follow = $('pertFollow').value;
      rerenderPortraits();
    });
    $('retrRecompute').addEventListener('click', recomputeRetraction);
    $('retrRestore').addEventListener('click', function () { S.retr = null; renderRetraction(); });
    $('familyRecompute').addEventListener('click', recomputeFamily);
    $('familyRestore').addEventListener('click', function () {
      S.family = { rows: MATLAB_FAMILY, source: 'matlab' };
      renderFamily();
    });

    // Perturbation
    var dh = $('dropHeight'), dhn = $('dropHeightNum'), ds = $('dropStrides');
    var setDrop = debounce(function (v) {
      v = clamp(v, 0, 60);
      dh.value = v; dhn.value = v;
      S.perturb.drop = v / 100;
      runPerturbation();
      renderPerturbation();
      updateStatus($('perturbText').textContent, true);
    }, 80);
    dh.addEventListener('input', function () { dhn.value = dh.value; setDrop(parseFloat(dh.value)); });
    dhn.addEventListener('change', function () { setDrop(parseFloat(dhn.value) || 0); });
    ds.addEventListener('change', function () {
      S.perturb.strides = clamp(Math.round(parseFloat(ds.value) || 15), 2, 40);
      ds.value = S.perturb.strides;
      runPerturbation();
      renderPerturbation();
    });
    $('compareBtn').addEventListener('click', comparePresets);

    // Map
    $('gridBtn').addEventListener('click', computeGrid);

    window.addEventListener('resize', debounce(redrawAll, 150));
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onScheme = function () { redrawAll(); };
      if (mq.addEventListener) mq.addEventListener('change', onScheme);
    }
  }

  function start() {
    var saved = 'auto';
    try { saved = localStorage.getItem('hds-theme') || 'auto'; } catch (e) { saved = 'auto'; }
    if (saved !== 'auto') document.documentElement.setAttribute('data-theme', saved);
    $('themeToggle').textContent = 'Theme: ' + saved;
    buildFooter();
    setupTabs();
    wire();
    buildLessons();
    setModel('slip');
    selectTab('stride', false);
    setPlaying(!reducedMotion);
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
