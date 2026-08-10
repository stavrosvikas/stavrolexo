# -*- coding: utf-8 -*-
"""
ΣΤΑΥΡΟΛΕΞΟ LUBEN — γεννήτρια πλέγματος (offline, τρέχει μία φορά)

Διαβάζει data/questions.json και βγάζει data/grids.json με τα δύο πλέγματα.
Το site είναι static — δεν τρέχει τίποτα από αυτά στον browser.

Στυλ: σκανδιναβικό υβριδικό. Οι λέξεις διασταυρώνονται, τα κενά είναι μαύρα,
και κάθε λέξη ξεκινάει από ένα κελί-clue με βελάκι που δείχνει προς τα πού
γράφεις. Το κείμενο του clue ζει έξω από το πλέγμα (μπάρα), το κελί κρατάει
βελάκι + αριθμό.

    python tools/generate_grid.py
"""
import json, io, os, random, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QNA = os.path.join(ROOT, "data", "questions.json")
OUT = os.path.join(ROOT, "data", "grids.json")

RESTARTS = 400          # τυχαίες επανεκκινήσεις ανά πλέγμα
DIRS = {"H": (0, 1), "V": (1, 0)}


# ---------------------------------------------------------------- packing ---

class Grid:
    def __init__(self):
        self.cells = {}      # (r,c) -> letter
        self.words = []      # dicts: id, answer, r, c, dir, crossings

    def bbox(self):
        rs = [r for r, _ in self.cells]
        cs = [c for _, c in self.cells]
        return min(rs), min(cs), max(rs), max(cs)

    def size(self):
        r0, c0, r1, c1 = self.bbox()
        return (r1 - r0 + 1, c1 - c0 + 1)

    def fits(self, w, r, c, d):
        """Returns crossing count, or None if the placement is illegal.

        Criss-cross rules: words may only touch where they cross. A word's
        head and tail must be clear, and any letter that is not a crossing
        must have empty cells on both perpendicular sides."""
        dr, dc = DIRS[d]
        if (r - dr, c - dc) in self.cells:
            return None
        if (r + dr * len(w), c + dc * len(w)) in self.cells:
            return None
        crossings = 0
        for i, ch in enumerate(w):
            rr, cc = r + dr * i, c + dc * i
            cur = self.cells.get((rr, cc))
            if cur is not None:
                if cur != ch:
                    return None
                crossings += 1
            elif d == "H":
                if (rr - 1, cc) in self.cells or (rr + 1, cc) in self.cells:
                    return None
            else:
                if (rr, cc - 1) in self.cells or (rr, cc + 1) in self.cells:
                    return None
        return crossings

    def put(self, wid, w, r, c, d, crossings):
        dr, dc = DIRS[d]
        for i, ch in enumerate(w):
            self.cells[(r + dr * i, c + dc * i)] = ch
        self.words.append({"id": wid, "answer": w, "r": r, "c": c,
                           "dir": d, "crossings": crossings})


def pack(words, seed, max_dim):
    """words: [(id, answer)] sorted longest-first. Returns Grid or None."""
    rnd = random.Random(seed)
    g = Grid()

    wid, w = words[0]
    g.put(wid, w, 0, 0, "H", 0)

    rest = list(words[1:])
    # shuffle within equal-length buckets so restarts explore different orders
    rnd.shuffle(rest)
    rest.sort(key=lambda x: -len(x[1]))

    for wid, w in rest:
        best = None
        for i, ch in enumerate(w):
            for (r, c), g_ch in g.cells.items():
                if g_ch != ch:
                    continue
                for d in ("H", "V"):
                    rr = r - i if d == "V" else r
                    cc = c - i if d == "H" else c
                    cr = g.fits(w, rr, cc, d)
                    if not cr:                       # None or 0 crossings
                        continue
                    # would it blow the size budget?
                    r0, c0, r1, c1 = g.bbox()
                    dr, dc = DIRS[d]
                    er, ec = rr + dr * (len(w) - 1), cc + dc * (len(w) - 1)
                    h = max(r1, rr, er) - min(r0, rr, er) + 1
                    wd = max(c1, cc, ec) - min(c0, cc, ec) + 1
                    if max(h, wd) > max_dim:
                        continue
                    # prefer many crossings, compact and square
                    score = (cr * 1000 - (h * wd) - abs(h - wd) * 5
                             + rnd.random())
                    if best is None or score > best[0]:
                        best = (score, rr, cc, d, cr)
        if best is None:
            return None
        _, r, c, d, cr = best
        g.put(wid, w, r, c, d, cr)
    return g


# ------------------------------------------------------------- clue cells ---

def normalise(g):
    """Shift to origin, leaving a 1-cell margin for clue cells."""
    r0, c0, _, _ = g.bbox()
    dr, dc = 1 - r0, 1 - c0
    g.cells = {(r + dr, c + dc): ch for (r, c), ch in g.cells.items()}
    for w in g.words:
        w["r"] += dr
        w["c"] += dc
    return g


