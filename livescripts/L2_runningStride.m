%[text] # Lesson 2. One running stride of the spring-mass model
%[text] The spring-loaded inverted pendulum (SLIP) represents a runner as a point mass on a massless spring leg (Blickhan 1989; McMahon and Cheng 1990). A stride runs from one apex of flight to the next and passes through three phases: descending flight, stance and ascending flight.
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
%[text] ## 1. The baseline gait
%[text] The baseline preset is a periodic gait of an 80 kg runner with a 1 m leg, at an average speed of 4 m/s and 3 steps per second. Its relative leg stiffness $k L_0 / (m g)$ is close to the value of 15 used by McMahon and Cheng (1990) for human running.
[p, apex] = slip_defaults("human");
fprintf('Leg stiffness %.0f N/m, relative stiffness %.1f\n', p.k, p.k * p.L0 / (p.m * p.g));
fprintf('Leg angle at apex %.2f deg, retraction %.1f deg/s, foot clearance at apex %.1f cm\n', ...
    p.legAngleDeg, p.retractionDegPerS, 100 * (apex.y - p.L0 * sind(p.legAngleDeg)));
%[text] The swing leg retracts (rotates rearward) from apex at a constant rate, the leg rotation rate measured at touchdown in humans running at 4 m/s (Blum et al. 2011). At apex the foot is held above the ground; the leg then reaches its touchdown angle as the body falls.
%[text] ## 2. Simulate one stride
M = slip_metrics(p, [apex.y; apex.vx]);
M.trace.events(:, {'time', 'from', 'guard', 'to'})
%[text] The table lists the three transitions of the stride: touchdown, takeoff and apex.
fprintf('Contact time %.3f s, flight time %.3f s, duty factor %.2f\n', M.contactTime, M.flightTime, M.dutyFactor);
fprintf('Peak vertical force %.2f body weights; leg compression %.1f %% of leg length\n', ...
    M.peakVerticalForceBW, M.legCompressionPct);
%[text] ## 3. Forces and energy
%[text] The leg pushes along its own axis. Early in stance the force points backward and slows the body (braking); late in stance it points forward (propulsion). Over a periodic stride the average vertical force equals body weight.
%[text] The body trades kinetic energy and gravitational potential energy with elastic energy in the spring. The model has no damping and no actuation, so the total mechanical energy is constant.
plotSlipStride(M, p, "Baseline gait");
fprintf('Mechanical energy change over the stride: %.1e J\n', M.energyChange);
%[text] ## 4. Phase portraits
%[text] A phase portrait plots one state against another as the stride unfolds. Panel A shows body height against vertical velocity. One stride of a periodic gait is a closed loop: descending flight, stance, then ascending flight back to the apex, where the vertical velocity is zero. Panel B shows leg angle against leg length, the format Blum et al. (2011) used for the strides of running humans and pheasants. In flight the leg stays at rest length while it retracts; in stance it shortens and sweeps from front to back; at apex it is reset to its starting angle, a jump drawn as a dotted line.
%[text] The overlay starts 2 cm higher with the same mechanical energy. Its apex points sit on the dotted line in panel A and are numbered by stride. Watch whether they approach the periodic loop and whether they alternate above and below it: that is the return map of Lesson 4, read on the phase portrait.
perturbation = 0.02;        % change in apex height for the overlay (m); 0 for none
showAnimation = false;      % true: a dot moves along both portraits with the runner
plotPhasePortraits(p, apex, struct('perturbation', perturbation, 'perturbStrides', 6, ...
    'animate', showAnimation, 'animateRun', "perturbed"));
%[text] ## Try this
%[text] Change `p.k` to 20000 and rerun: the stride is no longer periodic (see Lesson 4). Compare the peak force and contact time.
%[text] Set `showAnimation = true` to move a dot along both portraits in step with the runner.
%[text] Compare the overlay for the presets `"humanLowStiffness"` and `"humanHighStiffness"`.
%[text] Call `animateSlip(M, p)` to watch the stride.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
