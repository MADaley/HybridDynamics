function [p, apex, spec, presets] = slip_defaults(preset)
%SLIP_DEFAULTS  Parameters, apex state and setting ranges for the SLIP runner.
%
%   [p, apex, spec, presets] = slip_defaults()            % "human" preset
%   [p, apex, spec, presets] = slip_defaults("humanHighStiffness")
%
%   Presets (models/slip/slip_presets.csv, written by
%   tools/slip_computePresets.m) are periodic gaits of an 80 kg runner with
%   a 1 m leg at an average speed of 4 m/s and 3 steps per second:
%     "human"               leg stiffness 12 kN/m (k L0 / m g = 15.3)
%     "humanLowStiffness"   8 kN/m
%     "humanHighStiffness"  20 kN/m
%
%   p       : model parameters: m, L0, k, g, legAngleDeg, retractionDegPerS
%   apex    : initial condition at apex: y (m), vx (m/s)
%   spec    : one row per setting: name, value, units, min, max, group,
%             description. Groups match the script template and the web
%             page: "parameter", "contact condition", "initial condition".
%   presets : the full preset table

if nargin < 1 || strlength(preset) == 0
    preset = "human";
end

presetFile = fullfile(fileparts(mfilename('fullpath')), 'slip_presets.csv');
presets = readtable(presetFile, 'TextType', 'string');
row = presets(presets.name == preset, :);
if isempty(row)
    error('slip_defaults:preset', 'Unknown preset "%s". Available: %s', ...
        preset, strjoin(presets.name, ', '));
end

%% ===== Parameters =====
p.m                 = row.m;                 % body mass (kg)
p.L0                = row.L0;                % leg rest length (m)
p.k                 = row.k;                 % leg stiffness (N/m)
p.g                 = row.g;                 % gravitational acceleration (m/s^2)

%% ===== Contact conditions =====
p.legAngleDeg       = row.legAngleDeg;       % leg angle set at apex (deg from ground, in front)
p.retractionDegPerS = row.retractionDegPerS; % leg rotation rate in descending flight (deg/s)

%% ===== Initial conditions (apex of flight) =====
apex.y  = row.apexHeight;                    % apex height (m)
apex.vx = row.apexSpeed;                     % forward speed at apex (m/s)

%% ===== Setting ranges, units and descriptions =====
%            name                 value                 units    min    max     group                description
rows = {
    "m",                  p.m,                  "kg",    1,     150,    "parameter",         "body mass"
    "L0",                 p.L0,                 "m",     0.1,   2,      "parameter",         "leg rest length"
    "k",                  p.k,                  "N/m",   1000,  60000,  "parameter",         "leg stiffness"
    "g",                  p.g,                  "m/s^2", 1,     20,     "parameter",         "gravitational acceleration"
    "legAngleDeg",        p.legAngleDeg,        "deg",   30,    89,     "contact condition", "leg angle set at apex, from the ground in front of the body"
    "retractionDegPerS",  p.retractionDegPerS,  "deg/s", -200,  800,    "contact condition", "rearward leg rotation rate during descending flight"
    "apexHeight",         apex.y,               "m",     0.2,   2,      "initial condition", "height of the body at apex"
    "apexSpeed",          apex.vx,              "m/s",   0.2,   10,     "initial condition", "forward speed at apex"};
spec = cell2table(rows, 'VariableNames', ...
    {'name', 'value', 'units', 'min', 'max', 'group', 'description'});
end