def attach_clues(g, rows, cols):
    """Give every word a clue cell with an arrow.

    Preferred: the cell directly before the word (arrow points straight in).
    Fallback: the neighbour beside that cell, with an elbow arrow -- this is
    the standard Scandinavian trick when the straight-back cell is taken."""
    letters = set(g.cells)
    clue_cells = {}          # (r,c) -> [entries]
    unplaced = []

    # Words that start further from the top-left get their clue cell first,
    # so the crowded interior resolves before the easy edges.
    order = sorted(g.words, key=lambda w: -(w["r"] + w["c"]))

    for w in order:
        dr, dc = DIRS[w["dir"]]
        back = (w["r"] - dr, w["c"] - dc)
        cands = []
        if back not in letters and 0 <= back[0] < rows and 0 <= back[1] < cols:
            cands.append((back, "straight"))
        # elbow candidates: beside the first letter, arrow turns into the word
        if w["dir"] == "H":
            elbows = [((w["r"] - 1, w["c"]), "down-right"),
                      ((w["r"] + 1, w["c"]), "up-right")]
        else:
            elbows = [((w["r"], w["c"] - 1), "right-down"),
                      ((w["r"], w["c"] + 1), "left-down")]
        for pos, kind in elbows:
            if pos not in letters and 0 <= pos[0] < rows and 0 <= pos[1] < cols:
                cands.append((pos, kind))

        # a clue cell holds at most 2 clues, like the printed ones
        chosen = None
        for pos, kind in cands:
            if len(clue_cells.get(pos, [])) < 2:
                chosen = (pos, kind)
                break
        if chosen is None:
            unplaced.append(w)
            continue
        pos, kind = chosen
        clue_cells.setdefault(pos, []).append({"id": w["id"], "arrow": kind})
        w["cluePos"] = list(pos)
        w["arrow"] = kind

    return clue_cells, unplaced


# ------------------------------------------------------------------ build ---

def build(group, label, max_dim):
    words = sorted([(x["id"], x["answer"]) for x in group], key=lambda x: -len(x[1]))
    best = None
    for seed in range(RESTARTS):
        g = pack(words, seed, max_dim)
        if g is None:
            continue
        h, w = g.size()
        cross = sum(x["crossings"] for x in g.words)
        key = (max(h, w), h * w, -cross)
        if best is None or key < best[0]:
            best = (key, g)
    if best is None:
        raise SystemExit("Δεν χώρεσαν οι λέξεις σε %d — ανέβασε το max_dim" % max_dim)

    g = normalise(best[1])
    h, w = g.size()
    rows, cols = h + 2, w + 2          # +1 margin each side for clue cells
    clue_cells, unplaced = attach_clues(g, rows, cols)

    return {
        "label": label,
        "rows": rows,
        "cols": cols,
        "words": g.words,
        "clueCells": [{"r": r, "c": c, "clues": v} for (r, c), v in sorted(clue_cells.items())],
        "_grid": g,
        "_unplaced": unplaced,
    }


def render(page):
    g = page["_grid"]
    clues = {(cc["r"], cc["c"]): cc for cc in page["clueCells"]}
    out = []
    for r in range(page["rows"]):
        row = []
        for c in range(page["cols"]):
            if (r, c) in g.cells:
                row.append(g.cells[(r, c)])
            elif (r, c) in clues:
                row.append("▓" if len(clues[(r, c)]["clues"]) > 1 else "▒")
            else:
                row.append("·")
        out.append("".join(row))
    return "\n".join(out)


def main():
    data = json.load(io.open(QNA, encoding="utf-8"))
    items = data["items"]

    # Split so the two monster words land on different pages.
    srt = sorted(items, key=lambda x: -x["len"])
    A, B = [], []
    for i, x in enumerate(srt):
        (A if i % 2 == 0 else B).append(x)

    pages = [build(A, "ΣΕΛΙΔΑ 1", 22), build(B, "ΣΕΛΙΔΑ 2", 22)]

    for p in pages:
        print("=" * 70)
        print("%s — %d x %d, %d λέξεις, %d διασταυρώσεις"
              % (p["label"], p["rows"], p["cols"], len(p["words"]),
                 sum(w["crossings"] for w in p["words"])))
        letters = len(p["_grid"].cells)
        print("  γράμματα: %d / %d κελιά (%.0f%%)   κελιά-clue: %d"
              % (letters, p["rows"] * p["cols"],
                 100.0 * letters / (p["rows"] * p["cols"]), len(p["clueCells"])))
        if p["_unplaced"]:
            print("  !! ΧΩΡΙΣ ΚΕΛΙ-CLUE:", [w["answer"] for w in p["_unplaced"]])
        print()
        print(render(p))
        print()

    for p in pages:
        del p["_grid"]
        del p["_unplaced"]
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump({"pages": pages}, f, ensure_ascii=False, indent=1)
    print("γράφτηκε:", OUT)


if __name__ == "__main__":
    main()
