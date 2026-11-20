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
%   Six panels against leg stiffness, all at the same average speed:
%   peak vertical force, contact time, positive leg work per distance,
%   force-time cost index, stride-to-stride eigenvalue (lambda; the
%   dotted lines at -1 and +1 bound the stable range) and the largest
%   drop survived.

if nargin < 2, highlight = table(); end
S = daleyStyle('teaching');
f = S.figure('double', 2, 0.30);
tl = tiledlayout(f, 2, 3, 'TileSpacing', 'compact', 'Padding', 'compact');

kk = T.k / 1000;
panels = {
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
    if i == 1 && ~isempty(h)
        legend(h, highlight.label, 'Box', 'off', 'Location', 'northwest', 'FontSize', 10);
    end
    xlabel(ax, 'Leg stiffness (kN/m)');
    ylabel(ax, panels{i, 2});
    S.apply(ax);
end
end
