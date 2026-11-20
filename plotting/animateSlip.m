function animateSlip(M, p, opts)
%ANIMATESLIP  Animate one or more SLIP strides; optionally save a video.
%
%   animateSlip(M, p)
%   animateSlip(M, p, opts)
%
%   M    : output of slip_metrics (uses M.trace), or any struct with fields
%          t, x, phase, phaseNames from hde.simulate
%   p    : parameters used
%   opts : .frameStep  time between frames (s), default 0.01
%          .videoFile  full path of an .mp4 to write (default: no file)
%          .speed      playback speed factor on screen (default 0.25)

if nargin < 3, opts = struct(); end
if ~isfield(opts, 'frameStep'), opts.frameStep = 0.01; end
if ~isfield(opts, 'videoFile'), opts.videoFile = ""; end
if ~isfield(opts, 'speed'), opts.speed = 0.25; end
if isfield(M, 'trace'), tr = M.trace; else, tr = M; end

S = daleyStyle('teaching');
f = S.figure('onehalf', 1, 0.45);
ax = axes(f); hold(ax, 'on');
xr = [min(tr.x(1, :)) - 0.6 * p.L0, max(tr.x(1, :)) + 0.6 * p.L0];
plot(ax, xr, [0 0], 'Color', S.col.grey, 'LineWidth', 0.8);            % ground
a = S.series(4);
trail = plot(ax, NaN, NaN, a{:});
leg = plot(ax, NaN, NaN, 'Color', S.col.navy, 'LineWidth', 2.0);
body = plot(ax, NaN, NaN, 'o', 'MarkerSize', 14, ...
    'MarkerFaceColor', S.col.magenta, 'MarkerEdgeColor', 'none');
axis(ax, 'equal');
xlim(ax, xr); ylim(ax, [-0.05, 1.3 * p.L0]);
xlabel(ax, 'Forward position (m)'); ylabel(ax, 'Height (m)');
S.apply(ax);

writer = [];
if strlength(opts.videoFile) > 0
    writer = VideoWriter(opts.videoFile, 'MPEG-4');
    writer.FrameRate = round(1 / opts.frameStep * opts.speed);
    open(writer);
end

frames = tr.t(1):opts.frameStep:tr.t(end);
[tu, iu] = unique(tr.t, 'last');
for tf = frames
    i = iu(find(tu <= tf, 1, 'last'));
    set(trail, 'XData', tr.x(1, 1:i), 'YData', tr.x(2, 1:i));
    set(leg, 'XData', [tr.x(1, i), tr.x(5, i)], 'YData', [tr.x(2, i), tr.x(6, i)]);
    set(body, 'XData', tr.x(1, i), 'YData', tr.x(2, i));
    title(ax, sprintf('t = %.3f s   phase: %s', tf, tr.phaseNames(tr.phase(i))));
    drawnow;
    if ~isempty(writer)
        writeVideo(writer, getframe(f));
    else
        pause(opts.frameStep / opts.speed);
    end
end
if ~isempty(writer)
    close(writer);
end
end
