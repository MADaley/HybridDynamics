%[text] # Lesson 1. Hybrid systems: flows, guards and resets
%[text] A hybrid dynamical system alternates between smooth motion and sudden events. Each phase has its own equations of motion (the flow). A guard is a function of the state that marks the end of a phase when it reaches zero. A reset maps the state across the event, for example an impact law. A transition table says which phase follows each guard.
%[text] This lesson uses two small models from the toolkit: a pendulum that strikes a wall and a ball in a box.
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
%[text] ## 1. A pendulum: one phase, then one guard and one reset
%[text] With no wall, the pendulum has one phase and no transitions. A wall at an angle below the starting angle adds a guard (the bob reaches the wall) and a reset (the angular velocity reverses and shrinks by the coefficient of restitution).
[p, x0] = pendulum_defaults();
p.wallAngleDeg = -20;     % wall position (deg)
p.restitution  = 0.7;     % fraction of angular speed kept at impact
r = hde.simulate(pendulum_model(p), x0, hde.solverDefaults(struct('timeLimit', 8)));
r.events(:, {'time', 'guard', 'to'})
%[text] Each row of the events table is one pass through the guard and the reset. Compare the angular velocity before and after each impact:
[r.events.xBefore(:, 2), r.events.xAfter(:, 2)]
%[text] ## 2. A ball in a box: four guards, two reset laws
%[text] The ball flies under gravity. Each wall is a guard. At impact, the velocity component normal to the wall reverses and shrinks by the restitution coefficient $e$; the tangential component is unchanged. The kinetic energy of the normal component therefore falls by the factor $e^2$ at each impact.
[pb, xb] = ballInBox_defaults();
pb.restitution = 0.8;     % try 1.0 (no energy loss) and 0.5
rb = hde.simulate(ballInBox_model(pb), xb, hde.solverDefaults(struct('timeLimit', 6, 'outputStep', 0.002)));
rb.events(:, {'time', 'guard'})
%[text] Plot the path and mark the impacts:
S = daleyStyle('teaching');
f = S.figure('single', 1, 1.0);
ax = axes(f); hold(ax, 'on');
a = S.series(1); plot(ax, rb.x(1, :), rb.x(2, :), a{:});
b = S.points(2); plot(ax, rb.events.xBefore(:, 1), rb.events.xBefore(:, 2), b{:});
axis(ax, 'equal'); xlim(ax, [pb.xMin pb.xMax]); ylim(ax, [pb.yMin pb.yMax]);
xlabel(ax, 'x (m)'); ylabel(ax, 'y (m)'); S.apply(ax);
%[text] ## 3. Many impacts in finite time
%[text] With $e < 1$, each floor bounce is shorter than the last, and the bounce durations form a geometric series with a finite sum. The ball would bounce infinitely often in finite time (Zeno behavior), and an ODE solver cannot resolve bounces that become arbitrarily short. The model adds a second phase: when the rebound speed falls below `restSpeed`, the floor transition sends the ball to the rolling phase, where it rests on the floor. The floor transition chooses its next phase from the state after the impact.
rz = hde.simulate(ballInBox_model(pb), [5; 2; 0; 0], hde.solverDefaults(struct('timeLimit', 10)));
nFloor = sum(rz.events.guard == "floor");
tRest = rz.events.time(find(rz.events.to == "rolling", 1));
fprintf('%d floor impacts; the ball comes to rest at t = %.3f s (series limit %.3f s)\n', ...
    nFloor, tRest, sqrt(2 * (2 - pb.radius) / pb.g) * (1 + 2 * pb.restitution / (1 - pb.restitution)));
%[text] ## Try this
%[text] Set `pb.restitution = 1` and check that the mechanical energy stays constant.
%[text] Move the wall of the pendulum and predict whether the bob still reaches it after the first impact.
%[text] Open `models/ballInBox/ballInBox_model.m` and find the guard functions and the reset laws.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
