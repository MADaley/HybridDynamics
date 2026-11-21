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
 *   R.clearance     minimum foot clearance at apex used by the presets (m)
 *   R.fixedClearance(name)  foot clearance at apex with a fixed leg angle (m)
 *   R.fallTime(name)        time from apex to touchdown (s)
 *   R.fixedLambda(name)     eigenvalue with a fixed leg angle
 *   R.drop(name), R.fixedDrop(name)  {maxDrop, first: {height, strides, failure}}
 *   R.referenceRate         common retraction rate for the NMD comparison (deg/s)
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

    var edge = function (lam) { return Math.abs(lam) > 0.95 ? ', at the edge of stability' : ''; };
    var dropLimit = F.dropMaxValue >= 0.5 - 1e-9 ?
      'reaches the 50 cm limit of the test, first at ' + f(F.kDropMax, 0) + ' kN/m' :
      'reaches ' + f(F.dropMaxValue * 100, 0) + ' cm at ' + f(F.kDropMax, 0) + ' kN/m';
    var refRate = R.referenceRate;
    var nmd = function (v) { return v === null || v === undefined || v === Infinity ? 'no limit' : f(v, 2); };
    var inc = function (a, b, c) { return a < b && b < c; };
    var ownRises = inc(lo.nmdEstimate, h.nmdEstimate, hi.nmdEstimate);
    var refFalls = inc(hi.nmdEstimateAtReference, h.nmdEstimateAtReference, lo.nmdEstimateAtReference);
    var simAbove = [lo, h, hi].every(function (g) { return g.nmdSimulated === null || g.nmdSimulated > g.nmdEstimate; });
    var farAbove = [lo, h, hi].every(function (g) { return g.nmdSimulated === null || g.nmdSimulated > 2 * g.maxDrop; });
    var signText = F.crossings.length ? 'lambda is negative below about ' + f(F.crossings[0].k, 0) + ' kN/m, where errors change sign from stride to stride, and positive above it' :
      (F.lambdaMax < 0 ? 'lambda is negative for every gait, so errors change sign from stride to stride' : 'lambda is positive for every gait');

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
          'With a coefficient of restitution below 1, each floor impact removes kinetic energy. The bounces on the floor become shorter, and their number becomes infinite within a finite time. Hybrid systems with this property show Zeno behavior. The simulator stops the bouncing once a floor rebound is slower than the rest speed setting, and the ball then slides along the floor in a second phase.'
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
          'With a fixed leg angle, self-stable running in this model needs a suitable pairing of leg stiffness and leg angle, and a minimum speed (Seyfarth et al. 2002). The baseline preset uses swing-leg retraction (lesson 6) and has lambda = ' + f(h.lambda, 2) + '; the same gait with a fixed leg angle has lambda = ' + f(R.fixedLambda('human'), 2) + '.'
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
          'At a given speed the model admits many periodic gaits. With the average speed held at ' + f(F.speed, 1) + ' m/s and the step frequency at ' + f(F.frequency, 1) + ' steps per second, each leg stiffness has its own touchdown angle, apex height and contact time. The Same speed tab follows this family from ' + f(F.kMin, 0) + ' to ' + f(F.kMax, 0) + ' kN/m.',
          'A stiffer leg lands at a steeper angle, compresses less and stays on the ground for a shorter time. The average vertical force over a stride equals body weight, so a shorter contact needs a higher peak force: ' + f(lo.peakVerticalForceBW, 2) + ' body weights at ' + f(lo.k / 1000, 0) + ' kN/m and ' + f(hi.peakVerticalForceBW, 2) + ' body weights at ' + f(hi.k / 1000, 0) + ' kN/m.',
          'The model does no net work over a stride, so any energy cost needs a proxy. The positive leg work per distance is the mechanical work by the legs if the spring returned no energy; it falls with stiffness, since a stiff leg stores less elastic energy. The force-time cost index, the inverse of contact time, follows the force-time hypothesis of Kram and Taylor (1990); it rises with stiffness. The two proxies rank the gaits in opposite order.',
          'Every gait in the family uses swing-leg retraction where needed to keep the foot ' + f(R.clearance * 100, 0) + ' cm above the ground at apex (lesson 6). Retraction leaves each gait unchanged, so the forces and timing match the same gaits with a fixed leg angle; it changes only the stability.',
          'Stability has two aspects here. The eigenvalue lambda measures how fast a small error decays; the drop test measures the largest unexpected drop in the ground that the gait survives for 20 strides. In this family ' + signText + '. lambda is most negative (' + f(F.lambdaMin, 2) + ') at ' + f(F.kLambdaMin, 0) + ' kN/m' + edge(F.lambdaMin) + ', and |lambda| is smallest near ' + f(F.kBest, 0) + ' kN/m. The largest drop survived ' + dropLimit + ', against ' + f(lo.maxDrop * 100, 0) + ' cm for the low-stiffness preset.',
          'Daley and Usherwood (2010) proposed a second drop measure, the normalized maximum drop (NMD): the largest drop, in leg lengths, for which the leg still reaches the ground before rotating past vertical, so the first stance after the drop can take load (lesson 7). At one common retraction rate of ' + f(refRate, 1) + ' deg/s, the NMD estimate is ' + nmd(lo.nmdEstimateAtReference) + ' for the low-stiffness preset and ' + nmd(hi.nmdEstimateAtReference) + ' for the high-stiffness preset. The 20-stride drop test and NMD address different questions about stability, and the comparison table lists both.'
        ],
        tasks: [
          'Load the three presets in turn and compare contact time, peak force, retraction rate and lambda.',
          'In the Perturbation tab, press Compare the three presets with a 5 cm drop.',
          'Recompute the family with the minimum foot clearance left blank (a fixed leg angle) and compare the eigenvalue panel.'
        ],
        question: 'Two gaits run at the same speed and step frequency. One leg is twice as stiff as the other. Which gait has the higher peak vertical force, and why?',
        answer: 'The stiffer leg. Both gaits have the same step period and the same average vertical force, one body weight. The stiffer leg delivers that impulse during a shorter contact, which needs a higher peak force.'
      },
      {
        id: 'retraction',
        title: '6. Swing-leg retraction and foot clearance',
        model: 'slip',
        preset: 'human',
        tab: 'returnMap',
        goal: 'See how rotating the leg rearward before touchdown lifts the foot at apex, leaves the gait unchanged, and changes stability.',
        body: [
          'Running animals often rotate the swing leg rearward just before ground contact, and in the spring-mass model this retraction can stabilize running (Seyfarth et al. 2003). In the model the leg angle is set at apex and then rotates at the retraction rate during descending flight, so the touchdown angle depends on the time spent falling.',
          'With a fixed leg angle the foot hangs low at apex: in the three presets it sits only ' + f(R.fixedClearance('humanLowStiffness') * 100, 1) + ', ' + f(R.fixedClearance('human') * 100, 1) + ' and ' + f(R.fixedClearance('humanHighStiffness') * 100, 1) + ' cm above the ground, so a small loss of apex height places the foot below the ground and ends the run. Retraction starts the leg at a shallower angle at apex, which lifts the foot to ' + f(R.clearance * 100, 0) + ' cm, and rotates it to the same touchdown angle at the same touchdown time. The periodic gait, with its stance, forces, speed and step frequency, stays the same.',
          'Retraction changes the response to errors. After a stride that ends higher, the runner falls for longer and a retracting leg lands at a steeper angle. The compliant gait falls for the shortest time from apex to touchdown (' + f(R.fallTime('humanLowStiffness') * 1000, 0) + ' ms at ' + f(lo.k / 1000, 0) + ' kN/m, against ' + f(R.fallTime('humanHighStiffness') * 1000, 0) + ' ms at ' + f(hi.k / 1000, 0) + ' kN/m), so the same clearance needs the fastest retraction (' + f(lo.retractionDegPerS, 0) + ' deg/s, against ' + f(hi.retractionDegPerS, 0) + ' deg/s). That strong correction pushes lambda toward -1: the low-stiffness preset has lambda = ' + f(lo.lambda, 3) + edge(lo.lambda) + ', where the same gait with a fixed leg angle has lambda = ' + f(R.fixedLambda('humanLowStiffness'), 2) + '.',
          'In guinea fowl running over an unexpected drop, the limb contact angle explained most of the variation in stance-phase limb loading (Daley and Biewener 2006), and swing-leg trajectories closely matched simulations optimized to regulate leg loading (Blum et al. 2014).'
        ],
        tasks: [
          'With the baseline preset loaded, press Fixed leg angle and read the foot clearance and lambda. Then press Set retraction for this clearance.',
          'Raise the minimum foot clearance to 0.08 m, press Set retraction for this clearance, and compare lambda.',
          'Load the low-stiffness preset and note its retraction rate and lambda.'
        ],
        question: 'Why does retraction leave the periodic gait unchanged?',
        answer: 'The stride depends on the leg angle at touchdown and on the touchdown time. Retraction starts from a shallower angle at apex and rotates the leg at the rate that brings it to the original touchdown angle at the original touchdown time, so stance and the rest of the stride repeat. Only the response to a change in fall time differs.'
      },
      {
        id: 'drop',
        title: '7. Unexpected drops',
        model: 'slip',
        preset: 'human',
        tab: 'perturb',
        goal: 'Follow a gait through an unexpected drop in the ground and identify how it fails.',
        body: [
          'A drop in the ground during flight lets the body fall farther before touchdown. In the model, the apex height above the new ground rises by the drop height at the same forward speed, which adds m g h of mechanical energy, and the model has no damping to remove it.',
          'With swing-leg retraction, the longer fall after a drop gives the leg more time to rotate, so it lands at a steeper angle, and the next apex undershoots. For each preset the smallest drop that ends the run within 20 strides (' + f(R.drop('humanLowStiffness').first.height * 100, 0) + ', ' + f(R.drop('human').first.height * 100, 0) + ' and ' + f(R.drop('humanHighStiffness').first.height * 100, 0) + ' cm for the low-stiffness, baseline and high-stiffness presets) completes ' + (R.drop('human').first.strides === 1 ? 'one stride' : f(R.drop('human').first.strides, 0) + ' strides') + ' after the drop; the apex at the end of that stride falls below the height needed to place the leg. The run ends through overcorrection on the first stride after the drop, even though each unperturbed stride starts with the foot ' + f(R.clearance * 100, 0) + ' cm above the ground.',
          'With a fixed leg angle, the same gaits survive drops of ' + f(R.fixedDrop('humanLowStiffness').maxDrop * 100, 0) + ', ' + f(R.fixedDrop('human').maxDrop * 100, 0) + ' and ' + f(R.fixedDrop('humanHighStiffness').maxDrop * 100, 0) + ' cm, and the first drop not survived ends the run ' + f(R.fixedDrop('humanLowStiffness').first.strides, 0) + ', ' + f(R.fixedDrop('human').first.strides, 0) + ' and ' + f(R.fixedDrop('humanHighStiffness').first.strides, 0) + ' strides after the drop, as the error builds over several strides.',
          'Real animals do not behave as a perfect conservative spring-mass system. After an unexpected drop they have time to recover with non-conservative dynamics, such as muscle work and damping, provided the leg makes contact and takes load in the stance right after the drop. The normalized maximum drop of Daley and Usherwood (2010) measures that first-contact limit: NMD = dHmax / L, with dHmax = (g / 2) (Phi / omega)^2, where Phi is the stance half-angle (90 deg minus the touchdown angle) and omega the leg retraction rate. For a larger drop the leg rotates past vertical before the foot reaches the ground and misses stance.',
          'At their own retraction rates, the NMD estimate is ' + nmd(lo.nmdEstimate) + ', ' + nmd(h.nmdEstimate) + ' and ' + nmd(hi.nmdEstimate) + ' leg lengths for the low-stiffness, baseline and high-stiffness presets' +
            (ownRises ? ': the compliant leg retracts fastest to keep its foot clearance and reaches vertical soonest, so its NMD is the smallest.' : '.') +
            ' At one common rate of ' + f(refRate, 1) + ' deg/s the values are ' + nmd(lo.nmdEstimateAtReference) + ', ' + nmd(h.nmdEstimateAtReference) + ' and ' + nmd(hi.nmdEstimateAtReference) +
            (refFalls ? ': the order reverses, because the compliant leg lands with the widest stance half-angle, the outcome Daley and Usherwood (2010) predicted.' : '.') +
            ' The simulated first-contact limit is ' + nmd(lo.nmdSimulated) + ', ' + nmd(h.nmdSimulated) + ' and ' + nmd(hi.nmdSimulated) +
            (simAbove ? '; it exceeds the estimate because it includes the downward speed at touchdown and the change in hip height.' : '.'),
          'The largest drops survived for 20 strides are ' + f(lo.maxDrop, 2) + ', ' + f(h.maxDrop, 2) + ' and ' + f(hi.maxDrop, 2) + ' leg lengths' + (farAbove ? ', far below these first-contact limits' : '') + '. The 20-stride test asks whether the conservative model, with no way to remove the added energy, keeps running; NMD asks whether the first stance after the drop begins with a loaded leg, the condition for an animal to recover with muscle work.',
          'The Perturbation tab applies one drop after the first stride, plots apex height and speed stride by stride, and reports the stride at which a run stops. The Stride tab computes the NMD estimate and the simulated first-contact limit for the current settings.'
        ],
        tasks: [
          'Set the drop to 5 cm and press Compare the three presets.',
          'In the Stride tab, press Compute simulated first-contact limit for the baseline preset, then for the low-stiffness preset.',
          'Find the smallest drop that stops the baseline gait and read the stride at which it stops.',
          'Press Fixed leg angle in the sidebar and repeat the same drop.'
        ],
        question: 'Why does a retracting leg land at a steeper angle after a drop?',
        answer: 'The leg rotates at a constant rate from apex. A drop lengthens the fall from apex to touchdown, so the leg rotates for longer and reaches a steeper angle at touchdown.'
      }
    ];
  }
};
