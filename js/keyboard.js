/* Δικό μας ελληνικό πληκτρολόγιο.
   Γιατί όχι το native: σε κινητό ανοίγει με αγγλικό layout, βάζει autocorrect,
   και πετάει το viewport πάνω-κάτω. Εδώ ξέρουμε ακριβώς τι πατήθηκε. */
window.Keyboard = (function () {
  var ROWS = [
    'ΕΡΤΥΘΙΟΠ',
    'ΑΣΔΦΓΗΞΚΛ',
    'ΖΧΨΩΒΝΜ'
  ];

  // αντιστοίχιση λατινικού πληκτρολογίου -> ελληνικά (θέσεις Windows)
  var LATIN = {
    q: 'Q', w: 'Σ', e: 'Ε', r: 'Ρ', t: 'Τ', y: 'Υ', u: 'Θ', i: 'Ι', o: 'Ο', p: 'Π',
    a: 'Α', s: 'Σ', d: 'Δ', f: 'Φ', g: 'Γ', h: 'Η', j: 'Ξ', k: 'Κ', l: 'Λ',
    z: 'Ζ', x: 'Χ', c: 'Ψ', v: 'Ω', b: 'Β', n: 'Ν', m: 'Μ'
  };

  var TONOS = {
    'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
    'Ϊ': 'Ι', 'Ϋ': 'Υ', 'Σ': 'Σ', 'ς': 'Σ'
  };

  function normalise(ch) {
    ch = ch.toUpperCase();
    if (TONOS[ch]) return TONOS[ch];
    if (/^[Α-Ω]$/.test(ch)) return ch;
    var lat = LATIN[ch.toLowerCase()];
    return lat && lat !== 'Q' ? lat : null;
  }

  return {
    init: function (el, handlers) {
      ROWS.forEach(function (row, ri) {
        var div = document.createElement('div');
        div.className = 'krow';
        row.split('').forEach(function (ch) {
          var k = document.createElement('div');
          k.className = 'key';
          k.textContent = ch;
          k.dataset.k = ch;
          div.appendChild(k);
        });
        if (ri === 2) {
          var del = document.createElement('div');
          del.className = 'key wide del';
          del.textContent = '⌫';
          del.dataset.k = 'DEL';
          div.appendChild(del);
        }
        el.appendChild(div);
      });

      el.addEventListener('pointerdown', function (e) {
        var k = e.target.closest('.key');
        if (!k) return;
        e.preventDefault();
        if (k.dataset.k === 'DEL') handlers.del();
        else handlers.letter(k.dataset.k);
      });

      document.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Backspace') { e.preventDefault(); handlers.del(); return; }
        if (e.key === 'ArrowRight' || e.key === 'Tab') { e.preventDefault(); handlers.step(1); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); handlers.step(-1); return; }
        if (e.key.length !== 1) return;
        var ch = normalise(e.key);
        if (ch) { e.preventDefault(); handlers.letter(ch); }
      });
    },

    /* Δεν χρησιμοποιούμε πουθενά <input>, άρα το πληκτρολόγιο του κινητού δεν
       μπορεί να ανοίξει ποτέ. Αυτό κρίνει μόνο αν δείχνουμε το δικό μας — με
       βάση το πλάτος, ώστε να δουλεύει και το device mode των developer tools
       (το hover media query δεν αλλάζει αξιόπιστα εκεί). */
    wantsOnScreen: function () {
      return window.matchMedia('(max-width: 899px)').matches ||
             window.matchMedia('(pointer: coarse)').matches;
    },

    normalise: normalise
  };
})();
