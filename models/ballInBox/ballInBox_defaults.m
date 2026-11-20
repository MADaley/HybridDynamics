function [p, x0, spec] = ballInBox_defaults()
%BALLINBOX_DEFAULTS  Default parameters and initial state for the ball in a box.
%
%   [p, x0, spec] = ballInBox_defaults()
%
%   p    : parameter struct for ballInBox_model
%   x0   : initial state [x; y; vx; vy]
%   spec : table of every setting: name, value, units, min, max, group,
%          description. The interactive web page uses the same table.
%
%   Values match the legacy Example_BallInBox.m (2012).

%            name           value   units    min    max   group                 description
rows = {
    "g",            9.81,  "m/s^2",  0,    20,  "parameter",          "gravitational acceleration"
    "radius",       1.0,   "m",      0.1,  2,   "parameter",          "ball radius"
    "restitution",  0.8,   "-",      0,    1,   "contact condition",  "fraction of normal speed kept at each impact"
    "restSpeed",    0.01,  "m/s",    0,    0.5, "contact condition",  "rebound speed below which the ball comes to rest on the floor"
    "xMin",         0,     "m",      0,    0,   "parameter",          "left wall position"
    "xMax",         10,    "m",      5,    20,  "parameter",          "right wall position"
    "yMin",         0,     "m",      0,    0,   "parameter",          "floor height"
    "yMax",         10,    "m",      5,    20,  "parameter",          "ceiling height"
    "x0",           5,     "m",      1,    9,   "initial condition",  "initial horizontal position"
    "y0",           5,     "m",      1,    9,   "initial condition",  "initial height"
    "vx0",          -6.5,  "m/s",    -15,  15,  "initial condition",  "initial horizontal velocity"
    "vy0",          10,    "m/s",    -15,  15,  "initial condition",  "initial vertical velocity"};
spec = cell2table(rows, 'VariableNames', ...
    {'name', 'value', 'units', 'min', 'max', 'group', 'description'});

for i = 1:height(spec)
    v.(spec.name(i)) = spec.value(i);
end
p = rmfield(v, ["x0" "y0" "vx0" "vy0"]);
x0 = [v.x0; v.y0; v.vx0; v.vy0];
end
