function tests = test_slip
%TEST_SLIP  Tests of the SLIP runner: physics, numerics, presets and solvers.
tests = functiontests(localfunctions);
end

function setupOnce(testCase) %#ok<*DEFNU>
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));
[testCase.TestData.p, testCase.TestData.apex, ~, testCase.TestData.presets] = ...
    slip_defaults("human");
% Legacy 2020 defaults (BasicSLIP): 80 kg, 1 m leg, k = 50 kN/m, fast
% swing-leg retraction (3 * sqrt(g / (0.667 L0)) rad/s), and the limit cycle
% found at RelTol 1e-10 during the 2026-11-20 review.
legVel = 3 * sqrt(9.81 / 0.667);
testCase.TestData.legacy = struct('m', 80, 'k', 50000, 'L0', 1, 'g', 9.81, ...
    'legAngleDeg', 180 - rad2deg(2.754657), 'retractionDegPerS', rad2deg(legVel));
testCase.TestData.legacyApex = [0.998622; 5];
end

%% ----- Physics -----
function testEnergyConservation(testCase)
p = testCase.TestData.p; a = testCase.TestData.apex;
M = slip_metrics(p, [a.y; a.vx]);
verifyLessThan(testCase, abs(M.energyChange), 1e-6);
verifyLessThan(testCase, max(abs(M.trace.energy.total - M.trace.energy.total(1))), 1e-6);
end

function testVerticalImpulseEqualsWeight(testCase)
% Over a periodic stride the mean vertical force equals body weight.
p = testCase.TestData.p; a = testCase.TestData.apex;
M = slip_metrics(p, [a.y; a.vx], 1e-5);
[t, iu] = unique(M.trace.t);
meanFy = trapz(t, M.trace.Fy(iu)) / M.period;
verifyEqual(testCase, meanFy / (p.m * p.g), 1, 'RelTol', 1e-3);
end

%% ----- Numerics: touchdown detection (review defect D3) -----
function testTouchdownDetectedAtAllTolerances(testCase)
% Fast retraction carries the foot below ground and back up during flight.
% Touchdown must be found at every tolerance.
p = testCase.TestData.legacy; s = testCase.TestData.legacyApex;
model = slip_model(p);
for tol = [1e-3 1e-6 1e-9 1e-12]
    o = hde.solverDefaults(struct('relTol', tol, 'absTol', tol * 1e-3, ...
        'outputStep', 0, 'maxCycles', 1));
    r = hde.simulate(model, slip_apexState(p, s(1), s(2)), o);
    verifyEqual(testCase, r.events.guard', ["touchdown" "takeoff" "apex"], ...
        sprintf('RelTol %g', tol));
end
end

