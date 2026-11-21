function model = slip_model(p)
%SLIP_MODEL  Spring-loaded inverted pendulum (SLIP) runner as a hybrid model.
%
%   model = slip_model(p)
%
%   A point mass m bounces on a massless spring leg of rest length L0 and
%   stiffness k. The leg angle is measured from the ground, in front of the
%   body (90 deg = vertical). At each apex the leg is set to
%   p.legAngleDeg; during the descending flight phase it can rotate
%   rearward (swing-leg retraction) at p.retractionDegPerS. With zero
%   retraction, p.legAngleDeg is the angle of attack at touchdown.
%
%   Global states (one column):  x, y, vx, vy, xFoot, yFoot
%     x, y      body (center of mass) position (m); ground at y = 0
%     vx, vy    body velocity (m/s)
%     xFoot, yFoot  foot position (m); in flight the foot moves with the leg
%
%   Phases and transitions
%     flightDown --footBelowGround--> END    flight starts with the foot
%                                            already below the ground (the
%                                            apex is lower than the
%                                            touchdown height): a stumble
%     flightDown --touchdown--> stance       foot reaches the ground and the
%                                            body moves toward the foot
%                          --> noContact     foot reaches the ground while the
%                                            body moves away from it: the leg
%                                            cannot be loaded (missed stance)
%     noContact  --missedStance--> END
%     flightDown --fall-------> END          body reaches the ground
%     stance     --takeoff----> flightUp     leg returns to rest length
%     stance     --reversal---> END          forward speed reaches zero
%     stance     --fall-------> END          body reaches the ground
%     flightUp   --apex-------> flightDown   vertical speed reaches zero;
%                                            reset: leg set to p.legAngleDeg
%   A stride (one cycle) runs from apex to apex. If takeoff happens with the
%   body already moving down, the apex guard fires on entry to flightUp and
%   the leg is reset at takeoff.
%
%   See also slip_defaults, slip_apexState, slip_returnMap

%% ===== Parameters used by the equations =====
m      = p.m;                         % body mass (kg)
k      = p.k;                         % leg stiffness (N/m)
L0     = p.L0;                        % leg rest length (m)
g      = p.g;                         % gravitational acceleration (m/s^2)
alpha0 = deg2rad(p.legAngleDeg);      % leg angle set at apex (rad)
omega  = deg2rad(p.retractionDegPerS);% leg rotation rate in descending flight (rad/s)

% A retracting leg can carry the foot below ground and back up within one
% solver step, so the solver step is limited in descending flight.
if omega ~= 0
    flightMaxStep = 5e-4;
else
    flightMaxStep = Inf;
end

%% ===== Phases: equations of motion, guards and coordinate changes =====
% footBelowGround uses the foot height offset by 1 micrometer. In a normal
% descent the touchdown guard crosses zero first; footBelowGround fires only
% on entry to the phase, when the foot is placed below the ground.
footTol = 1e-6;
flightDown = hde.phase("flightDown", @(t, s) flightFlow(s, g, omega), ...
    guards = ["footBelowGround", "touchdown", "fall"], ...
    guardFcn = @(t, s) [s(2) - L0 * sin(s(5)) + footTol; s(2) - L0 * sin(s(5)); s(2)], ...
    toLocal = @(x) globalToFlight(x), ...
    toGlobal = @(s, data) flightToGlobal(s, L0), ...
    maxStep = flightMaxStep, ...
    description = "Ballistic descent from apex; the leg rotates at the retraction rate.");

% The leg cannot be loaded when the body moves away from the foot at
% touchdown (angle between leg and body velocity above 90 deg); this phase
% ends the run at once (its guard is already past zero on entry).
noContact = hde.phase("noContact", @(t, s) zeros(size(s)), ...
    guards = "missedStance", ...
    guardFcn = @(t, s) -1, ...
    description = "Touchdown with the body moving away from the foot: the leg misses stance.");

