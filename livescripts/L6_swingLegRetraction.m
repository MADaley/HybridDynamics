%[text] # Lesson 6. Choosing swing-leg retraction rate
%[text] Running animals rotate the leg rearward before ground contact (swing-leg retraction). In the model, the leg is set to an angle at apex and rotates at a constant rate during the descending flight, so the touchdown angle depends on how long the body falls (Seyfarth et al. 2003). For a periodic gait the rate can take many values: the leg angle at apex is set so that the leg reaches the same touchdown angle at the same moment, and the gait itself stays the same. The rate changes how the runner responds to perturbations. Which rate should a runner choose?
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
[p, apex] = slip_defaults("human");
%[text] ## 1. Five rules for the retraction rate
%[text] Fixed leg angle: no retraction. Human data: the leg rotation rate measured at touchdown in humans running at 4 m/s, 82 degrees per gait cycle (Blum et al. 2011). Foot clearance: the rate that holds the foot 5 cm above the ground at apex. Fastest recovery: the rate at which the stride-to-stride eigenvalue $\lambda$ is zero, so an error in apex height is corrected in one stride. Ground speed matching: the rate at which the foot meets the ground as slowly as a leg of constant length allows, measured by $\mathrm{GSM} = 1 - |v_{foot}| / |v_{CoM}|$ at touchdown (Blum et al. 2010).
rules = slip_defaultRetractionRules();
T = slip_compareRetractionRules(p, apex, rules, struct('dropHeight', 0.05));
T(:, ["name" "retractionDegPerS" "retractionDegPerCycle" "apexClearance" "groundSpeedMatching" "lambda" "nmdEstimate" "peakForceAfterDropBW"])
%[text] ## 2. Trade-offs
%[text] Slow retraction keeps the leg near its touchdown angle for longer, so after an unexpected drop the leg still lands in front of the body: the normalized maximum drop (NMD) is large. It also lands steeply after the longer fall, so the leg force after a drop is high. Fast retraction lowers the leg force after a drop and brings the foot speed closer to the ground speed, at the cost of a small NMD. Daley and Usherwood (2010) described this trade-off between fall risk and injury risk. In this conservative model, fast retraction also drives $\lambda$ below $-1$: the runner overcorrects each stride.
W = slip_retractionSweep(p, apex, 0:10:250, struct('dropHeight', 0.05));
St = daleyStyle('teaching');
f = St.figure('double', 1, 0.45);
tl = tiledlayout(f, 1, 3, 'TileSpacing', 'compact', 'Padding', 'compact');
cols = ["lambda" "nmdEstimate" "peakForceAfterDropBW"];
labels = ["Eigenvalue \lambda" "NMD estimate" "Peak force after 5 cm drop (BW)"];
for i = 1:3
    ax = nexttile(tl); hold(ax, 'on');
    y = W.(cols(i)); y(~isfinite(y)) = NaN;
    if cols(i) == "lambda", yline(ax, [-1 0 1], ':', 'Color', St.col.grey, 'LineWidth', St.reflinewidth); end
    a = St.series(1); plot(ax, W.retractionDegPerS, y, a{:});
    if cols(i) == "nmdEstimate", ylim(ax, [0 3]); end
    xlabel(ax, 'Retraction rate (deg/s)'); ylabel(ax, labels(i)); St.apply(ax);
end
%[text] ## 3. What runners do
%[text] Blum et al. (2011) measured leg rotation at touchdown in running humans and pheasants. Their values are in degrees per gait cycle; dividing by this gait's cycle converts them to deg/s. Rates per gait cycle compare animals of different size through dynamic similarity; at dynamically similar speeds large birds use relatively higher stride frequencies than small birds (Daley and Birn-Jeffery 2018), so this scaling is an approximation.
D = readtable(fullfile(here, '..', 'data', 'swingLegKinematics_Blum2011.csv'), 'TextType', 'string');
cycle = T.retractionDegPerCycle(2) / T.retractionDegPerS(2);
D.legRotation_degPerSecondHere = D.legRotation_degPerCycle / cycle;
D(:, ["species" "speed_mps" "touchdownAngle_deg" "legRotation_degPerCycle" "legRotation_degPerSecondHere" "groundSpeedMatching_pct" "nmd"])
%[text] At 4 m/s the human rate lies between the rate for fastest recovery and the rate for the largest ground speed matching. In this model it gives a ground speed matching and an NMD close to the human values in the table, and a $\lambda$ near $-1$. Real runners have more control than the model: humans shorten the leg before contact and pheasants lengthen it, and Blum et al. (2011) proposed that humans also adjust leg stiffness in anticipation of contact. Pheasants run with flatter touchdown angles and faster leg rotation per gait cycle, and they lengthen the leg before contact; in that study this combination, with leg lengthening the largest influence, gave them the larger NMD. On uneven ground, humans and cursorial birds use similar swing-leg adaptations of leg angle and leg length, and the crouched avian leg has the greater range of adjustment for drops (Müller et al. 2016).
%[text] Guinea fowl stepping down a visible drop used swing-leg trajectories that matched simulations optimized to regulate leg loading, and did not match those optimized for steady gait (Blum et al. 2014); Vejdani et al. (2013) turned such load-regulating policies into swing-leg control for robots. The rule for fastest recovery here plays the role of steady gait.
%[text] ## Try this
%[text] Repeat for `"humanLowStiffness"`: with no retraction its $\lambda$ is already negative, so the rule for fastest recovery returns zero retraction.
%[text] Run `ex07_slip_retraction` to plot every measure against retraction rate with the human and pheasant ranges.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
