function [q, info] = slip_retractionForClearance(p, apex, clearance)
%SLIP_RETRACTIONFORCLEARANCE  Swing-leg retraction that gives a foot clearance at apex.
%
%   [q, info] = slip_retractionForClearance(p, apex, clearance)
%
%   p         : parameters of a periodic gait (any retraction rate)
%   apex      : apex state of that gait, struct with y (m) and vx (m/s)
%   clearance : foot height above the ground at apex (m)
%
%   At apex the leg is set to a shallower angle, which lifts the foot to the
%   chosen clearance, and the leg then rotates rearward at a constant rate
%   so that it reaches the original touchdown angle at the original
%   touchdown time. The body follows the same ballistic path, so the
%   periodic gait (apex state, touchdown angle, stance, speed and step
%   frequency) is unchanged. Only the response to perturbations changes:
%   a longer fall now ends with a steeper leg.
%
%   q    : parameters with legAngleDeg (apex angle) and retractionDegPerS set
%   info : touchdownAngleDeg, fallTime (s), apexClearance (m) of the input
%          gait, and the new clearance
%
%   See also slip_model, slip_stability, slip_stiffnessFamily

% One stride of the input gait gives the touchdown angle and fall time.
r = hde.simulate(slip_model(p), slip_apexState(p, apex.y, apex.vx), ...
    hde.solverDefaults(struct('outputStep', 0, 'maxCycles', 1, 'check', false)));
iTD = find(r.events.guard == "touchdown", 1);
if r.exitReason ~= "cycleLimit" || isempty(iTD)
    error('slip_retractionForClearance:stride', ...
        'The input gait does not complete a stride (%s).', r.exitReason);
end
xTD = r.events.xBefore(iTD, :);
tdAngle = atan2(xTD(2) - xTD(6), xTD(5) - xTD(1));     % rad, from the ground in front
fallTime = r.events.time(iTD);

if clearance >= apex.y
    error('slip_retractionForClearance:clearance', ...
        'The clearance (%.3f m) must be below the apex height (%.3f m).', clearance, apex.y);
end
apexAngle = asin((apex.y - clearance) / p.L0);
if apexAngle > tdAngle
    error('slip_retractionForClearance:protraction', ...
        ['A clearance of %.3f m needs a leg angle at apex steeper than the touchdown ' ...
         'angle (forward leg rotation). Use a clearance below %.3f m.'], ...
        clearance, apex.y - p.L0 * sin(tdAngle));
end

q = p;
q.legAngleDeg = rad2deg(apexAngle);
q.retractionDegPerS = rad2deg(tdAngle - apexAngle) / fallTime;

info.touchdownAngleDeg = rad2deg(tdAngle);
info.fallTime = fallTime;
info.apexClearanceBefore = apex.y - p.L0 * sind(p.legAngleDeg);
info.apexClearance = clearance;
end
