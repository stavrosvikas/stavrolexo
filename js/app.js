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
  var kb = document.getElementById('keyboard');
  var list = document.getElementById('solutions-list');
  var revealBtn = document.getElementById('btn-reveal');
  var lastPage = document.querySelector('.last');

  function activePuzzle() {
    var p = Book.current();
    return (p === 1 || p === 2) ? puzzles[p - 1] : null;
  }

  function showClue(w, q) {
    if (!w) {
      // καθάρισε το πεδίο, μη μείνει κρεμασμένος ο προηγούμενος ορισμός.
      // Η μπάρα κρατάει τον χώρο της, απλώς αδειάζει.
      cluebar.classList.add('empty');
      clueN.textContent = '';
      clueText.textContent = '';
      clueLen.textContent = '';
      clueImg.hidden = true;
      clueImg.removeAttribute('src');
      return;
    }
    cluebar.classList.remove('empty');
    clueN.textContent = w.n + (w.dir === 'H' ? ' ΟΡΙΖΟΝΤΙΑ' : ' ΚΑΘΕΤΑ');
    clueText.textContent = q.clue;
    clueLen.textContent = w.answer.length + ' γράμματα';
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
    cluebar.classList.toggle('empty', !onGrid || !p || !p.active);
    kb.classList.toggle('empty', !onGrid || !Keyboard.wantsOnScreen());
  }

  // ── πλέγματα ────────────────────────────────────────────────────
  P.pages.forEach(function (pageData, i) {
    var el = document.querySelector('.face[data-grid="' + i + '"]');
    puzzles.push(new Grid.Puzzle(el, pageData, P.questions, i, {
      onClue: function (w, q) { showClue(w, q); syncChrome(); },
      onProgress: updateCover
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
      if (i === 1 || i === 2) {
        var p = puzzles[i - 1];
        requestAnimationFrame(function () { p.fit(); });
      }
      updateCover();
    }
  });

  // ── πληκτρολόγιο ────────────────────────────────────────────────
  Keyboard.init(kb, {
    letter: function (ch) { var p = activePuzzle(); if (p) p.type(ch); },
    del: function () { var p = activePuzzle(); if (p) p.backspace(); },
    step: function (d) { var p = activePuzzle(); if (p) p.step(d); }
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
    if (!open) lastPage.scrollTop = 0;
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
      syncChrome();
      var p = activePuzzle();
      if (!p) return;
      if (p.active) p.zoomToWord(p.active.word); else p.fit(true);
    }, 140);
  });

  syncChrome();
  updateCover();
})();
