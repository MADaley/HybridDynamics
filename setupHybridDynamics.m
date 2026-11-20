function rootDir = setupHybridDynamics()
%SETUPHYBRIDDYNAMICS  Add the HybridDynamics toolkit folders to the MATLAB path.
%
%   rootDir = setupHybridDynamics()
%
%   Run once per MATLAB session before using the examples, live scripts or
%   tests. The function finds its own location, so the toolkit can live in
%   any folder on any computer. It returns the toolkit root folder.

rootDir = fileparts(mfilename('fullpath'));

% Folders that hold functions. The +hde engine namespace is found through
% the root folder, so only the root needs to be on the path for it.
folders = { ...
    rootDir
    fullfile(rootDir, 'models', 'slip')
    fullfile(rootDir, 'models', 'ballInBox')
    fullfile(rootDir, 'models', 'pendulum')
    fullfile(rootDir, 'plotting')};

addpath(folders{:});
fprintf('HybridDynamics toolkit added to the path from:\n  %s\n', rootDir);
end
