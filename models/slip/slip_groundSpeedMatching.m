function G = slip_groundSpeedMatching(p, apex)
%SLIP_GROUNDSPEEDMATCHING  Foot speed relative to the ground at touchdown.
%
%   G = slip_groundSpeedMatching(p, apex)
%
%   p, apex : parameters and apex state (struct with y, vx)
%
%   Ground speed matching (GSM; Blum et al. 2010, 2011):
%       GSM = 1 - |v_foot| / |v_CoM|      at touchdown
%   GSM = 1 (100 %): the foot meets the ground at rest, a landing with no
%   impact. GSM = 0: the foot moves with the body. In this model the foot
%   moves with the body and rotates about it, so
%       v_foot = v_CoM + L0 * omega * [-sin(alpha); -cos(alpha)]
%   with alpha the leg angle from the ground and omega the retraction rate.
%   A leg of constant length cannot reach GSM = 1 while the body falls;
%   GSM is largest at
%       omega* = (vx sin(alpha) + vy cos(alpha)) / L0.
%
%   G.gsm               GSM at touchdown (fraction)
%   G.footSpeed         |v_foot| at touchdown (m/s)
%   G.touchdownAngleDeg leg angle at touchdown (deg)
%   G.omegaMaxGsmDegPerS  omega* (deg/s), the rate with the largest GSM
%   G.gsmMax            GSM at omega*
%
%   See also slip_retractionRule

r = hde.simulate(slip_model(p), slip_apexState(p, apex.y, apex.vx), ...
    hde.solverDefaults(struct('outputStep', 0, 'maxTransitions', 1, 'check', false)));
if isempty(r.events) || r.events.guard(1) ~= "touchdown"
    error('slip_groundSpeedMatching:touchdown', 'No touchdown in the first flight.');
end
x = r.events.xBefore(1, :);
a = atan2(x(2) - x(6), x(5) - x(1));
v = x(3:4)';
u = [-sin(a); -cos(a)];                 % direction of foot motion for rearward rotation
omega = deg2rad(p.retractionDegPerS);
vFoot = v + p.L0 * omega * u;

G.touchdownAngleDeg = rad2deg(a);
G.footSpeed = norm(vFoot);
G.gsm = 1 - norm(vFoot) / norm(v);
wStar = max(-(v' * u) / p.L0, 0);
G.omegaMaxGsmDegPerS = rad2deg(wStar);
G.gsmMax = 1 - norm(v + p.L0 * wStar * u) / norm(v);
end
