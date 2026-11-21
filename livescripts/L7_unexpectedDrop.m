%[text] # Lesson 7. Unexpected drops in the ground
%[text] When the ground drops unexpectedly, the body falls for longer before the foot reaches the ground. A retracting leg keeps rotating during that extra time, so it lands at a steeper angle and with the body moving faster downward. Real animals can recover from a drop through muscle work and damping in the strides that follow, provided the leg makes contact in the stance right after the drop. This lesson therefore asks two questions about that first stance: does the leg make contact, and how large is the leg force?
here = fileparts(mfilename('fullpath'));
if isempty(here), here = pwd; end
run(fullfile(here, '..', 'setupHybridDynamics.m'));
names = ["humanLowStiffness", "human", "humanHighStiffness"];
%[text] ## 1. The first stance after a drop
%[text] For each preset and drop height, `slip_dropResponse` simulates the flight after apex over the lowered ground and the stance that follows, and reports whether the leg was loaded at or in front of vertical, its touchdown angle and the peak leg force. The same gait with a fixed leg angle (`slip_retractionRule` with rule "fixed") lands at its usual touchdown angle after every drop.
dropHeights = [0 0.05 0.10 0.20];      % m
for name = names
    [p, apex] = slip_defaults(name);
    q = slip_retractionRule(p, apex, "fixed");
    fprintf('%s\n', name);
    for h = dropHeights
        R = slip_dropResponse(p, apex, h);
        F = slip_dropResponse(q, apex, h);
        fprintf(['  drop %4.2f m: contact %d, touchdown angle %5.1f deg, peak leg force %.2f BW', ...
            ' (fixed leg angle: %.2f BW)\n'], h, R.firstContact, R.touchdownAngleDeg, R.peakLegForceBW, F.peakLegForceBW);
    end
end
%[text] With retraction, the leg lands steeper as the drop grows, and the steeper landing nearly offsets the faster downward speed at touchdown: the peak leg force stays close to its value in the steady gait. With a fixed leg angle, the same drops raise the peak leg force by tens of percent. In guinea fowl running over an unexpected drop, adjustment of limb contact angle accounted for 80 % of the variation in stance-phase limb loading after the drop (Daley and Biewener 2006).
%[text] ## 2. Normalized maximum drop: does the leg make contact?
%[text] Daley and Usherwood (2010) measured the first-contact limit with the normalized maximum drop: $\mathrm{NMD} = \Delta H_{max} / L$ with $\Delta H_{max} = \frac{g}{2} (\Phi / \bar{\omega})^2$, where $\Phi$ is the stance half-angle and $\bar{\omega}$ the leg retraction rate. For larger drops the leg rotates past vertical before contact and misses stance. The simulated value applies the same criterion to the actual flight path, which includes the downward speed at the usual touchdown and the rise of the hip as the leg rotates toward vertical.
for name = names
    [p, apex] = slip_defaults(name);
    D = slip_normalizedMaxDrop(p, apex);
    fprintf('%-20s stance half-angle %.1f deg; NMD estimate %.2f; simulated first contact %.2f\n', ...
        name, D.stanceHalfAngleDeg, D.estimateNMD, D.simulatedNMD);
end
%[text] The presets share one retraction rate, so the compliant leg, with its larger stance half-angle, has the largest NMD, the outcome Daley and Usherwood (2010) predicted. Lesson 6 shows how the retraction rate trades the NMD against the leg force after a drop.
%[text] ## Try this
%[text] Run `ex08_slip_dropStep` to plot the leg force in the first stance after each drop.
%[text] Repeat section 1 with the rules of Lesson 6 (`slip_retractionRule`) and compare the peak forces.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
