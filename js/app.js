/* Δέσιμο: τεύχος + πλέγματα + μπάρα ορισμού + πληκτρολόγιο + τελείες. */
(function () {
  var P = window.LUBEN_PUZZLE;
  var puzzles = [];
  var board = null;

  var cluebar = document.getElementById('cluebar');
  var clueN = document.getElementById('clue-n');
  var clueText = document.getElementById('clue-text');
  var clueLen = document.getElementById('clue-len');
  var clueImg = document.getElementById('clue-image');
  var hintBtn = document.getElementById('hint-btn');
  var hintCount = document.getElementById('hint-count');
  var kb = document.getElementById('keyboard');
  var list = document.getElementById('solutions-list');
  var revealBtn = document.getElementById('btn-reveal');
  var lastPage = document.querySelector('.last');
  /* Οι ορισμοί ΤΥΠΩΝΟΝΤΑΙ στην πίσω όψη του προηγούμενου φύλλου — δηλαδή
     πάνω στην ίδια τη σελίδα που γυρνάει και καταλήγει αριστερά, όπως σε
     αληθινό τεύχος. Η πίσω όψη του φύλλου i είναι η αριστερή σελίδα όταν
     βρίσκεσαι στη σελίδα i+1, άρα εκεί πάνε οι ορισμοί του πλέγματος i. */
  function buildBacks() {
    puzzles.forEach(function (p, idx) {
      var host = Book.back(idx);
      if (!host) return;
      host.innerHTML = '';
      // χωρίς αρίθμηση σελίδας: η αριστερή σελίδα δεν είναι η «ΣΕΛΙΔΑ x»
      var h = document.createElement('h3');
      h.textContent = 'Ορισμοί';
      host.appendChild(h);

      var cols = document.createElement('div');
      cols.className = 'facing-cols';
      [['Οριζόντια', 'H'], ['Κάθετα', 'V']].forEach(function (g) {
        var box = document.createElement('div');
        box.className = 'cl-group';
        var b = document.createElement('b');
        b.textContent = g[0];
        box.appendChild(b);
        p.words.filter(function (w) { return w.dir === g[1]; })
               .sort(function (a, b2) { return a.n - b2.n; })
               .forEach(function (w) {
          var it = document.createElement('div');
          it.className = 'cl-item';
          it.dataset.id = w.id;
          it.innerHTML = '<span class="cl-n"></span><span class="cl-t"></span>';
          it.querySelector('.cl-n').textContent = w.n;
          it.querySelector('.cl-t').textContent = P.questions[w.id].clue;
          it.addEventListener('click', function () {
            if (Book.current() !== idx + 1) Book.go(idx + 1);
            p.select(w, 0);
          });
          box.appendChild(it);
        });
        cols.appendChild(box);
      });
      host.appendChild(cols);
    });
    paintClues();
  }

  function paintClues() {
    puzzles.forEach(function (p, idx) {
      var host = Book.back(idx);
      if (!host) return;
      var activeId = p.active ? p.active.word.id : null;
      host.querySelectorAll('.cl-item').forEach(function (it) {
        var w = p.byId(+it.dataset.id);
        it.classList.toggle('done', !!w && w.state === 'ok');
        var on = (+it.dataset.id === activeId);
        it.classList.toggle('on', on);
        // όχι scrollIntoView: οι στήλες δεν σκρολάρουν πια, και μέσα σε
        // μετασχηματισμένο τεύχος θα μετακινούσε τα πάντα

      });
    });
  }

  /* Πόσες βοήθειες μένουν στη λέξη που δουλεύεις. Κλείνει και όταν δεν
     έχει πια νόημα: λυμένη λέξη ή γεμάτη χωρίς κενά. */
  function syncHint() {
    var p = activePuzzle();
    var w = p && p.active ? p.active.word : null;
    if (!w) { hintBtn.disabled = true; hintCount.textContent = '0/2'; return; }
    var left = p.hintsLeft(w);
    hintCount.textContent = left + '/2';
    hintBtn.disabled = left <= 0 || w.state === 'ok' || !p.emptyCells(w).length;
  }

  /* ── κύλιση της τελευταίας σελίδας ────────────────────────────
     Το iOS ΔΕΝ κυλάει στοιχεία που ζουν μέσα σε preserve-3d, και οι σελίδες
     μας γυρίζουν στον χώρο. Τα αγγίγματα φτάνουν κανονικά -- οι χρήστες
     παίζουν το σταυρόλεξο μια χαρά -- απλώς δεν ενεργοποιείται η αυτόματη
     κύλιση. Οπότε την οδηγούμε εμείς, ίδια σε κάθε συσκευή.

     Πάνω στο ταμπλό των τελειών ισχύει ο κανόνας: αν ξεκινήσεις ΠΑΝΩ σε
     τελεία σχεδιάζεις, αν ξεκινήσεις σε κενό κυλάς. */
  function initSheetScroll() {
    var sheet = lastPage.querySelector('.sheet');
    var drag = null, vel = 0, glide = 0;

    function maxTop() { return Math.max(0, sheet.scrollHeight - sheet.clientHeight); }
    function to(v) { sheet.scrollTop = Math.max(0, Math.min(maxTop(), v)); }

    sheet.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button, a')) return;
      if (board && board.drawing && board.drawing()) return;
      cancelAnimationFrame(glide);
      drag = { y: e.clientY, top: sheet.scrollTop, t: Date.now(), live: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dy = e.clientY - drag.y;
      if (!drag.live) {
        if (Math.abs(dy) < 5) return;
        drag.live = true;
        try { sheet.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var now = Date.now(), dt = Math.max(16, now - drag.t);
      vel = (sheet.scrollTop - (drag.top - dy)) / dt;
      drag.t = now;
      to(drag.top - dy);
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      var live = drag.live;
      drag = null;
      if (!live || Math.abs(vel) < .05) return;
      // λίγη αδράνεια, αλλιώς μια λίστα 60 απαντήσεων θέλει δέκα σπρωξιές
      var v = Math.max(-2.6, Math.min(2.6, vel)) * 16;
      (function step() {
        v *= .93;
        to(sheet.scrollTop - v);
        if (Math.abs(v) > .4) glide = requestAnimationFrame(step);
      })();
    });
  }

  function activePuzzle() {
    var p = Book.current();
    return (p === 1 || p === 2) ? puzzles[p - 1] : null;
  }

  function showClue(w, q) {
    if (!w) {
      // καθάρισε το πεδίο, μη μείνει κρεμασμένος ο προηγούμενος ορισμός.
      // Τις κλάσεις τις ορίζει το syncChrome.
      clueN.textContent = '';
      clueText.textContent = '';
      clueLen.textContent = '';
      clueImg.hidden = true;
      clueImg.removeAttribute('src');
      return;
    }
    clueN.textContent = w.n + (w.dir === 'H' ? ' ΟΡΙΖΟΝΤΙΑ' : ' ΚΑΘΕΤΑ');
    clueText.textContent = q.clue;
    clueLen.textContent = w.answer.length + ' γράμματα';
    syncHint();
    if (q.image) {
      clueImg.src = q.image;
      clueImg.hidden = false;
    } else {
      clueImg.hidden = true;
      clueImg.removeAttribute('src');
    }
  }

  function updateCover() {
    var total = 0, done = 0;
    puzzles.forEach(function (p) { total += p.words.length; done += p.solved || 0; });
    var el = document.getElementById('cover-progress');
    el.textContent = done ? done + ' από ' + total + ' βρέθηκαν' : '';
    el.classList.toggle('on', done > 0);
  }

  /* Και τα δύο μένουν στη ροή -- αλλάζει μόνο αν δείχνουν κάτι. Έτσι η
     σελίδα έχει ακριβώς το ίδιο ύψος σε εξώφυλλο, πλέγματα και λύσεις. */
  function syncChrome() {
    var i = Book.current();
    var onGrid = (i === 1 || i === 2);
    var p = activePuzzle();
    var picked = !!(onGrid && p && p.active);
    cluebar.classList.toggle('empty', !onGrid);
    cluebar.classList.toggle('hint', onGrid && !picked);
    // Το κουμπί εστίασης υπάρχει σε ΟΛΗ τη διάρκεια των σταυρολέξων, ώστε να
    // μπορείς πάντα να ξαναφέρεις το τεύχος στο καρέ που σερβίρουμε.
    document.getElementById('fitbtn').classList.toggle('on', onGrid);
    /* ΜΟΝΟ όταν υπάρχει επιλεγμένη λέξη. Όταν στεκόταν μόνιμα στις σελίδες
       με σταυρόλεξο, έτρωγε το κάτω τρίτο: τα τελευταία κελιά δεν φαίνονταν
       ούτε πατιόνταν, και όλο το κενό της σελίδας μαζευόταν επάνω. */
    kb.classList.toggle('empty', !picked || !Keyboard.wantsOnScreen());
    syncSpace();
  }

  /* Η μπάρα και το πληκτρολόγιο ΕΠΙΚΑΘΟΝΤΑΙ -- δεν κρατούν χώρο στο layout,
     αλλιώς φαινόταν λωρίδα στο χρώμα του φόντου να κόβει το εξώφυλλο και,
     χειρότερα, άλλαζε το μέγεθος της σελίδας από σελίδα σε σελίδα.
     Κρατάμε μόνο τις πραγματικές τους διαστάσεις σε μεταβλητές, για να ξέρει
     το κουμπί εστίασης πού να κάτσει και η εστίαση ποια ζώνη είναι ορατή. */
  function syncSpace() {
    var app = document.getElementById('app');
    var side = app.classList.contains('kbside');
    var kbOn = !kb.classList.contains('empty') &&
               getComputedStyle(kb).display !== 'none';
    var t = cluebar.classList.contains('empty') ? 0 : cluebar.offsetHeight;
    var b = (kbOn && !side) ? kb.offsetHeight : 0;
    var r = (kbOn && side)  ? kb.offsetWidth  : 0;
    var key = t + '/' + b + '/' + r;
    if (key === lastSpace) return;
    lastSpace = key;
    app.style.setProperty('--chrome-t', t + 'px');
    app.style.setProperty('--chrome-b', b + 'px');
    app.style.setProperty('--chrome-r', r + 'px');
  }
  var lastSpace = '';

  /* Η αριστερή σελίδα με τους ορισμούς μπαίνει μόνο όταν ΔΕΝ κοστίζει:
     δηλαδή όταν η οθόνη είναι τόσο φαρδιά που η σελίδα δένεται στο ύψος
     ούτως ή άλλως, οπότε η δεύτερη σελίδα γεμίζει άδειο πλάι χωρίς να
     μικρύνει το σταυρόλεξο. Δεν γίνεται με media query γιατί εξαρτάται
     από το ύψος του τεύχους, όχι από το πλάτος του παραθύρου. */
  function syncSpread() {
    var book = document.getElementById('book');
    var w = book.clientWidth, h = book.clientHeight;
    if (!w || !h) return;
    var alone = Math.min(w, h * .75);
    var withFacing = Math.min(w * .48, h * .75);
    var app = document.getElementById('app');
    var was = app.classList.contains('spread');
    /* Ανοχή 10%: η διπλανή σελίδα αξίζει μια μικρή σμίκρυνση. Με το παλιό
       «ούτε ένα pixel» η σελίδα των ορισμών εξαφανιζόταν σε πλατιές οθόνες:
       όταν η μπάρα βγήκε από το layout το #book ψήλωσε, και η μονή σελίδα
       άρχισε να βγαίνει οριακά μεγαλύτερη από τη διπλή. */
    var now = withFacing >= alone * .90 && withFacing >= 360;
    if (was === now) return;
    app.classList.toggle('spread', now);
    if (Book.restack) Book.restack();     // αλλάζει ποιο φύλλο μένει ορατό
  }

  /* Οριζόντια συσκευή αφής: το πληκτρολόγιο πάει στο πλάι αντί από κάτω.
     Αλλιώς τρώει ύψος, και επειδή η σελίδα δένεται στο ύψος βγαίνει
     μικρότερη κι από κινητό ενώ περισσεύει πλάτος. Απαιτεί coarse pointer,
     ώστε ποντίκι και trackpad να μην επηρεάζονται ποτέ. */
  function syncKbSide() {
    var touch = window.matchMedia('(pointer: coarse)').matches;
    var landscape = window.innerWidth > window.innerHeight;
    var wide = window.innerWidth >= 820;
    document.getElementById('app')
            .classList.toggle('kbside', touch && landscape && wide);
    syncSpace();
  }

  // ── πλέγματα ────────────────────────────────────────────────────
  P.pages.forEach(function (pageData, i) {
    var el = document.querySelector('.face[data-grid="' + i + '"]');
    puzzles.push(new Grid.Puzzle(el, pageData, P.questions, i, {
      onClue: function (w, q) { showClue(w, q); syncChrome(); paintClues(); syncHint(); },
      onProgress: function () { updateCover(); paintClues(); }
    }));
  });

  // ── τεύχος ──────────────────────────────────────────────────────
  Book.init({
    onChange: function (i) {
      Store.page(i);
      setSolutions(false);           // οι λύσεις κλείνουν σε κάθε γύρισμα
      document.getElementById('app').classList.toggle('at-cover', i === 0);
      // κάθε φορά που γυρνάς σελίδα, το πλέγμα ξαναπιάνει από καθαρή θέα
      puzzles.forEach(function (p) { p.deselect(); });
      showClue(null, null);
      syncChrome();
      paintClues();
      if (i === 1 || i === 2) {
        var p = puzzles[i - 1];
        requestAnimationFrame(function () { p.fit(); });
      }
      updateCover();
    }
  });

  // οι πίσω όψεις υπάρχουν μόνο αφού τρέξει το Book.init
  buildBacks();


  // ── πληκτρολόγιο ────────────────────────────────────────────────
  Keyboard.init(kb, {
    letter: function (ch) { var p = activePuzzle(); if (p) { p.type(ch); syncHint(); } },
    del: function () { var p = activePuzzle(); if (p) { p.backspace(); syncHint(); } },
    step: function (d) { var p = activePuzzle(); if (p) p.step(d); }
  });

  hintBtn.addEventListener('click', function () {
    var p = activePuzzle();
    if (p && p.useHint()) { paintClues(); }
    syncHint();
  });

  document.getElementById('fitbtn').addEventListener('click', function () {
    var p = activePuzzle();
    if (!p) return;
    // ζουμαρισμένος → δες όλο το τεύχος· αλλιώς → ξαναεστίασε στη λέξη
    if (window.Book && !Book.atFit()) p.fit();
    else if (p.active) p.zoomToWord(p.active.word);
  });

  document.getElementById('clue-hint').addEventListener('click', function () {
    var p = activePuzzle();
    if (p) p.nextUnsolved();
  });

  document.getElementById('clue-prev').addEventListener('click', function () {
    var p = activePuzzle(); if (p) p.step(-1);
  });
  document.getElementById('clue-next').addEventListener('click', function () {
    var p = activePuzzle(); if (p) p.step(1);
  });

  // ── ένωσε τις τελείες ───────────────────────────────────────────
  if (window.LUBEN_DOTS) {
    var host = document.getElementById('dots-wrap');
    var sub = host.previousElementSibling;          // η γραμμή οδηγιών
    board = new Dots.Board(host, window.LUBEN_DOTS, {
      onProgress: function (done, total) {
        sub.textContent = done >= total
          ? 'Έτοιμο. Τον αναγνώρισες;'
          : 'Επόμενη τελεία: ' + (done + 1) + ' από ' + total;
      }
    });
    document.getElementById('dots-reset').addEventListener('click', function () {
      board.reset();
    });
    document.getElementById('dots-solve').addEventListener('click', function () {
      board.solve();
    });
  }

  // ── λύσεις ──────────────────────────────────────────────────────
  function buildSolutions() {
    list.innerHTML = '';
    P.pages.forEach(function (page) {
      var box = document.createElement('div');
      box.className = 'sol-page';
      box.innerHTML = '<h3>' + page.label + '</h3>';
      page.words.slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (w) {
        var q = P.questions[w.id];
        var row = document.createElement('div');
        row.className = 'sol';
        row.innerHTML = '<span class="sn"></span><span class="sc"></span>' +
                        '<button class="sa" type="button"></button>';
        row.querySelector('.sn').textContent = w.n + (w.dir === 'H' ? '→' : '↓');
        row.querySelector('.sc').textContent = q.clue;
        // η απάντηση μένει θολή μέχρι να τη ζητήσεις — μια λέξη τη φορά,
        // για να μη χαλάει όλο το σταυρόλεξο όποιος ψάχνει ένα μόνο
        var a = row.querySelector('.sa');
        a.textContent = q.answer;
        a.addEventListener('click', function () {
          a.classList.add('on');
          SFX.key();
        });
        box.appendChild(row);
      });
      list.appendChild(box);
    });
  }

  function setSolutions(open) {
    if (open && !list.dataset.built) {
      buildSolutions();
      list.dataset.built = '1';
    }
    list.hidden = !open;
    revealBtn.textContent = open ? 'Κρύψε τις λύσεις' : 'Δείξε μου τις λύσεις';
    // η σελίδα σκρολάρει μόνο όταν υπάρχει λόγος
    lastPage.classList.toggle('scrollable', open);
    var sheet = lastPage.querySelector('.sheet');
    if (!open) { sheet.scrollTop = 0; return; }

    /* Σε μικρές οθόνες οι λύσεις ξεκινάνε κάτω από το ορατό και έμοιαζαν
       να μην εμφανίζονται καθόλου. Τις φέρνουμε μπροστά στα μάτια. */
    requestAnimationFrame(function () {
      var h = revealBtn.previousElementSibling;      // ο τίτλος «Λύσεις»
      var target = (h && h.previousElementSibling) || revealBtn;
      sheet.scrollTop = Math.max(0, target.offsetTop - 12);
    });
  }

  revealBtn.addEventListener('click', function () {
    setSolutions(list.hidden);
  });
  setSolutions(false);

  // ── resize ──────────────────────────────────────────────────────
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      syncKbSide();
      syncSpread();
      syncChrome();
      var p = activePuzzle();
      if (!p) return;
      if (p.active) p.zoomToWord(p.active.word); else p.fit(true);
    }, 140);
  });

  initSheetScroll();
  syncKbSide();
  syncSpread();
  syncChrome();
  updateCover();
  // το layout μπορεί να μην έχει σταθεροποιηθεί στο πρώτο frame
  requestAnimationFrame(function () {
    syncKbSide();
    syncSpread();
    // #1..#3 στο URL ανοίγει κατευθείαν τη σελίδα. ΠΡΕΠΕΙ να είναι εδώ και
    // όχι νωρίτερα: πριν στηθεί το τεύχος, το Book.go δεν έχει πού να πάει.
    var hash = parseInt((location.hash || '').slice(1), 10);
    if (hash >= 1 && hash <= 3) Book.go(hash, { silent: true });
    var p = activePuzzle();
    if (p) p.fit(true);
  });
})();
