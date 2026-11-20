function opts = solverDefaults(overrides)
%SOLVERDEFAULTS  Default solver, output and stopping options for hde.simulate.
%
%   opts = hde.solverDefaults()
%   opts = hde.solverDefaults(overrides)   % struct with fields to change
%
%   Fields
%   solver         : ODE solver handle with the ode45 calling syntax (@ode45)
%   relTol, absTol : integration tolerances (1e-10, 1e-12). Loose values
%                    cause energy drift in conservative models; 1e-3 (the
%                    ode45 default) adds about 1 J per stride to an 80 kg
%                    spring-mass runner.
%   maxStep        : largest solver step in every phase (Inf). Phases can
%                    set a smaller value of their own (hde.phase maxStep).
%   outputStep     : spacing of the output time grid (1e-3 s). Transition
%                    times are always added. 0 returns only the start and
%                    end of each phase, which is fastest for searches.
%   timeLimit      : simulation end time (10 s)
%   maxCycles      : stop after this many entries into model.cyclePhase (Inf)
%   maxTransitions : stop after this many transitions (1000)
%   entryTol       : a guard that is already past zero by more than this at
%                    the start of a phase fires immediately (1e-9)
%   check          : run hde.checkModel before simulating (true)

opts = struct( ...
    'solver',         @ode45, ...
    'relTol',         1e-10, ...
    'absTol',         1e-12, ...
    'maxStep',        Inf, ...
    'outputStep',     1e-3, ...
    'timeLimit',      10, ...
    'maxCycles',      Inf, ...
    'maxTransitions', 1000, ...
    'entryTol',       1e-9, ...
    'check',          true);

if nargin < 1 || isempty(overrides)
    return
end

names = fieldnames(overrides);
for i = 1:numel(names)
    if ~isfield(opts, names{i})
        error('hde:solverDefaults:unknown', ...
            'Unknown option "%s". Valid options: %s', names{i}, ...
            strjoin(fieldnames(opts), ', '));
    end
    opts.(names{i}) = overrides.(names{i});
end
end
