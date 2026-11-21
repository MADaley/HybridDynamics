function [q, info] = slip_retractionRule(p, apex, rule, value)
%SLIP_RETRACTIONRULE  Set the swing-leg retraction rate of a periodic gait by a rule.
%
%   [q, info] = slip_retractionRule(p, apex, rule)
%   [q, info] = slip_retractionRule(p, apex, rule, value)
%
%   p, apex : a periodic gait (parameters and apex state, struct with y, vx)
%   rule    : how the retraction rate omega is chosen
%       "fixed"            omega = 0: the leg angle at apex is the touchdown
%                          angle
%       "common"           omega = value (deg/s), the same for every gait
%       "commonPerCycle"   omega = value / T, with value in degrees per gait
%                          cycle and T the gait cycle (two steps) of this
%                          gait; the unit of the swing-leg data in Blum et
%                          al. (2011)
%       "clearance"        the rate that holds the foot value (m) above the
%                          ground at apex (slip_retractionForClearance)
%       "fastestRecovery"  the rate (omega >= 0) at which the eigenvalue of
%                          the apex return map is zero: an error in apex
%                          height is corrected in one stride. If the
%                          eigenvalue is already negative at omega = 0,
%                          retraction only moves it further from zero, and
%                          the rule returns omega = 0.
%       "groundSpeedMatching"  the rate with the largest ground speed
%                          matching at touchdown, GSM = 1 - |v_foot|/|v_CoM|
%                          (Blum et al. 2010, 2011): the foot meets the
%                          ground as slowly as a leg of constant length
%                          allows (slip_groundSpeedMatching)
%
%   Every rule keeps the periodic gait: the leg angle at apex is set so the
%   leg reaches the same touchdown angle at the same touchdown time
%   (slip_setRetraction). Only the response to perturbations changes.
%
%   q    : parameters with legAngleDeg (at apex) and retractionDegPerS set
%   info : rule, retractionDegPerS, retractionDegPerCycle, apexClearance
%          (m), gsm (ground speed matching at touchdown), lambda, note
%
%   See also slip_setRetraction, slip_retractionForClearance, slip_stability

if nargin < 4, value = NaN; end
rule = string(rule);
info.rule = rule;
info.note = "";
[~, td] = slip_setRetraction(p, apex, 0);

switch rule
    case "fixed"
        omega = 0;
    case "common"
        omega = value;
    case "commonPerCycle"
        omega = value / gaitCycle(p, apex);
    case "clearance"
        q = slip_retractionForClearance(p, apex, value);
        omega = q.retractionDegPerS;
    case "groundSpeedMatching"
        G = slip_groundSpeedMatching(slip_setRetraction(p, apex, 0), apex);
        omega = G.omegaMaxGsmDegPerS;
    case "fastestRecovery"
        lam = @(w) lambdaAt(p, apex, w);
        lam0 = lam(0);
        if lam0 <= 0
            omega = 0;
            info.note = "lambda is already negative with no retraction; " + ...
                "retraction moves it further from zero";
        else
            % lambda falls as retraction increases; bracket the zero.
            wHi = 20;
            while lam(wHi) > 0 && wHi < 2000
                wHi = 2 * wHi;
            end
            omega = fzero(lam, [0 wHi], optimset('TolX', 1e-6));
        end
    otherwise
        error('slip_retractionRule:rule', 'Unknown rule "%s".', rule);
end

q = slip_setRetraction(p, apex, omega);
info.retractionDegPerS = q.retractionDegPerS;
info.retractionDegPerCycle = q.retractionDegPerS * gaitCycle(p, apex);
info.apexClearance = apex.y - q.L0 * sind(q.legAngleDeg);
G = slip_groundSpeedMatching(q, apex);
info.gsm = G.gsm;
S = slip_stability(q, [apex.y; apex.vx], struct('jacobian', false, 'terrain', false));
info.lambda = S.lambda;
end

function T = gaitCycle(p, apex)
% Gait cycle of a biped: two steps (two apex-to-apex periods).
[~, m] = slip_returnMap(p, [apex.y; apex.vx]);
T = 2 * m.period;
end

function l = lambdaAt(p, apex, w)
q = slip_setRetraction(p, apex, w);
S = slip_stability(q, [apex.y; apex.vx], struct('jacobian', false, 'terrain', false));
l = S.lambda;
end
