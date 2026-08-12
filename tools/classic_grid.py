# -*- coding: utf-8 -*-
"""Χτίζει ΚΛΑΣΙΚΟ πλέγμα: ένα ενιαίο σώμα, ορισμοί έξω (μόνο νούμερα μέσα),
και όσο περισσότερες διασταυρώσεις γίνεται.

Γιατί χωριστό εργαλείο από το optimize_grid.py: εκεί κάθε λέξη χρειάζεται
δικό της κελί-ορισμό μέσα στο πλέγμα (σκανδιναβικό στιλ), και αυτά τα 28
κελιά σπρώχνουν τις λέξεις μακριά τη μία από την άλλη -- γι' αυτό μόνο το
17% των γραμμάτων ανήκει σε δύο λέξεις. Εδώ δεν υπάρχουν, οπότε ο χώρος
πάει όλος στο δέσιμο.

Κανόνες που ΔΕΝ παραβιάζονται:
  - καμία λέξη δεν ακουμπάει άλλη πλάι-πλάι (θα δημιουργούσε ψεύτικες
    δίγραμμες λέξεις στην κάθετη κατεύθυνση)
  - πριν και μετά από κάθε λέξη υπάρχει κενό ή άκρη
  - το τετράγωνο της εικόνας είναι απαραβίαστο
  - το πλέγμα βγαίνει ΕΝΑ κομμάτι
"""
import json, io, random, sys, collections

random.seed(20260812)

SIZE_IMG = 5          # το τετράγωνο της φωτογραφίας
TRIES    = 100000     # γύροι ruin & recreate (κόβεται από τον χρόνο)
ASPECT   = 0.75       # η σελίδα είναι όρθια 3:4 -- τόσο θέλουμε πλάτος/ύψος
# ΣΚΛΗΡΗ ΚΟΡΝΙΖΑ. Χωρίς αυτή ο αλγόριθμος έχει άπειρο χώρο: κάθε νέα λέξη
# κολλάει στην άκρη της προηγούμενης και η μάζα ξεφεύγει διαγώνια σαν σκάλα,
# με 21% γέμισμα. Το πλαίσιο τον αναγκάζει να στριμώξει τις λέξεις μαζί.
MAXR, MAXC = 25, 19


TARGET = 30           # πόσες λέξεις θέλουμε στην κλασική σελίδα


def load_words():
    """ΟΛΕΣ οι 60. Ποιες 30 θα μπουν στο κλασικό το αποφασίζει ο αλγόριθμος --
       κάποιες λέξεις δένουν εύκολα και κάποιες όχι, και η επιλογή είναι το
       μισό παιχνίδι. Οι υπόλοιπες πάνε στο σκανδιναβικό."""
    src = io.open('data/puzzle.js', encoding='utf-8').read()
    P = json.loads(src[src.index('{'):src.rindex('}') + 1])
    ws = [{'id': int(k), 'answer': v['answer']}
          for k, v in sorted(P['questions'].items(), key=lambda kv: int(kv[0]))]
    img_id = None
    for pg in P['pages']:
        if pg.get('imageBlock'):
            img_id = pg['imageBlock']['id']
    return ws, img_id, P


