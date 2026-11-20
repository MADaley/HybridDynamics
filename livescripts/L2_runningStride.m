%[text] # Lesson 2. One running stride of the spring-mass model
%[text] The spring-loaded inverted pendulum (SLIP) represents a runner as a point mass on a massless spring leg (Blickhan 1989; McMahon and Cheng 1990). A stride runs from one apex of flight to the next and passes through three phases: descending flight, stance and ascending flight.
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
%[text] ## 1. The baseline gait
%[text] The baseline preset is a periodic gait of an 80 kg runner with a 1 m leg, at an average speed of 4 m/s and 3 steps per second. Its relative leg stiffness $k L_0 / (m g)$ is close to the value of 15 used by McMahon and Cheng (1990) for human running.
[p, apex] = slip_defaults("human");
fprintf('Leg stiffness %.0f N/m, relative stiffness %.1f, leg angle at apex %.2f deg\n', ...
    p.k, p.k * p.L0 / (p.m * p.g), p.legAngleDeg);
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
%[text] ## Try this
%[text] Change `p.k` to 20000 and rerun: the stride is no longer periodic (see Lesson 4). Compare the peak force and contact time.
%[text] Call `animateSlip(M, p)` to watch the stride.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
