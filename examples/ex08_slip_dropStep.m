%% EX08_SLIP_DROPSTEP  The first stance after an unexpected drop in the ground
% Purpose : lower the ground once, by several heights, for three gaits that
%           share one speed, step frequency and retraction rate, and plot
%           the leg force in the stance right after the drop: touchdown
%           angle, contact and peak force, with the peak force of the same
%           gait with a fixed leg angle for comparison. Report the
%           normalized maximum drop (first-contact limit; Daley and
%           Usherwood 2010).
% Model   : models/slip
% Outputs : figure and table on screen
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: gaits and drops =====
presetNames = ["humanLowStiffness", "human", "humanHighStiffness"];
dropHeights = [0 0.05 0.10 0.20];    % unexpected drops in ground height (m); at most four

%% 1. Leg force in the first stance after each drop
St = daleyStyle('teaching');
f = St.figure('double', 1);
set(f, 'Position', [1 1 13 4.2], 'PaperSize', [13 4.2], 'PaperPosition', [0 0 13 4.2]);
tl = tiledlayout(f, 1, numel(presetNames), 'TileSpacing', 'compact', 'Padding', 'compact');
for j = 1:numel(presetNames)
    [p, apex, ~, presets] = slip_defaults(presetNames(j));
    model = slip_model(p);
    ax = nexttile(tl); hold(ax, 'on');
    yline(ax, 1, ':', 'Color', St.col.grey, 'LineWidth', St.reflinewidth);    % body weight
    h = gobjects(1, numel(dropHeights));
    for i = 1:numel(dropHeights)
        o = hde.solverDefaults(struct('outputStep', 1e-4, 'maxCycles', 1));
        r = hde.simulate(model, slip_apexState(p, apex.y + dropHeights(i), apex.vx), o);
        inStance = r.phase == find(r.phaseNames == "stance");
        if ~any(inStance), continue, end
        L = hypot(r.x(1, inStance) - r.x(5, inStance), r.x(2, inStance) - r.x(6, inStance));
        F = p.k * max(p.L0 - L, 0) / (p.m * p.g);
        t = r.t(inStance) - r.t(find(inStance, 1));
        a = St.series(i);
        h(i) = plot(ax, 1000 * t, F, a{:});
    end
    title(ax, presets.label(presets.name == presetNames(j)));
    xlabel(ax, 'Time from touchdown (ms)'); ylabel(ax, 'Leg force (BW)');
    St.apply(ax);
    if j == 1
        shown = isgraphics(h);
        legend(ax, h(shown), compose("drop %.0f cm", 100 * dropHeights(shown)), ...
            'Box', 'off', 'Location', 'northeast', 'FontSize', 9);
    end
end

%% 2. Table: contact, touchdown angle, peak force and the first-contact limit
rows = {};
for j = 1:numel(presetNames)
    [p, apex] = slip_defaults(presetNames(j));
    q = slip_retractionRule(p, apex, "fixed");       % same gait, no retraction
    D = slip_normalizedMaxDrop(p, apex);
    for i = 1:numel(dropHeights)
        R = slip_dropResponse(p, apex, dropHeights(i));
        F = slip_dropResponse(q, apex, dropHeights(i));
        rows(end+1, :) = {presetNames(j), dropHeights(i), R.firstContact, R.touchdownAngleDeg, ...
            R.peakLegForceBW, F.peakLegForceBW, D.estimateNMD, D.simulatedNMD}; %#ok<AGROW>
    end
end
T = cell2table(rows, 'VariableNames', {'preset', 'drop_m', 'contactBeforeVertical', 'touchdownAngleDeg', ...
    'peakLegForceBW', 'peakLegForceBWfixedAngle', 'nmdEstimate', 'nmdSimulated'});
disp(T);
