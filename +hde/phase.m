function ph = phase(name, flow, opts)
%PHASE  Define one continuous phase of a hybrid model.
%
%   ph = hde.phase(name, flow, Name=Value)
%
%   name  : phase name, for example "stance"
%   flow  : @(t, xLocal) dxLocal, the equations of motion in this phase,
%           written in the phase's local coordinates
%
%   Name-value options
%   guards         : names of the events that can end the phase
%   guardFcn       : @(t, xLocal) column vector of guard values, one per guard.
%                    A guard fires when its value crosses zero in the
%                    direction given by guardDirection.
%   guardDirection : -1 (value decreasing through zero, the default),
%                    +1 (increasing) or 0 (either), one entry per guard
%   toLocal        : @(xGlobal) [xLocal, data], change to local coordinates.
%                    data carries anything toGlobal needs (for example a
%                    foot position). Default: identity.
%   toGlobal       : @(xLocal, data) xGlobal, accepts one state per column.
%                    Default: identity.
%   maxStep        : largest solver step in this phase (s). Set a finite
%                    value when a guard value can dip below zero and return
%                    within one solver step (see docs/concepts.md).
%   description    : one-line description for documentation and diagrams
%
%   Example
%     ph = hde.phase("flight", @(t,x) [x(3); x(4); 0; -9.81], ...
%            guards="landing", guardFcn=@(t,x) x(2));

arguments
    name (1,1) string
    flow (1,1) function_handle
    opts.guards (1,:) string = string.empty(1,0)
    opts.guardFcn = []
    opts.guardDirection (1,:) double = []
    opts.toLocal = []
    opts.toGlobal = []
    opts.maxStep (1,1) double {mustBePositive} = Inf
    opts.description (1,1) string = ""
end

nGuards = numel(opts.guards);
if nGuards > 0 && isempty(opts.guardFcn)
    error('hde:phase:noGuardFcn', ...
        'Phase "%s" names guards but has no guardFcn.', name);
end
if isempty(opts.guardDirection)
    opts.guardDirection = -ones(1, nGuards);
elseif numel(opts.guardDirection) ~= nGuards
    error('hde:phase:guardDirection', ...
        'Phase "%s": guardDirection needs one entry per guard (%d).', name, nGuards);
end
if isempty(opts.toLocal)
    opts.toLocal = @(x) deal(x, []);
end
if isempty(opts.toGlobal)
    opts.toGlobal = @(xLocal, data) xLocal;
end

ph = struct( ...
    'name',           name, ...
    'flow',           flow, ...
    'guards',         opts.guards, ...
    'guardFcn',       opts.guardFcn, ...
    'guardDirection', opts.guardDirection, ...
    'toLocal',        opts.toLocal, ...
    'toGlobal',       opts.toGlobal, ...
    'maxStep',        opts.maxStep, ...
    'description',    opts.description);
end
