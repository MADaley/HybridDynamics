%% EX06_SLIP_SAMESPEEDSTIFFNESS  One running speed, many leg stiffnesses
% Purpose : show that a runner can reach the same average speed and step
%           frequency with different leg stiffness, each with its own leg
%           angle, and compare peak forces, leg work, cost proxies and
%           stability across the family of solutions.
% Model   : models/slip
% Outputs : results/<time stamp>/stiffnessFamily.csv and figures
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: starting gait (baseline preset) =====
[p, apex, ~, presets] = slip_defaults("human");   % 12 kN/m, 4 m/s, 3 steps/s

%% ===== USER SETTINGS: gait held fixed across the family =====
target.meanSpeed     = presets.meanSpeed(presets.name == "human");      % 4 m/s
target.hold          = "stepFrequency";
target.stepFrequency = presets.stepFrequency(presets.name == "human");  % 3 steps/s

%% ===== USER SETTINGS: swing leg =====
% One retraction rate for every gait, so the gaits differ only in leg
% stiffness: the human leg rotation rate at touchdown at 4 m/s, in degrees
% per gait cycle (Blum et al. 2011). Retraction leaves each periodic gait
% unchanged. Other rules: see slip_retractionRule and ex07.
rules = slip_defaultRetractionRules();
retractionRule  = rules{2, 2};      % "commonPerCycle"
retractionValue = rules{2, 3};      % deg per gait cycle

%% ===== USER SETTINGS: stiffness range and output =====
kValues     = (6:1:35) * 1000;    % leg stiffness values (N/m)
runDropTest = true;               % adds about 30 s
saveResults = true;

%% 1. Solve the family by continuation from the baseline gait
base = struct('p', p, 'y', apex.y, 'vx', apex.vx);
tic;
T = slip_stiffnessFamily(base, kValues, target, struct('terrain', runDropTest, ...
    'retractionRule', retractionRule, 'retractionValue', retractionValue));
fprintf('Solved %d of %d gaits in %.0f s.\n', sum(~isnan(T.legAngleDeg)), height(T), toc);

%% 2. Compare the three presets
show = ["k" "touchdownAngleDeg" "apexClearance" "contactTime" ...
    "peakVerticalForceBW" "positiveWorkPerDistance" "forceTimeCostIndex" "lambda" ...
    "maxDrop" "nmdEstimate" "nmdSimulated"];
[~, rows] = ismember(presets.k, T.k);
disp(T(rows, show));

%% 3. Plot the family with the presets marked
f = plotStiffnessFamily(T, presets(:, {'k', 'label'}));

%% 4. Save
if saveResults
    out = hde.resultsFolder(mfilename('fullpath'), "stiffnessFamily");
    writetable(T, fullfile(out, 'stiffnessFamily.csv'));
    S = daleyStyle('teaching');
    S.save(f, 'stiffnessFamily', out);
    fprintf('Results saved in %s\n', out);
end
