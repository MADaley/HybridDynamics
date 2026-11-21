function tests = test_examplesAndHygiene
%TEST_EXAMPLESANDHYGIENE  Every example runs; no file holds a hardcoded path.
tests = functiontests(localfunctions);
end

function setupOnce(testCase) %#ok<*DEFNU>
testCase.TestData.root = fullfile(fileparts(mfilename('fullpath')), '..');
run(fullfile(testCase.TestData.root, 'setupHybridDynamics.m'));
testCase.TestData.figVis = get(0, 'DefaultFigureVisible');
set(0, 'DefaultFigureVisible', 'off');
end

function teardownOnce(testCase)
set(0, 'DefaultFigureVisible', testCase.TestData.figVis);
close all force;
end

function testExamplesRun(testCase)
files = dir(fullfile(testCase.TestData.root, 'examples', 'ex*.m'));
verifyGreaterThan(testCase, numel(files), 0);
for i = 1:numel(files)
    f = fullfile(files(i).folder, files(i).name);
    try
        runScript(f);
        ok = true; msg = "";
    catch ME
        ok = false; msg = string(ME.message);
    end
    close all force;
    verifyTrue(testCase, ok, files(i).name + ": " + msg);
end
end

function testLiveScriptsRun(testCase)
files = dir(fullfile(testCase.TestData.root, 'livescripts', '*.m'));
for i = 1:numel(files)
    f = fullfile(files(i).folder, files(i).name);
    try
        runScript(f);
        ok = true; msg = "";
    catch ME
        ok = false; msg = string(ME.message);
    end
    close all force;
    verifyTrue(testCase, ok, files(i).name + ": " + msg);
end
end

function testNoHardcodedPaths(testCase)
% Drive letters, user folders, mounted volumes, matlabroot and cd( are not
% allowed in code: every path is built from the file's own location.
root = testCase.TestData.root;
exts = ["*.m", "*.js", "*.html", "*.json", "*.csv", "*.md"];
pattern = "(?<![A-Za-z0-9])[A-Za-z]:\\[A-Za-z]|/Users/|/home/|/Volumes/|matlabroot|\<cd\(";
self = string(mfilename('fullpath')) + ".m";
for e = exts
    files = dir(fullfile(root, '**', e));
    for i = 1:numel(files)
        f = string(fullfile(files(i).folder, files(i).name));
        if f == self || contains(f, [filesep 'results' filesep]) || ...
                contains(f, [filesep 'node_modules' filesep])
            continue
        end
        txt = fileread(f);
        hit = regexp(txt, char(pattern), 'match', 'once');
        verifyEmpty(testCase, hit, "Hardcoded path in " + f + ": " + string(hit));
    end
end
end

function runScript(f)
% Run a script in a clean function workspace, with saving switched off.
src = fileread(f);
src = regexprep(src, '(saveResults|saveFigures)\s*=\s*true', '$1 = false');
[folder, name] = fileparts(f);
copyName = fullfile(folder, ['zz_test_' name '.m']);
fid = fopen(copyName, 'w');
fwrite(fid, src);
fclose(fid);
cleaner = onCleanup(@() delete(copyName));
evalScript(copyName);
end

function evalScript(f)
run(f);
end
