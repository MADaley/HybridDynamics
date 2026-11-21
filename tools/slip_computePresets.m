%% SLIP_COMPUTEPRESETS  Solve the periodic gaits used as SLIP presets.
% Purpose : find a human-like stable running gait and two variants with
%           lower and higher leg stiffness at the same average speed and
%           step frequency, all with the same swing-leg retraction rate:
%           the leg rotation rate measured at touchdown in humans running
%           at 4 m/s (Blum et al. 2011). Writes models/slip/slip_presets.csv,
%           which slip_defaults and the interactive web page read.
% Run     : once, after any change to the SLIP model or the settings below.
% Requires: setupHybridDynamics (run automatically below)

clear; close all;
toolDir = fileparts(mfilename('fullpath'));
run(fullfile(toolDir, '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: body and leg (shared by all presets) =====
base.m  = 80;          % body mass (kg)
base.L0 = 1.0;         % leg rest length (m)
base.g  = 9.81;        % gravitational acceleration (m/s^2)
base.retractionDegPerS = 0;   % gaits are solved with a fixed leg angle first

%% ===== USER SETTINGS: swing leg =====
% One retraction rate for every preset, so the gaits differ only in leg
% stiffness: the human leg rotation rate at touchdown at 4.07 m/s, in
% degrees per gait cycle (Blum et al. 2011; data/swingLegKinematics_Blum2011.csv).
% Retraction from apex lifts the foot at apex (with a fixed leg angle it
% sits 0.6 to 3 cm above the ground) and leaves the periodic gait unchanged.
rules = slip_defaultRetractionRules();
retractionRule  = rules{2, 2};          % "commonPerCycle"
retractionValue = rules{2, 3};          % deg per gait cycle

%% ===== USER SETTINGS: gait held fixed across presets =====
target.meanSpeed     = 4.0;   % average forward speed (m/s)
target.hold          = "stepFrequency";
target.stepFrequency = 3.0;   % steps per second

%% ===== USER SETTINGS: presets (stiffness and a starting guess) =====
%          name                  label                    k (N/m)  guess: angle(deg) y(m)  vx(m/s)
presets = {
    "human",               "Baseline (human-like)",     12000,   64.0,  0.914,  4.10
    "humanLowStiffness",   "Low leg stiffness",          8000,   58.5,  0.859,  4.14
    "humanHighStiffness",  "High leg stiffness",        20000,   69.5,  0.967,  4.06};

%% 1. Solve each gait
rows = cell(size(presets, 1), 1);
gaitsSolved = cell(size(presets, 1), 1);
for i = 1:size(presets, 1)
    p = base;
    p.k = presets{i, 3};
    p.legAngleDeg = presets{i, 4};
    guess = struct('legAngleDeg', presets{i, 4}, 'y', presets{i, 5}, 'vx', presets{i, 6});
    [gait, info] = slip_findGait(p, target, guess);
    if ~info.converged || gait.exitReason ~= "cycleLimit"
        error('Preset "%s" did not converge: %s', presets{i, 1}, info.message);
    end
    apex = struct('y', gait.y, 'vx', gait.vx);
    q = slip_retractionRule(gait.p, apex, retractionRule, retractionValue);
    S = slip_stability(q, [gait.y; gait.vx], struct('jacobian', true));
    M = slip_metrics(q, [gait.y; gait.vx]);
    fprintf(['%-20s k = %5.0f N/m  touchdown %.3f deg  apex angle %.3f deg  retraction %.1f deg/s  ' ...
        'apex y = %.5f m  vx = %.5f m/s  lambda = %+.3f  max drop = %.2f m (%s)\n'], ...
        presets{i, 1}, p.k, M.touchdownAngleDeg, q.legAngleDeg, q.retractionDegPerS, ...
        gait.y, gait.vx, S.lambda, S.maxDrop, S.dropFailure);
    gaitsSolved{i} = struct('p', q, 'apex', apex);
    rows{i} = struct('name', presets{i, 1}, 'label', presets{i, 2}, ...
        'm', p.m, 'L0', p.L0, 'k', p.k, 'g', p.g, ...
        'legAngleDeg', q.legAngleDeg, 'retractionDegPerS', q.retractionDegPerS, ...
        'touchdownAngleDeg', M.touchdownAngleDeg, ...
        'apexClearance', gait.y - q.L0 * sind(q.legAngleDeg), ...
        'apexHeight', gait.y, 'apexSpeed', gait.vx, ...
        'meanSpeed', M.meanSpeed, 'stepFrequency', M.stepFrequency, ...
        'lambda', S.lambda, 'maxDrop', S.maxDrop, 'dropFailure', S.dropFailure, ...
        'peakVerticalForceBW', M.peakVerticalForceBW, 'contactTime', M.contactTime);
end

%% 2. Largest drop with a stance contact (Daley and Usherwood 2010)
% Kinematic estimate at each gait's own retraction rate and at the
% baseline rate, and the simulated value of the same criterion.
wRef = gaitsSolved{strcmp([presets{:, 1}], "human")}.p.retractionDegPerS;
for i = 1:numel(rows)
    D = slip_normalizedMaxDrop(gaitsSolved{i}.p, gaitsSolved{i}.apex, ...
        struct('referenceRetractionDegPerS', wRef));
    rows{i}.stanceHalfAngleDeg = D.stanceHalfAngleDeg;
    rows{i}.nmdEstimate = D.estimateNMD;
    rows{i}.nmdSimulated = D.simulatedNMD;
    rows{i}.nmdEstimateAtReference = D.estimateDropAtReference / gaitsSolved{i}.p.L0;
    rows{i}.referenceRetractionDegPerS = wRef;
    fprintf('%-20s NMD estimate %.3f (simulated %.3f; at %.1f deg/s %.3f)\n', rows{i}.name, ...
        D.estimateNMD, D.simulatedNMD, wRef, rows{i}.nmdEstimateAtReference);
end

%% 3. Write the preset table
T = struct2table(vertcat(rows{:}));
outFile = fullfile(toolDir, '..', 'models', 'slip', 'slip_presets.csv');
writetable(T, outFile);
fprintf('Wrote %s\n', outFile);
