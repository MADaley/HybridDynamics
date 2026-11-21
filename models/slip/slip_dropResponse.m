function R = slip_dropResponse(p, apex, dropHeight)
%SLIP_DROPRESPONSE  First stance after an unexpected drop: contact and peak force.
%
%   R = slip_dropResponse(p, apex, dropHeight)
%
%   p, apex    : a periodic gait (parameters and apex state, struct y, vx)
%   dropHeight : drop in ground height during the flight after apex (m)
%
%   R.outcome            exit reason of the stride after the drop
%                        ("cycleLimit" when the stride completes)
%   R.contact            true when the leg touches down and is loaded
%   R.firstContact       true when that loaded touchdown is at or in front
%                        of vertical (touchdown angle <= 90 deg): the
%                        first-contact criterion of slip_normalizedMaxDrop
%   R.touchdownAngleDeg  leg angle at that touchdown (deg)
%   R.peakLegForceBW     peak leg force in that stance (body weights);
%                        NaN without a loaded contact
%   R.peakLegForceBWsteady  the same in the periodic gait, for comparison
%
%   Daley and Usherwood (2010) note a trade-off in retraction control: slow
%   retraction raises the largest drop with a stance contact, and fast
%   retraction lowers the peak leg force after a drop.
%
%   See also slip_normalizedMaxDrop, slip_stability

R.peakLegForceBWsteady = peakForce(p, apex.y, apex.vx);
[R.peakLegForceBW, R.contact, R.touchdownAngleDeg, R.outcome] = ...
    peakForce(p, apex.y + dropHeight, apex.vx);
R.firstContact = R.contact && R.touchdownAngleDeg <= 90;
end

function [Fbw, contact, tdAngle, outcome] = peakForce(p, y, vx)
o = hde.solverDefaults(struct('outputStep', 1e-4, 'maxCycles', 1, 'check', false));
r = hde.simulate(slip_model(p), slip_apexState(p, y, vx), o);
outcome = r.exitReason;
ev = r.events;
iTD = find(ev.guard == "touchdown", 1);
contact = ~isempty(iTD) && ev.to(iTD) == "stance";
tdAngle = NaN;
Fbw = NaN;
if ~isempty(iTD)
    x = ev.xBefore(iTD, :);
    tdAngle = rad2deg(atan2(x(2) - x(6), x(5) - x(1)));
end
if contact
    inStance = r.phase == find(r.phaseNames == "stance");
    L = hypot(r.x(1, inStance) - r.x(5, inStance), r.x(2, inStance) - r.x(6, inStance));
    Fbw = max(p.k * max(p.L0 - L, 0)) / (p.m * p.g);
end
end
