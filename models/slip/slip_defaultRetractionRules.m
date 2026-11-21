function rules = slip_defaultRetractionRules()
%SLIP_DEFAULTRETRACTIONRULES  The retraction rules compared in the lessons.
%
%   rules = slip_defaultRetractionRules()
%
%   Returns an n x 3 cell array {name, rule, value} for slip_retractionRule:
%     fixed leg angle            no retraction
%     human data, 4 m/s          leg rotation rate at touchdown of humans
%                                running at 4.07 m/s, in degrees per gait
%                                cycle (Blum et al. 2011; read from
%                                data/swingLegKinematics_Blum2011.csv)
%     5 cm foot clearance        the rate that lifts the foot 5 cm at apex
%     fastest recovery           the rate with eigenvalue lambda = 0
%     ground speed matching      the rate with the largest GSM at touchdown

dataFile = fullfile(fileparts(mfilename('fullpath')), '..', '..', 'data', ...
    'swingLegKinematics_Blum2011.csv');
D = readtable(dataFile, 'TextType', 'string');
human = D(D.species == "human", :);
[~, i] = min(abs(human.speed_mps - 4));
humanRate = human.legRotation_degPerCycle(i);

rules = {
    "fixed leg angle",        "fixed",               NaN
    "human data, 4 m/s",      "commonPerCycle",      humanRate
    "5 cm foot clearance",    "clearance",           0.05
    "fastest recovery",       "fastestRecovery",     NaN
    "ground speed matching",  "groundSpeedMatching", NaN};
end
