function f = plotSlipStride(M, p, titleText)
%PLOTSLIPSTRIDE  Body path, ground reaction forces and energy for one stride.
%
%   f = plotSlipStride(M, p)
%   f = plotSlipStride(M, p, titleText)
%
%   M : output of slip_metrics;  p : the parameters used
%
%   Panels: (A) body path with the leg at touchdown, mid-stance and takeoff;
%   (B) vertical and (C) horizontal ground reaction force in body weights;
%   (D) change in each mechanical energy component from the start of the
%   stride. Stance is shaded.

if nargin < 3, titleText = ""; end
S = daleyStyle('teaching');
tr = M.trace;
W = p.m * p.g;
f = S.figure('double', 2, 0.32);
tl = tiledlayout(f, 2, 2, 'TileSpacing', 'compact', 'Padding', 'compact');
if strlength(titleText) > 0
    title(tl, titleText, 'FontName', S.font, 'Color', S.ink, 'FontSize', 13);
end

stanceIdx = find(tr.phaseNames == "stance");
inStance = tr.phase == stanceIdx;
tTD = tr.events.time(tr.events.guard == "touchdown");
tTO = tr.events.time(tr.events.guard == "takeoff");

%% A. Body path and leg snapshots
ax = nexttile(tl); hold(ax, 'on');
yline(ax, 0, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);   % ground
a = S.series(1);
plot(ax, tr.x(1, :), tr.x(2, :), a{:});
iStance = find(inStance);
[~, iMid] = min(tr.x(2, iStance));
snaps = [iStance(1), iStance(iMid), iStance(end)];
for i = snaps
    plot(ax, [tr.x(1, i), tr.x(5, i)], [tr.x(2, i), tr.x(6, i)], ...
        'Color', S.col.grey, 'LineWidth', 0.8);
    plot(ax, tr.x(1, i), tr.x(2, i), 'o', 'MarkerSize', 6, ...
        'MarkerFaceColor', S.col.navy, 'MarkerEdgeColor', 'none');
end
axis(ax, 'equal');
ylim(ax, [0, max(tr.x(2, :)) * 1.08]);
xlabel(ax, 'Forward position (m)'); ylabel(ax, 'Height (m)');
S.apply(ax);

%% B. Vertical ground reaction force
ax = nexttile(tl); hold(ax, 'on');
yline(ax, 1, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);   % body weight
a = S.series(1);
plot(ax, tr.t, tr.Fy / W, a{:});
xlabel(ax, 'Time (s)'); ylabel(ax, 'Vertical force (BW)');
shadeStance(ax, tTD, tTO, S);
S.apply(ax);

%% C. Horizontal ground reaction force
ax = nexttile(tl); hold(ax, 'on');
yline(ax, 0, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);   % braking vs propulsion
a = S.series(2);
plot(ax, tr.t, tr.Fx / W, a{:});
xlabel(ax, 'Time (s)'); ylabel(ax, 'Horizontal force (BW)');
shadeStance(ax, tTD, tTO, S);
S.apply(ax);

%% D. Energy components, change from the start of the stride
ax = nexttile(tl); hold(ax, 'on');
yline(ax, 0, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);
E = tr.energy;
kin = E.kineticHorizontal + E.kineticVertical;
comps = {kin - kin(1), E.potential - E.potential(1), E.elastic - E.elastic(1), ...
    E.total - E.total(1)};
names = ["kinetic", "gravitational", "elastic", "total"];
h = gobjects(1, 4);
for i = 1:4
    a = S.series(i);
    h(i) = plot(ax, tr.t, comps{i}, a{:});
end
legend(h, names, 'Box', 'off', 'Location', 'southwest', 'FontSize', 10);
xlabel(ax, 'Time (s)'); ylabel(ax, 'Energy change (J)');
shadeStance(ax, tTD, tTO, S);
S.apply(ax);
end

function shadeStance(ax, tTD, tTO, S)
% Light grey span marking stance, placed behind the data at the final limits.
yl = ylim(ax);
h = patch(ax, [tTD tTO tTO tTD], [yl(1) yl(1) yl(2) yl(2)], S.col.lightgrey, ...
    'EdgeColor', 'none', 'FaceAlpha', 0.5, 'HandleVisibility', 'off');
uistack(h, 'bottom');
ylim(ax, yl);
end
