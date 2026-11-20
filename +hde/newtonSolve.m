function [z, info] = newtonSolve(F, z0, opts)
%NEWTONSOLVE  Solve F(z) = 0 by damped Gauss-Newton (Levenberg-Marquardt).
%
%   [z, info] = hde.newtonSolve(F, z0)
%   [z, info] = hde.newtonSolve(F, z0, opts)
%
%   F    : @(z) residual column vector. Return NaN entries when the model
%          fails (for example, the runner falls); the solver then shortens
%          the step.
%   z0   : starting guess (column vector)
%   opts : struct with optional fields
%          tol      residual norm at which iteration stops (1e-10)
%          acceptTol  residual norm accepted as converged when no further
%                   step reduces the residual, the noise floor set by the
%                   integration tolerance (1e-7)
%          stepTol  relative step size treated as converged (1e-12)
%          maxIter  iteration limit (60)
%          fdStep   finite-difference step, scalar or one per unknown (1e-6)
%          verbose  print progress (false)
%
%   info : struct with fields converged, residualNorm, iterations, message
%
%   Uses central finite differences for the Jacobian and needs no toolbox.

if nargin < 3, opts = struct(); end
def = struct('tol', 1e-10, 'acceptTol', 1e-7, 'stepTol', 1e-12, 'maxIter', 60, ...
    'fdStep', 1e-6, 'verbose', false);
for f = fieldnames(def)'
    if ~isfield(opts, f{1}), opts.(f{1}) = def.(f{1}); end
end

z = z0(:);
n = numel(z);
h = opts.fdStep(:) .* ones(n, 1);
r = F(z);
info = struct('converged', false, 'residualNorm', norm(r), ...
    'iterations', 0, 'message', "");
if any(~isfinite(r))
    info.message = "Model failed at the starting guess.";
    return
end

lambda = 1e-3;
for iter = 1:opts.maxIter
    info.iterations = iter;
    if norm(r) < opts.tol
        info.converged = true;
        info.message = "Residual below tolerance.";
        break
    end

    % Jacobian by central differences.
    J = zeros(numel(r), n);
    for j = 1:n
        e = zeros(n, 1);
        e(j) = h(j);
        J(:, j) = (F(z + e) - F(z - e)) / (2 * h(j));
    end
    if any(~isfinite(J(:)))
        info.message = "Model failed near the current point.";
        break
    end

    % Damped step; increase damping until the residual decreases.
    A = J' * J;
    b = -J' * r;
    accepted = false;
    for tries = 1:12
        dz = (A + lambda * diag(max(diag(A), eps))) \ b;
        rNew = F(z + dz);
        if all(isfinite(rNew)) && norm(rNew) < norm(r)
            accepted = true;
            break
        end
        lambda = lambda * 10;
    end
    if ~accepted
        info.message = "No step reduced the residual.";
        break
    end
    z = z + dz;
    r = rNew;
    lambda = max(lambda / 10, 1e-12);
    if opts.verbose
        fprintf('  iter %2d  |r| = %.3e  |dz| = %.3e\n', iter, norm(r), norm(dz));
    end
    if norm(dz) < opts.stepTol * (1 + norm(z))
        info.message = "Step size below tolerance.";
        break
    end
end
info.residualNorm = norm(r);
if info.message == ""
    info.message = "Iteration limit reached.";
end
info.converged = norm(r) < opts.tol || ...
    (norm(r) < opts.acceptTol && info.message ~= "Model failed near the current point.");
end
