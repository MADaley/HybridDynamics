function T = slip_retractionSweep(p, apex, omegas, opts)
%SLIP_RETRACTIONSWEEP  Measures of one gait across swing-leg retraction rates.
%
%   T = slip_retractionSweep(p, apex, omegas)
%   T = slip_retractionSweep(p, apex, omegas, opts)
%
%   p, apex : a periodic gait (parameters and apex state, struct with y, vx)
%   omegas  : retraction rates to test (deg/s, >= 0)
%   opts    : .dropHeight  drop for the peak-force test (m, default 0.05)
%             .terrain     run the 20-stride drop test (default false; slow)
%
%   Each rate keeps the same periodic gait (slip_setRetraction). T has one
%   row per rate: foot clearance at apex, ground speed matching, eigenvalue
%   lambda, normalized maximum drop (estimate and simulated first contact),
%   peak leg force after a drop, and optionally the 20-stride drop.
%
%   See also slip_compareRetractionRules

if nargin < 4, opts = struct(); end
if ~isfield(opts, 'dropHeight'), opts.dropHeight = 0.05; end
if ~isfield(opts, 'terrain'), opts.terrain = false; end

[~, m] = slip_returnMap(p, [apex.y; apex.vx]);
cycle = 2 * m.period;
n = numel(omegas);
rows = cell(n, 1);
for i = 1:n
    q = slip_setRetraction(p, apex, omegas(i));
    S = slip_stability(q, [apex.y; apex.vx], struct('jacobian', false, 'terrain', opts.terrain));
    D = slip_normalizedMaxDrop(q, apex);
    G = slip_groundSpeedMatching(q, apex);
    R = slip_dropResponse(q, apex, opts.dropHeight);
    row = struct('retractionDegPerS', omegas(i), 'retractionDegPerCycle', omegas(i) * cycle, ...
        'apexClearance', apex.y - q.L0 * sind(q.legAngleDeg), ...
        'groundSpeedMatching', G.gsm, 'lambda', S.lambda, ...
        'nmdEstimate', D.estimateNMD, 'nmdSimulated', D.simulatedNMD, ...
        'peakForceAfterDropBW', R.peakLegForceBW, 'maxDrop', NaN);
    if opts.terrain
        row.maxDrop = S.maxDrop;
    end
    rows{i} = row;
end
T = struct2table(vertcat(rows{:}));
end