class Grid(object):
    """Αραιό πλέγμα: dict (r,c) -> γράμμα. Το τετράγωνο της εικόνας κρατιέται
       χωριστά γιατί δεν έχει γράμματα αλλά πιάνει χώρο."""

    def __init__(self):
        self.cell = {}
        self.placed = []           # (id, answer, r, c, dir)
        self.img = None            # (r, c)

    # ---------------------------------------------------------------- έλεγχοι
    def blocked(self, r, c):
        if self.img is None:
            return False
        ir, ic = self.img
        return ir <= r < ir + SIZE_IMG and ic <= c < ic + SIZE_IMG

    def fits(self, word, r, c, d):
        """Επιστρέφει τον αριθμό διασταυρώσεων ή None αν δεν χωράει."""
        n = len(word)
        dr, dc = (0, 1) if d == 'H' else (1, 0)
        if not self.inframe(r, c, r + dr * (n - 1), c + dc * (n - 1)):
            return None
        # κενό πριν και μετά
        for k in (-1, n):
            rr, cc = r + dr * k, c + dc * k
            if (rr, cc) in self.cell or self.blocked(rr, cc):
                return None
        cross = 0
        for k in range(n):
            rr, cc = r + dr * k, c + dc * k
            if self.blocked(rr, cc):
                return None
            here = self.cell.get((rr, cc))
            if here is not None:
                if here != word[k]:
                    return None
                cross += 1
            else:
                # άδειο κελί: δεν επιτρέπεται να ακουμπάει παράλληλη λέξη
                for sr, sc in ((dc, dr), (-dc, -dr)):
                    if (rr + sr, cc + sc) in self.cell:
                        return None
        return cross

    def inframe(self, r0, c0, r1, c1):
        """Θα χωράει το πάν μέσα στην κορνίζα αν βάλουμε κι αυτό;"""
        occ = list(self.cell)
        if self.img:
            ir, ic = self.img
            occ += [(ir, ic), (ir + SIZE_IMG - 1, ic + SIZE_IMG - 1)]
        occ += [(r0, c0), (r1, c1)]
        rs = [p[0] for p in occ]; cs = [p[1] for p in occ]
        return (max(rs) - min(rs) < MAXR) and (max(cs) - min(cs) < MAXC)

    def place(self, wid, word, r, c, d):
        dr, dc = (0, 1) if d == 'H' else (1, 0)
        for k in range(len(word)):
            self.cell[(r + dr * k, c + dc * k)] = word[k]
        self.placed.append((wid, word, r, c, d))

    # -------------------------------------------------------------- μετρήσεις
    def crossings(self):
        owner = collections.defaultdict(list)
        for i, (wid, w, r, c, d) in enumerate(self.placed):
            dr, dc = (0, 1) if d == 'H' else (1, 0)
            for k in range(len(w)):
                owner[(r + dr * k, c + dc * k)].append(i)
        per = collections.Counter()
        checked = 0
        for pos, ws in owner.items():
            if len(ws) > 1:
                checked += 1
                for i in ws:
                    per[i] += 1
        return owner, per, checked

    def components(self):
        occ = set(self.cell)
        if self.img:
            ir, ic = self.img
            for dr in range(SIZE_IMG):
                for dc in range(SIZE_IMG):
                    occ.add((ir + dr, ic + dc))
        seen, comps = set(), 0
        for p in occ:
            if p in seen:
                continue
            comps += 1
            st = [p]; seen.add(p)
            while st:
                r, c = st.pop()
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (r + d[0], c + d[1])
                    if q in occ and q not in seen:
                        seen.add(q); st.append(q)
        return comps

    def bbox(self):
        occ = list(self.cell)
        if self.img:
            ir, ic = self.img
            occ += [(ir, ic), (ir + SIZE_IMG - 1, ic + SIZE_IMG - 1)]
        rs = [p[0] for p in occ]; cs = [p[1] for p in occ]
        return min(rs), min(cs), max(rs), max(cs)

    def score(self):
        """Ό,τι μετράει, με τη σειρά που μετράει."""
        owner, per, checked = self.crossings()
        n = len(self.placed)
        lonely = sum(1 for i in range(n) if per[i] == 0)
        thin   = sum(1 for i in range(n) if per[i] == 1)
        comps  = self.components()
        r0, c0, r1, c1 = self.bbox()
        h = r1 - r0 + 1; w = c1 - c0 + 1
        area = h * w
        # Η σελίδα είναι όρθια: ένα πλατύ πλέγμα θα τυπωνόταν μικροσκοπικό.
        shape = abs(w - h * ASPECT) * 260
        letters = len(self.cell)
        return (checked * 160          # πρώτο ζητούμενο: δέσιμο
                + letters * 22         # και γεμάτο πλαίσιο, όχι μαύρη έρημος
                - lonely * 1200        # καμία λέξη δεν κρέμεται μόνη
                - thin * 300           # ούτε από ένα μόνο γράμμα
                - (comps - 1) * 1500   # ΕΝΑ σώμα
                - area * 1.30          # μαζεμένο (αλλιώς απλώνει και γεμίζει μαύρο)
                - shape)               # και όρθιο


def clone(g):
    h = Grid()
    h.cell = dict(g.cell)
    h.placed = list(g.placed)
    h.img = g.img
    return h


def rebuild_cells(g):
    g.cell = {}
    for (wid, w, r, c, d) in g.placed:
        dr, dc = (0, 1) if d == 'H' else (1, 0)
        for k in range(len(w)):
            g.cell[(r + dr * k, c + dc * k)] = w[k]


