%% EX08_SLIP_DROPSTEP  Recovery from an unexpected drop in the ground
% Purpose : lower the ground once, by the same height for three gaits that
%           share one speed and step frequency, and follow apex height and
%           forward speed stride by stride.
% Model   : models/slip
% Outputs : figure on screen
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: gaits and perturbation =====
presetNames = ["humanLowStiffness", "human", "humanHighStiffness"];
dropHeight  = 0.05;               % unexpected drop in ground height (m)
nStrides    = 15;                 % strides to follow after the drop

%% 1. Run each gait through the drop
n = numel(presetNames);
yHist = nan(nStrides + 1, n);
vHist = nan(nStrides + 1, n);
labels = strings(1, n);
for j = 1:n
    [p, apex, ~, presets] = slip_defaults(presetNames(j));
    labels(j) = presets.label(presets.name == presetNames(j));
    model = slip_model(p);
    s = [apex.y + dropHeight; apex.vx];      % apex height above the new ground
    yHist(1, j) = s(1) - apex.y;
    vHist(1, j) = s(2);
    reason = "survived";
    for i = 1:nStrides
        [s, info] = slip_returnMap(p, s, model);
        if any(isnan(s)), reason = info.exitReason; break, end
        yHist(i + 1, j) = s(1) - apex.y;
        vHist(i + 1, j) = s(2);
    end
    fprintf('%-24s strides completed after the drop: %2d (%s)\n', labels(j), ...
        sum(~isnan(yHist(2:end, j))), reason);
end

%% 2. Plot change in apex height and apex speed after the drop
St = daleyStyle('teaching');
f = St.figure('onehalf', 2);
tl = tiledlayout(f, 2, 1, 'TileSpacing', 'compact', 'Padding', 'compact');
ax = nexttile(tl); hold(ax, 'on');
h = gobjects(1, n);
for j = 1:n
    a = St.series(j);
    h(j) = plot(ax, 0:nStrides, yHist(:, j), a{:});
end
legend(h, labels, 'Box', 'off', 'Location', 'best');
ylabel(ax, 'Apex height change (m)');
St.apply(ax);
ax = nexttile(tl); hold(ax, 'on');
for j = 1:n
    a = St.series(j);
    plot(ax, 0:nStrides, vHist(:, j), a{:});
end
xlabel(ax, 'Stride after the drop'); ylabel(ax, 'Apex speed (m/s)');
St.apply(ax);
