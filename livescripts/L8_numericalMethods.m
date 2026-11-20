%[text] # Lesson 8. Numerical methods: why events can be missed
%[text] An ODE solver checks a guard only at the end of each step. If a guard value dips below zero and comes back within one step, the solver never sees the crossing. In the spring-mass model with fast swing-leg retraction, the foot height does exactly this: the foot passes below the ground and rises again as the leg rotates past vertical.
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
%[text] ## 1. The 2020 default settings
%[text] The legacy engine used a fast retraction rate. Plot the foot height during the descending flight.
legVel = 3 * sqrt(9.81 / 0.667);                       % rad/s, legacy setting
p = struct('m', 80, 'k', 50000, 'L0', 1, 'g', 9.81, ...
    'legAngleDeg', 180 - rad2deg(2.754657), 'retractionDegPerS', rad2deg(legVel));
apex = struct('y', 0.998622, 'vx', 5);
t = linspace(0, 0.2, 2001);
footHeight = apex.y - 0.5 * p.g * t.^2 - p.L0 * sind(p.legAngleDeg + p.retractionDegPerS * t);
below = footHeight < 0;
fprintf('Foot below ground from %.3f s to %.3f s; lowest point %.1f cm\n', ...
    t(find(below, 1)), t(find(below, 1, 'last')), 100 * min(footHeight));
St = daleyStyle('teaching');
f = St.figure('single', 1, 0.8);
ax = axes(f); hold(ax, 'on');
yline(ax, 0, ':', 'Color', St.col.grey, 'LineWidth', St.reflinewidth);
a = St.series(1); plot(ax, t, footHeight, a{:});
xlabel(ax, 'Time from apex (s)'); ylabel(ax, 'Foot height (m)'); St.apply(ax);
%[text] ## 2. A large solver step misses touchdown
%[text] Flight is a quadratic in time, which ode45 integrates exactly, so its error estimate is near zero and its steps grow large. Remove the step limit from the descending flight phase and tighten the tolerance:
model = slip_model(p);
model.phases(1).maxStep = Inf;          % the toolkit sets 5e-4 s here
opts = hde.solverDefaults(struct('relTol', 1e-12, 'absTol', 1e-15, 'maxCycles', 1, 'outputStep', 0));
r = hde.simulate(model, slip_apexState(p, apex.y, apex.vx), opts);
r.events(:, {'time', 'guard', 'to'})
%[text] The runner falls through the ground: the solver stepped over the touchdown. Tightening the tolerance does not fix this. Try `relTol` values of 1e-3, 1e-6, 1e-8, 1e-9 and 1e-10 with the step limit removed: some find the touchdown and others miss it, with no order. With the step limit restored, touchdown is found at every tolerance:
r = hde.simulate(slip_model(p), slip_apexState(p, apex.y, apex.vx), opts);
r.events(:, {'time', 'guard', 'to'})
%[text] ## 3. Lessons for building models
%[text] Write guards that change sign once per phase where possible.
%[text] Where a guard can dip and return, limit the solver step (`maxStep` in `hde.phase`) or solve the phase in closed form and scan the guard finely (the web page does this).
%[text] Check conservation laws: in this model the mechanical energy should stay constant to the solver tolerance.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
