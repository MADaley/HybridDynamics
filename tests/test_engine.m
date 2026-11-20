function tests = test_engine
%TEST_ENGINE  Tests of the hde engine on models with known answers.
tests = functiontests(localfunctions);
end

function setupOnce(testCase) %#ok<*DEFNU>
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));
testCase.TestData.opts = hde.solverDefaults(struct('outputStep', 0.01));
end

%% ----- Ball in a box: impact times against the closed-form solution -----
function testBallInBoxImpactTimes(testCase)
[p, x0] = ballInBox_defaults();
r = hde.simulate(ballInBox_model(p), x0, hde.solverDefaults(struct('timeLimit', 6)));
% Legacy regression (TestBallInBox.m, 2012): 7 impacts in the first 6 s.
verifyEqual(testCase, height(r.events), 7);
% First impact: the ceiling, where y + r reaches yMax.
% Solve y0 + vy0 t - g t^2 / 2 = yMax - r for the first root.
a = -p.g / 2; b = x0(4); c = x0(2) - (p.yMax - p.radius);
tCeil = (-b + sqrt(b^2 - 4 * a * c)) / (2 * a);
verifyEqual(testCase, r.events.time(1), tCeil, 'AbsTol', 1e-9);
verifyEqual(testCase, r.events.guard(1), "ceiling");
% Second impact: the left wall, where x - r reaches xMin; vx is constant.
tLeft = (x0(1) - p.radius - p.xMin) / -x0(3);
verifyEqual(testCase, r.events.time(2), tLeft, 'AbsTol', 1e-9);
end

function testRestitutionReset(testCase)
[p, x0] = ballInBox_defaults();
r = hde.simulate(ballInBox_model(p), x0, hde.solverDefaults(struct('timeLimit', 1)));
ev = r.events(1, :);   % ceiling impact: vy reverses and scales by e
verifyEqual(testCase, ev.xAfter(4), -p.restitution * ev.xBefore(4), 'AbsTol', 1e-12);
verifyEqual(testCase, ev.xAfter(3), ev.xBefore(3), 'AbsTol', 1e-12);
end

function testBallComesToRestBeforeZenoLimit(testCase)
% Dropped from rest, floor bounces shorten geometrically; their durations
% sum to t0 * (1 + 2e / (1 - e)). The ball must come to rest (rolling
% phase) just before that limit and then stay on the floor.
[p, ~] = ballInBox_defaults();
r = hde.simulate(ballInBox_model(p), [5; 2; 0; 0], hde.solverDefaults(struct('timeLimit', 10)));
t0 = sqrt(2 * (2 - p.radius - p.yMin) / p.g);
tLimit = t0 * (1 + 2 * p.restitution / (1 - p.restitution));
iRest = find(r.events.to == "rolling", 1);
verifyNotEmpty(testCase, iRest);
verifyLessThan(testCase, r.events.time(iRest), tLimit);
verifyGreaterThan(testCase, r.events.time(iRest), tLimit - 0.05);
verifyEqual(testCase, r.xEnd(2), p.yMin + p.radius, 'AbsTol', 1e-12);
verifyEqual(testCase, r.exitReason, "timeLimit");
end

%% ----- Single phase with no transitions -----
function testPendulumNoTransitions(testCase)
[p, x0] = pendulum_defaults();
p.damping = 0;
r = hde.simulate(pendulum_model(p), x0, hde.solverDefaults(struct('timeLimit', 3)));
verifyEqual(testCase, r.exitReason, "timeLimit");
verifyEmpty(testCase, r.events);
% Undamped: energy per unit mass is conserved.
E = 0.5 * p.length^2 * r.x(2, :).^2 - p.g * p.length * cos(r.x(1, :));
verifyLessThan(testCase, max(abs(E - E(1))), 1e-8);
end

function testPendulumWallImpact(testCase)
[p, x0] = pendulum_defaults();
p.wallAngleDeg = -20;
r = hde.simulate(pendulum_model(p), x0, hde.solverDefaults(struct('timeLimit', 3)));
verifyGreaterThan(testCase, height(r.events), 0);
verifyEqual(testCase, rad2deg(r.events.xBefore(1, 1)), -20, 'AbsTol', 1e-8);
verifyEqual(testCase, r.events.xAfter(1, 2), -p.restitution * r.events.xBefore(1, 2), 'AbsTol', 1e-12);
end

%% ----- Engine behavior -----
function testGuardFiresOnEntry(testCase)
% A phase that starts past its guard leaves at once.
ph = hde.phase("a", @(t, x) [1; 0], guards = "g", guardFcn = @(t, x) x(2));
ph2 = hde.phase("b", @(t, x) [0; 0]);
model = struct('name', "entry", 'stateNames', ["u" "v"], 'phases', [ph ph2], ...
    'transitions', hde.transition("a", "g", "b"), 'startPhase', "a", 'cyclePhase', "");
r = hde.simulate(model, [0; -1], hde.solverDefaults(struct('timeLimit', 1)));
verifyEqual(testCase, r.events.time(1), 0);
verifyEqual(testCase, r.events.to(1), "b");
end

function testTerminalExitReason(testCase)
ph = hde.phase("fall", @(t, x) [x(2); -9.81], guards = "ground", guardFcn = @(t, x) x(1));
model = struct('name', "drop", 'stateNames', ["h" "v"], 'phases', ph, ...
    'transitions', hde.transition("fall", "ground", "END"), 'startPhase', "fall", 'cyclePhase', "");
r = hde.simulate(model, [1; 0]);
verifyEqual(testCase, r.exitReason, "terminal:ground");
verifyEqual(testCase, r.tEnd, sqrt(2 / 9.81), 'AbsTol', 1e-10);
end

function testCheckModelMissingTransition(testCase)
ph = hde.phase("a", @(t, x) 0, guards = ["g1", "g2"], guardFcn = @(t, x) [x; x]);
model = struct('name', "bad", 'stateNames', "u", 'phases', ph, ...
    'transitions', hde.transition("a", "g1", "END"), 'startPhase', "a");
verifyError(testCase, @() hde.checkModel(model), 'hde:checkModel:missingTransition');
end

function testUnknownSolverOption(testCase)
verifyError(testCase, @() hde.solverDefaults(struct('relTOL', 1)), ...
    'hde:solverDefaults:unknown');
end

function testNewtonSolve(testCase)
[z, info] = hde.newtonSolve(@(z) [z(1)^2 - 2; z(2) - 3], [1; 1]);
verifyTrue(testCase, info.converged);
verifyEqual(testCase, z, [sqrt(2); 3], 'AbsTol', 1e-9);
end
