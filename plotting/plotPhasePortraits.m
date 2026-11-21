function [f, P] = plotPhasePortraits(p, apex, opts)
%PLOTPHASEPORTRAITS  Phase portraits of a SLIP gait, with a moving dot and a perturbed start.
%
%   [f, P] = plotPhasePortraits(p, apex)
%   [f, P] = plotPhasePortraits(p, apex, opts)
%
%   p, apex : parameters and apex state (struct with y, vx)
%   opts (all optional)
%     .nStrides      strides of the gait to draw (default 1)
%     .perturbation  change in apex height for an overlay run (m), at the
%                    same mechanical energy; 0 or NaN for no overlay
%     .perturbStrides  strides of the overlay run (default 6)
%     .animate       move a dot along both portraits and the stick figure
%                    together (default false)
%     .animateRun    "gait" (default) or "perturbed": the run the dot follows
%     .frameStep     time between animation frames (s, default 0.005)
%     .videoFile     full path of an .mp4 to write while animating
%
%   Panel A: body height against vertical velocity. One stride of a periodic
%   gait is a closed loop. The apex is the crossing of zero vertical velocity
%   in flight (dotted line): the section of the apex return map (Lesson 4).
%   Panel B: leg angle against leg length, as in the stride phase plots of
%   Blum et al. (2011). Flight runs at rest length while the leg retracts;
%   stance dips as the leg compresses and sweeps; the leg reset at apex is a
%   jump, drawn as a dotted line. Phases are coded by color and line width.
%   The overlay starts at a different apex height with the same energy; its
%   apex points are numbered, so the cobweb of the return map can be read on
%   panel A.
%
%   P : struct with the traces (t, y, vy, alpha, L, phase) of both runs

if nargin < 3, opts = struct(); end
def = struct('nStrides', 1, 'perturbation', 0, 'perturbStrides', 6, ...
    'animate', false, 'animateRun', "gait", 'frameStep', 0.005, 'videoFile', "");
for fn = fieldnames(def)'
    if ~isfield(opts, fn{1}), opts.(fn{1}) = def.(fn{1}); end
end

%% 1. Simulate the gait and the perturbed start
model = slip_model(p);
P.gait = runTrace(model, p, apex.y, apex.vx, opts.nStrides);
hasPert = isfinite(opts.perturbation) && opts.perturbation ~= 0;
if hasPert
    E = p.m * p.g * apex.y + 0.5 * p.m * apex.vx^2;
    y1 = apex.y + opts.perturbation;
    P.perturbed = runTrace(model, p, y1, sqrt(2 * (E / p.m - p.g * y1)), opts.perturbStrides);
end

%% 2. Draw the two portraits and the stick figure
S = daleyStyle('teaching');
f = S.figure('double', 1);
set(f, 'Position', [1 1 11 8], 'PaperSize', [11 8], 'PaperPosition', [0 0 11 8]);
tl = tiledlayout(f, 3, 2, 'TileSpacing', 'compact', 'Padding', 'compact');
cols = [S.col.navy; S.col.magenta; S.col.teal];     % descending flight, stance, ascending flight
widths = [1.25 2.0 0.8];
names = ["descending flight", "stance", "ascending flight"];

axA = nexttile(tl, 1, [2 1]); hold(axA, 'on');
xline(axA, 0, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);    % apex section
axB = nexttile(tl, 2, [2 1]); hold(axB, 'on');
axS = nexttile(tl, 5, [1 2]); hold(axS, 'on');

if hasPert
    R = P.perturbed;
    phaseLines(axA, R.vy, R.y, R.phase, cols, 0.5 * ones(1, 3));
    phaseLines(axB, R.alpha, R.L, R.phase, cols, 0.5 * ones(1, 3));
    numberApices(axA, R.apexY, S);
end
G = P.gait;
h = phaseLines(axA, G.vy, G.y, G.phase, cols, widths);
phaseLines(axB, G.alpha, G.L, G.phase, cols, widths);
for j = 1:size(G.resets, 1)                           % leg reset at apex
    plot(axB, G.resets(j, 1:2), [p.L0 p.L0], ':', 'Color', S.col.grey, 'LineWidth', 0.8);
end
b = S.points(2);
plot(axA, zeros(size(G.apexY)), G.apexY, b{:}, 'HandleVisibility', 'off');

lg = legend(axA, h, names, 'Box', 'off', 'Orientation', 'horizontal', 'FontSize', 10);
lg.Layout.Tile = 'south';
xlabel(axA, 'Vertical velocity (m/s)'); ylabel(axA, 'Body height (m)');
title(axA, 'A. Body height and vertical velocity');
xlabel(axB, 'Leg angle from ground (deg)'); ylabel(axB, 'Leg length (m)');
title(axB, 'B. Leg angle and leg length');
S.apply(axA); S.apply(axB);

