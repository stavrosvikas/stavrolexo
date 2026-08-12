/* Το τεύχος: φύλλα στοιβαγμένα σε 3D, γυρνάνε γύρω από τη ράχη.
   Το σύρσιμο ακολουθεί το δάχτυλο — δεν είναι απλό slide. */
window.Book = (function () {
  var stack, leaves, nav, prevBtn, nextBtn;
  var backs = [];                 // η πίσω όψη κάθε φύλλου (= η αριστερή σελίδα)
  var current = 0, count = 0, onChange = null, busy = false;

  // σύρσιμο
  var drag = null, justDragged = false;

  function mkCorner(side) {
    var c = document.createElement('div');
    c.className = 'corner ' + side;
    return c;
  }

  /* Το τσάκισμα αναβοσβήνει ΜΟΝΟ στο εξώφυλλο, για να μάθει ο χρήστης την
     κίνηση. Μέσα στα σταυρόλεξα θα ήταν σκέτη ενόχληση όσο λύνεις. */
  var hintTimer = null;
  function flashCorners() {
    if (hintTimer) clearTimeout(hintTimer);
    leaves.forEach(function (l) { l.classList.remove('show-corners'); });
    if (current !== 0) return;
    var cur = leaves[0];
    if (!cur) return;
    cur.classList.add('show-corners');
    hintTimer = setTimeout(function () {
      cur.classList.remove('show-corners');
    }, 3200);
  }

  // μετά από σύρσιμο ή πάτημα στην άκρη, το click που ακολουθεί δεν μετράει
  function suppressClick() {
    justDragged = true;
    setTimeout(function () { justDragged = false; }, 350);
  }

  function setLeaf(el, deg) {
    el.style.transform = 'rotateY(' + deg + 'deg)';
    // --curl: 0 στην αρχή/τέλος, 1 στη μέση της κίνησης. Το CSS το χρησιμοποιεί
    // για τη λάμψη στην ακμή και τη στρογγυλότητα της γωνίας -- δεν λυγίζει
    // πραγματικά το χαρτί, αλλά ο φωτισμός λέει «peel».
    var t = Math.abs(deg) / 180;
    var curl = t < .5 ? t * 2 : (1 - t) * 2;
    el.style.setProperty('--curl', curl.toFixed(3));
    var sh = el.querySelector('.shade');
    if (sh) sh.style.opacity = curl * .7;
  }

  var animating = null;        // το φύλλο που γυρνάει αυτή τη στιγμή

  function zFor(i) { return (i < current) ? i : (count - i); }

  /* Ορατά: το τρέχον φύλλο, το επόμενο, και το τελευταίο γυρισμένο — αυτό
     είναι η αριστερή σελίδα. Τα από κάτω κρύβονται, αλλιώς στοιβάζονται
     τέσσερα χαρτιά και μαυρίζει η άκρη. Το `from` επιτρέπει να κρατήσουμε
     ορατά ΚΑΙ τα φύλλα της προηγούμενης κατάστασης όσο διαρκεί η κίνηση,
     ώστε τίποτα να μην ξεπροβάλλει ή να χάνεται απότομα. */
  function applyVisibility(from) {
    var edge = Math.min(from === undefined ? current : from, current) - 1;
    for (var i = 0; i < count; i++) {
      leaves[i].style.visibility = (i < edge) ? 'hidden' : 'visible';
    }
  }

  function restack() {
    for (var i = 0; i < count; i++) {
      var el = leaves[i];
      if (el !== animating) {
        el.style.zIndex = zFor(i);
        if (!drag || drag.leaf !== el) setLeaf(el, i < current ? -180 : 0);
      }
    }
    applyVisibility();
  }

  function go(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(count - 1, i));
    if (i === current) { restack(); return; }
    if (busy) return;

    var back = i < current;
    var from = current, movingIdx = back ? i : current;
    var moving = leaves[movingIdx];
    busy = true;
    animating = moving;
    moving.classList.add('turning');
    moving.style.zIndex = count + 5;
    if (opts.silent !== true) SFX.page(back);

    // ξεκίνα από τη σωστή γωνία και πήγαινε στην άλλη άκρη
    setLeaf(moving, back ? -180 : 0);
    void moving.offsetWidth;                       // force reflow
    requestAnimationFrame(function () {
      setLeaf(moving, back ? 0 : -180);
    });

    current = i;
    // Η αριστερή σελίδα ξεκλειδώνεται ΑΜΕΣΩΣ, όχι στο τέλος της κίνησης —
    // αλλιώς πηγαίνοντας πίσω ξεπρόβαλλε καθυστερημένα.
    applyVisibility(from);
    if (onChange) onChange(i);
    paintNav();

    // Στη μέση της διαδρομής το φύλλο περνάει τη ράχη: εκεί κατεβαίνει στο
    // τελικό του επίπεδο, ώστε η σκιά να μη «διορθώνεται» μετά το τέλος.
    setTimeout(function () {
      if (animating === moving) moving.style.zIndex = zFor(movingIdx);
    }, 330);

    setTimeout(function () {
      moving.classList.remove('turning');
      animating = null;
      busy = false;
      restack();
      flashCorners();
    }, 640);
  }

  function jump(i) {                               // χωρίς animation (αρχικό φόρτωμα)
    current = Math.max(0, Math.min(count - 1, i));
    restack();
    paintNav();
    flashCorners();
    if (onChange) onChange(current);
  }

  function paintNav() {
    Array.prototype.forEach.call(nav.children, function (d, n) {
      d.classList.toggle('on', n === current);
    });
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === count - 1;
  }

  /* ── σύρσιμο ──────────────────────────────────────────────────── */

  /* Η σελίδα πιάνεται από την ΚΑΤΩ ΓΩΝΙΑ, όχι από όλο το πλάι.
     Πριν η ζώνη έπιανε όλο το ύψος και έτρωγε πατήματα σε κελιά του
     πλέγματος. Η γωνία είναι μικρός στόχος, μακριά από το σώμα του
     σταυρόλεξου, και συμπίπτει με το σημείο που δείχνει το animation. */
  function corner(clientX, clientY, target) {
    if (!stack) return null;
    var r = stack.getBoundingClientRect();
    var w = Math.max(34, Math.min(84, r.width * .18));
    var h = Math.max(70, Math.min(180, r.height * .18));
    if (clientY < r.bottom - h) return null;
    if (clientX >= r.right - w) return 'right';
    // Η ελεύθερη ακμή της αριστερής σελίδας είναι ΤΕΡΜΑ ΑΡΙΣΤΕΡΑ, όχι στη
    // ράχη — από εκεί την πιάνεις για να γυρίσεις πίσω.
    var leftEdge = Math.max(0, r.left - r.width);
    if (clientX <= leftEdge + w) return 'left';
    return null;
  }

  function inEdgeZone(clientX, clientY, target) {
    return corner(clientX, clientY, target) !== null;
  }

  function canDrag(e) {
    if (busy) return false;
    if (e.target.closest('button')) return false;
    if (inEdgeZone(e.clientX, e.clientY, e.target)) return true;  // από τη γωνία, πάντα
    if (e.target.closest('.gridwrap')) return false; // αλλιώς το πλέγμα κάνει pan
    if (e.target.closest('#dots-wrap')) return false;
    if (e.target.closest('.last')) return false;
    return true;
  }

  function down(e) {
    if (!canDrag(e)) return;
    drag = { x: e.clientX, y: e.clientY, leaf: null, back: false, deg: 0,
             live: false, edge: corner(e.clientX, e.clientY, e.target) };
  }

  function move(e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.live) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      drag.back = dx > 0;
      var idx = drag.back ? current - 1 : current;
      if (idx < 0 || idx >= count || (drag.back && current === 0) ||
          (!drag.back && current === count - 1)) { drag = null; return; }
      drag.leaf = leaves[idx];
      drag.leaf.style.zIndex = count + 5;
      drag.leaf.classList.remove('turning');
      drag.live = true;
      // ξεκλείδωσε από τώρα ό,τι θα φανεί, ώστε να μη ξεπροβάλλει στο τέλος
      applyVisibility(drag.back ? current - 1 : current);
    }
    var w = stack.clientWidth || 1;
    var frac = Math.max(0, Math.min(1, Math.abs(dx) / w));
    drag.deg = drag.back ? -180 + frac * 180 : -frac * 180;
    setLeaf(drag.leaf, drag.deg);
  }

  function up() {
    if (!drag) return;
    var d = drag;
    drag = null;

    // Σκέτο πάτημα στην άκρη (χωρίς σύρσιμο) γυρίζει κι αυτό σελίδα —
    // δεξιά μπροστά, αριστερά πίσω, όπως και στη διπλανή ανοιχτή σελίδα.
    if (!d.live) {
      if (!d.edge) return;
      var target = d.edge === 'left' ? current - 1 : current + 1;
      if (target < 0 || target >= count || target === current) return;
      suppressClick();
      go(target);
      return;
    }
    suppressClick();
    d.leaf.classList.add('turning');
    // πέρασε τη μέση; τότε ολοκλήρωσε το γύρισμα, αλλιώς γύρνα πίσω
    var complete = d.back ? d.deg > -90 : d.deg < -90;
    if (complete) {
      SFX.page(d.back);
      var from = current;
      current = d.back ? current - 1 : current + 1;
      setLeaf(d.leaf, d.back ? 0 : -180);
      applyVisibility(from);
      if (onChange) onChange(current);
      paintNav();
    } else {
      setLeaf(d.leaf, d.back ? -180 : 0);
    }
    setTimeout(function () {
      d.leaf.classList.remove('turning');
      restack();
    }, 640);
  }

  return {
    init: function (opts) {
      stack = document.getElementById('stack');
      leaves = Array.prototype.slice.call(stack.querySelectorAll('.leaf'));
      nav = document.getElementById('dots-nav');
      prevBtn = document.getElementById('prev');
      nextBtn = document.getElementById('next');
      count = leaves.length;
      onChange = opts && opts.onChange;

      /* Κάθε φύλλο έχει δύο ΠΡΑΓΜΑΤΙΚΕΣ πλευρές, όπως στο χαρτί: μπροστά η
         σελίδα του, πίσω η σελίδα που βλέπεις αριστερά αφού το γυρίσεις.
         Τα φύλλα δεν τσακίζουν από τη ράχη, οπότε τσάκισμα μπαίνει μόνο στην
         ελεύθερη ακμή — δεξιά μπροστά, και στην πίσω όψη δεξιά τοπικά, που
         λόγω του καθρεφτίσματος εμφανίζεται τέρμα αριστερά. */
      leaves.forEach(function (l, i) {
        var front = l.querySelector('.face.front');
        var sh = document.createElement('div');
        sh.className = 'shade';
        front.appendChild(sh);
        if (i < count - 1) front.appendChild(mkCorner('r'));

        var back = document.createElement('div');
        back.className = 'face back';
        var inner = document.createElement('div');
        inner.className = 'back-inner';
        back.appendChild(inner);
        if (i < count - 1) back.appendChild(mkCorner('l'));
        l.appendChild(back);
        backs.push(inner);
      });

      for (var i = 0; i < count; i++) {
        var d = document.createElement('div');
        d.className = 'pdot';
        d.dataset.i = i;
        d.addEventListener('click', function (e) { go(+e.currentTarget.dataset.i); });
        nav.appendChild(d);
      }

      prevBtn.addEventListener('click', function () { go(current - 1); });
      nextBtn.addEventListener('click', function () { go(current + 1); });
      document.addEventListener('click', function (e) {
        // αν μόλις έγινε σύρσιμο, το click που ακολουθεί δεν μετράει
        if (justDragged) return;
        var t = e.target.closest('[data-goto]');
        if (t) go(+t.dataset.goto);
      });

      stack.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);

      jump(Store.page());
    },
    go: go,
    current: function () { return current; },
    inEdgeZone: inEdgeZone,
    restack: restack,
    /* Η πίσω όψη του φύλλου i — δηλαδή η αριστερή σελίδα που βλέπεις όταν
       είσαι στη σελίδα i+1. Εκεί τυπώνονται οι ορισμοί. */
    back: function (i) { return backs[i] || null; }
  };
})();
