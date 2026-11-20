function result = simulate(model, x0, opts)
%SIMULATE  Integrate a hybrid model through its phases and transitions.
%
%   result = hde.simulate(model, x0)
%   result = hde.simulate(model, x0, opts)
%
%   model : hybrid model structure with fields
%       .name         model name
%       .stateNames   names of the global states
%       .phases       struct array built with hde.phase
%       .transitions  struct array built with hde.transition
%       .startPhase   name of the phase that holds x0
%       .cyclePhase   optional: each entry into this phase completes a cycle
%   x0    : initial state in global coordinates (column vector)
%   opts  : options from hde.solverDefaults (tolerances, output grid, limits)
%
%   result : structure with fields
%       .t, .x        output times (column) and global states (one column per
%                     time). Every transition time appears twice: once with
%                     the state before the transition, once with the state
%                     after its reset.
%       .phase        phase index at each output time; .phaseNames lists them
%       .events       table, one row per transition: time, from, guard, to,
%                     xBefore, xAfter
%       .exitReason   "cycleLimit", "timeLimit", "transitionLimit",
%                     "terminal:<guard>" (a transition to "END"), or
%                     "noEvent" (the solver stopped early with no event)
%       .nCycles      number of completed cycles
%       .tEnd, .xEnd  final time and state
%       .model, .x0, .opts   inputs, kept for provenance
%
%   A guard fires when its value crosses zero in its direction during the
%   phase, or at once on entry to the phase when the state already lies past
%   the guard by more than opts.entryTol (see docs/concepts.md).

%% ----- Options and checks -----
if nargin < 3 || isempty(opts)
    opts = hde.solverDefaults();
else
    opts = hde.solverDefaults(opts);
end
x0 = x0(:);
if opts.check
    hde.checkModel(model, x0);
end
if ~isfield(model, 'cyclePhase')
    model.cyclePhase = "";
end

phaseNames = [model.phases.name];
trFrom  = [model.transitions.from];
trGuard = [model.transitions.guard];
nStates = numel(x0);

%% ----- Simulation loop: one pass per phase -----
p = find(phaseNames == model.startPhase);
t = 0;
x = x0;
T = {}; X = {}; P = {};
ev = struct('time', {}, 'from', {}, 'guard', {}, 'to', {}, ...
    'xBefore', {}, 'xAfter', {});
nCycles = 0;
exitReason = "";

