# Relation to the 2007-2020 Hybrid Dynamic Engine

This toolkit replaces the Hybrid Dynamic Engine (2007-2020). The legacy code remains in its original folders and is not part of this repository. This file maps legacy functions to their replacements and lists the defects that the 2026 review found and this version corrects.

## Function map

| Legacy | Replacement |
|---|---|
| `RunHybridDynamics.m` | `hde.simulate` (named phases and guards, results structure, solver options) |
| phase cell arrays `{flow, event, globalToLocal, localToGlobal}` | `hde.phase` |
| `phaseTransitionMap` nested cells | `hde.transition` table |
| `RunOneStride.m` | `hde.simulate` with `maxCycles = 1`; `slip_returnMap` |
| `FindOneLimitCycle.m`, `FindOneLimitCycle_GaitOptimized.m`, `FindOneLimitCycle_*ForceOptimized.m` | `slip_findGait` (targets: average speed plus step frequency, apex height or leg angle) built on `hde.newtonSolve` |
| `SimpleLimitCycleSearch.m` | repeated `slip_returnMap` calls (see `ex04`) |
| `partialderiv.m` | `hde.returnMapJacobian` (central differences) and `slip_stability` |
| `BuildMassSpringRunner.m` | `slip_model` |
| `GetDefault_ICsAndParams_MSR.m` (three versions) | `slip_defaults` with named presets from `slip_presets.csv` |
| `FixCoupledValues_SLIP.m`, `Set_ICsAndParams.m` | `slip_apexState` |
| `SLIP_RunOneStrideSummary.m` (four versions), `CalculateForces_Gen.m` | `slip_metrics` |
| `AddDropStep_SLIP.m`, `TestStabilityMassSpringRunner.m` | `slip_stability` drop test; `ex08_slip_dropStep` |
| `SearchMassSpringRunner.m` (stiffness sweeps) | `slip_stiffnessFamily`; `ex06_slip_sameSpeedStiffness` |
| `BuildBallInBox.m`, `TestBallInBox.m` | `ballInBox_model` (adds a rolling phase); `tests/test_engine.m` |
| `BuildPendulum.m` | `pendulum_model` (adds an optional wall) |
| `MakeProgressGraph_wForces.m`, `MakeProgressMovie_wForces.m` | `plotSlipStride`, `animateSlip` |
| `Muybridge_initialize_addpaths.m` | `setupHybridDynamics` (self-locating) |

## Defects corrected

| Legacy defect | Effect in the legacy code | Correction |
|---|---|---|
| Solver options could not be passed (`inOptions` unassigned) | every run used the `ode45` defaults; 1.3 J energy gain per stride | `hde.solverDefaults`; tight tolerances by default |
| Touchdown guard skipped during fast leg retraction | the runner could fall through the ground, depending on tolerance | step limit in descending flight; regression test at tolerances 1e-3 to 1e-12 |
| Stability Jacobian: forward differences, foot not moved with the body, vertical velocity included | eigenvalue 2.93 where the consistent value is 2.68 | central differences on the apex section with consistent foot placement |
| Limit-cycle objective ignored falls | the optimizer could score failed strides | failed strides return NaN; the solver shortens its step |
| State-only search failed (`searchParamNames` undefined) | error | `slip_findGait` with `hold = "legAngle"` |
| `exceptStates` had no effect | user initial states were never reset | presets and explicit apex states |
| Event index taken as the first listed event | ambiguous transitions | first guard in time, warning for simultaneous guards |
| Error thrown when a phase ended with no event | results lost | `exitReason = "noEvent"` with partial results |
| Generic search called SLIP-specific functions | copied and edited forks for each model | model-specific wrappers on a generic engine |
| Apex below touchdown height continued with the foot underground | non-physical strides in perturbation runs | `footBelowGround` guard ends the run |
| Ball in a box sank through the floor after many short bounces | Zeno behavior unresolved | rolling phase below a rest speed |
| Hardcoded drive and user paths | scripts ran only on one computer | self-locating paths; a test scans for hardcoded paths |
| Divergent duplicate files | path order decided which copy ran | one copy of each function, in the `+hde` namespace or a model folder |

## Not ported

The legacy two-leg runner, passive-swing-leg runner, swing-force-policy searches, GUIs and the neural oscillator project (`DynamicExperiments/NeuralModel`) remain in their original folders. The neural oscillator project is unfinished and may return in a future version.
