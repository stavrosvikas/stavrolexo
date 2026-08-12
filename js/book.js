/* Το τεύχος: φύλλα στοιβαγμένα σε 3D, γυρνάνε γύρω από τη ράχη.
   Το σύρσιμο ακολουθεί το δάχτυλο — δεν είναι απλό slide. */
window.Book = (function () {
  var stack, spread, leaves, nav, prevBtn, nextBtn;
  var backs = [];                 // η πίσω όψη κάθε φύλλου (= η αριστερή σελίδα)
  var current = 0, count = 0, onChange = null, busy = false;

  // σύρσιμο
  var drag = null, justDragged = false;

  /* ── ΖΟΥΜ ΟΛΟΚΛΗΡΟΥ ΤΟΥ ΤΕΥΧΟΥΣ ──────────────────────────────────
     Δεν μεγαλώνει ένα παράθυρο μέσα στη σελίδα: πλησιάζει το ίδιο το
     περιοδικό, με το χαρτί, τις ακμές και τη σκιά του. Το #book κόβει. */
  var zoom = { z: 1, x: 0, y: 0 };
  var applied = { z: 1, x: 0, y: 0 };   // τι είναι ΠΡΑΓΜΑΤΙ περασμένο στο DOM
  var fitZ = 1;              // το ζουμ που «σερβίρουμε»
  function atFitFlag() { return zoom.z <= fitZ + .02; }
  var MAXZ = 2.6;

  /* Η ΟΡΑΤΗ ζώνη: το #book μείον ό,τι κάθεται από πάνω του (μπάρα ερώτησης,
     πληκτρολόγιο). Δεν κρατούν χώρο στο layout -- αλλιώς άλλαζε το μέγεθος
     της σελίδας από σελίδα σε σελίδα και τιναζόταν όλο το τεύχος.
     Μετριούνται με offsetHeight/Width και όχι με getBoundingClientRect:
     όσο τρέχει η κίνησή τους το rect δίνει ενδιάμεση θέση, και πάνω σε
     εκείνη τη στιγμή η ζώνη έβγαινε 54px και το τεύχος μίκραινε στο 10%. */
  function bandRect() {
    var book = document.getElementById('book');
    var r = book.getBoundingClientRect();
    var l = r.left, t = r.top, ri = r.right, b = r.bottom;
    var app = document.getElementById('app');
    var side = app && app.classList.contains('kbside');
    var cb = document.getElementById('cluebar');
    var kb = document.getElementById('keyboard');
    if (cb && !cb.classList.contains('empty')) t += cb.offsetHeight;
    if (kb && !kb.classList.contains('empty') && kb.offsetWidth) {
      if (side) ri -= kb.offsetWidth; else b -= kb.offsetHeight;
    }
    // δικλείδα: ό,τι κι αν συμβεί, η ζώνη δεν εκφυλίζεται
    if (b - t < r.height * .3) b = t + r.height * .3;
    if (ri - l < r.width * .3) ri = l + r.width * .3;
    return { left: l, top: t, right: ri, bottom: b,
             width: ri - l, height: b - t };
  }

  /* ΤΟ ΚΑΡΕ ΠΟΥ ΣΕΡΒΙΡΟΥΜΕ. Είναι ΕΝΑ και σταθερό ανά οθόνη, και στη βασική
     του θέση ΔΕΝ ακουμπάει τίποτα το τεύχος: αφήνουμε πάντα ελεύθερη τη
     λωρίδα της μπάρας ερώτησης -- πάντα, ακόμα και στις σελίδες που δεν την
     έχουν. Το ύψος της είναι σταθερό, οπότε το καρέ μένει σταθερό και δεν
     ξαναρχίζει το τίναγμα από σελίδα σε σελίδα.

     Το πληκτρολόγιο ΔΕΝ αφαιρείται: εμφανίζεται μόνο όταν έχεις επιλέξει
     λέξη, δηλαδή σε κατάσταση εστίασης, όπου επιτρέπεται να επικαλύπτει.

     Όλα μετριούνται με offsetWidth/offsetHeight. Το getBoundingClientRect()
     επιστρέφει την τρέχουσα τιμή του transition, και μετρώντας πάνω σε
     κίνηση το ζουμ κατέρρεε στο 0.10 και το τεύχος εξαφανιζόταν. */
  function servedFrame() {
    var book = document.getElementById('book');
    if (!book || !spread) return { z: 1, x: 0, y: 0 };
    var sw = spread.offsetWidth, sh = spread.offsetHeight;
    var f = document.getElementById('facing'), st = document.getElementById('stack');
    var cw = ((f && f.offsetWidth) || 0) + ((st && st.offsetWidth) || 0);
    var ch = Math.max((f && f.offsetHeight) || 0, (st && st.offsetHeight) || 0);
    if (!sw || !sh || !cw || !ch) return { z: 1, x: 0, y: 0 };

    var cb = document.getElementById('cluebar');
    var inset = (cb && cb.offsetHeight) || 0;      // σταθερή, ό,τι κι αν παίζει
    var r = book.getBoundingClientRect();
    var av = { left: r.left, top: r.top + inset, width: r.width,
               height: Math.max(60, r.height - inset) };

    var z = Math.min(1, av.width / cw, av.height / ch);
    var lx = (sw - cw) / 2, ly = (sh - ch) / 2;    // θέση μέσα στο #spread
    return {
      z: z,
      x: av.left + (av.width  - cw * z) / 2 - (r.left + lx * z),
      y: av.top  + (av.height - ch * z) / 2 - (r.top  + ly * z)
    };
  }

  /* Μαγνήτης: όσο κι αν σύρεις ή ζουμάρεις, το τεύχος δεν φεύγει από το
     κάδρο -- κρατάμε πάντα ένα κομμάτι του μέσα στη ζώνη. */
  function clampZoom() {
    var book = document.getElementById('book');
    if (!book) return;
    var S = servedFrame();
    fitZ = S.z;
    if (zoom.z <= S.z + 1e-4) { zoom.z = S.z; zoom.x = S.x; zoom.y = S.y; return; }
    zoom.z = Math.min(zoom.z, MAXZ);
    var band = bandRect();
    var b = { x: spread.getBoundingClientRect().left - zoom.x,
              y: spread.getBoundingClientRect().top - zoom.y };
    var w = spread.offsetWidth * zoom.z, h = spread.offsetHeight * zoom.z;
    var keep = .35;                       // τουλάχιστον 35% να παραμένει ορατό
    var minX = band.left - b.x - w * (1 - keep);
    var maxX = band.right - b.x - w * keep;
    var minY = band.top - b.y - h * (1 - keep);
    var maxY = band.bottom - b.y - h * keep;
    if (w <= band.width) { minX = maxX = (band.left + band.width / 2) - b.x - w / 2; }
    if (h <= band.height) { minY = maxY = (band.top + band.height / 2) - b.y - h / 2; }
    zoom.x = Math.max(Math.min(zoom.x, maxX), minX);
    zoom.y = Math.max(Math.min(zoom.y, maxY), minY);
  }

  function applyZoom(instant) {
    clampZoom();
    var app = document.getElementById('app');
    if (app) app.classList.toggle('zoomed', !atFitFlag());
    spread.classList.toggle('zfx', !instant);
    spread.style.setProperty('--z', zoom.z.toFixed(4));
    spread.style.transform =
      'translate(' + zoom.x.toFixed(1) + 'px,' + zoom.y.toFixed(1) + 'px) ' +
      'scale(' + zoom.z.toFixed(4) + ')';
    applied = { z: zoom.z, x: zoom.x, y: zoom.y };
  }

  function baseOrigin() {                       // θέση χωρίς το translate
    var o = spread.getBoundingClientRect();
    return { x: o.left - applied.x, y: o.top - applied.y, o: o };
  }

  function toLocal(cx, cy, o) {                 // client -> τοπικές του spread
    return { x: (cx - o.left) / applied.z, y: (cy - o.top) / applied.z };
  }

  /* Φέρνει το rect (σε client συντεταγμένες) στο κέντρο της ορατής ζώνης. */
  function zoomToRect(r, band, opts) {
    opts = opts || {};
    var b = baseOrigin();
    var bw = band.width, bh = band.height, pad = opts.pad || 1.35;
    var k = Math.min(bw / (r.width * pad), bh / (r.height * pad));
    var nz = Math.max(fitZ, Math.min(MAXZ, zoom.z * k));
    var p = toLocal((r.left + r.right) / 2, (r.top + r.bottom) / 2, b.o);
    zoom.z = nz;
    zoom.x = (band.left + band.width / 2) - b.x - nz * p.x;
    zoom.y = (band.top + band.height / 2) - b.y - nz * p.y;
    applyZoom(opts.instant);
  }

  /* Ορίζει κλίμακα και φέρνει το σημείο (cx,cy) στο κέντρο της ζώνης. */
  function zoomAt(nz, cx, cy, band) {
    var b = baseOrigin();
    var p = toLocal(cx, cy, b.o);
    zoom.z = Math.max(fitZ, Math.min(MAXZ, nz));
    zoom.x = (band.left + band.width / 2) - b.x - zoom.z * p.x;
    zoom.y = (band.top + band.height / 2) - b.y - zoom.z * p.y;
    applyZoom();
  }

  /* Πανοραμική μόνο: κρατάει το rect μέσα στη ζώνη χωρίς να αλλάξει κλίμακα. */
  function keepInside(r, band, m) {
    m = m || 24;
    var dx = 0, dy = 0;
    if (r.left < band.left + m) dx = band.left + m - r.left;
    else if (r.right > band.right - m) dx = band.right - m - r.right;
    if (r.top < band.top + m) dy = band.top + m - r.top;
    else if (r.bottom > band.bottom - m) dy = band.bottom - m - r.bottom;
    if (!dx && !dy) return;
    zoom.x += dx; zoom.y += dy;
    applyZoom();
  }

  function zoomReset(instant) {
    var S = servedFrame();
    zoom = { z: S.z, x: S.x, y: S.y };
    applyZoom(instant);
  }
  function atFit() { return atFitFlag(); }

  function zoomBy(f, cx, cy) {                  // pinch / wheel γύρω από σημείο
    var b = baseOrigin();
    var p = toLocal(cx, cy, b.o);
    var nz = Math.max(1, Math.min(MAXZ, zoom.z * f));
    zoom.z = nz;
    zoom.x = cx - b.x - nz * p.x;
    zoom.y = cy - b.y - nz * p.y;
    applyZoom(true);
  }

  function panBy(dx, dy) { zoom.x += dx; zoom.y += dy; applyZoom(true); }

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
      // ποια όψη κοιτάει τον χρήστη — το CSS το χρειάζεται για να μη
      // «πιάνει» το ποντίκι η γωνία της γυρισμένης όψης
      leaves[i].classList.toggle('turned', i < current);
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
    /* Πρώτα το τεύχος επιστρέφει οργανικά στο καρέ που σερβίρουμε, ΜΕΤΑ
       γυρίζει η σελίδα. Αλλιώς η σελίδα γύριζε μέσα σε ζουμαρισμένο κάδρο. */
    if (!opts._settled && !atFitFlag()) {
      zoomReset();
      opts._settled = true;
      setTimeout(function () { go(i, opts); }, 210);
      return;
    }

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
    /* Όσο είσαι ζουμαρισμένος ΔΕΝ γυρίζει σελίδα: προσπαθώντας να εστιάσεις
       με το δάχτυλο ή το ποντίκι κατέληγες σε άλλη σελίδα. */
    if (!atFitFlag()) return null;
    var r = stack.getBoundingClientRect();
    /* ΤΡΙΓΩΝΟ, όχι ορθογώνιο, και στο ίδιο μέγεθος με τη ζωγραφισμένη
       τσάκιση. Το παλιό ορθογώνιο έπιανε 18% του ύψους σε όλο το πλάι και
       κάθονταν πάνω σε κελιά -- δεν μπορούσες να τα επιλέξεις. */
    var side = Math.min(68, r.width * .15);
    if (clientY < r.bottom - side) return null;
    var dy = (r.bottom - clientY) / side;          // 0 στη βάση, 1 στην κορυφή
    if (clientX >= r.right - side) {
      var dxr = (clientX - (r.right - side)) / side;
      return dxr >= dy ? 'right' : null;
    }
    // Η ελεύθερη ακμή της αριστερής σελίδας είναι ΤΕΡΜΑ ΑΡΙΣΤΕΡΑ, όχι στη
    // ράχη — από εκεί την πιάνεις για να γυρίσεις πίσω.
    var leftEdge = Math.max(0, r.left - r.width);
    if (clientX <= leftEdge + side) {
      var dxl = (leftEdge + side - clientX) / side;
      return dxl >= dy ? 'left' : null;
    }
    return null;
  }

  /* ΠΑΝΟΡΑΜΙΚΗ όσο είσαι ζουμαρισμένος, από ΟΠΟΥΔΗΠΟΤΕ πάνω στο τεύχος.
     Πριν, το σύρσιμο έπιανε μόνο μέσα στο πλέγμα -- στη σελίδα των ορισμών
     δεν υπήρχε κανένας χειριστής και δεν κουνιόταν τίποτα. Το πλέγμα κρατάει
     τον δικό του (χρειάζεται και το pinch), γι' αυτό το εξαιρούμε εδώ. */
  var pan = null;
  function panDown(e) {
    if (atFitFlag()) return;
    if (e.target.closest('button')) return;
    if (e.target.closest('.gridwrap')) return;
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false };
  }
  function panMove(e) {
    if (!pan || e.pointerId !== pan.id) return;
    if (!pan.live) {
      if (Math.abs(e.clientX - pan.x) < 6 && Math.abs(e.clientY - pan.y) < 6) return;
      pan.live = true;
      var bk = document.getElementById('book');
      try { bk.setPointerCapture(e.pointerId); } catch (err) {}
    }
    panBy(e.clientX - pan.x, e.clientY - pan.y);
    pan.x = e.clientX; pan.y = e.clientY;
  }
  function panUp(e) {
    if (!pan || (e && e.pointerId !== pan.id)) return;
    var moved = pan.live;
    pan = null;
    if (!moved) return;
    // μετά από σύρσιμο δεν θέλουμε και «κλικ» στο σημείο που άφησες
    var block = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', block, true);
    setTimeout(function () { window.removeEventListener('click', block, true); }, 0);
  }

  function inEdgeZone(clientX, clientY, target) {
    return corner(clientX, clientY, target) !== null;
  }

  function canDrag(e) {
    if (busy) return false;
    if (!atFitFlag()) return false;          // ζουμαρισμένος → σέρνεις, δεν γυρνάς
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
      spread = document.getElementById('spread');
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
      var bk = document.getElementById('book');
      bk.addEventListener('pointerdown', panDown);
      window.addEventListener('pointermove', panMove);
      window.addEventListener('pointerup', panUp);
      window.addEventListener('pointercancel', panUp);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);

      jump(Store.page());
    },
    go: go,
    current: function () { return current; },
    inEdgeZone: inEdgeZone,
    restack: restack,
    zoomToRect: zoomToRect,
    zoomAt: zoomAt,
    zoomReset: zoomReset,
    zoomBy: zoomBy,
    band: bandRect,
    atFit: atFit,
    panBy: panBy,
    keepInside: keepInside,
    zoomLevel: function () { return zoom.z; },
    /* Η πίσω όψη του φύλλου i — δηλαδή η αριστερή σελίδα που βλέπεις όταν
       είσαι στη σελίδα i+1. Εκεί τυπώνονται οι ορισμοί. */
    back: function (i) { return backs[i] || null; }
  };
})();
