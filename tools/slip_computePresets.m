%% SLIP_COMPUTEPRESETS  Solve the periodic gaits used as SLIP presets.
% Purpose : find a human-like stable running gait and two variants with
%           lower and higher leg stiffness at the same average speed and
%           step frequency. Writes models/slip/slip_presets.csv, which
%           slip_defaults and the interactive web page read.
% Run     : once, after any change to the SLIP model or the settings below.
% Requires: setupHybridDynamics (run automatically below)

clear; close all;
toolDir = fileparts(mfilename('fullpath'));
run(fullfile(toolDir, '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: body and leg (shared by all presets) =====
base.m  = 80;          % body mass (kg)
base.L0 = 1.0;         % leg rest length (m)
base.g  = 9.81;        % gravitational acceleration (m/s^2)
base.retractionDegPerS = 0;   % no swing-leg retraction: fixed angle of attack

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
for i = 1:size(presets, 1)
    p = base;
    p.k = presets{i, 3};
    p.legAngleDeg = presets{i, 4};
    guess = struct('legAngleDeg', presets{i, 4}, 'y', presets{i, 5}, 'vx', presets{i, 6});
    [gait, info] = slip_findGait(p, target, guess);
    if ~info.converged || gait.exitReason ~= "cycleLimit"
        error('Preset "%s" did not converge: %s', presets{i, 1}, info.message);
    end
    S = slip_stability(gait.p, [gait.y; gait.vx], struct('jacobian', true));
    M = slip_metrics(gait.p, [gait.y; gait.vx]);
    fprintf('%-20s k = %5.0f N/m  angle = %.4f deg  apex y = %.5f m  vx = %.5f m/s  lambda = %+.3f  max drop = %.2f m\n', ...
        presets{i, 1}, p.k, gait.p.legAngleDeg, gait.y, gait.vx, S.lambda, S.maxDrop);
    rows{i} = struct('name', presets{i, 1}, 'label', presets{i, 2}, ...
        'm', p.m, 'L0', p.L0, 'k', p.k, 'g', p.g, ...
        'legAngleDeg', gait.p.legAngleDeg, 'retractionDegPerS', p.retractionDegPerS, ...
        'apexHeight', gait.y, 'apexSpeed', gait.vx, ...
        'meanSpeed', M.meanSpeed, 'stepFrequency', M.stepFrequency, ...
        'lambda', S.lambda, 'maxDrop', S.maxDrop, ...
        'peakVerticalForceBW', M.peakVerticalForceBW, 'contactTime', M.contactTime);
end

%% 2. Write the preset table
T = struct2table(vertcat(rows{:}));
outFile = fullfile(toolDir, '..', 'models', 'slip', 'slip_presets.csv');
writetable(T, outFile);
fprintf('Wrote %s\n', outFile);
