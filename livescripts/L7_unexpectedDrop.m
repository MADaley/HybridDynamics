%[text] # Lesson 7. Unexpected drops in the ground
%[text] An unexpected drop in ground height adds gravitational potential energy: at the next apex the body is higher above the new ground at the same forward speed. The model has no damping and no actuation, so it cannot remove that energy. A stable runner settles into a new, faster gait; an unstable one falls.
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
%[text] ## 1. One drop, three legs
dropHeight = 0.05;      % m
nStrides = 15;
names = ["humanLowStiffness", "human", "humanHighStiffness"];
for name = names
    [p, apex] = slip_defaults(name);
    model = slip_model(p);
    s = [apex.y + dropHeight; apex.vx];
    n = 0;
    for i = 1:nStrides
        [s, info] = slip_returnMap(p, s, model);
        if any(isnan(s)), break, end
        n = i;
    end
    if n == nStrides
        fprintf('%-20s survived %d strides; final apex speed %.3f m/s\n', name, n, s(2));
    else
        fprintf('%-20s failed on stride %d after the drop (%s)\n', name, n + 1, info.exitReason);
    end
end
%[text] The failure mode `footBelowGround` means that the next apex was lower than the height needed to place the leg at its apex angle: the foot would meet the ground before the leg is placed. With swing-leg retraction at the human rate the presets hold the foot several centimeters above the ground at apex, so this failure needs an apex that falls that far below the periodic gait. After a drop the body falls longer, the retracting leg lands steeper, and the next apex undershoots.
%[text] ## 2. Largest drop survived
for name = names
    [p, apex] = slip_defaults(name);
    S = slip_stability(p, [apex.y; apex.vx], struct('jacobian', false));
    fprintf('%-20s largest drop survived for 20 strides: %.2f m (first failure: %s)\n', name, S.maxDrop, S.dropFailure);
end
%[text] ## 3. Normalized maximum drop: does the leg make contact?
%[text] Real animals are not conservative spring-mass systems. After an unexpected drop they can recover through muscle work and damping in the strides that follow, provided the leg makes contact in the stance right after the drop. Daley and Usherwood (2010) measured that first-contact limit with the normalized maximum drop: $\mathrm{NMD} = \Delta H_{max} / L$ with $\Delta H_{max} = \frac{g}{2} (\Phi / \bar{\omega})^2$, where $\Phi$ is the stance half-angle and $\bar{\omega}$ the leg retraction rate. For larger drops the leg rotates past vertical before contact and misses stance.
%[text] The estimate below uses each gait's own retraction rate and, for comparison at one rate as in the paper, the baseline rate. The simulated value applies the same criterion to the actual flight path, which includes the downward speed at the usual touchdown and the rise of the hip as the leg rotates toward vertical.
[~, ~, ~, presets] = slip_defaults();
wRef = presets.retractionDegPerS(presets.name == "human");
for name = names
    [p, apex] = slip_defaults(name);
    D = slip_normalizedMaxDrop(p, apex, struct('referenceRetractionDegPerS', wRef));
    fprintf('%-20s NMD estimate %.2f (at %.0f deg/s: %.2f); simulated first contact %.2f\n', ...
        name, D.estimateNMD, wRef, D.estimateDropAtReference / p.L0, D.simulatedNMD);
end
%[text] The presets share one retraction rate, so the compliant leg has the largest NMD, the outcome Daley and Usherwood (2010) predicted. Lesson 6 shows how the ranking changes when each gait gets its own rate. The conservative 20-stride test above gives far smaller drops: it asks for recovery with no muscle work at all.
%[text] ## Try this
%[text] Run `ex08_slip_dropStep` to plot apex height and speed stride by stride.
%[text] In guinea fowl running over an unexpected drop, adjustment of limb contact angle accounted for 80 % of the variation in stance-phase limb loading after the drop (Daley and Biewener 2006). Use Lesson 3 to explore how the leg angle changes peak force after a drop.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
