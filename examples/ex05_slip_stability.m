%% EX05_SLIP_STABILITY  Stride-to-stride stability of a periodic gait
% Purpose : test whether a small change in apex height grows or shrinks
%           from stride to stride (return map, eigenvalues).
% Model   : models/slip
% Outputs : eigenvalues in the Command Window; return-map figure
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: gait to test (a preset is already periodic) =====
presetName = "human";             % "human", "humanLowStiffness", "humanHighStiffness"
[p, apex] = slip_defaults(presetName);

%% ===== USER SETTINGS: perturbations =====
cobwebStart = 0.01;               % starting change in apex height (m)
nStrides    = 10;                 % strides in the cobweb

%% ===== USER SETTINGS: output =====
saveFigures = false;

%% 1. Eigenvalues of the apex return map
S = slip_stability(p, [apex.y; apex.vx]);
fprintf('Preset "%s"\n', presetName);
fprintf('  lambda (constant-energy apex map) = %+.4f\n', S.lambda);
fprintf('  2-D apex map eigenvalues: %s\n', mat2str(S.floquet.eigenvalues', 5));
fprintf('  %s\n', S.floquet.text);
fprintf('  finite-difference consistency: %.1e\n', S.jacobianConsistency);

%% 2. Return map with a cobweb from a perturbed start
f = plotReturnMap(p, apex, struct('start', cobwebStart, 'nStrides', nStrides));
title(gca, sprintf('\\lambda = %+.2f', S.lambda));
if saveFigures
    St = daleyStyle('teaching');
    St.save(f, "ex05_returnMap_" + presetName, hde.resultsFolder(mfilename('fullpath')));
end
