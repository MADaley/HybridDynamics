function S = slip_stability(p, s, opts)
%SLIP_STABILITY  Stride-to-stride stability and perturbation tolerance.
%
%   S = slip_stability(p, s)
%   S = slip_stability(p, s, opts)
%
%   p : parameters; s : apex state [y; vx] of a periodic gait (slip_findGait)
%   opts (struct, all optional)
%     .jacobian   also compute the 2-D apex Jacobian (default true)
%     .terrain    run the drop test (default true)
%     .heights    drop heights to test (m), default 0.01:0.01:0.50
%     .nStrides   strides to run after the drop (default 20)
%
%   S.lambda   slope of the apex-height return map at constant energy,
%              d(y_next)/d(y). |lambda| < 1: a small change in apex height
%              shrinks each stride (stable). lambda < 0: the error changes
%              sign each stride.
%   S.floquet  eigenvalues of the 2-D apex map (hde.floquetSummary). One
%              equals 1, the neutral energy mode; the other equals lambda.
%   S.maxDrop  largest unexpected drop in ground height (m) survived for
%              nStrides strides; heights are tested in increasing order
%              and the scan stops counting at the first failure
%   S.dropTable  per height: survived (true/false), strides completed,
%              failure mode (the exit reason of the failed stride, for
%              example "terminal:footBelowGround" when the foot would
%              start below the ground at apex), final apex height and speed
%   S.dropFailure  failure mode at the first drop height not survived
%
%   The drop occurs during the flight that follows the apex: the apex
%   height above the new ground rises by the drop height at the same
%   forward speed, which adds m*g*h of mechanical energy. Unexpected steps
%   up are left out: the leg is placed at apex, so a step higher than the
%   foot clearance at apex would meet the foot before the leg is placed.

if nargin < 3, opts = struct(); end
def = struct('jacobian', true, 'terrain', true, ...
    'heights', 0.01:0.01:0.50, 'nStrides', 20);
for f = fieldnames(def)'
    if ~isfield(opts, f{1}), opts.(f{1}) = def.(f{1}); end
end

model = slip_model(p);
y0 = s(1);
vx0 = s(2);
E = p.m * p.g * y0 + 0.5 * p.m * vx0^2;   % mechanical energy at apex (J)

%% ----- 1-D apex map at constant energy -----
f = @(y) apexMapAtEnergy(p, model, y, E);
% Central difference. A step of 1e-4 m keeps integration and event-location
% noise (about 1e-9 m) well below the result; the map is smooth on this
% scale, so the truncation error is negligible.
h = 1e-4;
S.lambda = (f(y0 + h) - f(y0 - h)) / (2 * h);
S.energy = E;

%% ----- 2-D apex map Jacobian -----
if opts.jacobian
    P = @(z) slip_returnMap(p, z, model);
    [J, info] = hde.returnMapJacobian(P, [y0; vx0], 1e-5);
    S.jacobian = J;
    S.jacobianConsistency = info.consistency;
    S.floquet = hde.floquetSummary(J, true);
end

%% ----- Unexpected drop in ground height -----
if opts.terrain
    [S.maxDrop, S.dropTable] = terrainTest(p, model, y0, vx0, opts.heights, opts.nStrides);
    iFail = find(~S.dropTable.survived, 1);
    S.dropFailure = "";
    if ~isempty(iFail)
        S.dropFailure = S.dropTable.failure(iFail);
    end
end
end

%% ===== Local functions =====
function yNext = apexMapAtEnergy(p, model, y, E)
% Next apex height for a start at height y with the energy held at E.
vx = sqrt(2 * (E / p.m - p.g * y));
sNext = slip_returnMap(p, [y; vx], model);
yNext = sNext(1);
end

function [maxH, T] = terrainTest(p, model, y0, vx0, heights, nStrides)
% Lower the ground once (raise the apex), then run nStrides strides.
n = numel(heights);
survived = false(n, 1);
strides = zeros(n, 1);
failure = strings(n, 1);
yEnd = nan(n, 1);
vxEnd = nan(n, 1);
for i = 1:n
    s = [y0 + heights(i); vx0];
    for j = 1:nStrides
        [sNext, info] = slip_returnMap(p, s, model);
        if any(isnan(sNext))
            failure(i) = info.exitReason;
            break
        end
        s = sNext;
        strides(i) = j;
    end
    survived(i) = strides(i) == nStrides;
    yEnd(i) = s(1);
    vxEnd(i) = s(2);
end
T = table(heights(:), survived, strides, failure, yEnd, vxEnd, 'VariableNames', ...
    {'height', 'survived', 'strides', 'failure', 'yEnd', 'vxEnd'});
firstFail = find(~survived, 1);
if isempty(firstFail)
    maxH = heights(end);
elseif firstFail == 1
    maxH = 0;
else
    maxH = heights(firstFail - 1);
end
end
