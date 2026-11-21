# Concepts: writing and solving hybrid models

## 1. Phases, guards, resets and transitions

A hybrid model in this toolkit is a MATLAB structure with five main fields.

| Field | Meaning |
|---|---|
| `stateNames` | names of the global states, for example `["x" "y" "vx" "vy" "xFoot" "yFoot"]` |
| `phases` | struct array made with `hde.phase`: each phase has a flow (equations of motion), guards (event functions), and optional changes to and from local coordinates |
| `transitions` | struct array made with `hde.transition`: for each phase and guard, the next phase and an optional reset map |
| `startPhase` | the phase that holds the initial state |
| `cyclePhase` | optional: entering this phase completes one cycle (for a runner, one stride from apex to apex) |

A phase integrates its flow until one of its guards fires. The engine then applies the transition for that phase and guard: it maps the state through the reset (if any) and starts the next phase. A transition to `"END"` stops the simulation and sets `exitReason` to `"terminal:<guard>"`.

The spring-mass runner (`models/slip/slip_model.m`) uses three phases:

| From | Guard | To | Reset |
|---|---|---|---|
| flightDown | footBelowGround | END | |
| flightDown | touchdown | stance | |
| flightDown | fall | END | |
| stance | takeoff | flightUp | |
| stance | reversal | END | |
| stance | fall | END | |
| flightUp | apex | flightDown | leg set to the apex angle |

## 2. Local coordinates

Each phase can integrate in its own coordinates. In stance the body position is measured from the foot, which stays fixed; in flight the leg is described by its angle. `toLocal` maps the global state into the phase's coordinates and returns any data that `toGlobal` needs to map back (for stance, the foot position). Outputs are always reported in global coordinates.

## 3. When a guard fires

- A guard value crosses zero in its stated direction (`guardDirection`, default -1: from positive to negative).
- On entry to a phase, a guard whose value already lies past zero by more than `entryTol` (1e-9) fires at once. This makes a phase of zero duration. The SLIP model uses this rule when takeoff happens with the body already moving down: the apex guard of the ascending flight phase fires immediately and the leg is reset at takeoff.
- A transition can choose its next phase from the state after the reset: pass a function `@(x) phaseName` as `to`. The ball in a box uses this to switch to its rolling phase when a floor rebound is too slow to resolve.
- When two guards fire at the same time, the engine takes the one listed first and issues a warning.

## 4. Numerical choices

- Tolerances: `relTol` 1e-10 and `absTol` 1e-12 by default (`hde.solverDefaults`). At the `ode45` defaults (1e-3 and 1e-6) the 2020 code gained about 1.3 J per stride in an energy-conserving 80 kg runner, which moved its limit cycle.
- Step limits: an ODE solver checks guards only at the end of each step. A guard whose value dips below zero and returns within one step is missed. In the SLIP model, fast swing-leg retraction carries the foot below the ground and back up during descending flight; the flight phase therefore sets `maxStep` to 5e-4 s whenever the leg retracts. Lesson 8 demonstrates the failure.
- Conservation checks: in an energy-conserving model, the change in mechanical energy over a stride should be near the solver tolerance. `slip_metrics` reports it as `energyChange`.

## 5. Periodic gaits and stability

A return map sends the state at one crossing of a section (for a runner, the apex) to the state at the next crossing. A periodic gait is a fixed point of the map. `slip_findGait` solves for a fixed point with a damped Gauss-Newton method (`hde.newtonSolve`), holding the average speed and one more quantity: the step frequency, the apex height or the leg angle.

Near the fixed point, small errors evolve by the Jacobian of the map (`hde.returnMapJacobian`, central differences). Its eigenvalues decide stability: magnitudes below 1 mean errors shrink. In an energy-conserving model, one eigenvalue equals 1, because a change in energy neither grows nor decays. `hde.floquetSummary` reports that neutral mode separately. For the spring-mass runner the remaining eigenvalue equals the slope of the apex-height map at constant energy, which `slip_stability` returns as `lambda`.

Coupled states must stay consistent when the section state is perturbed. For the runner the foot position depends on the apex height and the leg angle, so `slip_apexState` rebuilds it from the apex state. The 2020 code perturbed the body height with the foot held fixed, which also changed the leg angle and raised the computed eigenvalue by 8 %.

## 6. Swing-leg retraction

In the SLIP model the leg is set to an angle at apex and rotates rearward at a constant rate during descending flight. For a periodic gait, `slip_setRetraction` gives any rate omega by setting the apex angle to the touchdown angle minus omega times the fall time, so the leg reaches the original touchdown angle at the original touchdown time. The body follows the same ballistic path, so the periodic gait is unchanged; only the response to perturbations changes. `slip_retractionRule` chooses omega by a rule (fixed angle, a common rate, a foot clearance at apex, fastest recovery, or the largest ground speed matching), and `slip_stiffnessFamily` applies a rule to every gait in a family.

## 7. Writing a new model

1. Copy `models/ballInBox/ballInBox_model.m` (one or two phases) or `models/slip/slip_model.m` (several phases with coordinate changes).
2. List the states. Write one flow function per phase, in the phase's own coordinates.
3. For each phase, list its guards and write one guard function that returns their values as a column vector, each positive while the phase continues.
4. Write the transition table, with reset maps for impacts and leg placement.
5. Write a defaults function that returns parameters, an initial state and a specification table (name, value, units, minimum, maximum, group, description).
6. Run `hde.checkModel(model, x0)`, then `hde.simulate(model, x0)`, and check a conserved quantity or a closed-form special case before trusting the results.
