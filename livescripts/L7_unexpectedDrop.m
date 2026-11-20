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
        fprintf('%-20s failed after %d strides (%s)\n', name, n, info.exitReason);
    end
end
%[text] ## 2. Largest drop survived
for name = names
    [p, apex] = slip_defaults(name);
    S = slip_stability(p, [apex.y; apex.vx], struct('jacobian', false));
    fprintf('%-20s largest drop survived for 20 strides: %.2f m\n', name, S.maxDrop);
end
%[text] ## Try this
%[text] Run `ex08_slip_dropStep` to plot apex height and speed stride by stride.
%[text] In guinea fowl running over an unexpected drop, adjustment of limb contact angle accounted for 80 % of the variation in stance-phase limb loading after the drop (Daley and Biewener 2006). Use Lesson 3 to explore how the leg angle changes peak force after a drop.

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline"}
%---
