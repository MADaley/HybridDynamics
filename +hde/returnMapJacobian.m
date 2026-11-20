function [J, info] = returnMapJacobian(P, s, h)
%RETURNMAPJACOBIAN  Jacobian of a return (Poincare) map by central differences.
%
%   [J, info] = hde.returnMapJacobian(P, s)
%   [J, info] = hde.returnMapJacobian(P, s, h)
%
%   P : @(s) next-section state, the map from one crossing of the Poincare
%       section to the next (for a runner, apex to apex). P must rebuild any
%       coupled states (for example foot position) from s.
%   s : section coordinates at the fixed point (column vector)
%   h : perturbation size, scalar or one per coordinate (default 1e-6)
%
%   info.consistency compares J with a second estimate at 10 times the step.
%   Values below about 1e-4 indicate that integration error does not
%   dominate the finite differences.

if nargin < 3 || isempty(h), h = 1e-6; end
s = s(:);
n = numel(s);
h = h(:) .* ones(n, 1);

J = estimate(P, s, h);
J10 = estimate(P, s, 10 * h);
info.consistency = norm(J - J10) / max(norm(J), eps);
info.step = h;
end

function J = estimate(P, s, h)
n = numel(s);
J = zeros(n);
for j = 1:n
    e = zeros(n, 1);
    e(j) = h(j);
    J(:, j) = (P(s + e) - P(s - e)) / (2 * h(j));
end
end
