function folder = resultsFolder(callerFile, tag)
%RESULTSFOLDER  Create a time-stamped results folder beside the calling script.
%
%   folder = hde.resultsFolder(mfilename('fullpath'))
%   folder = hde.resultsFolder(mfilename('fullpath'), "stiffnessFamily")
%
%   Returns <script folder>/results/<yyyyMMdd_HHmmss>[_tag] and creates it.
%   Pass mfilename('fullpath') from the calling script so the location
%   follows the script, whatever the current folder.

if nargin < 2, tag = ""; end
stamp = string(datetime('now', 'Format', 'yyyyMMdd_HHmmss'));
if strlength(tag) > 0
    stamp = stamp + "_" + tag;
end
folder = fullfile(fileparts(callerFile), 'results', stamp);
if ~exist(folder, 'dir')
    mkdir(folder);
end
end