function testLegacyLimitCycleParity(testCase)
% The legacy limit cycle at tight tolerance: eigenvalue magnitudes 2.684 and 1.
p = testCase.TestData.legacy; s = testCase.TestData.legacyApex;
sNext = slip_returnMap(p, s);
verifyEqual(testCase, sNext, s, 'AbsTol', 1e-5);   % stored values are rounded to 1e-6
[J, info] = hde.returnMapJacobian(@(z) slip_returnMap(p, z), s);
F = hde.floquetSummary(J, true);
verifyEqual(testCase, abs(F.eigenvalues'), [2.684 1.000], 'AbsTol', 2e-3);
verifyFalse(testCase, F.isStable);
verifyLessThan(testCase, info.consistency, 1e-3);
end

%% ----- Presets -----
function testPresetsArePeriodic(testCase)
P = testCase.TestData.presets;
for i = 1:height(P)
    [p, a] = slip_defaults(P.name(i));
    [sNext, info] = slip_returnMap(p, [a.y; a.vx]);
    verifyEqual(testCase, sNext, [a.y; a.vx], 'AbsTol', 1e-7, P.name(i));
    verifyEqual(testCase, info.meanSpeed, 4, 'AbsTol', 1e-6, P.name(i));
    verifyEqual(testCase, 1 / info.period, 3, 'AbsTol', 1e-6, P.name(i));
end
end

function testPresetStability(testCase)
P = testCase.TestData.presets;
for i = 1:height(P)
    [p, a] = slip_defaults(P.name(i));
    S = slip_stability(p, [a.y; a.vx], struct('terrain', false));
    verifyEqual(testCase, S.lambda, P.lambda(i), 'AbsTol', 1e-4, P.name(i));
    % The 2-D map has the neutral energy eigenvalue and lambda.
    verifyEqual(testCase, sort(real(S.floquet.eigenvalues))', ...
        sort([1, S.lambda]), 'AbsTol', 1e-3, P.name(i));
    verifyLessThan(testCase, abs(S.lambda), 1, P.name(i));
end
end

%% ----- Solvers -----
function testFindGaitHoldLegAngle(testCase)
% State-only search (legacy defect D6 failed on this case).
p = testCase.TestData.p; a = testCase.TestData.apex;
target = struct('meanSpeed', 4, 'hold', "legAngle");
guess = struct('y', a.y + 0.005, 'vx', a.vx - 0.02, 'legAngleDeg', p.legAngleDeg);
[g, info] = slip_findGait(p, target, guess);
verifyTrue(testCase, info.converged);
verifyEqual(testCase, [g.y; g.vx], [a.y; a.vx], 'AbsTol', 1e-6);
end

function testFindGaitStepFrequency(testCase)
p = testCase.TestData.p;
p.k = 15000;
p.retractionDegPerS = 0;              % fixed leg angle; the guess is a touchdown angle
target = struct('meanSpeed', 4, 'hold', "stepFrequency", 'stepFrequency', 3);
[g, info] = slip_findGait(p, target, struct('y', 0.94, 'vx', 4.1, 'legAngleDeg', 66));
verifyTrue(testCase, info.converged);
verifyEqual(testCase, g.meanSpeed, 4, 'AbsTol', 1e-6);
verifyEqual(testCase, 1 / g.period, 3, 'AbsTol', 1e-6);
end

function testRetractionForClearanceKeepsGait(testCase)
% Retraction for a foot clearance changes the leg angle at apex but leaves
% the periodic gait (apex state, period, touchdown angle) unchanged.
P = testCase.TestData.presets;
for i = 1:height(P)
    [p, a] = slip_defaults(P.name(i));
    verifyEqual(testCase, a.y - p.L0 * sind(p.legAngleDeg), P.apexClearance(i), 'AbsTol', 1e-12);
    q = p; q.legAngleDeg = P.touchdownAngleDeg(i); q.retractionDegPerS = 0;   % fixed leg angle
    [q2, info] = slip_retractionForClearance(q, a, 0.08);
    verifyEqual(testCase, a.y - q2.L0 * sind(q2.legAngleDeg), 0.08, 'AbsTol', 1e-12);
    verifyEqual(testCase, info.touchdownAngleDeg, P.touchdownAngleDeg(i), 'AbsTol', 1e-8);
    [s0, i0] = slip_returnMap(q, [a.y; a.vx]);
    [s2, i2] = slip_returnMap(q2, [a.y; a.vx]);
    verifyEqual(testCase, s2, s0, 'AbsTol', 1e-8, P.name(i));
    verifyEqual(testCase, i2.period, i0.period, 'AbsTol', 1e-9, P.name(i));
    M = slip_metrics(q2, [a.y; a.vx]);
    verifyEqual(testCase, M.touchdownAngleDeg, P.touchdownAngleDeg(i), 'AbsTol', 1e-6, P.name(i));
end
end

function testDropFailureModeReported(testCase)
[p, a] = slip_defaults("human");
S = slip_stability(p, [a.y; a.vx], struct('jacobian', false, 'terrain', true));
verifyNotEmpty(testCase, S.dropFailure);
verifyTrue(testCase, startsWith(S.dropFailure, "terminal:"));
end

function testNormalizedMaxDrop(testCase)
% Daley and Usherwood (2010): dHmax = g/2 * (Phi/omega)^2. The simulated
% value (first contact at or in front of vertical) has the closed form
% L0 + g/2 * tv^2 - y, with tv the time from apex for the leg to reach vertical.
[p, a] = slip_defaults("human");
D = slip_normalizedMaxDrop(p, a, struct('referenceRetractionDegPerS', 100));
M = slip_metrics(p, [a.y; a.vx]);
phi = deg2rad(90 - M.touchdownAngleDeg);
verifyEqual(testCase, D.estimateDrop, 0.5 * p.g * (phi / deg2rad(p.retractionDegPerS))^2, 'RelTol', 1e-6);
verifyEqual(testCase, D.estimateDropAtReference, 0.5 * p.g * (phi / deg2rad(100))^2, 'RelTol', 1e-6);
tv = (90 - p.legAngleDeg) / p.retractionDegPerS;
verifyEqual(testCase, D.simulatedDrop, p.L0 + 0.5 * p.g * tv^2 - a.y, 'AbsTol', 2e-4);
% slip_dropResponse applies the same criterion on either side of the limit
verifyTrue(testCase, slip_dropResponse(p, a, D.simulatedDrop - 0.02).firstContact);
verifyFalse(testCase, slip_dropResponse(p, a, D.simulatedDrop + 0.02).firstContact);
q = p; q.retractionDegPerS = 0; q.legAngleDeg = M.touchdownAngleDeg;
Dfixed = slip_normalizedMaxDrop(q, a);
verifyEqual(testCase, Dfixed.estimateDrop, Inf);
end

function testMissedStance(testCase)
% Touchdown with the leg behind vertical and the body moving away from the
% foot: the leg cannot be loaded, and the run ends as a missed stance.
p = struct('m', 80, 'k', 12000, 'L0', 1, 'g', 9.81, 'legAngleDeg', 100, 'retractionDegPerS', 0);
[sNext, info] = slip_returnMap(p, [sind(100) + 0.01; 5]);
verifyTrue(testCase, all(isnan(sNext)));
verifyEqual(testCase, info.exitReason, "terminal:missedStance");
end

function testRetractionRules(testCase)
% Each rule keeps the periodic gait. Fastest recovery gives lambda = 0;
% ground speed matching maximizes GSM; per-cycle rates convert with the
% gait cycle (two steps).
[p, a] = slip_defaults("human");
[q1, i1] = slip_retractionRule(p, a, "fastestRecovery");
verifyLessThan(testCase, abs(i1.lambda), 1e-4);
[q2, i2] = slip_retractionRule(p, a, "groundSpeedMatching");
G0 = slip_groundSpeedMatching(slip_setRetraction(p, a, i2.retractionDegPerS + 5), a);
G1 = slip_groundSpeedMatching(slip_setRetraction(p, a, i2.retractionDegPerS - 5), a);
verifyGreaterThan(testCase, i2.gsm, max(G0.gsm, G1.gsm));
[~, i3] = slip_retractionRule(p, a, "commonPerCycle", 90);
[~, m] = slip_returnMap(p, [a.y; a.vx]);
verifyEqual(testCase, i3.retractionDegPerS, 90 / (2 * m.period), 'RelTol', 1e-9);
for q = {q1, q2}
    s = slip_returnMap(q{1}, [a.y; a.vx]);
    verifyEqual(testCase, s, [a.y; a.vx], 'AbsTol', 1e-7);
end
% Low-stiffness gait: lambda < 0 with no retraction, so the rule returns 0.
[pl, al] = slip_defaults("humanLowStiffness");
[~, il] = slip_retractionRule(pl, al, "fastestRecovery");
verifyEqual(testCase, il.retractionDegPerS, 0);
end

function testStrideFailureIsReported(testCase)
% A leg angle steeper than the apex allows puts the foot below ground.
p = testCase.TestData.p; a = testCase.TestData.apex;
p.legAngleDeg = 85;
[sNext, info] = slip_returnMap(p, [a.y; a.vx]);
verifyTrue(testCase, all(isnan(sNext)));
verifyEqual(testCase, info.exitReason, "terminal:footBelowGround");
end

function testStiffnessFamilyComplete(testCase)
p = testCase.TestData.p; a = testCase.TestData.apex;
target = struct('meanSpeed', 4, 'hold', "stepFrequency", 'stepFrequency', 3);
T = slip_stiffnessFamily(struct('p', p, 'y', a.y, 'vx', a.vx), (6:1:35) * 1000, ...
    target, struct('stability', false));
verifyFalse(testCase, any(isnan(T.legAngleDeg)));
% Peak force rises and contact time falls with stiffness at one speed.
verifyTrue(testCase, all(diff(T.peakVerticalForceBW) > 0));
verifyTrue(testCase, all(diff(T.contactTime) < 0));
end
