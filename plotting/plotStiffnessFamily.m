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
%   Nine panels against leg stiffness, all at the same average speed:
%   touchdown angle, swing-leg retraction rate, peak vertical force,
%   contact time, positive leg work per distance, force-time cost index,
%   stride-to-stride eigenvalue (lambda; the dotted lines at -1 and +1
%   bound the stable range), the largest drop survived for 20 strides, and
%   the normalized maximum drop of Daley and Usherwood (2010): the estimate
%   at each gait's retraction rate, the estimate at one common rate, and
%   the simulated first-contact limit (when the table has those columns).

if nargin < 2, highlight = table(); end
if height(highlight) > 0
    highlight = sortrows(highlight, 'k');      % legend from low to high stiffness
end
S = daleyStyle('teaching');
% Teaching type sizes need a screen-sized figure for nine panels.
f = S.figure('double', 3);
wh = [12 9.5];                                  % inches
set(f, 'Position', [1 1 wh], 'PaperSize', wh, 'PaperPosition', [0 0 wh]);
tl = tiledlayout(f, 3, 3, 'TileSpacing', 'compact', 'Padding', 'compact');

kk = T.k / 1000;
panels = {
    "touchdownAngleDeg",       "Touchdown angle (deg)"
    "retractionDegPerS",       "Retraction rate (deg/s)"
    "peakVerticalForceBW",     "Peak vertical force (BW)"
    "contactTime",             "Contact time (s)"
    "positiveWorkPerDistance", "Positive leg work (J kg^{-1} m^{-1})"
    "forceTimeCostIndex",      "Force-time cost index (s^{-1})"
    "lambda",                  "Eigenvalue \lambda"
    "maxDrop",                 "Largest drop survived (m)"};

for i = 1:size(panels, 1)
    ax = nexttile(tl); hold(ax, 'on');
    y = T.(panels{i, 1});
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
    if i == 3 && ~isempty(h)
        legend(h, highlight.label, 'Box', 'off', 'Location', 'northwest', 'FontSize', 10);
    end
    xlabel(ax, 'Leg stiffness (kN/m)');
    ylabel(ax, panels{i, 2});
    S.apply(ax);
end

% Normalized maximum drop: three estimates of one quantity on one axis.
if ismember('nmdEstimate', T.Properties.VariableNames)
    ax = nexttile(tl); hold(ax, 'on');
    cols = ["nmdEstimate" "nmdEstimateAtReference" "nmdSimulated"];
    names = ["estimate, own retraction", "estimate, common retraction", "simulated first contact"];
    h = gobjects(1, 3);
    for j = 1:3
        y = T.(cols(j));
        y(~isfinite(y)) = NaN;          % beyond the search limit: left out
        a = S.series(j);
        h(j) = plot(ax, kk, y, a{:});
    end
    legend(h, names, 'Box', 'off', 'Location', 'northwest', 'FontSize', 9);
    set(ax, 'YScale', 'log');                   % values span two orders of magnitude
    xlabel(ax, 'Leg stiffness (kN/m)');
    ylabel(ax, 'Normalized maximum drop');
    S.apply(ax);
end
end
