%[text] # Lesson 5. Same speed, different legs
%[text] A runner can reach the same average speed with legs of different stiffness. In the spring-mass model, each stiffness has its own periodic gait at that speed, with its own leg angle. This lesson holds the average speed and the step frequency fixed, solves the gait for a range of leg stiffness, and compares peak forces, two energy-cost proxies and two aspects of stability.
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
[p, apex, ~, presets] = slip_defaults("human");
target = struct('meanSpeed', presets.meanSpeed(1), 'hold', "stepFrequency", ...
    'stepFrequency', presets.stepFrequency(1));
fprintf('Average speed %.1f m/s, step frequency %.1f steps per second\n', target.meanSpeed, target.stepFrequency);
%[text] ## 1. Solve the family of gaits
%[text] `slip_stiffnessFamily` starts from the baseline gait and steps through stiffness, using each solution as the starting guess for the next. 
%[text] Every gait gets the same swing-leg retraction rate, so the gaits differ only in leg stiffness: the leg rotation rate measured at touchdown in humans running at 4 m/s, 82 degrees per gait cycle (Blum et al. 2011). Retraction leaves each periodic gait unchanged; it changes only the response to perturbations. Lesson 6 compares other ways to choose the rate.
rules = slip_defaultRetractionRules();
kValues = (6:1:35) * 1000;
T = slip_stiffnessFamily(struct('p', p, 'y', apex.y, 'vx', apex.vx), kValues, target, ...
    struct('retractionRule', rules{2, 2}, 'retractionValue', rules{2, 3}));
fprintf('Common retraction rate: %.1f deg/s\n', T.retractionDegPerS(1));
%[text] ## 2. Compare the three presets
[~, rows] = ismember(presets.k, T.k);
T(rows, ["k" "touchdownAngleDeg" "apexClearance" "contactTime" "peakVerticalForceBW" "positiveWorkPerDistance" "forceTimeCostIndex" "lambda" "nmdEstimate"])
%[text] Across the family a stiffer leg lands at a steeper angle, stays on the ground for less time and reaches a higher peak force. The leg spring stores less energy per step.
%[text] ## 3. Two energy-cost proxies
%[text] The model does no net mechanical work: the spring returns all the energy it stores. Two proxies estimate what muscles would have to provide.
%[text] Positive leg work per distance: the energy the spring stores and returns each step, divided by body mass and step length. It equals the mechanical work by the legs if the spring returned none.
%[text] Force-time cost index: the inverse of contact time, proportional to the metabolic cost of supporting body weight in the hypothesis of Kram and Taylor (1990).
fprintf('Positive leg work per distance: %.2f to %.2f J/(kg m)\n', max(T.positiveWorkPerDistance), min(T.positiveWorkPerDistance));
fprintf('Force-time cost index: %.2f to %.2f 1/s\n', min(T.forceTimeCostIndex), max(T.forceTimeCostIndex));
%[text] The two proxies change in opposite directions with stiffness, so the choice of cost measure decides which leg looks cheaper.
%[text] ## 4. Stability
%[text] The eigenvalue $\lambda$ (Lesson 4) measures how fast a small error shrinks.
stable = abs(T.lambda) < 1;
fprintf('Stable (|lambda| < 1) from %.0f to %.0f N/m in this range\n', min(T.k(stable)), max(T.k(stable)));
[~, iBest] = min(abs(T.lambda));
fprintf('Fastest recovery (smallest |lambda|) at %.0f N/m, lambda = %+.3f\n', T.k(iBest), T.lambda(iBest));
%[text] Retraction couples the touchdown angle to the fall time: a higher apex means a longer fall and a steeper leg at touchdown. At this common rate every gait has a negative $\lambda$: errors in apex height change sign from stride to stride.
%[text] ## 5. Normalized maximum drop at a common retraction rate
%[text] Real animals can recover from a drop through muscle work and damping in the strides that follow, provided the leg makes contact in the stance right after the drop. Daley and Usherwood (2010) measured that first-contact limit with the normalized maximum drop, $\mathrm{NMD} = \frac{g}{2} (\Phi / \bar{\omega})^2 / L$, with $\Phi$ the stance half-angle and $\bar{\omega}$ the retraction rate. At one common rate, NMD grows with $\Phi^2$: compliant legs sweep a larger angle and have the larger NMD.
T(rows, ["k" "stanceHalfAngleDeg" "nmdEstimate" "nmdSimulated"])
%[text] The simulated first-contact limit follows the actual flight path, including the downward speed at the usual touchdown and the rise of the hip as the leg rotates toward vertical, which the estimate leaves out. Blum et al. (2011) extended the NMD in the same direction.
plotStiffnessFamily(T, presets(:, {'k', 'label'}));
%[text] ## Try this
%[text] Change `target.stepFrequency` to 2.8 or 3.2 and rerun. How do the stable range and the presets move?
%[text] Run `ex06_slip_sameSpeedStiffness` to save the table and figure.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
