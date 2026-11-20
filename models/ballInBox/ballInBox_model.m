function model = ballInBox_model(p)
%BALLINBOX_MODEL  A ball bouncing inside a box, as a hybrid model.
%
%   model = ballInBox_model(p)
%
%   Phases
%     flight   ballistic motion under gravity; four guards, one per wall
%     rolling  the ball rests on the floor and slides; two guards (side walls)
%   At each impact the velocity component normal to the wall reverses and
%   shrinks by the coefficient of restitution p.restitution; the tangential
%   component is unchanged. A restitution of 1 conserves energy.
%
%   With restitution below 1, floor bounces shorten geometrically and their
%   durations sum to a finite time, so the ball would bounce infinitely
%   often in finite time (Zeno behavior). The model resolves this in the
%   usual way: when the rebound speed after a floor impact falls below
%   p.restSpeed, the ball comes to rest on the floor and the model switches
%   to the rolling phase. The floor transition therefore chooses its
%   destination from the state after the impact.
%
%   States: x, y (center position, m), vx, vy (velocity, m/s)
%   Parameters (ballInBox_defaults): g, radius, restitution, restSpeed,
%   xMin, xMax, yMin, yMax
%
%   See also ballInBox_defaults

%% ===== Parameters =====
g = p.g;
r = p.radius;
e = p.restitution;
vRest = p.restSpeed;
yFloor = p.yMin + r;

wallGuards = @(s) [s(1) - r - p.xMin; p.xMax - s(1) - r];

%% ===== Phases =====
flight = hde.phase("flight", @(t, s) [s(3); s(4); 0; -g], ...
    guards = ["leftWall", "rightWall", "floor", "ceiling"], ...
    guardFcn = @(t, s) [wallGuards(s); s(2) - yFloor; p.yMax - s(2) - r], ...
    description = "Ballistic flight under gravity.");

rolling = hde.phase("rolling", @(t, s) [s(3); 0; 0; 0], ...
    guards = ["leftWall", "rightWall"], ...
    guardFcn = @(t, s) wallGuards(s), ...
    description = "Ball at rest on the floor, sliding sideways.");

%% ===== Transitions: impact laws =====
bounceX = @(x) [x(1); x(2); -e * x(3); x(4)];
bounceY = @(x) [x(1); x(2); x(3); -e * x(4)];
floorImpact = @(x) settle(bounceY(x), vRest, yFloor);
afterFloor = @(x) phaseAfterFloor(x);

transitions = [
    hde.transition("flight",  "leftWall",  "flight",   bounceX, description = "Impact with the left wall.")
    hde.transition("flight",  "rightWall", "flight",   bounceX, description = "Impact with the right wall.")
    hde.transition("flight",  "floor",     afterFloor, floorImpact, ...
        description = "Impact with the floor; the ball rests if it rebounds slower than restSpeed.")
    hde.transition("flight",  "ceiling",   "flight",   bounceY, description = "Impact with the ceiling.")
    hde.transition("rolling", "leftWall",  "rolling",  bounceX, description = "Impact with the left wall while rolling.")
    hde.transition("rolling", "rightWall", "rolling",  bounceX, description = "Impact with the right wall while rolling.")];

%% ===== Assemble =====
model.name        = "Ball in a box";
model.stateNames  = ["x" "y" "vx" "vy"];
model.phases      = [flight, rolling];
model.transitions = transitions;
model.startPhase  = "flight";
model.cyclePhase  = "";
model.params      = p;
end

%% ===== Local functions =====
function x = settle(x, vRest, yFloor)
% After a floor impact: a slow rebound becomes rest on the floor.
if abs(x(4)) < vRest
    x(4) = 0;
    x(2) = yFloor;
end
end

function name = phaseAfterFloor(x)
% Rolling once the vertical speed has been set to zero by settle.
if x(4) == 0
    name = "rolling";
else
    name = "flight";
end
end
