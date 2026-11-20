function [f, cobweb] = plotReturnMap(p, apex, opts)
%PLOTRETURNMAP  Apex-height return map at constant energy, with a cobweb.
%
%   [f, cobweb] = plotReturnMap(p, apex)
%   [f, cobweb] = plotReturnMap(p, apex, opts)
%
%   p, apex : parameters and the apex state of a periodic gait
%   opts    : .halfRange  range of apex heights shown around the gait (0.03 m)
%             .start      starting offset from the periodic apex height (0.01 m)
%             .nStrides   strides in the cobweb (10)
%             .nPoints    points on the map curve (61)
%
%   The curve shows the next apex height y(n+1) for each apex height y(n)
%   with the mechanical energy held fixed. The periodic gait sits where the
%   curve crosses the dotted identity line; the slope there is lambda. The
%   cobweb follows the runner stride by stride from a perturbed start.

if nargin < 3, opts = struct(); end
def = struct('halfRange', 0.03, 'start', 0.01, 'nStrides', 10, 'nPoints', 61);
for fn = fieldnames(def)'
    if ~isfield(opts, fn{1}), opts.(fn{1}) = def.(fn{1}); end
end

model = slip_model(p);
E = p.m * p.g * apex.y + 0.5 * p.m * apex.vx^2;
next = @(y) mapAtEnergy(p, model, y, E);

yy = linspace(apex.y - opts.halfRange, apex.y + opts.halfRange, opts.nPoints);
yn = arrayfun(next, yy);

% Cobweb from a perturbed start
cobweb = zeros(opts.nStrides + 1, 1);
cobweb(1) = apex.y + opts.start;
for i = 1:opts.nStrides
    cobweb(i + 1) = next(cobweb(i));
    if isnan(cobweb(i + 1)), break, end
end

S = daleyStyle('teaching');
f = S.figure('single', 1, 1.0);
ax = axes(f); hold(ax, 'on');
lim = [yy(1), yy(end)];
plot(ax, lim, lim, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);   % identity
a = S.series(1);
plot(ax, yy, yn, a{:});
% Cobweb path: up from the axis to the curve at (y0, y1), across to the
% identity line at (y1, y1), then to the curve at (y1, y2), and so on.
cx = cobweb(1);
cy = lim(1);
for i = 2:numel(cobweb)
    if isnan(cobweb(i)), break, end
    cx = [cx, cobweb(i-1), cobweb(i)]; %#ok<AGROW>
    cy = [cy, cobweb(i),   cobweb(i)]; %#ok<AGROW>
end
b = S.series(2);
plot(ax, cx, cy, b{:});
c = S.points(2);
plot(ax, cobweb(1), lim(1), c{:});
xlim(ax, lim); ylim(ax, lim);
axis(ax, 'square');
xlabel(ax, 'Apex height, stride n (m)');
ylabel(ax, 'Apex height, stride n+1 (m)');
S.apply(ax);
end

function yNext = mapAtEnergy(p, model, y, E)
vx2 = 2 * (E / p.m - p.g * y);
if vx2 <= 0
    yNext = NaN;
    return
end
sNext = slip_returnMap(p, [y; sqrt(vx2)], model);
yNext = sNext(1);
end
