function tr = transition(from, guard, to, reset, opts)
%TRANSITION  Define what happens when a guard fires.
%
%   tr = hde.transition(from, guard, to)
%   tr = hde.transition(from, guard, to, reset, description="...")
%
%   from  : name of the phase in which the guard fires
%   guard : name of the guard (one of the phase's guards)
%   to    : name of the next phase, or "END" to stop the simulation.
%           A stop through "END" sets result.exitReason to
%           "terminal:<guard>", for example "terminal:fall".
%           to can also be @(xAfter) phaseName, a function of the state
%           after the reset, when the next phase depends on the state
%           (for example, a ball that rebounds or comes to rest).
%   reset : optional @(xGlobal) xGlobal applied at the transition, for
%           example an impact law or a leg placement rule. Default: none.

arguments
    from (1,1) string
    guard (1,1) string
    to
    reset = []
    opts.description (1,1) string = ""
end

if ~isempty(reset) && ~isa(reset, 'function_handle')
    error('hde:transition:reset', 'reset must be a function handle or [].');
end
if ~isa(to, 'function_handle')
    to = string(to);
end

tr = struct('from', from, 'guard', guard, 'to', to, 'reset', {reset}, ...
    'description', opts.description);
end
