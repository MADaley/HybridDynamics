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
| `plotting/` | Figures in the lab teaching style (`daleyStyle.m`), stride plots, phase portraits with a moving dot and a perturbed start, return-map cobwebs, animation |
| `examples/` | `ex01` to `ex08`: short scripts, one idea each |
| `livescripts/` | Lessons 1 to 8 as MATLAB live scripts in plain-text format (R2025a or later opens them in the Live Editor; earlier releases run them as scripts) |
| `tests/` | `runAllTests.m` and the MATLAB test suite |
| `tools/` | `slip_computePresets.m` (solves the presets) and `exportWebReference.m` (exports settings and reference results for the web lab) |
| `data/` | Published measurements used in the lessons, with sources (`data/README.md`) |
| `interactive/` | The web lab (`index.html`), its simulator (`js/slipsim.js`) and tests that compare it with MATLAB |
| `docs/` | `concepts.md` (how hybrid models are written and solved) and `legacy_mapping.md` (relation to the 2007-2020 code) |

## The spring-mass runner presets

Three periodic gaits of an 80 kg runner with a 1 m leg share an average speed of 4 m/s and 3 steps per second; they differ only in leg stiffness and therefore in touchdown angle. All three retract the swing leg from apex at the same rate: the leg rotation rate measured at touchdown in humans running at 4.07 m/s, 82.2 degrees per gait cycle (Blum et al. 2011), which is 123.3 deg/s for these gaits. Retraction leaves each periodic gait unchanged and lifts the foot several centimeters above the ground at apex. Values come from `models/slip/slip_presets.csv`, written by `tools/slip_computePresets.m`.

| Preset | Leg stiffness (kN/m) | Touchdown angle (deg) | Foot clearance at apex (cm) | Contact time (s) | Peak vertical force (body weights) | Eigenvalue | Largest drop survived, 20 strides (m) |
|---|---|---|---|---|---|---|---|
| `humanLowStiffness` | 8 | 58.52 | 4.7 | 0.264 | 2.05 | -0.989 | 0.04 |
| `human` (baseline) | 12 | 64.01 | 7.4 | 0.222 | 2.40 | -0.940 | 0.07 |
| `humanHighStiffness` | 20 | 69.55 | 10.2 | 0.177 | 2.98 | -0.891 | 0.11 |

The baseline relative leg stiffness, k L0 / (m g) = 15.3, lies near the value of 15 that McMahon and Cheng (1990) used for human running. The eigenvalue is the slope of the apex-height return map at constant energy: magnitudes below 1 mean that a small error shrinks from stride to stride, and a negative value means the error changes sign each stride. The drop test lowers the ground once and counts a gait as surviving when it completes 20 further strides.

The normalized maximum drop (NMD; Daley and Usherwood 2010) is the largest unexpected drop, as a fraction of leg length, for which the leg still makes stance contact: NMD = (g/2) (Phi / omega)^2 / L, with Phi the stance half-angle and omega the retraction rate. Real animals can recover from a drop through muscle work and damping in the strides that follow, provided the leg makes contact in the stance right after the drop; NMD measures that first-contact limit, and the 20-stride test measures recovery with no muscle work at all. At the common retraction rate, compliant legs have the larger NMD, as Daley and Usherwood (2010) predicted.

| Preset | Stance half-angle (deg) | NMD estimate | Simulated first-contact limit |
|---|---|---|---|
| `humanLowStiffness` | 31.48 | 0.32 | 0.55 |
| `human` (baseline) | 25.99 | 0.22 | 0.43 |
| `humanHighStiffness` | 20.45 | 0.13 | 0.32 |

The simulated first-contact limit follows the actual flight path, including the downward speed at the usual touchdown and the rise of the hip as the leg rotates toward vertical, which the kinematic estimate leaves out.

## Choosing the retraction rate

`slip_retractionRule` sets the rate of any periodic gait by one of five rules, each leaving the gait unchanged: a fixed leg angle; a common rate (deg/s or degrees per gait cycle, for example the human data above); a foot clearance at apex; fastest recovery (eigenvalue zero); and the largest ground speed matching at touchdown, GSM = 1 - |v_foot| / |v_CoM| (Blum et al. 2010). `slip_compareRetractionRules` and `slip_retractionSweep` compare them, and Lesson 6 and `ex07_slip_retraction` show the trade-offs: slow retraction raises the NMD and the leg force after a drop, and fast retraction lowers both (Daley and Usherwood 2010). For the baseline gait the human rate lies between the rate for fastest recovery and the rate for the largest GSM. Measured swing-leg kinematics of running humans and pheasants (Blum et al. 2011) are in `data/swingLegKinematics_Blum2011.csv`; Müller et al. (2016) compare human and avian swing-leg adaptations on uneven ground with the same model. Rates per gait cycle compare animals of different size through dynamic similarity, and at dynamically similar speeds large birds use relatively higher stride frequencies than small birds (Daley and Birn-Jeffery 2018), so per-cycle scaling is an approximation.

## Lessons