def best_spot(g, word, greedy=True):
    """Καλύτερη θέση για μια λέξη: πρώτα διασταυρώσεις, μετά μάζεμα."""
    cands = []
    for (pid, pw, pr, pc, pd) in g.placed:
        dr, dc = (0, 1) if pd == 'H' else (1, 0)
        nd = 'V' if pd == 'H' else 'H'
        for k in range(len(pw)):
            rr, cc = pr + dr * k, pc + dc * k
            for j, ch in enumerate(word):
                if ch != pw[k]:
                    continue
                r = rr - (j if nd == 'V' else 0)
                c = cc - (j if nd == 'H' else 0)
                got = g.fits(word, r, c, nd)
                if got is None:
                    continue
                cands.append((got * 10 - (abs(r - 40) * 0.16 + abs(c - 40) * 0.30),
                              r, c, nd))
    if not cands:
        return None
    cands.sort(key=lambda x: -x[0])
    if greedy or len(cands) == 1:
        return cands[0][1:]
    return random.choice(cands[:min(4, len(cands))])[1:]


def reinsert(g, missing, greedy=True):
    """Ξαναβάζει λέξεις, πάντα αυτή που δένει καλύτερα πρώτη."""
    left = list(missing)
    while left:
        best = None
        for w in left:
            spot = best_spot(g, w['answer'], greedy)
            if spot is None:
                continue
            r, c, d = spot
            got = g.fits(w['answer'], r, c, d)
            val = got * 10 - (abs(r - 40) + abs(c - 40)) * 0.22
            if best is None or val > best[0]:
                best = (val, w, r, c, d)
        if best is None:
            return False                      # δεν χώρεσε -- η λύση απορρίπτεται
        _, w, r, c, d = best
        g.place(w['id'], w['answer'], r, c, d)
        left.remove(w)
    return True


