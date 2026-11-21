function D = slip_normalizedMaxDrop(p, apex, opts)
%SLIP_NORMALIZEDMAXDROP  Largest drop for which the leg still makes stance contact.
%
%   D = slip_normalizedMaxDrop(p, apex)
%   D = slip_normalizedMaxDrop(p, apex, opts)
%
%   p, apex : a periodic gait (parameters and apex state, struct with y, vx)
%   opts    : .hMax  largest drop searched in the simulation (m, default 5)
%             .tol   bisection tolerance (m, default 1e-4)
%             .referenceRetractionDegPerS  a common retraction rate (deg/s)
%                    for a second estimate, so gaits can be compared at
%                    the same omega as in Daley and Usherwood (2010)
%
%   Daley and Usherwood (2010) defined the normalized maximum drop (NMD) as
%   the largest unexpected drop, relative to leg length, for which the
%   intended stance leg makes any contact:
%       NMD = dHmax / L,   dt = Phi / omega,   dHmax = g/2 * (Phi / omega)^2
%   with Phi the stance half-angle (here 90 deg minus the touchdown angle)
%   and omega the mean retraction velocity as the leg approaches the
%   ground. Beyond dHmax the leg has rotated past vertical before contact
%   and cannot be loaded. The measure does not require the runner to keep
%   a steady gait afterward: a real animal can use non-conservative
%   dynamics to recover once the leg makes contact.
%
%   This function returns that kinematic estimate and a simulated value of
%   the same criterion: the largest drop for which the first touchdown
%   after the drop occurs with the leg at or in front of vertical, loading
%   the leg. The simulation follows the actual ballistic path from apex, so
%   it includes the vertical speed at the nominal touchdown and the change
%   in hip height as the leg rotates, which the kinematic estimate leaves
%   out.
%
%   D.stanceHalfAngleDeg   Phi (deg)
%   D.retractionDegPerS    omega (deg/s)
%   D.estimateDrop         dHmax from the kinematic estimate (m); Inf for
%                          a fixed leg angle (omega = 0)
%   D.estimateNMD          dHmax / L0
%   D.estimateDropAtReference  the estimate at the reference retraction
%                          rate (m), if one is given
%   D.simulatedDrop        largest drop with a first contact at or in front
%                          of vertical (m); Inf if none up to opts.hMax fails
%   D.simulatedNMD         simulatedDrop / L0
%
%   See also slip_stability, slip_model

if nargin < 3, opts = struct(); end
if ~isfield(opts, 'hMax'), opts.hMax = 5; end
if ~isfield(opts, 'tol'), opts.tol = 1e-4; end

model = slip_model(p);
first = firstContact(p, model, apex.y, apex.vx);
if ~first.loaded
    error('slip_normalizedMaxDrop:gait', 'The gait does not make a loaded contact.');
end

%% ===== Kinematic estimate (Daley and Usherwood 2010) =====
D.stanceHalfAngleDeg = 90 - first.touchdownAngleDeg;
D.retractionDegPerS = p.retractionDegPerS;
phi = deg2rad(D.stanceHalfAngleDeg);
omega = deg2rad(p.retractionDegPerS);
if omega > 0
    D.estimateDrop = 0.5 * p.g * (phi / omega)^2;
else
    D.estimateDrop = Inf;
end
D.estimateNMD = D.estimateDrop / p.L0;
D.estimateDropAtReference = NaN;
if isfield(opts, 'referenceRetractionDegPerS') && opts.referenceRetractionDegPerS > 0
    D.estimateDropAtReference = 0.5 * p.g * (phi / deg2rad(opts.referenceRetractionDegPerS))^2;
end

%% ===== Simulated: largest drop with a first contact before vertical =====
loaded = @(h) firstContact(p, model, apex.y + h, apex.vx).loaded;
step = 0.05;
lo = 0;
hi = NaN;
for h = step:step:opts.hMax
    if loaded(h)
        lo = h;
    else
        hi = h;
        break
    end
end
if isnan(hi)
    D.simulatedDrop = Inf;
else
    while hi - lo > opts.tol
        mid = 0.5 * (lo + hi);
        if loaded(mid), lo = mid; else, hi = mid; end
    end
    D.simulatedDrop = lo;
end
D.simulatedNMD = D.simulatedDrop / p.L0;
end

function c = firstContact(p, model, y, vx)
% Simulate from apex to the first transition and test the contact.
o = hde.solverDefaults(struct('outputStep', 0, 'maxTransitions', 1, ...
    'check', false, 'timeLimit', 10));
r = hde.simulate(model, slip_apexState(p, y, vx), o);
c.loaded = false;
c.touchdownAngleDeg = NaN;
if isempty(r.events) || r.events.guard(1) ~= "touchdown"
    return
end
x = r.events.xBefore(1, :);
c.touchdownAngleDeg = rad2deg(atan2(x(2) - x(6), x(5) - x(1)));
c.loaded = r.events.to(1) == "stance" && c.touchdownAngleDeg <= 90;
end
