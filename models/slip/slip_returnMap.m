function [sNext, info] = slip_returnMap(p, s, model)
%SLIP_RETURNMAP  Apex-to-apex return map of the SLIP runner.
%
%   [sNext, info] = slip_returnMap(p, s)
%   [sNext, info] = slip_returnMap(p, s, model)   % reuse a built model
%
%   s     : apex state [y; vx] (apex height in m, forward speed in m/s)
%   sNext : apex state one stride later, or [NaN; NaN] when the stride fails
%   info  : exitReason, period (s), meanSpeed (m/s), stepLength (m), and the
%           full hde.simulate result
%
%   A stride fails when the runner falls, reverses, or when the apex lies
%   below the touchdown height, so the foot would start below the ground
%   (exitReason "terminal:footBelowGround").

if nargin < 3 || isempty(model)
    model = slip_model(p);
end

x0 = slip_apexState(p, s(1), s(2));
info = struct('exitReason', "", 'period', NaN, 'meanSpeed', NaN, ...
    'stepLength', NaN, 'result', []);
sNext = [NaN; NaN];

opts = hde.solverDefaults(struct('outputStep', 0, 'maxCycles', 1, ...
    'check', false, 'timeLimit', 5));
r = hde.simulate(model, x0, opts);
info.exitReason = r.exitReason;
info.result = r;
if r.exitReason == "cycleLimit"
    sNext = [r.xEnd(2); r.xEnd(3)];
    info.period = r.tEnd;
    info.stepLength = r.xEnd(1) - x0(1);
    info.meanSpeed = info.stepLength / r.tEnd;
end
end
