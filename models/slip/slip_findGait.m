function [gait, info] = slip_findGait(p, target, guess)
%SLIP_FINDGAIT  Find a periodic SLIP gait with a chosen average speed.
%
%   [gait, info] = slip_findGait(p, target, guess)
%
%   p      : parameters (slip_defaults); p.k, p.m, p.L0, p.g and
%            p.retractionDegPerS stay fixed
%   target : struct with
%            .meanSpeed   average forward speed over the stride (m/s)
%            .hold        which extra quantity is held fixed:
%                         "apexHeight" (default), "stepFrequency" or "legAngle"
%            .apexHeight  apex height (m), when hold = "apexHeight"
%            .stepFrequency  steps per second, when hold = "stepFrequency"
%   guess  : struct with .y (m), .vx (m/s), .legAngleDeg (deg)
%
%   The unknowns are the apex state (y, vx) and the apex leg angle. A gait
%   is periodic when the apex height returns to its starting value; in this
%   energy-conserving model the forward speed at apex then returns as well.
%   One unknown is fixed by target.hold, so the remaining unknowns are
%   determined by periodicity and the average speed.
%
%   gait : struct with p (parameters at the solution, legAngleDeg updated),
%          y, vx (apex state), meanSpeed, period, stepLength
%   info : solver report from hde.newtonSolve plus the target

if ~isfield(target, 'hold') || strlength(target.hold) == 0
    target.hold = "apexHeight";
end
target.hold = string(target.hold);
v = target.meanSpeed;

switch target.hold
    case "apexHeight"
        y0 = target.apexHeight;
        unpack = @(z) deal(y0, z(1), z(2));
        z0 = [guess.vx; guess.legAngleDeg];
    case "stepFrequency"
        unpack = @(z) deal(z(1), z(2), z(3));
        z0 = [guess.y; guess.vx; guess.legAngleDeg];
    case "legAngle"
        a0 = p.legAngleDeg;
        unpack = @(z) deal(z(1), z(2), a0);
        z0 = [guess.y; guess.vx];
    otherwise
        error('slip_findGait:hold', 'Unknown target.hold "%s".', target.hold);
end

F = @(z) residual(z, p, v, target, unpack);
[z, info] = hde.newtonSolve(F, z0, struct('tol', 1e-11, 'acceptTol', 1e-8, 'fdStep', 1e-6));
info.target = target;

[y, vx, a] = unpack(z);
gait.p = p;
gait.p.legAngleDeg = a;
gait.y = y;
gait.vx = vx;
[~, mapInfo] = slip_returnMap(gait.p, [y; vx]);
gait.meanSpeed = mapInfo.meanSpeed;
gait.period = mapInfo.period;
gait.stepLength = mapInfo.stepLength;
gait.exitReason = mapInfo.exitReason;
end

function r = residual(z, p, v, target, unpack)
[y, vx, a] = unpack(z);
p.legAngleDeg = a;
[sNext, info] = slip_returnMap(p, [y; vx]);
r = [sNext(1) - y; info.meanSpeed - v];
if target.hold == "stepFrequency"
    r(3) = 1 / info.period - target.stepFrequency;
end
end
