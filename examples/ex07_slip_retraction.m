%% EX07_SLIP_RETRACTION  Choosing swing-leg retraction rate
% Purpose : give one periodic gait different swing-leg retraction rates,
%           chosen by different rules, and compare foot clearance, ground
%           speed matching, stride-to-stride stability, the normalized
%           maximum drop and the peak leg force after a drop. Compare the
%           rates with the leg rotation measured in running humans and
%           pheasants (Blum et al. 2011).
% Model   : models/slip
% Outputs : rule table and figure on screen
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: gait =====
presetName = "human";             % "human", "humanLowStiffness", "humanHighStiffness"
[p, apex] = slip_defaults(presetName);

%% ===== USER SETTINGS: rules and tests =====
rules      = slip_defaultRetractionRules();   % {name, rule, value}
omegas     = 0:10:250;                        % rates for the sweep (deg/s)
dropHeight = 0.05;                            % drop for the peak-force test (m)

%% 1. Compare the rules (every rule keeps the same periodic gait)
T = slip_compareRetractionRules(p, apex, rules, struct('dropHeight', dropHeight));
disp(T(:, ["name" "retractionDegPerS" "retractionDegPerCycle" "apexClearance" ...
    "groundSpeedMatching" "lambda" "nmdEstimate" "peakForceAfterDropBW"]));

%% 2. Sweep the retraction rate
W = slip_retractionSweep(p, apex, omegas, struct('dropHeight', dropHeight));

%% 3. Measured leg rotation in running humans and pheasants (deg per gait cycle)
D = readtable(fullfile(fileparts(mfilename('fullpath')), '..', 'data', ...
    'swingLegKinematics_Blum2011.csv'), 'TextType', 'string');
cycle = T.retractionDegPerCycle(2) / T.retractionDegPerS(2);   % gait cycle of this gait (s)
humanRate = D.legRotation_degPerCycle(D.species == "human") / cycle;     % deg/s at this cycle
birdRate  = D.legRotation_degPerCycle(D.species == "pheasant") / cycle;

%% 4. Plot measures against retraction rate, with the rules marked
St = daleyStyle('teaching');
f = St.figure('double', 2);
set(f, 'Position', [1 1 12 7], 'PaperSize', [12 7], 'PaperPosition', [0 0 12 7]);
tl = tiledlayout(f, 2, 3, 'TileSpacing', 'compact', 'Padding', 'compact');
panels = {"apexClearance", 100, "Foot clearance at apex (cm)"
          "groundSpeedMatching", 100, "Ground speed matching (%)"
          "lambda", 1, "Eigenvalue \lambda"
          "nmdEstimate", 1, "NMD estimate"
          "peakForceAfterDropBW", 1, sprintf("Peak force after %.0f cm drop (BW)", 100 * dropHeight)
          "nmdSimulated", 1, "Simulated first-contact limit"};
for i = 1:size(panels, 1)
    ax = nexttile(tl); hold(ax, 'on');
    y = W.(panels{i, 1}) * panels{i, 2};
    y(~isfinite(y)) = NaN;
    % Shaded spans: measured human and pheasant rates (deg/T converted to deg/s)
    yl = [min(y, [], 'omitnan'), max(y, [], 'omitnan')];
    if panels{i, 1} == "lambda", yl = [-1.5 1]; yline(ax, [-1 0 1], ':', 'Color', St.col.grey, 'LineWidth', St.reflinewidth); end
    if startsWith(panels{i, 1}, "nmd"), yl = [0 3]; end
    patch(ax, [min(humanRate) max(humanRate) max(humanRate) min(humanRate)], yl([1 1 2 2]), ...
        St.col.lightgrey, 'EdgeColor', 'none', 'FaceAlpha', 0.6, 'HandleVisibility', 'off');
    a = St.series(1); a{end} = 1.25;
    plot(ax, W.retractionDegPerS, y, a{:}, 'HandleVisibility', 'off');
    for r = 2:height(T)
        b = St.points(r);
        yr = T.(panels{i, 1})(r) * panels{i, 2};
        if isfinite(yr), plot(ax, T.retractionDegPerS(r), yr, b{:}, 'DisplayName', T.name(r)); end
    end
    ylim(ax, yl);
    xlabel(ax, 'Retraction rate (deg/s)'); ylabel(ax, panels{i, 3});
    St.apply(ax);
    if i == 1, legend(ax, 'Box', 'off', 'Location', 'northwest', 'FontSize', 9); end
end
title(tl, sprintf('%s; grey span: human leg rotation 2 to 4 m/s (Blum et al. 2011)', presetName), ...
    'FontName', St.font, 'Color', St.ink, 'FontSize', 12);
fprintf('Human leg rotation (2 to 4 m/s): %.0f to %.0f deg/s at this gait cycle; pheasant: %.0f to %.0f deg/s.\n', ...
    min(humanRate), max(humanRate), min(birdRate), max(birdRate));
