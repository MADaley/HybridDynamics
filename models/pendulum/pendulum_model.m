function model = pendulum_model(p)
%PENDULUM_MODEL  Damped pendulum, with an optional wall, as a hybrid model.
%
%   model = pendulum_model(p)
%
%   States: theta (angle from hanging straight down, rad, positive
%   counterclockwise) and thetaDot (rad/s).
%
%   Without a wall (p.wallAngleDeg = NaN) the model has one phase and no
%   transitions: an ordinary differential equation. With a wall at
%   p.wallAngleDeg, the bob swings in the region theta > wall angle and
%   strikes the wall when theta falls to the wall angle; the angular
%   velocity then reverses and shrinks by the coefficient of restitution
%   p.restitution. This adds one guard and one reset, the smallest hybrid
%   system. Start the pendulum above the wall angle.
%
%   Parameters (pendulum_defaults): g, length, damping, wallAngleDeg,
%   restitution
%
%   See also pendulum_defaults

%% ===== Parameters =====
g = p.g;
L = p.length;
c = p.damping;                      % viscous damping (1/s)
hasWall = ~isnan(p.wallAngleDeg);
thetaWall = deg2rad(p.wallAngleDeg);
e = p.restitution;

flow = @(t, s) [s(2); -(g / L) * sin(s(1)) - c * s(2)];

%% ===== Phase and transitions =====
if hasWall
    swing = hde.phase("swing", flow, ...
        guards = "wallContact", ...
        guardFcn = @(t, s) s(1) - thetaWall, ...
        description = "Swing under gravity until the bob reaches the wall.");
    transitions = hde.transition("swing", "wallContact", "swing", ...
        @(x) [x(1); -e * x(2)], ...
        description = "Impact with the wall; angular velocity reverses.");
else
    swing = hde.phase("swing", flow, ...
        description = "Swing under gravity with viscous damping.");
    transitions = struct('from', {}, 'guard', {}, 'to', {}, 'reset', {}, ...
        'description', {});
end

%% ===== Assemble =====
model.name        = "Pendulum";
model.stateNames  = ["theta" "thetaDot"];
model.phases      = swing;
model.transitions = transitions;
model.startPhase  = "swing";
model.cyclePhase  = "";
model.params      = p;
end
