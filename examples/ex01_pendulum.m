%% EX01_PENDULUM  A free pendulum, then a pendulum and a wall: one phase, then one transition
% Purpose : introduce the toolkit with the simplest model. Without a wall
%           the pendulum is an ordinary differential equation (one phase,
%           no guards). A wall adds one guard (contact) and one reset
%           (impact), which makes it a hybrid system.
% Model   : models/pendulum
% Outputs : figures on screen; set saveFigures = true to save them
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: model parameters =====
[p, x0] = pendulum_defaults();
p.length  = 1.0;          % pendulum length (m)
p.damping = 0.1;          % viscous damping (1/s)

%% ===== USER SETTINGS: initial conditions =====
x0 = [deg2rad(60); 0];    % angle from hanging (rad), angular velocity (rad/s)

%% ===== USER SETTINGS: contact conditions (second run only) =====
wallAngleDeg = -20;       % wall position (deg); the bob strikes it while swinging back
restitution  = 0.7;       % fraction of angular speed kept at each impact

%% ===== USER SETTINGS: solver and output =====
opts = hde.solverDefaults(struct('timeLimit', 10, 'outputStep', 0.005));
saveFigures = false;

%% 1. Simulate with no wall (one phase, no transitions)
pFree = p;
pFree.wallAngleDeg = NaN;
free = hde.simulate(pendulum_model(pFree), x0, opts);

%% 2. Simulate with a wall (one guard, one reset)
pWall = p;
pWall.wallAngleDeg = wallAngleDeg;
pWall.restitution = restitution;
wall = hde.simulate(pendulum_model(pWall), x0, opts);
fprintf('Without wall: %s after %.1f s.\n', free.exitReason, free.tEnd);
fprintf('With wall: %d impacts in %.1f s.\n', height(wall.events), wall.tEnd);
disp(wall.events(1:min(5, height(wall.events)), {'time', 'from', 'guard', 'to'}));

%% 3. Plot angle against time and the phase portrait
S = daleyStyle('teaching');
f = S.figure('double', 1, 0.40);
tl = tiledlayout(f, 1, 2, 'TileSpacing', 'compact', 'Padding', 'compact');
ax = nexttile(tl); hold(ax, 'on');
a = S.series(1); h1 = plot(ax, free.t, rad2deg(free.x(1, :)), a{:});
b = S.series(2); h2 = plot(ax, wall.t, rad2deg(wall.x(1, :)), b{:});
yline(ax, wallAngleDeg, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);
legend([h1 h2], ["no wall", "wall"], 'Box', 'off');
xlabel(ax, 'Time (s)'); ylabel(ax, 'Angle (deg)');
S.apply(ax);
ax = nexttile(tl); hold(ax, 'on');
plot(ax, rad2deg(free.x(1, :)), free.x(2, :), a{:});
plot(ax, rad2deg(wall.x(1, :)), wall.x(2, :), b{:});
xlabel(ax, 'Angle (deg)'); ylabel(ax, 'Angular velocity (rad/s)');
S.apply(ax);

if saveFigures
    S.save(f, 'ex01_pendulum', hde.resultsFolder(mfilename('fullpath')));
end
