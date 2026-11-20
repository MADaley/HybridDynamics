# HybridDynamics

A MATLAB toolkit and an interactive web lab for hybrid dynamical models of legged locomotion. A hybrid model alternates between smooth motion (flight, stance) and discrete events (touchdown, takeoff, impact). The toolkit simulates such models, finds periodic gaits, tests their stability and runs perturbation experiments. The web lab lets students explore how initial conditions, contact conditions and parameters interact in a spring-mass runner.

- Interactive lab: https://madaley.github.io/HybridDynamics/ (runs in any browser; nothing to install)
- MATLAB toolkit: this repository (no toolboxes required; tested with MATLAB R2025b)

## Quick start (MATLAB)

```matlab
run('setupHybridDynamics.m')          % once per session; finds its own folder
run('examples/ex03_slip_oneStride.m') % one stride of the spring-mass runner
run('examples/ex06_slip_sameSpeedStiffness.m')   % one speed, many leg stiffnesses
results = runAllTests();              % from the tests folder; about one minute
```

Every example and lesson script begins with labeled blocks of user settings (parameters, initial conditions, contact conditions, solver and output), followed by numbered sections. Paths are built from each file's own location, so the toolkit runs from any folder.

## Folder map

| Folder | Contents |
|---|---|
| `+hde/` | Engine: `simulate`, `phase`, `transition`, `checkModel`, `solverDefaults`, `newtonSolve`, `returnMapJacobian`, `floquetSummary`, `resultsFolder` |
| `models/slip/` | Spring-loaded inverted pendulum (SLIP) runner: model, presets, return map, stride measures, gait solver, stability, stiffness family |
| `models/ballInBox/`, `models/pendulum/` | Small teaching models: impacts, Zeno behavior, a single guard and reset |
| `plotting/` | Figures in the lab teaching style (`daleyStyle.m`), stride plots, return-map cobwebs, animation |
| `examples/` | `ex01` to `ex08`: short scripts, one idea each |
| `livescripts/` | Lessons 1 to 8 as MATLAB live scripts in plain-text format (R2025a or later opens them in the Live Editor; earlier releases run them as scripts) |
| `tests/` | `runAllTests.m` and the MATLAB test suite |
| `tools/` | `slip_computePresets.m` (solves the presets) and `exportWebReference.m` (exports settings and reference results for the web lab) |
| `interactive/` | The web lab (`index.html`), its simulator (`js/slipsim.js`) and tests that compare it with MATLAB |
| `docs/` | `concepts.md` (how hybrid models are written and solved) and `legacy_mapping.md` (relation to the 2007-2020 code) |

## The spring-mass runner presets

Three periodic gaits of an 80 kg runner with a 1 m leg share an average speed of 4 m/s and 3 steps per second; they differ in leg stiffness and therefore in leg angle. Values come from `models/slip/slip_presets.csv`, written by `tools/slip_computePresets.m`.

| Preset | Leg stiffness (kN/m) | Leg angle at touchdown (deg) | Contact time (s) | Peak vertical force (body weights) | Eigenvalue | Largest drop survived (m) |
|---|---|---|---|---|---|---|
| `humanLowStiffness` | 8 | 58.52 | 0.264 | 2.05 | -0.587 | 0.03 |
| `human` (baseline) | 12 | 64.01 | 0.222 | 2.40 | 0.394 | 0.14 |
| `humanHighStiffness` | 20 | 69.55 | 0.177 | 2.98 | 0.808 | 0.25 |

The baseline relative leg stiffness, k L0 / (m g) = 15.3, lies near the value of 15 that McMahon and Cheng (1990) used for human running. The eigenvalue is the slope of the apex-height return map at constant energy: magnitudes below 1 mean that a small error shrinks from stride to stride. The drop test lowers the ground once and counts a gait as surviving when it completes 20 further strides.

## Lessons

