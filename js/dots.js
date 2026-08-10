/* Ένωσε τις τελείες — 114 σημεία βγαλμένα από το SVG του Illustrator.
   Δουλεύει και με σύρσιμο: περνάς το δάχτυλο πάνω από την επόμενη τελεία. */
window.Dots = (function () {
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function Board(host, data, hooks) {
    this.host = host;
    this.data = data;
    this.hooks = hooks || {};
    this.pts = data.dots;
    this.progress = Store.dots();
    this.build();
  }

  Board.prototype.build = function () {
    var self = this, vb = this.data.viewBox;
    var svg = el('svg', {
      viewBox: vb.join(' '),
      preserveAspectRatio: 'xMidYMid meet'
    });
    this.svg = svg;

    // το πλήρες σχέδιο, κρυφό μέχρι το «Δείξε το»
    this.reveal = el('path', { d: this.data.path, class: 'dot-reveal' });
    this.reveal.style.display = 'none';
    svg.appendChild(this.reveal);

    this.line = el('polyline', { class: 'dot-line', points: '' });
    svg.appendChild(this.line);

    this.nodes = [];
    this.pts.forEach(function (p, i) {
      var g = el('g', {});
      var circle = el('circle', { cx: p[0], cy: p[1], r: 7, class: 'dot-pt' });
      var num = el('text', {
        x: p[0] + 11, y: p[1] - 8, class: 'dot-num'
      });
      num.textContent = i + 1;
      g.appendChild(circle);
      g.appendChild(num);
      svg.appendChild(g);
      self.nodes.push({ circle: circle, num: num, p: p });
    });

    this.host.appendChild(svg);
    this.bind();
    this.paint();
  };

  Board.prototype.toSvg = function (clientX, clientY) {
    var r = this.svg.getBoundingClientRect();
    var vb = this.data.viewBox;
    // preserveAspectRatio meet -> ίδια κλίμακα στους δύο άξονες
    var s = Math.min(r.width / vb[2], r.height / vb[3]);
    var ox = (r.width - vb[2] * s) / 2, oy = (r.height - vb[3] * s) / 2;
    return {
      x: (clientX - r.left - ox) / s,
      y: (clientY - r.top - oy) / s
    };
  };

  Board.prototype.hit = function (clientX, clientY) {
    if (this.progress >= this.pts.length) return;
    var p = this.toSvg(clientX, clientY);
    var target = this.pts[this.progress];
    var d = Math.hypot(p.x - target[0], p.y - target[1]);
    if (d <= 34) {
      this.progress++;
      Store.dots(this.progress);
      SFX.dot(this.progress);
      this.paint();
      if (this.progress === this.pts.length) {
        this.reveal.style.display = '';
        SFX.good();
      }
      // αν το δάχτυλο είναι ήδη πάνω στην επόμενη, συνέχισε
      this.hit(clientX, clientY);
    }
  };

  Board.prototype.bind = function () {
    var self = this, down = false;
    this.svg.addEventListener('pointerdown', function (e) {
      down = true;
      try { self.svg.setPointerCapture(e.pointerId); } catch (err) {}
      self.hit(e.clientX, e.clientY);
    });
    this.svg.addEventListener('pointermove', function (e) {
      if (!down) return;
      self.hit(e.clientX, e.clientY);
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      self.svg.addEventListener(ev, function () { down = false; });
    });
  };

  Board.prototype.paint = function () {
    var pts = this.pts.slice(0, this.progress);
    this.line.setAttribute('points', pts.map(function (p) { return p.join(','); }).join(' '));
    for (var i = 0; i < this.nodes.length; i++) {
      var n = this.nodes[i];
      var done = i < this.progress;
      var next = i === this.progress;
      n.circle.setAttribute('class', 'dot-pt' + (done ? ' done' : next ? ' next' : ''));
      n.circle.setAttribute('r', next ? 13 : 7);
      n.num.setAttribute('class', 'dot-num' + (done ? ' done' : ''));
    }
    if (this.hooks.onProgress) {
      this.hooks.onProgress(this.progress, this.pts.length);
    }
  };

  Board.prototype.reset = function () {
    this.progress = 0;
    Store.dots(0);
    this.reveal.style.display = 'none';
    this.paint();
  };

  Board.prototype.solve = function () {
    this.progress = this.pts.length;
    Store.dots(this.progress);
    this.reveal.style.display = '';
    this.paint();
  };

  return { Board: Board };
})();
