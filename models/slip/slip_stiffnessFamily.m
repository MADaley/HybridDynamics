function [T, gaits] = slip_stiffnessFamily(base, kValues, target, opts)
%SLIP_STIFFNESSFAMILY  Periodic gaits at one average speed across leg stiffness.
%
%   [T, gaits] = slip_stiffnessFamily(base, kValues, target)
%   [T, gaits] = slip_stiffnessFamily(base, kValues, target, opts)
%
%   base    : a periodic gait from slip_findGait (the starting solution)
%   kValues : leg stiffness values to solve for (N/m), any order
%   target  : as in slip_findGait (.meanSpeed, .hold and the held value)
%   opts    : .stability  compute slip_stability for each gait (true)
%             .terrain    include the drop test (false; slower)
%
%   Starting from the base gait, the function steps through stiffness in
%   both directions and uses each solution as the guess for the next
%   (continuation). Every gait has the same average speed, so the table
%   shows how one speed can be reached with different legs.
%
%   T : one row per stiffness with the leg angle, apex state, timing, peak
%       forces, leg work, the cost proxies of slip_metrics and the
%       stability measures of slip_stability. Rows whose solve failed hold
%       NaN.
%   gaits : cell array of gait structs, in the order of kValues

if nargin < 4, opts = struct(); end
if ~isfield(opts, 'stability'), opts.stability = true; end
if ~isfield(opts, 'terrain'), opts.terrain = false; end

kValues = kValues(:)';
n = numel(kValues);
gaits = cell(1, n);

% Continue upward and downward from the stiffness nearest the base gait.
[~, i0] = min(abs(kValues - base.p.k));
for direction = [1, -1]
    last = [base.y; base.vx; base.p.legAngleDeg];
    kLast = base.p.k;
    previous = [];
    kPrevious = [];
    if direction == 1
        idx = i0:n;
    else
        idx = i0-1:-1:1;
    end
    for i = idx
        % Predictor: extend the line through the last two solutions; fall
        % back to the last solution alone if that guess fails.
        guesses = {last};
        if ~isempty(previous)
            slope = (last - previous) / (kLast - kPrevious);
            guesses = {last + slope * (kValues(i) - kLast), last};
        end
        for j = 1:numel(guesses)
            z = guesses{j};
            guess = struct('y', z(1), 'vx', z(2), 'legAngleDeg', z(3));
            q = base.p;
            q.k = kValues(i);
            q.legAngleDeg = z(3);
            [g, info] = slip_findGait(q, target, guess);
            if info.converged && g.exitReason == "cycleLimit"
                gaits{i} = g;
                previous = last;
                kPrevious = kLast;
                last = [g.y; g.vx; g.p.legAngleDeg];
                kLast = kValues(i);
                break
            end
        end
    end
end

%% ----- Measures for each gait -----
rows = cell(n, 1);
for i = 1:n
    rows{i} = familyRow(kValues(i), gaits{i}, opts);
end
T = struct2table(vertcat(rows{:}));
end

function row = familyRow(k, g, opts)
row = struct('k', k, 'relativeStiffness', NaN, 'legAngleDeg', NaN, ...
    'apexHeight', NaN, 'apexSpeed', NaN, 'meanSpeed', NaN, ...
    'contactTime', NaN, 'flightTime', NaN, 'stepFrequency', NaN, ...
    'stepLength', NaN, 'dutyFactor', NaN, 'touchdownAngleDeg', NaN, ...
    'sweepAngleDeg', NaN, 'legCompressionPct', NaN, 'comDropStance', NaN, ...
    'peakVerticalForceBW', NaN, 'peakLegForceBW', NaN, ...
    'peakBrakingForceBW', NaN, 'peakElasticEnergy', NaN, ...
    'positiveWorkPerDistance', NaN, 'forceTimeCostIndex', NaN, ...
    'lambda', NaN, 'maxDrop', NaN);
if isempty(g)
    return
end
M = slip_metrics(g.p, [g.y; g.vx]);
copy = ["relativeStiffness" "meanSpeed" "contactTime" "flightTime" ...
    "stepFrequency" "stepLength" "dutyFactor" "touchdownAngleDeg" ...
    "sweepAngleDeg" "legCompressionPct" "comDropStance" ...
    "peakVerticalForceBW" "peakLegForceBW" "peakBrakingForceBW" ...
    "peakElasticEnergy" "positiveWorkPerDistance" "forceTimeCostIndex"];
for f = copy
    row.(f) = M.(f);
end
row.legAngleDeg = g.p.legAngleDeg;
row.apexHeight = g.y;
row.apexSpeed = g.vx;
if opts.stability
    S = slip_stability(g.p, [g.y; g.vx], ...
        struct('jacobian', false, 'terrain', opts.terrain));
    row.lambda = S.lambda;
    if opts.terrain
        row.maxDrop = S.maxDrop;
    end
end
end
