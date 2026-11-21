%[text] # Lesson 6. Swing-leg retraction
%[text] Running animals rotate the leg rearward before ground contact (swing-leg retraction). In the model, the leg is set to an angle at apex and then rotates at a constant rate during the descending flight phase, so the touchdown angle depends on how long the body falls (Seyfarth et al. 2003). A higher apex means a longer fall and a steeper leg at touchdown.
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
[p, apex, ~, presets] = slip_defaults("human");
target = struct('meanSpeed', presets.meanSpeed(1), 'hold', "stepFrequency", ...
    'stepFrequency', presets.stepFrequency(1));
%[text] ## 1. Retraction rate and stability at one speed
%[text] For each retraction rate, solve the periodic gait at the same average speed and step frequency, then compute $\lambda$.
rates = 0:20:160;
lambda = nan(size(rates)); tdAngle = nan(size(rates)); apexAngle = nan(size(rates));
clearance = nan(size(rates));
guess = struct('y', apex.y, 'vx', apex.vx, ...
    'legAngleDeg', presets.touchdownAngleDeg(presets.name == "human"));
for i = 1:numel(rates)
    q = p; q.retractionDegPerS = rates(i);
    [g, info] = slip_findGait(q, target, guess);
    if ~info.converged, continue, end
    guess = struct('y', g.y, 'vx', g.vx, 'legAngleDeg', g.p.legAngleDeg);
    M = slip_metrics(g.p, [g.y; g.vx]);
    S = slip_stability(g.p, [g.y; g.vx], struct('jacobian', false, 'terrain', false));
    lambda(i) = S.lambda; tdAngle(i) = M.touchdownAngleDeg; apexAngle(i) = g.p.legAngleDeg;
    clearance(i) = g.y - g.p.L0 * sind(g.p.legAngleDeg);
end
table(rates', apexAngle', tdAngle', 100 * clearance', lambda', 'VariableNames', ...
    {'retractionDegPerS', 'apexLegAngleDeg', 'touchdownAngleDeg', 'apexClearanceCm', 'lambda'})
%[text] The touchdown angle is the same in every row: at this speed and step frequency the periodic gait itself does not change. Only the leg angle at apex changes, to reach the same touchdown angle after the same fall, and a shallower leg at apex lifts the foot higher above the ground. The eigenvalue changes: retraction couples the touchdown angle to the fall time, and that coupling sets how an error in apex height carries into the next stride. More foot clearance needs faster retraction, which moves $\lambda$ toward $-1$.
%[text] ## 2. Plot
St = daleyStyle('teaching');
f = St.figure('single', 1, 0.8);
ax = axes(f); hold(ax, 'on');
yline(ax, [-1 0 1], ':', 'Color', St.col.grey, 'LineWidth', St.reflinewidth);
a = St.series(1); plot(ax, rates, lambda, a{:});
xlabel(ax, 'Retraction rate (deg/s)'); ylabel(ax, 'Eigenvalue \lambda'); St.apply(ax);
%[text] ## Try this
%[text] Find the retraction rate with the smallest $|\lambda|$ and the rate at which $\lambda$ passes $-1$.
%[text] Repeat with the low-stiffness preset. Guinea fowl running over terrain drops have been studied with this framework (Daley and Biewener 2006; Blum et al. 2014).

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