% Stick figure of the run that the dot follows
R = G;
if hasPert && opts.animateRun == "perturbed", R = P.perturbed; end
xr = [min(R.x) - 0.6 * p.L0, max(R.x) + 0.8 * p.L0];
plot(axS, xr, [0 0], 'Color', S.col.grey, 'LineWidth', 0.8);
a = S.series(4); plot(axS, R.x, R.y, a{:}, 'HandleVisibility', 'off');
daspect(axS, [1 1 1]); xlim(axS, xr); ylim(axS, [-0.05, 1.25 * p.L0]);
xlabel(axS, 'Forward position (m)'); ylabel(axS, 'Height (m)');
title(axS, 'Runner');
S.apply(axS);

%% 3. Moving dots, synchronized across the three panels
dotA = plot(axA, R.vy(1), R.y(1), 'o', 'MarkerSize', 9, 'MarkerFaceColor', S.col.orange, 'MarkerEdgeColor', S.ink);
dotB = plot(axB, R.alpha(1), R.L(1), 'o', 'MarkerSize', 9, 'MarkerFaceColor', S.col.orange, 'MarkerEdgeColor', S.ink);
leg = plot(axS, [R.x(1) R.xf(1)], [R.y(1) R.yf(1)], 'Color', S.col.navy, 'LineWidth', 2);
body = plot(axS, R.x(1), R.y(1), 'o', 'MarkerSize', 12, 'MarkerFaceColor', S.col.magenta, 'MarkerEdgeColor', 'none');
set([dotA dotB], 'HandleVisibility', 'off');
P.dots = [dotA dotB];

if opts.animate
    writer = [];
    if strlength(opts.videoFile) > 0
        writer = VideoWriter(opts.videoFile, 'MPEG-4');
        writer.FrameRate = 30;
        open(writer);
    end
    [tu, iu] = unique(R.t, 'last');
    for tf = R.t(1):opts.frameStep:R.t(end)
        i = iu(find(tu <= tf, 1, 'last'));
        set(dotA, 'XData', R.vy(i), 'YData', R.y(i));
        set(dotB, 'XData', R.alpha(i), 'YData', R.L(i));
        set(leg, 'XData', [R.x(i) R.xf(i)], 'YData', [R.y(i) R.yf(i)]);
        set(body, 'XData', R.x(i), 'YData', R.y(i));
        title(axS, sprintf('Runner, t = %.3f s, %s', tf, names(R.phase(i))));
        drawnow;
        if ~isempty(writer), writeVideo(writer, getframe(f)); end
    end
    if ~isempty(writer), close(writer); end
end
end

%% ===== Local functions =====
function T = runTrace(model, p, y, vx, nStrides)
% Simulate from apex and return the traces the portraits need.
o = hde.solverDefaults(struct('outputStep', 5e-4, 'maxCycles', nStrides));
r = hde.simulate(model, slip_apexState(p, y, vx), o);
x = r.x;
T.t = r.t;
T.x = x(1, :); T.y = x(2, :); T.vy = x(4, :);
T.xf = x(5, :); T.yf = x(6, :);
T.alpha = rad2deg(atan2(x(2, :) - x(6, :), x(5, :) - x(1, :)));
T.L = hypot(x(1, :) - x(5, :), x(2, :) - x(6, :));
% Phase index 1 to 3: descending flight, stance, ascending flight
names = r.phaseNames(r.phase);
T.phase = 1 * (names == "flightDown") + 2 * (names == "stance") + 3 * (names == "flightUp");
T.phase(T.phase == 0) = 1;
T.phase = T.phase(:)';
ev = r.events;
iA = find(ev.guard == "apex");
T.apexY = [y; ev.xAfter(iA, 2)];
T.resets = [legAngle(ev.xBefore(iA, :)), legAngle(ev.xAfter(iA, :))];
T.exitReason = r.exitReason;
end

function a = legAngle(x)
a = rad2deg(atan2(x(:, 2) - x(:, 6), x(:, 5) - x(:, 1)));
end

function h = phaseLines(ax, X, Y, ph, cols, widths)
% One line per phase; gaps (NaN) where the run is in another phase.
h = gobjects(1, 3);
for k = 1:3
    Xk = X; Yk = Y;
    Xk(ph ~= k) = NaN; Yk(ph ~= k) = NaN;
    h(k) = plot(ax, Xk, Yk, '-', 'Color', cols(k, :), 'LineWidth', widths(k));
end
end

function numberApices(ax, apexY, S)
% Numbered apex points of the overlay run on the apex section (vy = 0).
b = S.points(3);
plot(ax, zeros(size(apexY)), apexY, b{:}, 'HandleVisibility', 'off');
for i = 1:numel(apexY)
    text(ax, 0.03, apexY(i), sprintf('%d', i - 1), 'FontSize', 9, 'Color', S.ink, ...
        'VerticalAlignment', 'middle', 'BackgroundColor', 'w', 'Margin', 0.5);
end
end
