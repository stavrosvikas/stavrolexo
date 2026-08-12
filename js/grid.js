/* Το πλέγμα: χτίσιμο, επιλογή λέξης, zoom, μελάνι, έλεγχος. */
window.Grid = (function () {
  var CELL = 40;
  var MAX_SCALE = 2.2;

  var ARROWS = {
    'straight-H': '▶', 'straight-V': '▼',
    'down-right': '↳', 'up-right': '↱',
    'right-down': '↴', 'left-down': '↲'
  };

  function key(r, c) { return r + ',' + c; }

  function Puzzle(pageEl, data, questions, gridIndex, hooks) {
    this.el = pageEl;
    this.data = data;
    this.questions = questions;
    this.gridIndex = gridIndex;
    this.hooks = hooks || {};
    this.letters = Store.letters(gridIndex);
    this.cells = {};
    this.words = [];
    this.active = null;
    this.view = { s: 1, x: 0, y: 0 };
    this.fitScale = .2;
    this.build();
  }

  Puzzle.prototype.build = function () {
    var d = this.data, self = this;

    this.el.innerHTML =
      '<div class="puzzle-head">' +
        '<h2>' + d.label + '</h2>' +
        '<span class="score"></span>' +
      '</div>' +
      '<div class="gridwrap">' +
        '<div class="stage"><div class="grid"></div></div>' +
      '</div>';

    this.wrap = this.el.querySelector('.gridwrap');
    this.stage = this.el.querySelector('.stage');
    this.gridEl = this.el.querySelector('.grid');
    this.scoreEl = this.el.querySelector('.score');
    this.fitBtn = document.getElementById('fitbtn');

    this.baked = 1;                     // πόσο ζουμ είναι ήδη «ψημένο» στο layout
    this.setUnit(1);

    d.words.forEach(function (w, i) {
      var cells = [], dr = w.dir === 'V' ? 1 : 0, dc = w.dir === 'H' ? 1 : 0;
      for (var j = 0; j < w.answer.length; j++) cells.push([w.r + dr * j, w.c + dc * j]);
      self.words.push({
        i: i, id: w.id, n: w.n, answer: w.answer, dir: w.dir,
        cells: cells, cluePos: w.cluePos, arrow: w.arrow, state: 'empty'
      });
    });

    var clueAt = {};
    d.clueCells.forEach(function (cc) { clueAt[key(cc.r, cc.c)] = cc; });

    var owner = {};
    this.words.forEach(function (w) {
      w.cells.forEach(function (rc) {
        var k = key(rc[0], rc[1]);
        (owner[k] = owner[k] || []).push(w.i);
      });
    });

    var frag = document.createDocumentFragment();
    for (var r = 0; r < d.rows; r++) {
      for (var c = 0; c < d.cols; c++) {
        var k = key(r, c), el = document.createElement('div');
        if (owner[k]) {
          el.className = 'c letter';
          el.dataset.rc = k;
          var ink = document.createElement('span');
          ink.className = 'ink';
          var h = (r * 31 + c * 17) % 11;
          ink.style.setProperty('--jit', ((h - 5) * .9) + 'deg');
          ink.style.setProperty('--jit-y', (((r * 13 + c * 7) % 5) - 2) * .4 + 'px');
          el.appendChild(ink);
          this.cells[k] = { el: el, ink: ink, words: owner[k] };
        } else if (clueAt[k]) {
          var cc = clueAt[k];
          el.className = 'c clue' + (cc.clues.length > 1 ? ' two' : '');
          el.dataset.clue = k;
          cc.clues.forEach(function (entry) {
            var w = self.byId(entry.id);
            var num = document.createElement('span');
            num.className = 'cn';
            num.textContent = w.n;
            var box = document.createElement('span');
            box.className = 'ar';
            box.textContent = ARROWS[entry.arrow === 'straight'
              ? 'straight-' + w.dir : entry.arrow] || '▶';
            el.appendChild(num);
            el.appendChild(box);
          });
          this.cells[k] = { el: el, clue: cc };
        } else {
          el.className = 'c void';
        }
        frag.appendChild(el);
      }
    }
    this.gridEl.appendChild(frag);

    // η εικόνα-ορισμός μέσα στον καμβά
    if (d.imageBlock) {
      var b = d.imageBlock, w = this.byId(b.id);
      var box = document.createElement('div');
      box.className = 'imgblock';
      box.dataset.imgid = b.id;
      // σε μονάδες κελιού, ώστε να ακολουθεί το ψήσιμο του ζουμ
      box.style.left = 'calc(var(--cell) * ' + b.c + ')';
      box.style.top = 'calc(var(--cell) * ' + b.r + ')';
      box.style.width = 'calc(var(--cell) * ' + b.size + ')';
      box.style.height = 'calc(var(--cell) * ' + b.size + ')';
      box.innerHTML = '<img alt="" src="' + b.src + '"><span class="tag">' +
                      (w ? w.n : '') + (w && w.dir === 'H' ? ' →' : ' ↓') + '</span>';
      this.gridEl.appendChild(box);
      this.imgBox = box;
    }

    this.bindInput();
    this.refreshAll(true);
    requestAnimationFrame(function () { self.fit(true); });
  };

  /* ── κρίσιμο για την ευκρίνεια ────────────────────────────────────
     Το transform: scale() πάνω σε 3D layer δεν ξαναζωγραφίζει τα γράμματα —
     ο browser τεντώνει το ήδη ζωγραφισμένο bitmap και βλέπεις pixels. Οπότε
     όσο κινείσαι χρησιμοποιούμε transform (γρήγορο), και μόλις σταματήσεις
     «ψήνουμε» το ζουμ στο layout: μεγαλώνει το ίδιο το κελί και τα γράμματα
     ξαναστοιχειοθετούνται καθαρά. Η θέση στην οθόνη βγαίνει ίδια. */
  Puzzle.prototype.setUnit = function (s) {
    var px = CELL * s;
    this.gridEl.style.setProperty('--cell', px + 'px');
    this.gridEl.style.gridTemplateColumns = 'repeat(' + this.data.cols + ',var(--cell))';
    this.gridEl.style.width = (this.data.cols * px) + 'px';
    this.gridEl.style.height = (this.data.rows * px) + 'px';
  };

  Puzzle.prototype.bake = function () {
    if (!this.view.s || Math.abs(this.baked - this.view.s) < 0.005) return;
    this.baked = this.view.s;
    this.setUnit(this.baked);
    this.apply(true);
  };

  Puzzle.prototype.bakeSoon = function () {
    var self = this;
    clearTimeout(this._bakeT);
    this._bakeT = setTimeout(function () { self.bake(); }, 160);
  };

  Puzzle.prototype.byId = function (id) {
    for (var i = 0; i < this.words.length; i++) if (this.words[i].id === id) return this.words[i];
    return null;
  };

  /* ── επιλογή ─────────────────────────────────────────────────── */

  Puzzle.prototype.handleTap = function (target) {
    var imgEl = target.closest && target.closest('.imgblock');
    if (imgEl) { this.select(this.byId(+imgEl.dataset.imgid), 0); return; }

    var clueEl = target.closest && target.closest('.clue');
    if (clueEl) {
      var cc = this.cells[clueEl.dataset.clue].clue;
      var id = cc.clues[0].id;
      if (cc.clues.length > 1 && this.active && this.active.word.id === id) {
        id = cc.clues[1].id;
      }
      this.select(this.byId(id), 0);
      return;
    }

    var cellEl = target.closest && target.closest('.letter');
    if (!cellEl) {                       // πάτησε στο κενό -> έξοδος + όλο το πλέγμα
      this.deselect();
      this.fit();
      return;
    }

    var rc = cellEl.dataset.rc, cell = this.cells[rc], idxs = cell.words, w;
    if (this.active && idxs.length > 1 && idxs.indexOf(this.active.word.i) !== -1) {
      var self = this;
      var other = idxs.filter(function (i) { return i !== self.active.word.i; });
      w = this.words[other.length ? other[0] : idxs[0]];
    } else {
      w = this.words[idxs[0]];
    }
    var idx = 0;
    for (var i = 0; i < w.cells.length; i++) {
      if (key(w.cells[i][0], w.cells[i][1]) === rc) { idx = i; break; }
    }
    this.select(w, idx);
  };

  Puzzle.prototype.select = function (w, idx) {
    if (!w) return;
    this.active = { word: w, idx: idx || 0 };
    this.paintSelection();
    this.zoomToWord(w);
    if (this.hooks.onClue) this.hooks.onClue(w, this.questions[w.id]);
  };

  Puzzle.prototype.deselect = function () {
    this.active = null;
    this.paintSelection();
    if (this.hooks.onClue) this.hooks.onClue(null, null);
  };

  Puzzle.prototype.step = function (delta) {
    var list = this.words;
    var i = this.active ? list.indexOf(this.active.word) : -1;
    this.select(list[(i + delta + list.length) % list.length], 0);
  };

  Puzzle.prototype.paintSelection = function () {
    var self = this;
    this.gridEl.querySelectorAll('.letter.active,.letter.inword')
      .forEach(function (el) { el.classList.remove('active', 'inword'); });
    this.gridEl.querySelectorAll('.clue.on').forEach(function (el) { el.classList.remove('on'); });
    if (this.imgBox) this.imgBox.classList.remove('on');
    if (!this.active) return;
    var w = this.active.word;
    w.cells.forEach(function (rc, i) {
      var cell = self.cells[key(rc[0], rc[1])];
      if (cell) cell.el.classList.add(i === self.active.idx ? 'active' : 'inword');
    });
    if (w.cluePos) {
      var cl = this.cells[key(w.cluePos[0], w.cluePos[1])];
      if (cl) cl.el.classList.add('on');
    }
    if (this.imgBox && this.data.imageBlock && this.data.imageBlock.id === w.id) {
      this.imgBox.classList.add('on');
    }
  };

  /* ── γράψιμο ─────────────────────────────────────────────────── */

  Puzzle.prototype.type = function (ch) {
    if (!this.active) return;
    var w = this.active.word, rc = w.cells[this.active.idx];
    this.letters[key(rc[0], rc[1])] = ch;
    Store.save();
    SFX.key();
    if (this.active.idx < w.cells.length - 1) this.active.idx++;
    this.refreshAll();
    this.paintSelection();
    this.ensureVisible();
    // μόλις κλείσει σωστά η λέξη, πήγαινε μόνος σου στην επόμενη άλυτη
    if (w.state === 'ok') {
      var self = this;
      setTimeout(function () {
        if (self.active && self.active.word === w) self.nextUnsolved();
      }, 480);
    }
  };

  Puzzle.prototype.nextUnsolved = function () {
    var start = this.active ? this.words.indexOf(this.active.word) : -1;
    for (var k = 1; k <= this.words.length; k++) {
      var w = this.words[(start + k + this.words.length) % this.words.length];
      if (w.state !== 'ok') { this.select(w, 0); return; }
    }
    this.deselect();               // όλα λυμένα
    this.fit();
  };

  Puzzle.prototype.backspace = function () {
    if (!this.active) return;
    var w = this.active.word, rc = w.cells[this.active.idx];
    var k = key(rc[0], rc[1]);
    if (this.letters[k]) {
      delete this.letters[k];
    } else if (this.active.idx > 0) {
      this.active.idx--;
      rc = w.cells[this.active.idx];
      delete this.letters[key(rc[0], rc[1])];
    }
    Store.save();
    SFX.key();
    this.refreshAll();
    this.paintSelection();
  };

  /* ── έλεγχος ─────────────────────────────────────────────────── */

  Puzzle.prototype.refreshAll = function (silent) {
    var self = this, solved = 0, becameOk = false, becameBad = false;

    this.words.forEach(function (w) {
      var full = true, txt = '';
      w.cells.forEach(function (rc) {
        var ch = self.letters[key(rc[0], rc[1])];
        if (!ch) full = false; else txt += ch;
      });
      var was = w.state;
      w.state = !full ? (txt ? 'partial' : 'empty') : (txt === w.answer ? 'ok' : 'bad');
      if (w.state !== was) {
        if (w.state === 'ok') becameOk = true;
        if (w.state === 'bad') becameBad = true;
      }
      if (w.state === 'ok') solved++;
    });

    Object.keys(this.cells).forEach(function (k) {
      var cell = self.cells[k];
      if (!cell.words) return;
      cell.ink.textContent = self.letters[k] || '';
      var bad = false, ok = false;
      cell.words.forEach(function (i) {
        if (self.words[i].state === 'bad') bad = true;
        if (self.words[i].state === 'ok') ok = true;
      });
      cell.el.classList.toggle('wrong', bad);
      cell.el.classList.toggle('solved', !bad && ok);
    });

    this.solved = solved;
    this.scoreEl.textContent = solved + '/' + this.words.length;
    if (!silent) {
      if (becameOk) SFX.good();
      else if (becameBad) SFX.bad();
    }
    if (this.hooks.onProgress) this.hooks.onProgress();
  };

  Puzzle.prototype.revealAll = function () {
    var self = this;
    this.words.forEach(function (w) {
      w.cells.forEach(function (rc, i) { self.letters[key(rc[0], rc[1])] = w.answer[i]; });
    });
    Store.save();
    this.refreshAll(true);
  };

  /* ── zoom / pan ──────────────────────────────────────────────── */

  /* Ύψος που ΒΛΕΠΕΙ πραγματικά ο χρήστης. Το πληκτρολόγιο επικάθεται στο
     κάτω μέρος της σελίδας, οπότε το αφαιρούμε — αλλιώς θα κεντράραμε το
     πλέγμα κάτω από αυτό. */
  Puzzle.prototype.vh = function () {
    var h = this.wrap.clientHeight;
    var kb = document.getElementById('keyboard');
    if (kb && !kb.classList.contains('empty') &&
        getComputedStyle(kb).display !== 'none') {
      var overlap = this.wrap.getBoundingClientRect().bottom -
                    kb.getBoundingClientRect().top;
      if (overlap > 0) h -= Math.min(overlap, h * .62);
    }
    return Math.max(60, h);
  };

  /* ── ΖΟΥΜ: πλέον το κάνει το ΤΕΥΧΟΣ, όχι το παράθυρο του πλέγματος ──
     Το πλέγμα κάθεται πάντα ολόκληρο μέσα στη σελίδα του σε κλίμακα 1·
     όταν εστιάζεις λέξη, πλησιάζει το ίδιο το περιοδικό. */
  /* Μία πηγή αλήθειας για την ορατή ζώνη -- ζει στο Book. */
  Puzzle.prototype.band = function () {
    return Book.band();
  };

  Puzzle.prototype.wordRect = function (w) {
    var self = this, l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    w.cells.forEach(function (rc) {
      var cell = self.cells[key(rc[0], rc[1])];
      if (!cell) return;
      var q = cell.el.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top);
      r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    });
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  };

  Puzzle.prototype.apply = function (instant) {
    this.stage.classList.toggle('fx', !instant);
    // μόνο η διαφορά από το ήδη ψημένο ζουμ πάει σε transform
    var rel = this.view.s / (this.baked || 1);
    this.stage.style.transform =
      'translate(' + this.view.x + 'px,' + this.view.y + 'px) scale(' + rel + ')';
    // Την ορατότητα του κουμπιού την ορίζει το syncChrome (φαίνεται σε όλες
    // τις σελίδες με σταυρόλεξο) -- εδώ αλλάζει μόνο τι κάνει.
    if (this.fitBtn && window.Book && Book.atFit) {
      var zed = !Book.atFit();
      this.fitBtn.classList.toggle('back', zed);
      this.fitBtn.setAttribute('aria-label',
        zed ? 'Δες όλο το τεύχος' : 'Εστίασε στη λέξη');
    }
  };

  Puzzle.prototype.computeFit = function () {
    var vw = this.wrap.clientWidth, vh = this.vh();
    if (!vw || !vh) return .2;
    return Math.min(vw / (this.data.cols * CELL), vh / (this.data.rows * CELL)) * .97;
  };

  Puzzle.prototype.fit = function (instant) {
    var vw = this.wrap.clientWidth, vh = this.wrap.clientHeight;
    if (!vw || !vh) {
      var self = this;
      if ((this._fitTries = (this._fitTries || 0) + 1) < 30) {
        requestAnimationFrame(function () { self.fit(instant); });
      }
      return;
    }
    this._fitTries = 0;
    // το κελί υπολογίζεται ώστε το πλέγμα να γεμίζει τη σελίδα -- καμία
    // κλίμακα με transform, άρα τα γράμματα είναι πάντα καθαρά
    var k = Math.min(vw / (this.data.cols * CELL), vh / (this.data.rows * CELL)) * .97;
    this.baked = k; this.view = { s: k, x: 0, y: 0 };
    this.setUnit(k);
    var gw = this.data.cols * CELL * k, gh = this.data.rows * CELL * k;
    this.view.x = (vw - gw) / 2; this.view.y = (vh - gh) / 2;
    this.fitScale = k;
    this.apply(true);
    if (window.Book && Book.zoomReset) Book.zoomReset(instant);
  };

  /* Το ζουμ δένεται στο ΜΕΓΕΘΟΣ ΚΕΛΙΟΥ, όχι στο πλάτος της λέξης: στόχος
     είναι ένα άνετο κελί ~34px. Έτσι σε desktop, όπου τα κελιά είναι ήδη
     μεγάλα, σχεδόν δεν ζουμάρει· σε κινητό πλησιάζει όσο χρειάζεται. */
  /* Η εστίαση κουνάει το τεύχος ΜΟΝΟ όταν χρειάζεται. Πριν, κάθε κλικ σε
     κελί μετατόπιζε ολόκληρο το περιοδικό ακόμα κι όταν η λέξη ήταν ήδη
     μπροστά στα μάτια σου και σε αναγνώσιμο μέγεθος. */
  Puzzle.prototype.zoomToWord = function (w) {
    if (!window.Book || !Book.zoomAt) return;
    var z = Book.zoomLevel();
    var cellPx = CELL * this.baked * z;
    var band = this.band();
    var r = this.wordRect(w);
    var readable = cellPx >= 26;
    var inside = r.left >= band.left + 6 && r.right <= band.right - 6 &&
                 r.top >= band.top + 6 && r.bottom <= band.bottom - 6;
    if (readable && inside) return;                       // τίποτα δεν κουνιέται
    if (readable) { Book.keepInside(r, band, 16); return; } // μόνο μετατόπιση
    var target = z * (34 / Math.max(4, cellPx));
    Book.zoomAt(target, (r.left + r.right) / 2, (r.top + r.bottom) / 2, band);
  };

  Puzzle.prototype.ensureVisible = function () {
    if (!this.active || !window.Book || !Book.keepInside) return;
    var rc = this.active.word.cells[this.active.idx];
    var cell = this.cells[key(rc[0], rc[1])];
    if (cell) Book.keepInside(cell.el.getBoundingClientRect(), this.band(), 28);
  };

  /* Το zoom-out σταματάει όταν το σταυρόλεξο γεμίσει την οθόνη. */
  Puzzle.prototype.clamp = function () {
    var vw = this.wrap.clientWidth, vh = this.vh();
    this.view.s = Math.max(this.fitScale, Math.min(MAX_SCALE, this.view.s));
    var gw = this.data.cols * CELL * this.view.s, gh = this.data.rows * CELL * this.view.s;
    if (gw <= vw) this.view.x = (vw - gw) / 2;
    else this.view.x = Math.min(0, Math.max(vw - gw, this.view.x));
    if (gh <= vh) this.view.y = (vh - gh) / 2;
    else this.view.y = Math.min(0, Math.max(vh - gh, this.view.y));
  };

  Puzzle.prototype.bindInput = function () {
    var self = this, pts = {}, last = null, pinch = null, tap = null;

    // μόλις ηρεμήσει η κίνηση, ψήσε το ζουμ ώστε τα γράμματα να ξαναγίνουν καθαρά
    this.stage.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'transform') self.bake();
    });

    this.wrap.addEventListener('pointerdown', function (e) {
      // στην κάτω γωνία της σελίδας το gesture ανήκει στο γύρισμα, όχι στο pan
      if (window.Book && Book.inEdgeZone &&
          Book.inEdgeZone(e.clientX, e.clientY, e.target)) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { self.wrap.setPointerCapture(e.pointerId); } catch (err) {}
      var ids = Object.keys(pts);
      if (ids.length === 1) {
        last = { x: e.clientX, y: e.clientY };
        tap = { x: e.clientX, y: e.clientY, target: e.target, moved: 0 };
      }
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, last: 1 };
        tap = null;
      }
    });

    this.wrap.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length >= 2 && pinch) {
        var a = pts[ids[0]], b = pts[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        var f = (d / pinch.d) / (pinch.last || 1);
        pinch.last = d / pinch.d;
        if (window.Book) Book.zoomBy(f, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (last) {
        if (tap) tap.moved += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y);
        if (window.Book) Book.panBy(e.clientX - last.x, e.clientY - last.y);
        last = { x: e.clientX, y: e.clientY };
      }
    });

    function up(e) {
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) pinch = null;
      if (Object.keys(pts).length === 0) {
        last = null;
        if (tap && tap.moved < 12) self.handleTap(tap.target);
        tap = null;
      }
    }
    this.wrap.addEventListener('pointerup', up);
    this.wrap.addEventListener('pointercancel', up);

    this.wrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (window.Book) Book.zoomBy(e.deltaY > 0 ? .9 : 1.12, e.clientX, e.clientY);
    }, { passive: false });
  };

  return { Puzzle: Puzzle, CELL: CELL };
})();
