function T = slip_compareRetractionRules(p, apex, rules, opts)
%SLIP_COMPARERETRACTIONRULES  One gait under several swing-leg retraction rules.
%
%   T = slip_compareRetractionRules(p, apex)
%   T = slip_compareRetractionRules(p, apex, rules, opts)
%
%   p, apex : a periodic gait (parameters and apex state, struct with y, vx)
%   rules   : n x 3 cell array {name, rule, value} for slip_retractionRule.
%             Default: fixed leg angle; the human leg rotation rate at
%             4 m/s from Blum et al. (2011, data/swingLegKinematics_Blum2011.csv);
%             5 cm foot clearance; fastest recovery; largest ground speed
%             matching.
%   opts    : .dropHeight  drop for the peak-force test (m, default 0.05)
%             .terrain     run the 20-stride drop test (default true)
%
%   Every rule keeps the same periodic gait. T has one row per rule:
%   retraction rate (deg/s and deg per gait cycle), leg angle at apex,
%   foot clearance at apex, ground speed matching at touchdown, eigenvalue
%   lambda, largest drop survived for 20 strides, normalized maximum drop
%   (estimate and simulated first contact), and peak leg force in the first
%   stance after a drop of opts.dropHeight.
%
%   See also slip_retractionRule, slip_retractionSweep

if nargin < 3 || isempty(rules)
    rules = slip_defaultRetractionRules();
end
if nargin < 4, opts = struct(); end
if ~isfield(opts, 'dropHeight'), opts.dropHeight = 0.05; end
if ~isfield(opts, 'terrain'), opts.terrain = true; end

n = size(rules, 1);
rows = cell(n, 1);
for i = 1:n
    [q, info] = slip_retractionRule(p, apex, rules{i, 2}, rules{i, 3});
    S = slip_stability(q, [apex.y; apex.vx], struct('jacobian', false, 'terrain', opts.terrain));
    D = slip_normalizedMaxDrop(q, apex);
    R = slip_dropResponse(q, apex, opts.dropHeight);
    row = struct('name', string(rules{i, 1}), 'rule', string(rules{i, 2}), ...
        'retractionDegPerS', info.retractionDegPerS, ...
        'retractionDegPerCycle', info.retractionDegPerCycle, ...
        'apexLegAngleDeg', q.legAngleDeg, 'apexClearance', info.apexClearance, ...
        'groundSpeedMatching', info.gsm, 'lambda', S.lambda, ...
        'maxDrop', NaN, 'dropFailure', "", ...
        'nmdEstimate', D.estimateNMD, 'nmdSimulated', D.simulatedNMD, ...
        'peakForceAfterDropBW', R.peakLegForceBW, 'peakForceSteadyBW', R.peakLegForceBWsteady, ...
        'note', info.note);
    if opts.terrain
        row.maxDrop = S.maxDrop;
        row.dropFailure = S.dropFailure;
    end
    rows{i} = row;
end
T = struct2table(vertcat(rows{:}));
end
