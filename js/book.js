/* Το τεύχος: φύλλα στοιβαγμένα σε 3D, γυρνάνε γύρω από τη ράχη.
   Το σύρσιμο ακολουθεί το δάχτυλο — δεν είναι απλό slide. */
window.Book = (function () {
  var stack, leaves, nav, prevBtn, nextBtn;
  var current = 0, count = 0, onChange = null, busy = false;

  // σύρσιμο
  var drag = null, justDragged = false;

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

  function restack() {
    for (var i = 0; i < count; i++) {
      var el = leaves[i];
      el.style.zIndex = (i < current) ? i : (count - i);
      if (!drag || drag.leaf !== el) {
        setLeaf(el, i < current ? -180 : 0);
      }
    }
  }

  function go(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(count - 1, i));
    if (i === current) { restack(); return; }
    if (busy) return;

    var back = i < current;
    var moving = back ? leaves[i] : leaves[current];
    busy = true;
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
    if (onChange) onChange(i);
    paintNav();

    setTimeout(function () {
      moving.classList.remove('turning');
      busy = false;
      restack();
    }, 640);
  }

  function jump(i) {                               // χωρίς animation (αρχικό φόρτωμα)
    current = Math.max(0, Math.min(count - 1, i));
    restack();
    paintNav();
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

  /* Πόσο κοντά στην άκρη πρέπει να ξεκινήσει το σύρσιμο για να μετρήσει ως
     γύρισμα σελίδας. Χρειάζεται γιατί στις σελίδες του πλέγματος το .gridwrap
     πιάνει όλη τη σελίδα και τρώει το gesture — όπως ακριβώς σε ένα βιβλίο,
     τη σελίδα την πιάνεις από την άκρη. */
  function edgeZone() {
    if (!stack) return 0;
    return Math.max(28, Math.min(64, stack.clientWidth * .11));
  }

  function edgeSide(clientX) {
    if (!stack) return null;
    var r = stack.getBoundingClientRect(), e = edgeZone();
    if ((clientX - r.left) < e) return 'left';    // και αριστερότερα (διπλανή σελίδα)
    if ((r.right - clientX) < e) return 'right';
    return null;
  }

  function inEdgeZone(clientX) {
    return edgeSide(clientX) !== null;
  }

  function canDrag(e) {
    if (busy) return false;
    if (e.target.closest('button')) return false;
    if (inEdgeZone(e.clientX)) return true;          // από την άκρη, πάντα
    if (e.target.closest('.gridwrap')) return false; // αλλιώς το πλέγμα κάνει pan
    if (e.target.closest('#dots-wrap')) return false;
    if (e.target.closest('.last')) return false;
    return true;
  }

  function down(e) {
    if (!canDrag(e)) return;
    drag = { x: e.clientX, y: e.clientY, leaf: null, back: false, deg: 0,
             live: false, edge: edgeSide(e.clientX) };
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
      current = d.back ? current - 1 : current + 1;
      setLeaf(d.leaf, d.back ? 0 : -180);
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

      // Κάθε φύλλο αποκτά πίσω όψη: μόλις περάσει τις 90 μοίρες βλέπεις την
      // ανάποδη του χαρτιού, όχι κενό. Αυτό κάνει το γύρισμα να μοιάζει φύλλο.
      leaves.forEach(function (l) {
        var front = l.querySelector('.face.front');
        var sh = document.createElement('div');
        sh.className = 'shade';
        front.appendChild(sh);
        var hint = document.createElement('div');
        hint.className = 'edge-hint';
        front.appendChild(hint);
        var back = document.createElement('div');
        back.className = 'face back';
        l.appendChild(back);
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
    edgeZone: edgeZone
  };
})();
