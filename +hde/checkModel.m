function checkModel(model, x0)
%CHECKMODEL  Check a hybrid model definition and report problems by name.
%
%   hde.checkModel(model)
%   hde.checkModel(model, x0)   % also evaluates the start phase at x0
%
%   Checks that phase names are unique, that every guard of every phase has
%   exactly one transition, that every transition starts and ends in a
%   defined phase (or "END"), and that startPhase and cyclePhase exist.
%   With x0, it also checks that the start phase's coordinate change,
%   flow and guard function return arrays of the expected size.

required = ["name" "stateNames" "phases" "transitions" "startPhase"];
for f = required
    if ~isfield(model, f)
        error('hde:checkModel:field', 'Model is missing the field "%s".', f);
    end
end

phaseNames = [model.phases.name];
if numel(unique(phaseNames)) ~= numel(phaseNames)
    error('hde:checkModel:duplicatePhase', 'Phase names must be unique: %s', ...
        strjoin(phaseNames, ', '));
end
if ~any(phaseNames == model.startPhase)
    error('hde:checkModel:startPhase', 'startPhase "%s" is not a phase name.', ...
        model.startPhase);
end
if isfield(model, 'cyclePhase') && strlength(model.cyclePhase) > 0 && ...
        ~any(phaseNames == model.cyclePhase)
    error('hde:checkModel:cyclePhase', 'cyclePhase "%s" is not a phase name.', ...
        model.cyclePhase);
end

trFrom  = [model.transitions.from];
trGuard = [model.transitions.guard];
trTo    = {model.transitions.to};

for i = 1:numel(model.phases)
    ph = model.phases(i);
    for g = ph.guards
        n = sum(trFrom == ph.name & trGuard == g);
        if n == 0
            error('hde:checkModel:missingTransition', ...
                'Phase "%s", guard "%s" has no transition.', ph.name, g);
        elseif n > 1
            error('hde:checkModel:duplicateTransition', ...
                'Phase "%s", guard "%s" has %d transitions; it needs one.', ...
                ph.name, g, n);
        end
    end
end

for j = 1:numel(model.transitions)
    if ~any(phaseNames == trFrom(j))
        error('hde:checkModel:transitionFrom', ...
            'Transition %d starts in unknown phase "%s".', j, trFrom(j));
    end
    ph = model.phases(phaseNames == trFrom(j));
    if ~any(ph.guards == trGuard(j))
        error('hde:checkModel:transitionGuard', ...
            'Transition %d uses guard "%s", which phase "%s" does not define.', ...
            j, trGuard(j), trFrom(j));
    end
    % A destination given as a function is checked when it is used.
    if ~isa(trTo{j}, 'function_handle') && trTo{j} ~= "END" && ...
            ~any(phaseNames == trTo{j})
        error('hde:checkModel:transitionTo', ...
            'Transition %d leads to unknown phase "%s".', j, trTo{j});
    end
end

if nargin > 1
    nStates = numel(model.stateNames);
    if numel(x0) ~= nStates
        error('hde:checkModel:x0', 'x0 has %d entries; the model has %d states.', ...
            numel(x0), nStates);
    end
    ph = model.phases(phaseNames == model.startPhase);
    [xl, data] = ph.toLocal(x0(:));
    dx = ph.flow(0, xl);
    if ~isequal(size(dx), size(xl))
        error('hde:checkModel:flowSize', ...
            'Phase "%s": flow returns %s for a local state of size %s.', ...
            ph.name, mat2str(size(dx)), mat2str(size(xl)));
    end
    if ~isempty(ph.guards)
        gv = ph.guardFcn(0, xl);
        if numel(gv) ~= numel(ph.guards)
            error('hde:checkModel:guardSize', ...
                'Phase "%s": guardFcn returns %d values for %d guards.', ...
                ph.name, numel(gv), numel(ph.guards));
        end
    end
    xg = ph.toGlobal(xl, data);
    if numel(xg) ~= nStates
        error('hde:checkModel:toGlobal', ...
            'Phase "%s": toGlobal returns %d states; the model has %d.', ...
            ph.name, numel(xg), nStates);
    end
end
end