stance = hde.phase("stance", @(t, s) stanceFlow(s, m, k, L0, g), ...
    guards = ["takeoff", "reversal", "fall"], ...
    guardFcn = @(t, s) [L0 - hypot(s(1), s(2)); s(3); s(2)], ...
    toLocal = @(x) globalToStance(x), ...
    toGlobal = @(s, foot) stanceToGlobal(s, foot), ...
    description = "Foot pinned to the ground; the spring leg pushes along its axis.");

flightUp = hde.phase("flightUp", @(t, s) flightFlow(s, g, 0), ...
    guards = "apex", ...
    guardFcn = @(t, s) s(4), ...
    toLocal = @(x) globalToFlight(x), ...
    toGlobal = @(s, data) flightToGlobal(s, L0), ...
    description = "Ballistic ascent after takeoff; the leg keeps its takeoff angle.");

%% ===== Transitions: guard outcomes and resets =====
transitions = [
    hde.transition("flightDown", "footBelowGround", "END", ...
        description = "The apex is too low for the leg angle; the foot would start below ground.")
    hde.transition("flightDown", "touchdown", @(x) touchdownPhase(x), ...
        description = "Foot contacts the ground; stance if the leg can be loaded.")
    hde.transition("noContact", "missedStance", "END", ...
        description = "The leg missed stance.")
    hde.transition("flightDown", "fall", "END", ...
        description = "Body reaches the ground before the foot does.")
    hde.transition("stance", "takeoff", "flightUp", ...
        description = "Leg returns to rest length; the foot leaves the ground.")
    hde.transition("stance", "reversal", "END", ...
        description = "Forward speed reaches zero; the runner falls backward.")
    hde.transition("stance", "fall", "END", ...
        description = "Body reaches the ground.")
    hde.transition("flightUp", "apex", "flightDown", @(x) apexReset(x, L0, alpha0), ...
        description = "Highest point of flight; the leg is set to the apex angle.")];

%% ===== Assemble =====
model.name        = "SLIP runner";
model.stateNames  = ["x" "y" "vx" "vy" "xFoot" "yFoot"];
model.phases      = [flightDown, stance, flightUp, noContact];
model.transitions = transitions;
model.startPhase  = "flightDown";
model.cyclePhase  = "flightDown";
model.params      = p;
end

%% ===== Equations of motion =====
function ds = flightFlow(s, g, omega)
% Flight: s = [x; y; vx; vy; legAngle]. Gravity only; the leg rotates.
ds = [s(3); s(4); 0; -g; omega];
end

function ds = stanceFlow(s, m, k, L0, g)
% Stance: s = [x; y; vx; vy] relative to the foot. The spring pushes along
% the leg; it cannot pull, so the force is zero beyond rest length.
L = hypot(s(1), s(2));
F = k * max(L0 - L, 0);
ds = [s(3); s(4); F / m * s(1) / L; F / m * s(2) / L - g];
end

%% ===== Coordinate changes =====
function [s, data] = globalToFlight(x)
% Leg angle from the body-to-foot vector, measured from the ground in front.
s = [x(1:4); atan2(x(2) - x(6), x(5) - x(1))];
data = [];
end

function x = flightToGlobal(s, L0)
% Foot hangs at rest length from the body (one state per column).
x = [s(1:4, :); s(1, :) + L0 * cos(s(5, :)); s(2, :) - L0 * sin(s(5, :))];
end

function [s, foot] = globalToStance(x)
% Body position relative to the foot, which stays fixed in stance.
foot = x(5:6);
s = [x(1:2) - foot; x(3:4)];
end

function x = stanceToGlobal(s, foot)
n = size(s, 2);
x = [s(1:2, :) + foot; s(3:4, :); repmat(foot, 1, n)];
end

%% ===== Touchdown routing =====
function name = touchdownPhase(x)
% Stance if the body moves toward the foot (leg shortening), else no contact.
if dot(x(1:2) - x(5:6), x(3:4)) < 0
    name = "stance";
else
    name = "noContact";
end
end

%% ===== Reset map =====
function x = apexReset(x, L0, alpha0)
% Place the foot at rest length along the apex leg angle.
x(5) = x(1) + L0 * cos(alpha0);
x(6) = x(2) - L0 * sin(alpha0);
end
