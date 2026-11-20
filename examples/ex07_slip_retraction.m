%% EX07_SLIP_RETRACTION  Swing-leg retraction and stride-to-stride stability
% Purpose : rotate the leg rearward during the descending flight phase and
%           see how the retraction rate changes the touchdown angle and the
%           eigenvalue of the apex return map, at the same average speed
%           and step frequency.
% Model   : models/slip
% Outputs : table and figure on screen
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: starting gait =====
[p, apex, ~, presets] = slip_defaults("human");

%% ===== USER SETTINGS: contact conditions to compare =====
retractionRates = 0:20:200;       % leg rotation rates in descending flight (deg/s)

%% ===== USER SETTINGS: gait held fixed =====
target.meanSpeed     = presets.meanSpeed(presets.name == "human");
target.hold          = "stepFrequency";
target.stepFrequency = presets.stepFrequency(presets.name == "human");

%% 1. Solve the periodic gait for each retraction rate (continuation)
n = numel(retractionRates);
lambda = nan(n, 1); apexAngle = nan(n, 1); tdAngle = nan(n, 1); Fv = nan(n, 1);
guess = struct('y', apex.y, 'vx', apex.vx, 'legAngleDeg', p.legAngleDeg);
for i = 1:n
    q = p;
    q.retractionDegPerS = retractionRates(i);
    [g, info] = slip_findGait(q, target, guess);
    if ~info.converged, continue, end
    guess = struct('y', g.y, 'vx', g.vx, 'legAngleDeg', g.p.legAngleDeg);
    S = slip_stability(g.p, [g.y; g.vx], struct('jacobian', false, 'terrain', false));
    M = slip_metrics(g.p, [g.y; g.vx]);
    lambda(i) = S.lambda;
    apexAngle(i) = g.p.legAngleDeg;
    tdAngle(i) = M.touchdownAngleDeg;
    Fv(i) = M.peakVerticalForceBW;
end
T = table(retractionRates(:), apexAngle, tdAngle, Fv, lambda, 'VariableNames', ...
    {'retractionDegPerS', 'apexLegAngleDeg', 'touchdownAngleDeg', 'peakVerticalForceBW', 'lambda'});
disp(T);

%% 2. Plot
St = daleyStyle('teaching');
f = St.figure('onehalf', 2);
tl = tiledlayout(f, 2, 1, 'TileSpacing', 'compact', 'Padding', 'compact');
ax = nexttile(tl); hold(ax, 'on');
a = St.series(1); plot(ax, T.retractionDegPerS, T.touchdownAngleDeg, a{:});
b = St.series(2); plot(ax, T.retractionDegPerS, T.apexLegAngleDeg, b{:});
legend(ax, ["at touchdown", "at apex"], 'Box', 'off', 'Location', 'best');
ylabel(ax, 'Leg angle (deg)');
St.apply(ax);
ax = nexttile(tl); hold(ax, 'on');
yline(ax, [-1 0 1], ':', 'Color', St.col.grey, 'LineWidth', St.reflinewidth);
plot(ax, T.retractionDegPerS, T.lambda, a{:});
xlabel(ax, 'Retraction rate (deg/s)'); ylabel(ax, 'Eigenvalue \lambda');
St.apply(ax);