| Lesson | Topic | Web lab | MATLAB |
|---|---|---|---|
| 1 | Hybrid systems: flows, guards, resets, Zeno behavior | yes | `L1_hybridSystems.m` |
| 2 | One running stride: forces, energy exchange and phase portraits | yes | `L2_runningStride.m` |
| 3 | Initial conditions and contact conditions | yes | `L3_initialAndContactConditions.m` |
| 4 | Periodic gaits and the return map | yes | `L4_returnMapStability.m` |
| 5 | Same speed, different legs: peak force, leg work, stability | yes | `L5_sameSpeedDifferentLegs.m` |
| 6 | Choosing a swing-leg retraction rate | yes | `L6_swingLegRetraction.m` |
| 7 | Unexpected drops in the ground | yes | `L7_unexpectedDrop.m` |
| 8 | Numerical methods: why events can be missed | no | `L8_numericalMethods.m` |

## Validation

- MATLAB test suite (`tests/runAllTests.m`): closed-form impact times and the Zeno limit for the ball in a box, energy conservation, touchdown detection at tolerances from 1e-3 to 1e-12, parity with the limit cycle of the 2020 code at tight tolerance, periodicity and stability of each preset, the gait solver, every example and lesson script, and a scan for hardcoded paths.
- Web simulator (`node interactive/tests/test_slipsim.mjs`): event times, apex sequences, stride measures, eigenvalues, drop tests, the gait solver and the stiffness family, checked against reference results exported from MATLAB by `tools/exportWebReference.m`. The GitHub Pages workflow runs these checks before each deployment.

## Numerical notes

The engine integrates each phase with `ode45` at a relative tolerance of 1e-10 and an absolute tolerance of 1e-12. A guard fires when its value crosses zero in its stated direction, or at once on entry to a phase when the state already lies past it. Guards whose value can dip below zero and return within one solver step need a step limit (`maxStep` in `hde.phase`); the SLIP descending flight phase sets one when the leg retracts. `docs/concepts.md` explains these choices.

## History

The engine descends from the Hybrid Dynamic Engine written by Monica A. Daley from 2007 and used for studies of spring-mass running, swing-leg control and terrain perturbations through 2020. This version keeps the phase-and-transition design, corrects numerical defects found in a 2026 review, and reorganizes the code for teaching. `docs/legacy_mapping.md` lists what changed.

## References

- Blickhan R (1989) The spring-mass model for running and hopping. J Biomech 22:1217-1227. doi:10.1016/0021-9290(89)90224-8
- Blum Y, Lipfert SW, Rummel J, Seyfarth A (2010) Swing leg control in human running. Bioinspir Biomim 5:026006. doi:10.1088/1748-3182/5/2/026006
- Blum Y, Birn-Jeffery A, Daley MA, Seyfarth A (2011) Does a crouched leg posture enhance running stability and robustness? J Theor Biol 281:97-106. doi:10.1016/j.jtbi.2011.04.029
- Blum Y, Vejdani HR, Birn-Jeffery AV, Hubicki CM, Hurst JW, Daley MA (2014) Swing-leg trajectory of running guinea fowl suggests task-level priority of force regulation rather than disturbance rejection. PLoS One 9:e100399. doi:10.1371/journal.pone.0100399
- Daley MA, Biewener AA (2006) Running over rough terrain reveals limb control for intrinsic stability. Proc Natl Acad Sci USA 103:15681-15686. doi:10.1073/pnas.0601473103
- Daley MA, Birn-Jeffery A (2018) Scaling of avian bipedal locomotion reveals independent effects of body mass and leg posture on gait. J Exp Biol 221:jeb152538. doi:10.1242/jeb.152538
- Daley MA, Usherwood JR (2010) Two explanations for the compliant running paradox: reduced work of bouncing viscera and increased stability in uneven terrain. Biol Lett 6:418-421. doi:10.1098/rsbl.2010.0175
- Holmes P, Full RJ, Koditschek D, Guckenheimer J (2006) The dynamics of legged locomotion: models, analyses, and challenges. SIAM Rev 48:207-304. doi:10.1137/S0036144504445133
- Kram R, Taylor CR (1990) Energetics of running: a new perspective. Nature 346:265-267. doi:10.1038/346265a0
- McMahon TA, Cheng GC (1990) The mechanics of running: how does stiffness couple with speed? J Biomech 23 Suppl 1:65-78. doi:10.1016/0021-9290(90)90042-2
- Müller R, Birn-Jeffery AV, Blum Y (2016) Human and avian running on uneven ground: a model-based comparison. J R Soc Interface 13:20160529. doi:10.1098/rsif.2016.0529
- Seyfarth A, Geyer H, Guenther M, Blickhan R (2002) A movement criterion for running. J Biomech 35:649-655. PMID 11955504
- Seyfarth A, Geyer H, Herr H (2003) Swing-leg retraction: a simple control model for stable running. J Exp Biol 206:2547-2555. doi:10.1242/jeb.00463
- Vejdani HR, Blum Y, Daley MA, Hurst JW (2013) Bio-inspired swing leg control for spring-mass robots running on ground with unexpected height disturbance. Bioinspir Biomim 8:046006. doi:10.1088/1748-3182/8/4/046006

## License

MIT License; see `LICENSE`.