while exitReason == ""
    ph = model.phases(p);
    [xl, data] = ph.toLocal(x);

    % Guard already past zero on entry: fire at once (zero-duration phase).
    g = entryGuard(ph, t, xl, opts.entryTol);
    if g > 0
        te = t;
        xeLocal = xl;
        tg = t;
        xg = ph.toGlobal(xl, data);
    else
        % Integrate the phase until a guard fires or time runs out.
        odeOpt = odeset('RelTol', opts.relTol, 'AbsTol', opts.absTol, ...
            'MaxStep', min(ph.maxStep, opts.maxStep));
        if ~isempty(ph.guards)
            odeOpt = odeset(odeOpt, 'Events', ...
                @(tt, yy) guardEvents(tt, yy, ph));
        end
        sol = opts.solver(ph.flow, [t, opts.timeLimit], xl, odeOpt);

        if isfield(sol, 'ie') && ~isempty(sol.ie)
            te = sol.xe(end);
            simultaneous = sol.ie(sol.xe == te);
            g = min(simultaneous);
            if numel(unique(simultaneous)) > 1
                warning('hde:simulate:simultaneousGuards', ...
                    'Phase "%s": guards %s fired together at t = %.6g s; using "%s".', ...
                    ph.name, strjoin(ph.guards(unique(simultaneous)), ', '), te, ph.guards(g));
            end
            xeLocal = sol.ye(:, find(sol.xe == te, 1, 'last'));
        else
            g = 0;
            te = sol.x(end);
            xeLocal = sol.y(:, end);
        end

        % Output samples on the global grid, plus the exact phase start and end.
        if opts.outputStep > 0
            tg = (ceil(t / opts.outputStep) * opts.outputStep : opts.outputStep : te)';
            tg = unique([t; tg(tg > t & tg < te); te]);
            xLoc = deval(sol, tg');
            xLoc(:, end) = xeLocal;
        else
            tg = [t; te];
            xLoc = [xl, xeLocal];
            if te == t
                tg = t;
                xLoc = xl;
            end
        end
        xg = ph.toGlobal(xLoc, data);
    end

    T{end+1} = tg; %#ok<AGROW>
    X{end+1} = xg; %#ok<AGROW>
    P{end+1} = p * ones(numel(tg), 1); %#ok<AGROW>
    t = te;
    xBefore = ph.toGlobal(xeLocal, data);

    % No guard fired: time limit reached, or the solver stopped early.
    if g == 0
        x = xBefore;
        if te >= opts.timeLimit - 1e-12
            exitReason = "timeLimit";
        else
            exitReason = "noEvent";
            warning('hde:simulate:noEvent', ...
                'Phase "%s" ended at t = %.6g s with no guard event.', ph.name, te);
        end
        break
    end

    % Apply the transition for this phase and guard.
    gName = ph.guards(g);
    k = find(trFrom == ph.name & trGuard == gName, 1);
    tr = model.transitions(k);
    xAfter = xBefore;
    if ~isempty(tr.reset)
        xAfter = tr.reset(xBefore);
        xAfter = xAfter(:);
    end
    toName = tr.to;
    if isa(toName, 'function_handle')
        toName = string(toName(xAfter));
        if toName ~= "END" && ~any(phaseNames == toName)
            error('hde:simulate:transitionTo', ...
                'Transition from "%s" on "%s" returned unknown phase "%s".', ...
                ph.name, gName, toName);
        end
    end
    ev(end+1) = struct('time', te, 'from', ph.name, 'guard', gName, ...
        'to', toName, 'xBefore', xBefore(:)', 'xAfter', xAfter(:)'); %#ok<AGROW>
    x = xAfter;

    if toName == "END"
        exitReason = "terminal:" + gName;
    else
        p = find(phaseNames == toName);
        if toName == model.cyclePhase
            nCycles = nCycles + 1;
            if nCycles >= opts.maxCycles
                exitReason = "cycleLimit";
            end
        end
        if exitReason == "" && numel(ev) >= opts.maxTransitions
            exitReason = "transitionLimit";
        end
        if exitReason == "" && t >= opts.timeLimit
            exitReason = "timeLimit";
        end
    end
end

%% ----- Assemble the result -----
result.t = vertcat(T{:});
result.x = [X{:}];
result.phase = vertcat(P{:});
result.phaseNames = phaseNames;
if isempty(ev)
    result.events = table(zeros(0,1), strings(0,1), strings(0,1), strings(0,1), ...
        zeros(0, nStates), zeros(0, nStates), 'VariableNames', ...
        {'time', 'from', 'guard', 'to', 'xBefore', 'xAfter'});
else
    result.events = table([ev.time]', [ev.from]', [ev.guard]', [ev.to]', ...
        vertcat(ev.xBefore), vertcat(ev.xAfter), 'VariableNames', ...
        {'time', 'from', 'guard', 'to', 'xBefore', 'xAfter'});
end
% Append the state after the last reset so that xEnd is the final state.
if ~isempty(ev) && exitReason ~= "noEvent" && exitReason ~= "timeLimit"
    result.t(end+1, 1) = t;
    result.x(:, end+1) = x;
    result.phase(end+1, 1) = p;
end
result.exitReason = exitReason;
result.nCycles = nCycles;
result.tEnd = t;
result.xEnd = x;
result.model = model.name;
result.x0 = x0;
result.opts = opts;
end

%% ===== Local functions =====
function [value, isterminal, direction] = guardEvents(t, xl, ph)
% Event function for the ODE solver: every guard stops the integration.
value = ph.guardFcn(t, xl);
value = value(:);
isterminal = ones(numel(value), 1);
direction = ph.guardDirection(:);
end

function g = entryGuard(ph, t, xl, tol)
% Index of the first guard that the state already lies past, or 0.
g = 0;
if isempty(ph.guards)
    return
end
v = ph.guardFcn(t, xl);
d = ph.guardDirection(:);
past = (d < 0 & v(:) < -tol) | (d > 0 & v(:) > tol);
if any(past)
    g = find(past, 1);
end
end
