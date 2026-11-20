%% EX04_SLIP_FINDGAIT  Find a periodic running gait at a chosen speed
% Purpose : start from a rough guess and solve for the apex state and leg
%           angle that repeat every stride at a chosen average speed and
%           step frequency.
% Model   : models/slip
% Outputs : the periodic gait and its measures in the Command Window
% Requires: none (the script adds the toolkit to the path)

clear; close all;
run(fullfile(fileparts(mfilename('fullpath')), '..', 'setupHybridDynamics.m'));

%% ===== USER SETTINGS: model parameters =====
p = slip_defaults("human");
p.k  = 15000;                     % leg stiffness (N/m)
p.m  = 80;                        % body mass (kg)
p.L0 = 1.0;                       % leg rest length (m)
p.retractionDegPerS = 0;          % no swing-leg retraction

%% ===== USER SETTINGS: gait targets =====
target.meanSpeed     = 4.0;       % average forward speed (m/s)
target.hold          = "stepFrequency";   % or "apexHeight" or "legAngle"
target.stepFrequency = 3.0;       % steps per second

%% ===== USER SETTINGS: starting guess (contact and initial conditions) =====
guess.legAngleDeg = 66;           % leg angle at apex (deg)
guess.y           = 0.94;         % apex height (m)
guess.vx          = 4.1;          % forward speed at apex (m/s)

%% 1. Solve for the periodic gait
[gait, info] = slip_findGait(p, target, guess);
fprintf('%s (%d iterations, residual %.1e)\n', info.message, info.iterations, info.residualNorm);
fprintf('Leg angle %.3f deg, apex height %.4f m, apex speed %.4f m/s\n', ...
    gait.p.legAngleDeg, gait.y, gait.vx);

%% 2. Check periodicity over ten strides
s = [gait.y; gait.vx];
for i = 1:10
    s = slip_returnMap(gait.p, s);
end
fprintf('Apex height after 10 strides: %.6f m (start %.6f m)\n', s(1), gait.y);

%% 3. Measures of the gait
M = slip_metrics(gait.p, [gait.y; gait.vx]);
fprintf('Contact time %.3f s, peak vertical force %.2f BW, duty factor %.2f\n', ...
    M.contactTime, M.peakVerticalForceBW, M.dutyFactor);
plotSlipStride(M, gait.p, sprintf("Periodic gait, k = %.0f kN/m", p.k / 1000));
