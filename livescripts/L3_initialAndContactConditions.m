%[text] # Lesson 3. Initial conditions and contact conditions
%[text] Two kinds of settings shape a stride. Initial conditions describe the state of the body at apex: its height and forward speed. Contact conditions describe how the leg meets the ground: the leg angle set at apex and its rotation during descent. Parameters (mass, leg length, stiffness, gravity) stay fixed.
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
[p, apex, ~, presets] = slip_defaults("human");
% Start from a fixed leg angle (no retraction): the leg angle at apex is the
% touchdown angle of the baseline gait.
p.retractionDegPerS = 0;
p.legAngleDeg = presets.touchdownAngleDeg(presets.name == "human");
%[text] ## 1. Same apex state, different leg angles
%[text] With no leg retraction, the leg angle set at apex is the angle of attack at touchdown. A steeper leg (larger angle) meets the ground earlier in the fall.
angles = p.legAngleDeg + (-4:2:4);
for a = angles
    q = p; q.legAngleDeg = a;
    [sNext, info] = slip_returnMap(q, [apex.y; apex.vx]);
    fprintf('leg angle %5.1f deg: next apex %.4f m, %.3f m/s (%s)\n', a, sNext(1), sNext(2), info.exitReason);
end
%[text] Only one of these angles returns the runner to the same apex height. The others raise or lower the next apex.
%[text] ## 2. Same leg angle, different apex heights
heights = apex.y + (-0.02:0.01:0.02);
for y = heights
    [sNext, info] = slip_returnMap(p, [y; apex.vx]);
    fprintf('apex %.3f m: next apex %.4f m (%s)\n', y, sNext(1), info.exitReason);
end
%[text] ## 3. Dimensionless groups
%[text] Runners of different size can be compared through dimensionless groups: the Froude number $v^2 / (g L_0)$ and the relative leg stiffness $k L_0 / (m g)$ (McMahon and Cheng 1990).
M = slip_metrics(p, [apex.y; apex.vx]);
fprintf('Froude number %.2f, relative stiffness %.1f\n', M.froude, M.relativeStiffness);
%[text] ## 3b. Foot clearance at apex
%[text] With a fixed leg angle the foot hangs close to the ground at apex. A small drop in apex height then puts the foot below the ground before the leg can be placed.
fprintf('Foot clearance at apex with a fixed leg angle: %.1f cm\n', 100 * (apex.y - p.L0 * sind(p.legAngleDeg)));
%[text] Swing-leg retraction lifts the foot at apex and rotates the leg to the same touchdown angle by the time it lands (Lesson 6). `slip_retractionForClearance` finds the rate:
q = slip_retractionForClearance(p, apex, 0.05);
fprintf('For 5 cm clearance: leg angle at apex %.2f deg, retraction %.1f deg/s\n', q.legAngleDeg, q.retractionDegPerS);
%[text] ## Try this
%[text] Find, by trial, the leg angle that returns the runner to the same apex height from `apex.y + 0.01`. Compare with `slip_findGait` in Lesson 4.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