def build(words, img_id, seed_id=None):
    """Χτίζει διαλέγοντας: σε κάθε βήμα μπαίνει η λέξη που δένει καλύτερα,
       από ΟΛΟ το απόθεμα. Σταματάει στις TARGET."""
    g = Grid()
    pool = list(words)

    # Η λέξη της εικόνας μπαίνει υποχρεωτικά και πρώτη, με το τετράγωνο
    # κολλητά της, ώστε να είναι σαφές ποιον ορισμό εικονογραφεί.
    imgw = next((w for w in pool if w['id'] == img_id), None)
    if imgw:
        pool.remove(imgw)
        g.img = (40, 40)
        g.place(imgw['id'], imgw['answer'], 40 + SIZE_IMG // 2, 40 + SIZE_IMG, 'H')
    else:
        first = max(pool, key=lambda w: len(w['answer']))
        pool.remove(first)
        g.place(first['id'], first['answer'], 40, 40, 'H')

    if seed_id is not None:
        sw = next((w for w in pool if w['id'] == seed_id), None)
        if sw:
            spot = best_spot(g, sw['answer'], greedy=False)
            if spot:
                pool.remove(sw)
                g.place(sw['id'], sw['answer'], spot[0], spot[1], spot[2])

    while len(g.placed) < TARGET and pool:
        best = None
        for w in pool:
            spot = best_spot(g, w['answer'])
            if spot is None:
                continue
            r, c, d = spot
            got = g.fits(w['answer'], r, c, d)
            # μεγάλες λέξεις με πολλές διασταυρώσεις αξίζουν περισσότερο
            val = got * 16 + len(w['answer']) * 0.5 - (abs(r - 40) + abs(c - 40)) * 0.10
            if best is None or val > best[0]:
                best = (val, w, r, c, d)
        if best is None:
            break
        _, w, r, c, d = best
        g.place(w['id'], w['answer'], r, c, d)
        pool.remove(w)
    return g


def save(g, words):
    """Γράφεται σε ΚΑΘΕ βελτίωση, ώστε να μη χάνεται η δουλειά αν κοπεί."""
    r0, c0, r1, c1 = g.bbox()
    used = set(p[0] for p in g.placed)
    out = {'rows': r1 - r0 + 1, 'cols': c1 - c0 + 1,
           'words': [{'id': wid, 'answer': w, 'r': r - r0, 'c': c - c0, 'dir': d}
                     for (wid, w, r, c, d) in g.placed],
           'leftover': [w['id'] for w in words if w['id'] not in used]}
    if g.img:
        out['imageBlock'] = {'r': g.img[0] - r0, 'c': g.img[1] - c0,
                             'size': SIZE_IMG}
    io.open('data/classic_page1.json', 'w', encoding='utf-8').write(
        json.dumps(out, ensure_ascii=False, indent=1))


def main():
    words, img_id, _ = load_words()
    by_id = dict((w['id'], w) for w in words)
    print('απόθεμα %d λέξεις, στόχος %d στην κλασική σελίδα' % (len(words), TARGET))

    base = build(words, img_id)
    if len(base.placed) < TARGET:
        print('χώρεσαν μόνο %d' % len(base.placed))
    best = (base.score(), base)
    o, per, ch = base.crossings()
    print('αρχή       σκορ %8.0f  σταυρωμένα %d/%d (%.0f%%)  λέξεις %d'
          % (best[0], ch, len(o), 100.0 * ch / len(o), len(base.placed)))

    for t in range(TRIES):
        g = clone(best[1])
        owner, per, _ = g.crossings()
        # ΓΚΡΕΜΙΣΜΑ: προτίμησε να πετάξεις αυτές που κρέμονται από ένα γράμμα
        weak = [i for i in range(len(g.placed)) if per[i] <= 1]
        k = random.randint(2, 6)
        idx = set(random.sample(range(1, len(g.placed)), min(k, len(g.placed) - 1)))
        if weak and random.random() < .75:
            idx.add(random.choice([i for i in weak if i > 0] or [1]))
        g.placed = [p for i, p in enumerate(g.placed) if i not in idx]
        rebuild_cells(g)
        # ΞΑΝΑΧΤΙΣΙΜΟ από ΟΛΟ το απόθεμα -- εδώ γίνεται και η ανταλλαγή λέξεων
        used = set(p[0] for p in g.placed)
        avail = [w for w in words if w['id'] not in used]
        greedy = random.random() < .5
        while len(g.placed) < TARGET and avail:
            pick = None
            for w in avail:
                spot = best_spot(g, w['answer'], greedy)
                if spot is None:
                    continue
                r, c, d = spot
                got = g.fits(w['answer'], r, c, d)
                val = got * 16 + len(w['answer']) * 0.5                       - (abs(r - 40) + abs(c - 40)) * 0.10
                if pick is None or val > pick[0]:
                    pick = (val, w, r, c, d)
            if pick is None:
                break
            _, w, r, c, d = pick
            g.place(w['id'], w['answer'], r, c, d)
            avail.remove(w)
        if len(g.placed) < TARGET:
            continue
        s_ = g.score()
        if s_ > best[0]:
            best = (s_, g)
            save(g, words)
            o, per, ch = g.crossings()
            r0, c0, r1, c1 = g.bbox()
            print('γύρος %4d  σκορ %8.0f  σταυρωμένα %d/%d (%.0f%%)  '
                  'μόνες %d  με 1 %d  κομμάτια %d  %dx%d'
                  % (t, s_, ch, len(o), 100.0 * ch / len(o),
                     sum(1 for i in range(len(g.placed)) if per[i] == 0),
                     sum(1 for i in range(len(g.placed)) if per[i] == 1),
                     g.components(), r1 - r0 + 1, c1 - c0 + 1))
            sys.stdout.flush()

    g = best[1]
    owner, per, checked = g.crossings()
    r0, c0, r1, c1 = g.bbox()
    print()
    print('ΤΕΛΙΚΟ  %dx%d  λέξεις %d' % (r1 - r0 + 1, c1 - c0 + 1, len(g.placed)))
    print('  σταυρωμένα γράμματα %d/%d = %.0f%%'
          % (checked, len(owner), 100.0 * checked / len(owner)))
    print('  διασταυρώσεις/λέξη μέσος %.2f  min %d  max %d'
          % (sum(per.values()) / float(len(g.placed)),
             min(per[i] for i in range(len(g.placed))),
             max(per[i] for i in range(len(g.placed)))))
    print('  κομμάτια %d' % g.components())

    used = [p[0] for p in g.placed]
    left = [w['id'] for w in words if w['id'] not in set(used)]
    out = {'rows': r1 - r0 + 1, 'cols': c1 - c0 + 1,
           'words': [{'id': wid, 'answer': w, 'r': r - r0, 'c': c - c0, 'dir': d}
                     for (wid, w, r, c, d) in g.placed],
           'leftover': left}
    if g.img:
        out['imageBlock'] = {'r': g.img[0] - r0, 'c': g.img[1] - c0, 'size': SIZE_IMG}
    io.open('data/classic_page1.json', 'w', encoding='utf-8').write(
        json.dumps(out, ensure_ascii=False, indent=1))
    print('  για το σκανδιναβικό μένουν %d λέξεις' % len(left))
    print('  -> data/classic_page1.json')


if __name__ == '__main__':
    main()
