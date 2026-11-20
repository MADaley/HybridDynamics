function [p, x0, spec] = pendulum_defaults()
%PENDULUM_DEFAULTS  Default parameters and initial state for the pendulum.
%
%   [p, x0, spec] = pendulum_defaults()
%
%   p    : parameter struct for pendulum_model
%   x0   : initial state [theta; thetaDot] (rad, rad/s)
%   spec : table of settings: name, value, units, min, max, group, description

%            name             value   units    min    max   group                description
rows = {
    "g",             9.81,   "m/s^2",  0,     20,   "parameter",         "gravitational acceleration"
    "length",        1.0,    "m",      0.1,   3,    "parameter",         "pendulum length"
    "damping",       0.1,    "1/s",    0,     2,    "parameter",         "viscous damping coefficient"
    "wallAngleDeg",  NaN,    "deg",    -90,   90,   "contact condition", "wall angle; NaN for no wall"
    "restitution",   0.7,    "-",      0,     1,    "contact condition", "fraction of angular speed kept at impact"
    "theta0Deg",     60,     "deg",    -170,  170,  "initial condition", "initial angle from vertical"
    "thetaDot0",     0,      "rad/s",  -10,   10,   "initial condition", "initial angular velocity"};
spec = cell2table(rows, 'VariableNames', ...
    {'name', 'value', 'units', 'min', 'max', 'group', 'description'});

for i = 1:height(spec)
    v.(spec.name(i)) = spec.value(i);
end
p = rmfield(v, ["theta0Deg" "thetaDot0"]);
x0 = [deg2rad(v.theta0Deg); v.thetaDot0];
end
