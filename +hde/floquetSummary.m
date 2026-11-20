function S = floquetSummary(J, conservative)
%FLOQUETSUMMARY  Interpret the eigenvalues of a return-map Jacobian.
%
%   S = hde.floquetSummary(J)
%   S = hde.floquetSummary(J, conservative)
%
%   J            : return-map Jacobian at a fixed point (hde.returnMapJacobian)
%   conservative : true when the model conserves mechanical energy. One
%                  eigenvalue then equals 1: a perturbation that changes the
%                  energy neither grows nor decays. That eigenvalue is
%                  reported as the neutral energy mode and left out of the
%                  stability test. Default false.
%
%   S.eigenvalues   eigenvalues sorted by magnitude, largest first
%   S.neutralIndex  index of the neutral energy mode (conservative only)
%   S.maxMagnitude  largest magnitude among the remaining eigenvalues
%   S.isStable      true when that magnitude is below 1: small perturbations
%                   shrink from stride to stride
%   S.text          one-line summary

if nargin < 2, conservative = false; end
lam = eig(J);
[~, order] = sort(abs(lam), 'descend');
lam = lam(order);

S.eigenvalues = lam;
S.neutralIndex = [];
others = lam;
if conservative && ~isempty(lam)
    [~, S.neutralIndex] = min(abs(lam - 1));
    others(S.neutralIndex) = [];
end
if isempty(others)
    S.maxMagnitude = NaN;
else
    S.maxMagnitude = max(abs(others));
end
S.isStable = S.maxMagnitude < 1;

if S.isStable
    verdict = "locally stable";
else
    verdict = "not locally stable";
end
S.text = sprintf("Largest |eigenvalue| (excluding the neutral energy mode) = %.4f: %s.", ...
    S.maxMagnitude, verdict);
if ~conservative
    S.text = sprintf("Largest |eigenvalue| = %.4f: %s.", S.maxMagnitude, verdict);
end
end
