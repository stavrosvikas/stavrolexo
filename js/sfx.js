/* Ήχοι — φτιάχνονται με WebAudio, κανένα αρχείο να κατέβει.
   Το γύρισμα σελίδας είναι θόρυβος περασμένος από bandpass που σαρώνει:
   ακούγεται σαν χαρτί που τρίβεται. */
window.SFX = (function () {
  var ctx = null, master = null, on = true;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = .5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise(dur, shape) {
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * shape(i / n);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  return {
    enabled: function (v) { if (v !== undefined) on = v; return on; },
    unlock: function () { ensure(); },

    /* γύρισμα σελίδας */
    page: function (back) {
      if (!on || !ensure()) return;
      var t = ctx.currentTime, dur = .5;
      var src = noise(dur, function (u) {
        // δύο μικρά «σπρωξίματα»: το πιάσιμο και το πέσιμο της σελίδας
        return Math.pow(Math.sin(Math.PI * Math.pow(u, .75)), 1.7) *
               (.75 + .25 * Math.sin(u * 34));
      });
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = .7;
      var f0 = back ? 2600 : 900, f1 = back ? 900 : 3200;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(f1, t + dur * .7);
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 420;
      var g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.5, t + .06);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(master);
      src.start(t); src.stop(t + dur);
    },

    /* πάτημα πλήκτρου — στεγνό κλικ */
    key: function () {
      if (!on || !ensure()) return;
      var t = ctx.currentTime;
      var src = noise(.03, function (u) { return 1 - u; });
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.4;
      var g = ctx.createGain();
      g.gain.setValueAtTime(.18, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .03);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t); src.stop(t + .04);
    },

    /* σωστή λέξη — δύο νότες πάνω */
    good: function () {
      if (!on || !ensure()) return;
      var t = ctx.currentTime;
      [0, .09].forEach(function (d, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = i ? 1174.7 : 880;         // A5 -> D6
        g.gain.setValueAtTime(.0001, t + d);
        g.gain.exponentialRampToValueAtTime(.16, t + d + .015);
        g.gain.exponentialRampToValueAtTime(.0001, t + d + .22);
        o.connect(g); g.connect(master);
        o.start(t + d); o.stop(t + d + .24);
      });
    },

    /* λάθος λέξη — χαμηλό μπιπ */
    bad: function () {
      if (!on || !ensure()) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(196, t);
      o.frequency.exponentialRampToValueAtTime(140, t + .16);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.09, t + .02);
      g.gain.exponentialRampToValueAtTime(.0001, t + .2);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + .22);
    },

    /* τελεία στο connect-the-dots */
    dot: function (i) {
      if (!on || !ensure()) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 520 + (i % 12) * 34;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.12, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + .13);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + .15);
    }
  };
})();

/* ξεκλείδωμα ήχου στην πρώτη επαφή (iOS) */
['pointerdown', 'keydown'].forEach(function (ev) {
  window.addEventListener(ev, function once() {
    SFX.unlock();
    window.removeEventListener(ev, once);
  }, { once: true });
});
