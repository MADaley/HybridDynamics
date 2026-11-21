%[text] # Lesson 4. Periodic gaits and the return map
%[text] A periodic gait repeats its apex state every stride. The apex return map sends one apex state to the next. A periodic gait is a fixed point of the map, and the slope of the map at the fixed point says whether small errors grow or shrink from stride to stride (Seyfarth et al. 2002; Holmes et al. 2006).
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
[p, apex] = slip_defaults("human");
%[text] ## 1. Find a periodic gait
%[text] `slip_findGait` adjusts the apex state and the leg angle until the apex height repeats, at a chosen average speed and step frequency.
q = p; q.k = 15000; q.retractionDegPerS = 0;   % fixed leg angle for this search
target = struct('meanSpeed', 4, 'hold', "stepFrequency", 'stepFrequency', 3);
[gait, info] = slip_findGait(q, target, struct('y', 0.94, 'vx', 4.1, 'legAngleDeg', 66));
fprintf('%s: leg angle %.3f deg, apex %.4f m at %.4f m/s\n', info.message, gait.p.legAngleDeg, gait.y, gait.vx);
%[text] ## 2. The map at constant energy
%[text] The model conserves mechanical energy, so apex height and apex speed are linked: a higher apex means a slower apex speed. Holding the energy fixed leaves one number per stride, the apex height. The slope $\lambda = dy_{n+1}/dy_n$ at the fixed point is the stability eigenvalue. For $|\lambda| < 1$ a small error shrinks each stride; for $\lambda < 0$ it changes sign each stride.
S = slip_stability(p, [apex.y; apex.vx], struct('terrain', false));
fprintf('lambda = %+.3f\n', S.lambda);
plotReturnMap(p, apex, struct('start', 0.01, 'nStrides', 10));
%[text] ## 3. Two eigenvalues, one of them equal to 1
%[text] The full apex map acts on two numbers (height and speed). Its Jacobian has two eigenvalues. One equals 1: a change in energy neither grows nor decays, because the model has no damping and no actuation. The other equals $\lambda$.
S.floquet.eigenvalues
S.floquet.text
%[text] ## Try this
%[text] Repeat with the presets `"humanLowStiffness"` and `"humanHighStiffness"`. Which recovers fastest from a small error, and which changes sign each stride?

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
