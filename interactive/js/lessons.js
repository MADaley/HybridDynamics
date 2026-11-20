/*
 * lessons.js
 * Guided lessons for the Spring-Mass Running Lab.
 *
 * HDS_LESSONS.build(R) returns the lesson list. R supplies numbers taken at
 * run time from the MATLAB reference data (js/reference.js), so the text
 * quotes the same values the toolkit computes:
 *   R.preset(name)  preset row (k, legAngleDeg, apexHeight, lambda, maxDrop, ...)
 *   R.fam           summary of the same-speed stiffness family (see app.js)
 *   R.f(v, d)       number formatted with d decimals
 *   R.numerics      summary of the legacy settings used in lesson 8
 *
 * Each lesson: id, title, model ('slip' | 'ball'), preset, settings
 * (overrides of slip parameters), tab, goal, body (paragraphs), tasks,
 * question, answer.
 */
var HDS_LESSONS = {
  build: function (R) {
    'use strict';
    var h = R.preset('human');
    var lo = R.preset('humanLowStiffness');
    var hi = R.preset('humanHighStiffness');
    var F = R.fam;
    var f = R.f;

    return [
      {
        id: 'hybrid',
        title: '1. Hybrid systems: a ball in a box',
        model: 'ball',
        tab: 'ball',
        goal: 'Identify the three parts of a hybrid model: flows, guards and resets.',
        body: [
          'A hybrid model joins continuous motion and instantaneous events. Between impacts the ball moves in ballistic flight under gravity. These equations of motion are the flow of the model.',
          'Each wall defines a guard: a function of the state that reaches zero when the ball touches that wall. When a guard fires, a reset map changes the state at once. Here the velocity component normal to the wall reverses and shrinks by the coefficient of restitution, and the tangential component stays the same.',
          'The diagram beside the animation lists the phase, its guards and its resets. The toolkit describes every model on this page, from this ball to the running model, in the same terms.',
          'With a coefficient of restitution below 1, each floor impact removes kinetic energy. The bounces on the floor become shorter, and their number becomes infinite within a finite time. Hybrid systems with this property show Zeno behavior. The simulator stops the bouncing once the rebound speed falls below a small threshold and lets the ball slide along the floor.'
        ],
        tasks: [
          'Set the coefficient of restitution to 1 and watch the energy panel. Then set it to 0.5.',
          'Change the initial horizontal velocity and note which wall the ball reaches first.',
          'Read the event table: each row is one guard firing and one reset.'
        ],
        question: 'The ball strikes the right wall moving at 6 m/s to the right and 2 m/s downward, with a coefficient of restitution of 0.8. What is its velocity just after the impact?',
        answer: 'The horizontal component is normal to the wall: it reverses and scales by 0.8, giving 4.8 m/s to the left. The vertical component is tangential to the wall and stays at 2 m/s downward.'
      },
      {
        id: 'stride',
        title: '2. One running stride',
        model: 'slip',
        preset: 'human',
        tab: 'stride',
        goal: 'Follow the exchange of kinetic, gravitational and elastic energy through one stride of the spring-mass model.',
        body: [
          'The spring-mass model represents a runner as a point mass on a massless spring leg (Blickhan 1989; McMahon and Cheng 1990). A stride has three phases: descending flight from the apex, stance with the foot pinned to the ground, and ascending flight back to the next apex.',
          'During stance the spring compresses and stores elastic energy while the body slows and drops; the spring then extends and returns that energy. The model has no damping and no actuation, so the total mechanical energy stays constant. The energy panel in the Stride tab tracks each component and the total.',
          'The baseline runner has a mass of ' + f(h.m, 0) + ' kg, a leg length of ' + f(h.L0, 2) + ' m and a leg stiffness of ' + f(h.k / 1000, 0) + ' kN/m, a relative stiffness k L0 / (m g) of ' + f(h.k * h.L0 / (h.m * h.g), 1) + '. It runs at an average speed of ' + f(h.meanSpeed, 1) + ' m/s with ' + f(h.stepFrequency, 1) + ' steps per second.',
          'Forces appear in body weights. Over a periodic stride the average vertical force equals one body weight, so a short contact needs a high peak force.'
        ],
        tasks: [
          'Open the Stride tab and find the time of the peak vertical force. Where is the leg at that time?',
          'Increase the leg stiffness and watch the contact time and the peak force.',
          'Compare the kinetic and elastic energy traces during stance.'
        ],
        question: 'Kinetic energy falls during the first half of stance. Why does the total mechanical energy stay constant?',
        answer: 'The kinetic and gravitational energy lost in early stance is stored in the spring as elastic energy and returned in late stance. With no damping and no actuation, the leg does equal amounts of negative and positive work.'
      },
      {
        id: 'conditions',
        title: '3. Initial conditions and contact conditions',
        model: 'slip',
        preset: 'human',
        tab: 'stride',
        goal: 'Separate the state at apex (initial conditions) from the leg placement at touchdown (contact conditions).',
        body: [
          'Each stride starts at the apex of flight, described by two numbers: apex height and forward speed. These are the initial conditions. The leg angle set at apex and the rotation rate of the leg during descent decide where and when the foot meets the ground. These are the contact conditions. Stiffness, mass, leg length and gravity are parameters.',
          'From the same apex state, a steeper leg angle delays touchdown. From a higher apex with the same leg angle, the body lands with a faster vertical speed and compresses the leg further.',
          'Dimensionless groups compare runners of different size. The Froude number v^2 / (g L0) compares speed with leg length, and the relative stiffness k L0 / (m g) compares leg stiffness with body weight per leg length (McMahon and Cheng 1990).'
        ],
        tasks: [
          'From the baseline, change only the leg angle by 1 deg in each direction and watch the apex heights over five strides.',
          'Return to the baseline and change only the apex height by 2 cm.',
          'Double the mass and the leg stiffness together and note which measures stay the same.'
        ],
        question: 'Mass and leg stiffness are both doubled. What happens to the motion?',
        answer: 'The motion is unchanged: the stance equations depend on k / m, which stays the same, and flight does not depend on mass. Forces double in newtons and stay the same in body weights.'
      },
      {
        id: 'returnmap',
        title: '4. Periodic gaits and the return map',
        model: 'slip',
        preset: 'human',
        tab: 'returnMap',
        goal: 'Find a periodic gait and test whether small errors grow or shrink from stride to stride.',
        body: [
          'A gait is periodic when the apex state returns to its starting value after one stride. The return map links the apex height at one stride to the apex height at the next. A periodic gait is a fixed point of the map, where its curve crosses the identity line.',
          'The slope of the map at the fixed point, lambda, sets the fate of a small error in apex height. With |lambda| < 1 the error shrinks each stride and the gait is locally stable; with |lambda| > 1 it grows. A negative lambda makes the error change sign each stride, which appears as a zigzag in the cobweb.',
          'The model conserves mechanical energy, so a change in energy neither grows nor decays: the full two-dimensional apex map has one eigenvalue equal to 1. The map in this tab holds the energy fixed and isolates the remaining eigenvalue, lambda (Holmes et al. 2006).',
          'With a fixed leg angle, self-stable running in this model needs a suitable pairing of leg stiffness and leg angle, and a minimum speed (Seyfarth et al. 2002). The baseline gait has lambda = ' + f(h.lambda, 2) + '.'
        ],
        tasks: [
          'Move the cobweb start and count the strides needed to return within 1 mm of the fixed point.',
          'Load the low-stiffness preset (lambda = ' + f(lo.lambda, 2) + ') and compare its cobweb.',
          'Change the leg angle by 0.5 deg, press Find periodic gait, and read the new lambda.'
        ],
        question: 'A gait has lambda = -0.6. An error of +1 cm in apex height appears at one stride. What errors do you expect at the next two strides?',
        answer: 'About -0.6 cm, then about +0.36 cm. The error shrinks by a factor of 0.6 each stride and changes sign each time.'
      },
      {
        id: 'stiffness',
        title: '5. Same speed, different legs',
        model: 'slip',
        preset: 'human',
        tab: 'family',
        goal: 'Compare running gaits that share one average speed and step frequency but use different leg stiffness.',
        body: [
          'At a given speed the model admits many periodic gaits. With the average speed held at ' + f(F.speed, 1) + ' m/s and the step frequency at ' + f(F.frequency, 1) + ' steps per second, each leg stiffness has its own leg angle, apex height and contact time. The Same speed tab follows this family from ' + f(F.kMin, 0) + ' to ' + f(F.kMax, 0) + ' kN/m.',
          'A stiffer leg lands at a steeper angle, compresses less and stays on the ground for a shorter time. The average vertical force over a stride equals body weight, so a shorter contact needs a higher peak force: ' + f(lo.peakVerticalForceBW, 2) + ' body weights at ' + f(lo.k / 1000, 0) + ' kN/m and ' + f(hi.peakVerticalForceBW, 2) + ' body weights at ' + f(hi.k / 1000, 0) + ' kN/m.',
          'The model does no net work over a stride, so any energy cost needs a proxy. The positive leg work per distance is the mechanical work by the legs if the spring returned no energy; it falls with stiffness, since a stiff leg stores less elastic energy. The force-time cost index, the inverse of contact time, follows the force-time hypothesis of Kram and Taylor (1990); it rises with stiffness. The two proxies rank the gaits in opposite order.',
          'Stability has two aspects here. The eigenvalue lambda measures how fast a small error decays. The drop test measures the largest unexpected drop in the ground that the gait survives for 20 strides. In this family, |lambda| < 1 from ' + f(F.kStableMin, 0) + ' to ' + f(F.kStableMax, 0) + ' kN/m, |lambda| is smallest near ' + f(F.kBest, 0) + ' kN/m, and the largest drop survived reaches ' + f(F.dropMax * 100, 0) + ' cm at ' + f(F.kDropMax, 0) + ' kN/m.',
          'Daley and Usherwood (2010) proposed the normalized maximum drop, a kinematic measure, which predicts that compliant legs negotiate relatively larger drops. The drop test on this page holds the leg angle fixed and counts strides to failure. The two measures address different questions about stability.'
        ],
        tasks: [
          'Load the three presets in turn and compare contact time, peak force and lambda.',
          'In the Perturbation tab, press Compare the three presets with a 5 cm drop.',
          'Change the body mass, press Find periodic gait, then Recompute for current body and speed.'
        ],
        question: 'Two gaits run at the same speed and step frequency. One leg is twice as stiff as the other. Which gait has the higher peak vertical force, and why?',
        answer: 'The stiffer leg. Both gaits have the same step period and the same average vertical force, one body weight. The stiffer leg delivers that impulse during a shorter contact, which needs a higher peak force.'
      },
      {
        id: 'retraction',
        title: '6. Swing-leg retraction',
        model: 'slip',
        preset: 'human',
        settings: { retractionDegPerS: 20 },
        tab: 'returnMap',
        goal: 'See how rotating the leg rearward before touchdown changes stability while the periodic gait stays the same.',
        body: [
          'Running animals often rotate the swing leg rearward just before ground contact, and in the spring-mass model this retraction can stabilize running (Seyfarth et al. 2003). In the model the leg angle is set at apex and then rotates at the retraction rate during descending flight, so the touchdown angle depends on the time spent falling.',
          'After a stride that ends higher than the periodic gait, the runner falls for longer and a retracting leg lands at a steeper angle. That automatic adjustment changes lambda. With speed and step frequency held fixed, the periodic gait keeps the same touchdown angle, contact time and forces; only the leg angle at apex changes.',
          'In guinea fowl running over an unexpected drop, the limb contact angle explained most of the variation in stance-phase limb loading (Daley and Biewener 2006), and swing-leg trajectories closely matched simulations optimized to regulate leg loading (Blum et al. 2014).',
          'This lesson starts from the baseline apex state with a retraction rate of 20 deg/s. Press Find periodic gait to restore a periodic gait at the target speed and step frequency.'
        ],
        tasks: [
          'Press Find periodic gait and compare lambda with the baseline value of ' + f(h.lambda, 2) + ' at 0 deg/s.',
          'Raise the retraction rate in steps of 40 deg/s, pressing Find periodic gait each time, until the gait becomes unstable.',
          'With retraction on, change the apex height and watch the touchdown angle readout.'
        ],
        question: 'Why does retraction leave the periodic gait unchanged when speed and step frequency are held fixed?',
        answer: 'The stride depends on the leg angle at touchdown. The gait solver lowers the leg angle at apex so that, after rotating during the fall time of the periodic gait, the leg reaches the same touchdown angle. Retraction changes only how the touchdown angle responds to a change in fall time.'
      },
      {
        id: 'drop',
        title: '7. Unexpected drops',
        model: 'slip',
        preset: 'human',
        tab: 'perturb',
        goal: 'Follow a gait through an unexpected drop in the ground.',
        body: [
          'A drop in the ground during flight lets the body fall farther before touchdown. In the model, the apex height above the new ground rises by the drop height at the same forward speed, which adds m g h of mechanical energy.',
          'With no damping, the runner keeps that energy. A stable gait settles toward a new periodic gait at a higher speed; an unstable gait falls or reverses.',
          'The Perturbation tab applies one drop after the first stride and plots apex height and speed stride by stride. The largest drop survived for 20 strides is ' + f(lo.maxDrop * 100, 0) + ' cm for the low-stiffness preset, ' + f(h.maxDrop * 100, 0) + ' cm for the baseline and ' + f(hi.maxDrop * 100, 0) + ' cm for the high-stiffness preset.'
        ],
        tasks: [
          'Set the drop to 5 cm and press Compare the three presets.',
          'Find the largest drop that the baseline gait survives and compare it with the Same speed tab.',
          'Add a retraction rate of 20 deg/s, press Find periodic gait, and repeat the drop.'
        ],
        question: 'Where does the energy added by the drop go in this model?',
        answer: 'It stays in the runner. The model has no damping, so the added energy appears as a higher forward speed and a different apex height in the strides after the drop.'
      },
      {
        id: 'numerics',
        title: '8. Numerical methods: missed events',
        model: 'slip',
        preset: 'human',
        tab: 'numerics',
        goal: 'See how an event detector can step over a guard, and why the toolkit limits the step.',
        body: [
          'A solver finds a guard by checking its sign at the ends of each step. With fast leg retraction, the foot can dip below the ground and come back up within one step. If no check falls inside the dip, the solver never registers the touchdown and the body falls through the ground.',
          'The Numerical methods tab uses the 2020 default settings of the legacy engine, with a retraction rate of ' + f(R.numerics.retraction, 0) + ' deg/s. The foot stays below the ground for ' + f(R.numerics.dipMs, 0) + ' ms. A scan step of 0.2 ms finds the touchdown; a scan step of 150 ms misses it.',
          'Flight is a quadratic in time, which the solver integrates exactly, so its error estimate stays near zero and its steps grow large. The 2020 engine missed this touchdown at some tolerance settings for that reason. The toolkit limits the solver step during descending flight in MATLAB, and this page solves flight in closed form and scans the foot height every 0.2 ms.'
        ],
        tasks: [
          'Select each scan step and read the outcome.',
          'Compare the dip duration with the scan step that first misses the touchdown.'
        ],
        question: 'Why does a smaller error tolerance not prevent a missed touchdown in flight?',
        answer: 'The solver integrates the quadratic flight motion exactly, so its error estimate stays near zero at any tolerance and the steps stay large. A limit on the step size, or a guard that changes sign only once per phase, prevents the miss.'
      }
    ];
  }
};
