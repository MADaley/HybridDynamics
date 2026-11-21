function [q, td] = slip_setRetraction(p, apex, omegaDegPerS)
%SLIP_SETRETRACTION  Give a periodic gait a retraction rate, keeping the gait.
%
%   [q, td] = slip_setRetraction(p, apex, omegaDegPerS)
%
%   p, apex      : a periodic gait (parameters and apex state, struct y, vx)
%   omegaDegPerS : retraction rate (deg/s, >= 0)
%
%   The leg angle at apex is set to touchdownAngle - omega * fallTime, so the
%   leg reaches the same touchdown angle at the same touchdown time. The body
%   follows the same ballistic path, so the periodic gait is unchanged; only
%   the response to perturbations changes.
%
%   q  : parameters with legAngleDeg (at apex) and retractionDegPerS set
%   td : touchdownAngleDeg and fallTime (s) of the gait
%
%   See also slip_retractionRule, slip_retractionForClearance

if omegaDegPerS < 0
    error('slip_setRetraction:negative', ...
        'The retraction rate must be zero or positive (forward rotation is not modeled here).');
end
r = hde.simulate(slip_model(p), slip_apexState(p, apex.y, apex.vx), ...
    hde.solverDefaults(struct('outputStep', 0, 'maxCycles', 1, 'check', false)));
iTD = find(r.events.guard == "touchdown", 1);
if r.exitReason ~= "cycleLimit" || isempty(iTD)
    error('slip_setRetraction:stride', 'The gait does not complete a stride (%s).', r.exitReason);
end
x = r.events.xBefore(iTD, :);
td.touchdownAngleDeg = rad2deg(atan2(x(2) - x(6), x(5) - x(1)));
td.fallTime = r.events.time(iTD);

q = p;
q.retractionDegPerS = omegaDegPerS;
q.legAngleDeg = td.touchdownAngleDeg - omegaDegPerS * td.fallTime;
if q.legAngleDeg <= 0
    error('slip_setRetraction:angle', ...
        'A rate of %.1f deg/s would need a leg angle at apex below the horizontal.', omegaDegPerS);
end
end
