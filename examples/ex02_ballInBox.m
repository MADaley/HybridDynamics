%% EX02_BALLINBOX  A ball bouncing in a box: guards, resets and energy loss
% Purpose : show how guards (wall contacts) and resets (impact laws) shape
%           a trajectory, and how the coefficient of restitution sets the
%           energy lost at each impact.
% Model   : models/ballInBox
% Outputs : events table and figures on screen
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: model parameters =====
[p, x0] = ballInBox_defaults();
p.g = 9.81;                 % gravitational acceleration (m/s^2)

%% ===== USER SETTINGS: contact conditions =====
p.restitution = 0.8;        % fraction of normal speed kept at each impact

%% ===== USER SETTINGS: initial conditions =====
x0 = [5; 5; -6.5; 10];      % x (m), y (m), vx (m/s), vy (m/s)

%% ===== USER SETTINGS: solver and output =====
opts = hde.solverDefaults(struct('timeLimit', 6, 'outputStep', 0.002));
saveFigures = false;

%% 1. Simulate
r = hde.simulate(ballInBox_model(p), x0, opts);
fprintf('%d impacts in %.2f s (%s).\n', height(r.events), r.tEnd, r.exitReason);
disp(r.events(:, {'time', 'guard'}));

%% 2. Mechanical energy before and after each impact
E = @(x) 0.5 * (x(:, 3).^2 + x(:, 4).^2) + p.g * x(:, 2);   % per unit mass (J/kg)
r.events.energyBefore = E(r.events.xBefore);
r.events.energyAfter  = E(r.events.xAfter);
fprintf('Fraction of energy kept per impact: %.3f to %.3f (restitution^2 = %.3f for the normal component).\n', ...
    min(r.events.energyAfter ./ r.events.energyBefore), ...
    max(r.events.energyAfter ./ r.events.energyBefore), p.restitution^2);

%% 3. Plot the path and the energy
S = daleyStyle('teaching');
f = S.figure('double', 1, 0.42);
tl = tiledlayout(f, 1, 2, 'TileSpacing', 'compact', 'Padding', 'compact');
ax = nexttile(tl); hold(ax, 'on');
rectangle(ax, 'Position', [p.xMin p.yMin p.xMax - p.xMin p.yMax - p.yMin], ...
    'EdgeColor', S.col.grey, 'LineWidth', 0.8);
a = S.series(1);
plot(ax, r.x(1, :), r.x(2, :), a{:});
b = S.points(2);
plot(ax, r.events.xBefore(:, 1), r.events.xBefore(:, 2), b{:});
axis(ax, 'equal'); xlim(ax, [p.xMin p.xMax]); ylim(ax, [p.yMin p.yMax]);
xlabel(ax, 'x (m)'); ylabel(ax, 'y (m)');
S.apply(ax);
ax = nexttile(tl); hold(ax, 'on');
plot(ax, r.t, E(r.x'), a{:});
xlabel(ax, 'Time (s)'); ylabel(ax, 'Energy per unit mass (J/kg)');
S.apply(ax);

if saveFigures
    S.save(f, 'ex02_ballInBox', hde.resultsFolder(mfilename('fullpath')));
end
