function f = plotStiffnessFamily(T, highlight)
%PLOTSTIFFNESSFAMILY  Force, timing, cost and stability across a stiffness family.
%
%   f = plotStiffnessFamily(T)
%   f = plotStiffnessFamily(T, highlight)
%
%   T         : table from slip_stiffnessFamily (one row per stiffness)
%   highlight : optional table with columns k and label (for example the
%               preset table from slip_defaults); these gaits are marked
%               with circles in every panel
%
%   Eight panels against leg stiffness, all at the same average speed:
%   touchdown angle, foot clearance at apex, peak vertical force, contact
%   time, positive leg work per distance, force-time cost index,
%   stride-to-stride eigenvalue (lambda; the dotted lines at -1 and +1
%   bound the stable range), and the normalized maximum drop of Daley and
%   Usherwood (2010): the estimate and the simulated first-contact limit.

if nargin < 2, highlight = table(); end
if height(highlight) > 0
    highlight = sortrows(highlight, 'k');      % legend from low to high stiffness
end
S = daleyStyle('teaching');
% Teaching type sizes need a screen-sized figure for nine panels.
f = S.figure('double', 2);
wh = [14 6.5];                                  % inches
set(f, 'Position', [1 1 wh], 'PaperSize', wh, 'PaperPosition', [0 0 wh]);
tl = tiledlayout(f, 2, 4, 'TileSpacing', 'compact', 'Padding', 'compact');

kk = T.k / 1000;
panels = {
    "touchdownAngleDeg",       "Touchdown angle (deg)",                1
    "apexClearance",           "Foot clearance at apex (cm)",          100
    "peakVerticalForceBW",     "Peak vertical force (BW)",             1
    "contactTime",             "Contact time (s)",                     1
    "positiveWorkPerDistance", "Positive leg work (J kg^{-1} m^{-1})", 1
    "forceTimeCostIndex",      "Force-time cost index (s^{-1})",       1
    "lambda",                  "Eigenvalue \lambda",                   1};

for i = 1:size(panels, 1)
    ax = nexttile(tl); hold(ax, 'on');
    y = T.(panels{i, 1}) * panels{i, 3};
    if panels{i, 1} == "lambda"
        yline(ax, [-1 1], ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);
        yline(ax, 0, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);
    end
    a = S.series(1);
    a{end} = 1.25;   % one series per panel: moderate weight under the markers
    plot(ax, kk, y, a{:});
    h = gobjects(0);
    for j = 1:height(highlight)
        [~, r] = min(abs(T.k - highlight.k(j)));
        b = S.points(j + 1);
        h(j) = plot(ax, kk(r), y(r), b{:});
    end
    if i == 1 && ~isempty(h)
        legend(h, highlight.label, 'Box', 'off', 'Location', 'northwest', 'FontSize', 10);
    end
    xlabel(ax, 'Leg stiffness (kN/m)');
    ylabel(ax, panels{i, 2});
    S.apply(ax);
end

% Normalized maximum drop: two measures of one quantity on one axis.
if ismember('nmdEstimate', T.Properties.VariableNames)
    ax = nexttile(tl); hold(ax, 'on');
    cols = ["nmdEstimate" "nmdSimulated"];
    names = ["estimate (Daley and Usherwood 2010)", "simulated first contact"];
    h = gobjects(1, 2);
    for j = 1:2
        y = T.(cols(j));
        y(~isfinite(y)) = NaN;          % beyond the search limit: left out
        a = S.series(j);
        h(j) = plot(ax, kk, y, a{:});
    end
    legend(h, names, 'Box', 'off', 'Location', 'northeast', 'FontSize', 9);
    % Linear axis scaled to the finite data, from zero; capped at 3 leg
    % lengths only when a value exceeds it (slow retraction gives very large
    % values).
    v = [T.nmdEstimate; T.nmdSimulated];
    yTop = max(v(isfinite(v)));
    if ~isempty(yTop) && yTop > 0, ylim(ax, [0, min(1.1 * yTop, 3)]); end
    xlabel(ax, 'Leg stiffness (kN/m)');
    ylabel(ax, 'Normalized maximum drop');
    S.apply(ax);
end
end
