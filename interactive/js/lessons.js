/*
 * lessons.js
 * Guided lessons for the Spring-Mass Running Lab.
 *
 * HDS_LESSONS.build(R) returns the lesson list. R supplies numbers taken at
 * run time from the MATLAB reference data (js/reference.js), so the text
 * quotes the same values the toolkit computes:
 *   R.preset(name)  preset row (k, legAngleDeg, apexHeight, lambda, nmdEstimate, ...)
 *   R.fam           summary of the same-speed stiffness family (see app.js)
 *   R.f(v, d)       number formatted with d decimals
 *   R.retraction    common retraction of the presets {name, rule, value (deg per gait cycle), degPerS}
 *   R.human4        measured human swing-leg row at the common rate (Blum et al. 2011)
 *   R.swing         all measured swing-leg rows; R.rules(name), R.sweep(name) retraction comparison
 *   R.fixedLambda(name)     eigenvalue with a fixed leg angle
 *   R.dropResponses(name)   first stance after drops of R.dropHeights (m):
 *                           [{h, contact, outcome, angle, force, fixedContact, fixedAngle, fixedForce}]
 *                           with the preset retraction and with a fixed leg angle
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

    var edge = function (lam) { return Math.abs(lam) > 1 ? ', beyond the stability limit' : (Math.abs(lam) > 0.95 ? ', at the edge of stability' : ''); };
    var RT = R.retraction, H4 = R.human4;
    var rateText = f(RT.value, 1) + ' deg per gait cycle' + (H4 ? ', the human leg rotation rate at touchdown at ' + f(H4.speed_mps, 2) + ' m/s (Blum et al. 2011)' : '') +
      ', or ' + f(RT.degPerS, 1) + ' deg/s for these gaits';
    var nmd = function (v) { return v === null || v === undefined || v === Infinity ? 'no limit' : f(v, 2); };
    // First stance after drops, computed live by SlipSim.dropResponse.
    var DR = { lo: R.dropResponses('humanLowStiffness'), h: R.dropResponses('human'), hi: R.dropResponses('humanHighStiffness') };
    var cm = function (rows) { return rows.map(function (d) { return f(d.h * 100, 0); }); };
    var listOf = function (v) { return v.length > 1 ? v.slice(0, -1).join(', ') + ' and ' + v[v.length - 1] : v.join(''); };
    var forces = function (rows, key) {
      return rows.map(function (d) {
        var fx = key === 'fixed';
        var ok = fx ? d.fixedContact && d.fixedAngle <= 90 : d.contact && d.angle <= 90;
        return ok ? f(fx ? d.fixedForce : d.force, 2) : 'missed stance';
      });
    };
    var nearSteady = ['lo', 'h', 'hi'].every(function (g) {
      var r = DR[g], f0 = r[0].force;
      return r.every(function (d) { return d.contact && Math.abs(d.force - f0) <= 0.1 * f0; });
    });
    var fixedRises = ['lo', 'h', 'hi'].every(function (g) {
      var r = DR[g];
      for (var i = 1; i < r.length; i++) if (!(r[i].fixedContact && r[i].fixedForce > r[i - 1].fixedForce)) return false;
      return true;
    });
    var steeper = DR.h.every(function (d, i) { return i === 0 || d.angle > DR.h[i - 1].angle; });
    var misses = ['lo', 'h', 'hi'].map(function (g) { return DR[g].filter(function (d) { return !d.contact || d.angle > 90; }).length; })
      .reduce(function (a, b) { return a + b; }, 0);
    var simAbove = [lo, h, hi].every(function (g) { return g.nmdSimulated === null || g.nmdSimulated > g.nmdEstimate; });
    var rh = R.rules('human'), rl = R.rules('humanLowStiffness');
    var sweepH = R.sweep('human');
    var overRate = null;
    for (var si = 0; si < sweepH.length; si++) { if (sweepH[si].lambda < -1) { overRate = sweepH[si].retractionDegPerS; break; } }
    var finite = function (v) { return v !== null && v !== undefined && isFinite(v); };
    var tradeOff = finite(rh.fastestRecovery.nmdEstimate) && finite(rh.groundSpeedMatching.nmdEstimate) &&
      rh.fastestRecovery.nmdEstimate > rh.groundSpeedMatching.nmdEstimate && rh.fastestRecovery.peakForceAfterDropBW > rh.groundSpeedMatching.peakForceAfterDropBW;
    var humanBetween = rh.commonPerCycle.retractionDegPerS > rh.fastestRecovery.retractionDegPerS && rh.commonPerCycle.retractionDegPerS < rh.groundSpeedMatching.retractionDegPerS;
    var humanClose = H4 && Math.abs(rh.commonPerCycle.groundSpeedMatching * 100 - H4.groundSpeedMatching_pct) <= H4.groundSpeedMatchingSD_pct &&
      Math.abs(rh.commonPerCycle.nmdEstimate - H4.nmd) <= H4.nmdSD;
    var rangeOf = function (species, field) {
      var v = R.swing.filter(function (r) { return r.species === species; }).map(function (r) { return r[field]; });
      return [Math.min.apply(null, v), Math.max.apply(null, v)];
    };
    var humLen = rangeOf('human', 'legLengthChange_L0PerCycle'), pheLen = rangeOf('pheasant', 'legLengthChange_L0PerCycle');
    var humTd = rangeOf('human', 'touchdownAngle_deg'), pheTd = rangeOf('pheasant', 'touchdownAngle_deg');
    var humRot = rangeOf('human', 'legRotation_degPerCycle'), pheRot = rangeOf('pheasant', 'legRotation_degPerCycle');
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
          'Forces appear in body weights. Over a periodic stride the average vertical force equals one body weight, so a short contact needs a high peak force.',
          'The Stride tab also draws two phase portraits of the run in the animation. In panel A, body height against vertical velocity, one stride of a periodic gait traces a closed loop, and the apex is the point where the loop crosses zero vertical velocity in flight, the section of the return map in lesson 4 (apex height ' + f(h.apexHeight, 3) + ' m for the baseline). In panel B, leg length against leg angle from the ground, as in the stride phase plots of Blum et al. (2011), flight runs at the rest length of ' + f(h.L0, 2) + ' m while the leg retracts, stance dips as the leg compresses and sweeps rearward, and the reset of the leg at apex appears as a jump, drawn as a dotted line. An orange dot on both portraits follows the animation.'
        ],
        tasks: [
          'Open the Stride tab and find the time of the peak vertical force. Where is the leg at that time?',
          'Increase the leg stiffness and watch the contact time and the peak force.',
          'Compare the kinetic and elastic energy traces during stance.',
          'Turn on Show a perturbed start in the Stride tab, set Dot and animation follow to perturbed start, and step through the run with Next event.',
          'Load the low-stiffness and the high-stiffness presets in turn and compare their loops in both portraits.'
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
          'Every gait in the family uses one swing-leg retraction rate, ' + rateText + '. Retraction leaves each gait unchanged, so the forces and timing match the same gaits with a fixed leg angle; it changes only the stability (lesson 6).',
          'The eigenvalue lambda measures how fast a small error in apex height decays from stride to stride. In this family ' + signText + '. lambda is most negative (' + f(F.lambdaMin, 2) + ') at ' + f(F.kLambdaMin, 0) + ' kN/m' + edge(F.lambdaMin) + ', and |lambda| is smallest near ' + f(F.kBest, 0) + ' kN/m.',
          'Daley and Usherwood (2010) proposed a drop measure, the normalized maximum drop (NMD): the largest drop, in leg lengths, for which the leg still reaches the ground before rotating past vertical, so the first stance after the drop can take load (lesson 7). At the common retraction rate the NMD estimate is ' + nmd(lo.nmdEstimate) + ' for the low-stiffness preset, ' + nmd(h.nmdEstimate) + ' for the baseline and ' + nmd(hi.nmdEstimate) + ' for the high-stiffness preset' +
            (lo.nmdEstimate > h.nmdEstimate && h.nmdEstimate > hi.nmdEstimate ? ': the compliant leg, with the widest stance half-angle, has the largest NMD, the outcome Daley and Usherwood (2010) predicted.' : '.')
        ],
        tasks: [
          'Load the three presets in turn and compare touchdown angle, contact time, peak force and lambda.',
          'In the Perturbation tab, press Compare the three presets with a 5 cm drop.',
          'Recompute the family with the retraction rule set to a fixed leg angle and compare the eigenvalue panel.'
        ],
        question: 'Two gaits run at the same speed and step frequency. One leg is twice as stiff as the other. Which gait has the higher peak vertical force, and why?',
        answer: 'The stiffer leg. Both gaits have the same step period and the same average vertical force, one body weight. The stiffer leg delivers that impulse during a shorter contact, which needs a higher peak force.'
      },
      {
        id: 'retraction',
        title: '6. Choosing swing-leg retraction rate',
        model: 'slip',
        preset: 'human',
        tab: 'retraction',
        goal: 'Compare rules for the swing-leg retraction rate and the trade-offs among recovery, foot clearance, leg force and first contact.',
        body: [
          'In the model the leg angle is set at apex and then rotates rearward at a constant rate until touchdown (Seyfarth et al. 2003). For a periodic gait the rate is a free choice: the toolkit adjusts the leg angle at apex so that the leg lands at the same angle and the same time, and the stance, forces, speed and step frequency stay the same. The rate changes only how the runner responds to errors and perturbations.',
          'The Retraction rate tab compares five rules for the baseline gait. A fixed leg angle uses no retraction. The human rule uses the leg rotation measured in people running at ' + (H4 ? f(H4.speed_mps, 2) : '4') + ' m/s, ' + f(rh.commonPerCycle.retractionDegPerCycle, 1) + ' deg per gait cycle (Blum et al. 2011), or ' + f(rh.commonPerCycle.retractionDegPerS, 0) + ' deg/s for this gait. The clearance rule places the foot ' + f(rh.clearance.apexClearance * 100, 0) + ' cm above the ground at apex (' + f(rh.clearance.retractionDegPerS, 0) + ' deg/s). The fastest-recovery rule sets lambda to 0, so a small error in apex height disappears within one stride (' + f(rh.fastestRecovery.retractionDegPerS, 0) + ' deg/s). The ground-speed-matching rule brings the speed of the foot relative to the ground at touchdown as close to zero as a constant-length rotating leg allows (' + f(rh.groundSpeedMatching.retractionDegPerS, 0) + ' deg/s, ground speed matching ' + f(rh.groundSpeedMatching.groundSpeedMatching * 100, 0) + ' %). Blum et al. (2010) introduced ground speed matching and analyzed swing-leg strategies in human running.',
          'Daley and Usherwood (2010) described a trade-off in the retraction rate. Slow retraction raises NMD, which lowers the risk of a fall, and raises the leg force after a drop; fast retraction lowers the force after a drop, which lowers the risk of injury, and lowers NMD.' +
            (tradeOff ? ' In the baseline gait, the NMD estimate falls from ' + nmd(rh.fastestRecovery.nmdEstimate) + ' at the fastest-recovery rate to ' + nmd(rh.groundSpeedMatching.nmdEstimate) + ' at the ground-speed-matching rate, and the peak leg force after a ' + f(R.rulesDrop * 100, 0) + ' cm drop falls from ' + f(rh.fastestRecovery.peakForceAfterDropBW, 2) + ' to ' + f(rh.groundSpeedMatching.peakForceAfterDropBW, 2) + ' body weights (' + f(rh.fixed.peakForceSteadyBW, 2) + ' in the steady gait).' : ''),
          'In this conservative model, fast retraction also overcorrects: ' + (overRate !== null ? 'in the baseline gait lambda falls below -1 above about ' + f(overRate, 0) + ' deg/s, and lambda = ' + f(rh.groundSpeedMatching.lambda, 2) + ' at the ground-speed-matching rate.' : 'lambda approaches -1 at fast rates.') +
            ' Fastest recovery needs slow retraction in the baseline gait (' + f(rh.fastestRecovery.retractionDegPerS, 0) + ' deg/s)' +
            (rl.fastestRecovery.retractionDegPerS === 0 ? ' and none in the low-stiffness gait, where lambda is already ' + f(rl.fixed.lambda, 2) + ' with a fixed leg angle.' : '.'),
          (humanBetween ? 'The human rate lies between the rates for fastest recovery and for ground speed matching. ' : '') + 'At the human rate the model has ground speed matching of ' + f(rh.commonPerCycle.groundSpeedMatching * 100, 0) + ' % and an NMD estimate of ' + nmd(rh.commonPerCycle.nmdEstimate) +
            (H4 ? ', ' + (humanClose ? 'close to' : 'against') + ' the ' + H4.groundSpeedMatching_pct + ' +/- ' + H4.groundSpeedMatchingSD_pct + ' % and ' + f(H4.nmd, 2) + ' +/- ' + f(H4.nmdSD, 2) + ' measured in humans at ' + f(H4.speed_mps, 2) + ' m/s (Blum et al. 2011)' : '') +
            ', with lambda = ' + f(rh.commonPerCycle.lambda, 2) + (rh.commonPerCycle.lambda < -0.8 ? ', near -1.' : '.'),
          'Real runners have more control than this model. Humans shorten the leg before contact (' + f(-humLen[1], 2) + ' to ' + f(-humLen[0], 2) + ' leg lengths per gait cycle) and pheasants lengthen it (' + f(pheLen[0], 2) + ' to ' + f(pheLen[1], 2) + '), and Blum et al. (2011) proposed that humans also adjust leg stiffness in anticipation of contact. Pheasants run with flatter touchdown angles (' + f(pheTd[0], 0) + ' to ' + f(pheTd[1], 0) + ' deg, against ' + f(humTd[0], 0) + ' to ' + f(humTd[1], 0) + ' deg in humans) and faster leg rotation per gait cycle (' + f(pheRot[0], 0) + ' to ' + f(pheRot[1], 0) + ' deg, against ' + f(humRot[0], 0) + ' to ' + f(humRot[1], 0) + ' deg), and they lengthen the leg; in that study this combination, with leg lengthening as the largest influence, gave pheasants the larger NMD.',
          'On uneven ground, humans and cursorial birds use similar swing-leg adaptations of leg angle and leg length, and the crouched avian leg has the greater range of adjustment for drops and downward steps (M\u00fcller et al. 2016).',
          'Guinea fowl stepping down a visible drop used swing-leg trajectories that closely matched simulations optimized to regulate leg loading; trajectories optimized to keep a steady gait did not match (Blum et al. 2014). Vejdani et al. (2013) built on such load-regulating policies to design swing-leg control for spring-mass robots running on ground with unexpected height disturbances.'
        ],
        tasks: [
          'Open the Retraction rate tab and compare the five rules in the table.',
          'Load the fastest-recovery rule, apply a 5 cm drop in the Perturbation tab, then repeat with the ground-speed-matching rule.',
          'Load the low-stiffness preset and read the note for fastest recovery.',
          'Change the leg stiffness, press Find periodic gait, then Recompute for the current gait in the Retraction rate tab.'
        ],
        question: 'A runner changes from the ground-speed-matching rate to the fastest-recovery rate. What happens to the NMD estimate and to the peak leg force after an unexpected drop, and why?',
        answer: 'Both rise. With slower retraction the leg takes longer to rotate to vertical, so a larger drop still allows contact and NMD rises. After a drop, the slowly retracting leg also lands at a shallower angle and compresses more, so the peak force rises. Faster retraction lands steeper after a drop, which lowers the force but leaves less time before the leg passes vertical.'
      },
      {
        id: 'drop',
        title: '7. Unexpected drops',
        model: 'slip',
        preset: 'human',
        tab: 'perturb',
        goal: 'Measure the first stance after an unexpected drop: whether the leg makes contact, its touchdown angle and the peak leg force.',
        body: [
          'A drop in the ground during flight lets the body fall farther before touchdown. In the model, the apex height above the new ground rises by the drop height at the same forward speed, which adds m g h of mechanical energy, and the model has no damping to remove it.',
          'The presets use the human retraction rate (lesson 6), which places the foot ' + f(lo.apexClearance * 100, 1) + ', ' + f(h.apexClearance * 100, 1) + ' and ' + f(hi.apexClearance * 100, 1) + ' cm above the ground at apex in the low-stiffness, baseline and high-stiffness gaits. After a drop the body falls for longer, so the retracting leg rotates further before touchdown' +
            (steeper ? ' and lands at a steeper angle: in the baseline gait the touchdown angle is ' + listOf(DR.h.map(function (d) { return d.contact ? f(d.angle, 1) : 'none'; })) + ' deg after drops of ' + listOf(cm(DR.h)) + ' cm.' : '.') +
            (nearSteady ? ' The steeper landing nearly offsets the faster downward speed at touchdown, so the peak leg force stays close to its steady value: ' : ' The peak leg force in the first stance is ') +
            listOf(forces(DR.h)) + ' body weights in the baseline gait, ' + listOf(forces(DR.lo)) + ' in the low-stiffness gait and ' + listOf(forces(DR.hi)) + ' in the high-stiffness gait, for the same drops.' +
            (misses ? ' A missed stance means the leg did not reach the ground in front of vertical in the first stance.' : ''),
          'With a fixed leg angle, the same gaits land at the same angle after every drop' + (fixedRises ? ', and the peak leg force rises with the drop' : '') + ': ' +
            listOf(forces(DR.h, 'fixed')) + ' body weights in the baseline gait, ' + listOf(forces(DR.lo, 'fixed')) + ' in the low-stiffness gait and ' + listOf(forces(DR.hi, 'fixed')) + ' in the high-stiffness gait after drops of ' + listOf(cm(DR.h)) + ' cm.',
          'In guinea fowl running over an unexpected drop, adjustment of limb contact angle accounted for 80 % of the variation in stance-phase limb loading after the drop (Daley and Biewener 2006).',
          'Real animals do not behave as a perfect conservative spring-mass system. After an unexpected drop they have time to recover with non-conservative dynamics, such as muscle work and damping, provided the leg makes contact and takes load in the stance right after the drop. The normalized maximum drop of Daley and Usherwood (2010) measures that first-contact limit: NMD = dHmax / L, with dHmax = (g / 2) (Phi / omega)^2, where Phi is the stance half-angle (90 deg minus the touchdown angle) and omega the leg retraction rate. For a larger drop the leg rotates past vertical before the foot reaches the ground and misses stance.',
          'At the common retraction rate the NMD estimate is ' + nmd(lo.nmdEstimate) + ', ' + nmd(h.nmdEstimate) + ' and ' + nmd(hi.nmdEstimate) + ' leg lengths for the low-stiffness, baseline and high-stiffness presets' +
            (lo.nmdEstimate > h.nmdEstimate && h.nmdEstimate > hi.nmdEstimate ? ': the compliant leg lands with the widest stance half-angle and has the largest NMD, the outcome Daley and Usherwood (2010) predicted.' : '.') +
            ' The simulated first-contact limit is ' + nmd(lo.nmdSimulated) + ', ' + nmd(h.nmdSimulated) + ' and ' + nmd(hi.nmdSimulated) +
            (simAbove ? '; it exceeds the estimate because it includes the downward speed at touchdown and the change in hip height.' : '.'),
          'The Perturbation tab applies one drop after the first stride and reports the first stance after the drop: contact, touchdown angle and peak leg force, with the fixed-leg-angle value for the same drop and the NMD for comparison. It also plots apex height and speed stride by stride. The Stride tab computes the NMD estimate and the simulated first-contact limit for the current settings.'
        ],
        tasks: [
          'In the Perturbation tab, set the drop to 5, 10 and 20 cm in turn and read the touchdown angle and peak leg force in the first stance after the drop.',
          'Press Compare the three presets at 10 cm and compare each peak leg force with the fixed-leg-angle value for the same drop.',
          'Raise the drop until the leg misses the first stance, and compare that height with the simulated first-contact limit in the table.',
          'Set the retraction rule to a fixed leg angle in the sidebar, apply it, and repeat the same drops.'
        ],
        question: 'Why does a retracting leg land at a steeper angle after a drop?',
        answer: 'The leg rotates at a constant rate from apex. A drop lengthens the fall from apex to touchdown, so the leg rotates for longer and reaches a steeper angle at touchdown.'
      }
    ];
  }
};
