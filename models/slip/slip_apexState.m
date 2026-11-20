function x0 = slip_apexState(p, y, vx)
%SLIP_APEXSTATE  Full SLIP state at the apex of flight.
%
%   x0 = slip_apexState(p, y, vx)
%
%   y  : apex height of the body (m)
%   vx : forward speed at apex (m/s)
%
%   The body starts at x = 0 with zero vertical speed. The foot sits at rest
%   length along the apex leg angle p.legAngleDeg, the same placement as the
%   apex reset in slip_model. Building the foot from the leg angle keeps the
%   coupled states consistent when y is perturbed.

alpha0 = deg2rad(p.legAngleDeg);
x0 = [0; y; vx; 0; p.L0 * cos(alpha0); y - p.L0 * sin(alpha0)];
end
