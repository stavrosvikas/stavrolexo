/* Αποθήκευση προόδου — ό,τι γράφεις μένει γραμμένο. */
window.Store = (function () {
  var KEY = 'luben-stavrolexo-v1';
  var mem = null;

  function read() {
    if (mem) return mem;
    try {
      mem = JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      mem = {};
    }
    if (!mem.grids) mem.grids = {};
    return mem;
  }

  var pending = null;
  function flush() {
    pending = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(mem));
    } catch (e) { /* γεμάτο ή private mode — δεν χαλάει το παιχνίδι */ }
  }

  return {
    letters: function (gridIndex) {
      var s = read();
      if (!s.grids[gridIndex]) s.grids[gridIndex] = {};
      return s.grids[gridIndex];
    },
    page: function (v) {
      var s = read();
      if (v === undefined) return s.page || 0;
      s.page = v;
      this.save();
    },
    revealed: function (v) {
      var s = read();
      if (v === undefined) return !!s.revealed;
      s.revealed = v;
      this.save();
    },
    dots: function (v) {
      var s = read();
      if (v === undefined) return s.dots || 0;
      s.dots = v;
      this.save();
    },
    save: function () {
      read();
      if (pending) clearTimeout(pending);
      pending = setTimeout(flush, 250);
    },
    reset: function () {
      mem = { grids: {} };
      flush();
    }
  };
})();
