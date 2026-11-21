%% EX03_SLIP_ONESTRIDE  One stride of the spring-mass runner
% Purpose : simulate one apex-to-apex stride, list its transitions, and
%           show the ground reaction forces and the exchange among kinetic,
%           gravitational and elastic energy.
% Model   : models/slip (spring-loaded inverted pendulum)
% Outputs : stride measures in the Command Window; figures on screen
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: model parameters =====
[p, apex] = slip_defaults("human");   % 80 kg, 1 m leg, 12 kN/m; edit below
p.k  = 12000;                         % leg stiffness (N/m)
p.m  = 80;                            % body mass (kg)
p.L0 = 1.0;                           % leg rest length (m)

%% ===== USER SETTINGS: contact conditions =====
% p.legAngleDeg       = 57.14;        % leg angle at apex (deg from ground, in front)
% p.retractionDegPerS = 123.3;        % leg rotation rate in descending flight (deg/s)

%% ===== USER SETTINGS: initial conditions (apex) =====
% apex.y  = 0.914;                    % apex height (m)
% apex.vx = 4.10;                     % forward speed at apex (m/s)

%% ===== USER SETTINGS: phase portraits =====
perturbation   = 0.02;            % apex height change of the overlay run (m), same energy; 0 for none
perturbStrides = 6;               % strides of the overlay run

%% ===== USER SETTINGS: output =====
showAnimation = false;            % moving dot on both phase portraits and the runner
saveFigures   = false;

%% 1. Simulate one stride and compute its measures
M = slip_metrics(p, [apex.y; apex.vx]);
disp(M.trace.events(:, {'time', 'from', 'guard', 'to'}));

%% 2. Report the stride
fprintf('\nStride from apex height %.3f m at %.2f m/s (%s)\n', apex.y, apex.vx, M.exitReason);
fprintf('  average speed %.2f m/s, step frequency %.2f Hz, step length %.2f m\n', ...
    M.meanSpeed, M.stepFrequency, M.stepLength);
fprintf('  contact time %.3f s, flight time %.3f s, duty factor %.2f\n', ...
    M.contactTime, M.flightTime, M.dutyFactor);
fprintf('  touchdown angle %.1f deg, leg sweep %.1f deg, leg compression %.1f %%\n', ...
    M.touchdownAngleDeg, M.sweepAngleDeg, M.legCompressionPct);
fprintf('  peak vertical force %.2f BW, peak braking force %.2f BW\n', ...
    M.peakVerticalForceBW, M.peakBrakingForceBW);
fprintf('  peak elastic energy %.1f J, positive leg work %.3f J/(kg m)\n', ...
    M.peakElasticEnergy, M.positiveWorkPerDistance);
fprintf('  mechanical energy change over the stride: %.1e J\n', M.energyChange);

%% 3. Plot forces and energy
f = plotSlipStride(M, p, "Baseline human-like gait, 4 m/s");

%% 4. Phase portraits: body height and vertical velocity; leg angle and leg length
f2 = plotPhasePortraits(p, apex, struct('perturbation', perturbation, ...
    'perturbStrides', perturbStrides, 'animate', showAnimation, 'animateRun', "perturbed"));

if saveFigures
    S = daleyStyle('teaching');
    out = hde.resultsFolder(mfilename('fullpath'));
    S.save(f, 'ex03_slip_oneStride', out);
    S.save(f2, 'ex03_phasePortraits', out);
end