| Lesson | Topic | Web lab | MATLAB |
|---|---|---|---|
| 1 | Hybrid systems: flows, guards, resets, Zeno behavior | yes | `L1_hybridSystems.m` |
| 2 | One running stride: forces and energy exchange | yes | `L2_runningStride.m` |
| 3 | Initial conditions and contact conditions | yes | `L3_initialAndContactConditions.m` |
| 4 | Periodic gaits and the return map | yes | `L4_returnMapStability.m` |
| 5 | Same speed, different legs: peak force, leg work, stability | yes | `L5_sameSpeedDifferentLegs.m` |
| 6 | Swing-leg retraction | yes | `L6_swingLegRetraction.m` |
| 7 | Unexpected drops in the ground | yes | `L7_unexpectedDrop.m` |
| 8 | Numerical methods: why events can be missed | yes | `L8_numericalMethods.m` |

## Validation

- MATLAB test suite (`tests/runAllTests.m`): closed-form impact times and the Zeno limit for the ball in a box, energy conservation, touchdown detection at tolerances from 1e-3 to 1e-12, parity with the limit cycle of the 2020 code at tight tolerance, periodicity and stability of each preset, the gait solver, every example and lesson script, and a scan for hardcoded paths.
- Web simulator (`node interactive/tests/test_slipsim.mjs`): event times, apex sequences, stride measures, eigenvalues, drop tests, the gait solver and the stiffness family, checked against reference results exported from MATLAB by `tools/exportWebReference.m`. The GitHub Pages workflow runs these checks before each deployment.

## Numerical notes

The engine integrates each phase with `ode45` at a relative tolerance of 1e-10 and an absolute tolerance of 1e-12. A guard fires when its value crosses zero in its stated direction, or at once on entry to a phase when the state already lies past it. Guards whose value can dip below zero and return within one solver step need a step limit (`maxStep` in `hde.phase`); the SLIP descending flight phase sets one when the leg retracts. `docs/concepts.md` explains these choices.

## History

The engine descends from the Hybrid Dynamic Engine written by Monica A. Daley from 2007 and used for studies of spring-mass running, swing-leg control and terrain perturbations through 2020. This version keeps the phase-and-transition design, corrects numerical defects found in a 2026 review, and reorganizes the code for teaching. `docs/legacy_mapping.md` lists what changed.

## References

- Blickhan R (1989) The spring-mass model for running and hopping. J Biomech 22:1217-1227. doi:10.1016/0021-9290(89)90224-8
- Blum Y, Vejdani HR, Birn-Jeffery AV, Hubicki CM, Hurst JW, Daley MA (2014) Swing-leg trajectory of running guinea fowl suggests task-level priority of force regulation rather than disturbance rejection. PLoS One 9:e100399. doi:10.1371/journal.pone.0100399
- Daley MA, Biewener AA (2006) Running over rough terrain reveals limb control for intrinsic stability. Proc Natl Acad Sci USA 103:15681-15686. doi:10.1073/pnas.0601473103
- Daley MA, Usherwood JR (2010) Two explanations for the compliant running paradox: reduced work of bouncing viscera and increased stability in uneven terrain. Biol Lett 6:418-421. doi:10.1098/rsbl.2010.0175
- Holmes P, Full RJ, Koditschek D, Guckenheimer J (2006) The dynamics of legged locomotion: models, analyses, and challenges. SIAM Rev 48:207-304. doi:10.1137/S0036144504445133
- Kram R, Taylor CR (1990) Energetics of running: a new perspective. Nature 346:265-267. doi:10.1038/346265a0
- McMahon TA, Cheng GC (1990) The mechanics of running: how does stiffness couple with speed? J Biomech 23 Suppl 1:65-78. doi:10.1016/0021-9290(90)90042-2
- Seyfarth A, Geyer H, Guenther M, Blickhan R (2002) A movement criterion for running. J Biomech 35:649-655. PMID 11955504
- Seyfarth A, Geyer H, Herr H (2003) Swing-leg retraction: a simple control model for stable running. J Exp Biol 206:2547-2555. doi:10.1242/jeb.00463

## License

MIT License; see `LICENSE`.
