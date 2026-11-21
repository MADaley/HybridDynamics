function M = slip_metrics(p, s, outputStep)
%SLIP_METRICS  Timing, force and leg-work measures for one SLIP stride.
%
%   M = slip_metrics(p, s)
%   M = slip_metrics(p, s, outputStep)    % sampling interval, default 1e-4 s
%
%   p : parameters (slip_defaults)
%   s : apex state [y; vx] at the start of the stride
%
%   M (struct, SI units unless the name says otherwise)
%   Timing   period, contactTime, flightTime, stepFrequency, stepLength,
%            meanSpeed, dutyFactor (contact time / two step periods, for a
%            biped that alternates legs)
%   Geometry touchdownAngleDeg, takeoffAngleDeg, sweepAngleDeg (leg angles
%            from the ground, in front of the body), legCompression,
%            legCompressionPct, comDropStance (fall of the body from
%            touchdown to its lowest point)
%   Forces   peakLegForceBW, peakVerticalForceBW, peakBrakingForceBW,
%            peakPropulsiveForceBW (body weights), verticalStiffness
%   Leg work and cost proxies
%            peakElasticEnergy (J): energy stored in the leg spring at
%              maximum compression. In this model the leg does this much
%              negative work in early stance and the same positive work in
%              late stance.
%            positiveWorkPerDistance (J kg^-1 m^-1): positive leg work per
%              step divided by body mass and step length; the mechanical
%              work by the legs per distance if the spring returned none.
%            forceTimeCostIndex (1/s): inverse contact time, proportional
%              to the metabolic cost of supporting body weight in the
%              force-time hypothesis of Kram and Taylor (1990).
%   Landing  groundSpeedMatching: GSM = 1 - |v_foot| / |v_CoM| at touchdown
%            (Blum et al. 2010); 1 means the foot meets the ground at rest
%   Dimensionless  froude (v^2 / g L0), relativeStiffness (k L0 / m g)
%   Check    energyChange (J): mechanical energy at the end minus the start
%   Traces   trace.t, trace.x, trace.phase, trace.Fx, trace.Fy (N),
%            trace.legLength, trace.energy (struct of components, J)

if nargin < 3, outputStep = 1e-4; end

model = slip_model(p);
x0 = slip_apexState(p, s(1), s(2));
opts = hde.solverDefaults(struct('outputStep', outputStep, 'maxCycles', 1));
r = hde.simulate(model, x0, opts);
M.exitReason = r.exitReason;
if r.exitReason ~= "cycleLimit"
    warning('slip_metrics:failed', 'The stride did not complete (%s).', r.exitReason);
end

W = p.m * p.g;                         % body weight (N)
ev = r.events;
iTD = find(ev.guard == "touchdown", 1);
iTO = find(ev.guard == "takeoff", 1);

%% ----- Timing -----
M.period        = r.tEnd;
M.contactTime   = ev.time(iTO) - ev.time(iTD);
M.flightTime    = M.period - M.contactTime;
M.stepFrequency = 1 / M.period;
M.stepLength    = r.xEnd(1) - x0(1);
M.meanSpeed     = M.stepLength / M.period;
M.dutyFactor    = M.contactTime / (2 * M.period);

%% ----- Leg geometry at touchdown and takeoff -----
legAngle = @(x) rad2deg(atan2(x(2) - x(6), x(5) - x(1)));
M.touchdownAngleDeg = legAngle(ev.xBefore(iTD, :));
M.takeoffAngleDeg   = legAngle(ev.xBefore(iTO, :));
M.sweepAngleDeg     = M.takeoffAngleDeg - M.touchdownAngleDeg;

%% ----- Forces along the leg during stance -----
stanceIdx = find(r.phaseNames == "stance");
inStance = r.phase == stanceIdx;
px = r.x(1, :) - r.x(5, :);
py = r.x(2, :) - r.x(6, :);
L  = hypot(px, py);
F  = p.k * max(p.L0 - L, 0) .* inStance';
Fx = F .* px ./ L;
Fy = F .* py ./ L;

M.peakLegForceBW        = max(F) / W;
M.peakVerticalForceBW   = max(Fy) / W;
M.peakBrakingForceBW    = -min(Fx) / W;
M.peakPropulsiveForceBW = max(Fx) / W;
M.legCompression        = max(p.L0 - L(inStance));
M.legCompressionPct     = 100 * M.legCompression / p.L0;
M.comDropStance         = ev.xBefore(iTD, 2) - min(r.x(2, inStance));
M.verticalStiffness     = max(Fy) / M.comDropStance;

%% ----- Leg work and cost proxies -----
M.peakElasticEnergy       = 0.5 * p.k * M.legCompression^2;
M.positiveWorkPerDistance = M.peakElasticEnergy / (p.m * M.stepLength);
M.forceTimeCostIndex      = 1 / M.contactTime;

%% ----- Foot landing speed (ground speed matching) -----
xTD = ev.xBefore(iTD, :);
aTD = deg2rad(M.touchdownAngleDeg);
vTD = xTD(3:4)';
vFoot = vTD + p.L0 * deg2rad(p.retractionDegPerS) * [-sin(aTD); -cos(aTD)];
M.groundSpeedMatching = 1 - norm(vFoot) / norm(vTD);

%% ----- Dimensionless groups -----
M.froude            = M.meanSpeed^2 / (p.g * p.L0);
M.relativeStiffness = p.k * p.L0 / W;

%% ----- Energy components and conservation check -----
spring = 0.5 * p.k * max(p.L0 - L, 0).^2 .* inStance';
energy.kineticHorizontal = 0.5 * p.m * r.x(3, :).^2;
energy.kineticVertical   = 0.5 * p.m * r.x(4, :).^2;
energy.potential         = p.m * p.g * r.x(2, :);
energy.elastic           = spring;
energy.total = energy.kineticHorizontal + energy.kineticVertical + ...
    energy.potential + energy.elastic;
M.energyChange = energy.total(end) - energy.total(1);

M.trace = struct('t', r.t, 'x', r.x, 'phase', r.phase, ...
    'phaseNames', r.phaseNames, 'Fx', Fx, 'Fy', Fy, 'legLength', L, ...
    'energy', energy, 'events', ev);
end
