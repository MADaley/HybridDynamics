function results = runAllTests()
%RUNALLTESTS  Run the HybridDynamics test suite and print a summary.
%
%   results = runAllTests()
%
%   Runs every test_*.m file in this folder. Takes about one minute.

testDir = fileparts(mfilename('fullpath'));
run(fullfile(testDir, '..', 'setupHybridDynamics.m'));
suite = matlab.unittest.TestSuite.fromFolder(testDir);
results = run(suite);
disp(table(results));
fprintf('\n%d passed, %d failed, %d incomplete.\n', ...
    sum([results.Passed]), sum([results.Failed]), sum([results.Incomplete]));
end
