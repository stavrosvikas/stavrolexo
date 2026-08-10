# -*- coding: utf-8 -*-
"""
Σφίξιμο πλέγματος με ruin & recreate, με δεσμευμένο χώρο για την εικόνα.

Ο greedy packer βάζει κάθε λέξη μία φορά και δεν την ξανακοιτάει. Εδώ ξηλώνουμε
επανειλημμένα ένα κομμάτι της λύσης και το ξαναχτίζουμε, κρατώντας ό,τι
βελτιώνει.

Η εικόνα-ορισμός δεσμεύει τετράγωνο IMAGE_SIZE x IMAGE_SIZE ΠΡΙΝ ξεκινήσει το
πακετάρισμα, και η λέξη που περιγράφει τοποθετείται κολλητά δεξιά της — έτσι η
ίδια η εικόνα παίζει τον ρόλο του κελιού-ορισμού, όπως στα έντυπα.

    python tools/optimize_grid.py
"""
import json, io, os, random, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QNA = os.path.join(ROOT, "data", "questions.json")
OUT = os.path.join(ROOT, "data", "grids.json")

DIRS = {"H": (0, 1), "V": (1, 0)}
TIME_PER_PAGE = 110.0       # δευτερόλεπτα ανά σελίδα, ανά χωρισμό
PARTITION_TRIES = 4
IMAGE_SIZE = 5

# Τα δεσμευμένα κελιά της εικόνας. Δεν είναι γράμματα, οπότε δεν ενεργοποιούν
# τους κανόνες γειτνίασης -- συμπεριφέρονται όπως τα κελιά-ορισμού.
BLOCKED = set()


# ------------------------------------------------------------------ core ---

def fits(cells, w, r, c, d):
    dr, dc = DIRS[d]
    if (r - dr, c - dc) in cells:
        return None
    if (r + dr * len(w), c + dc * len(w)) in cells:
        return None
    cross = 0
    for i, ch in enumerate(w):
        rr, cc = r + dr * i, c + dc * i
        if (rr, cc) in BLOCKED:
            return None
        cur = cells.get((rr, cc))
        if cur is not None:
            if cur != ch:
                return None
            cross += 1
        elif d == "H":
            if (rr - 1, cc) in cells or (rr + 1, cc) in cells:
                return None
        else:
            if (rr, cc - 1) in cells or (rr, cc + 1) in cells:
                return None
    return cross


def rebuild(placements):
    cells = {}
    for p in placements:
        dr, dc = DIRS[p["dir"]]
        for i, ch in enumerate(p["answer"]):
            cells[(p["r"] + dr * i, p["c"] + dc * i)] = ch
    return cells


def extent(cells):
    """Πλαίσιο που περικλείει γράμματα ΚΑΙ τον δεσμευμένο χώρο της εικόνας."""
    pts = list(cells) + list(BLOCKED)
    rs = [r for r, _ in pts]
    cs = [c for _, c in pts]
    return min(rs), min(cs), max(rs), max(cs)


def dims(cells):
    r0, c0, r1, c1 = extent(cells)
    return r1 - r0 + 1, c1 - c0 + 1


def cost(placements):
    cells = rebuild(placements)
    h, w = dims(cells)
    return max(h, w) * 1000 + h * w


def insert_all(words, placements, rnd, max_dim, greed=1):
    placements = list(placements)
    cells = rebuild(placements) if placements else {}

    if not cells and not BLOCKED:
        wid, w = words[0]
        for i, ch in enumerate(w):
            cells[(0, i)] = ch
        placements.append({"id": wid, "answer": w, "r": 0, "c": 0,
                           "dir": "H", "crossings": 0})
        words = words[1:]

    for wid, w in words:
        cands = []
        for i, ch in enumerate(w):
            for (r, c), gch in cells.items():
                if gch != ch:
                    continue
                for d in ("H", "V"):
                    rr = r - i if d == "V" else r
                    cc = c - i if d == "H" else c
                    cr = fits(cells, w, rr, cc, d)
                    if not cr:
                        continue
                    r0, c0, r1, c1 = extent(cells)
                    dr, dc = DIRS[d]
                    er, ec = rr + dr * (len(w) - 1), cc + dc * (len(w) - 1)
                    h = max(r1, rr, er) - min(r0, rr, er) + 1
                    wd = max(c1, cc, ec) - min(c0, cc, ec) + 1
                    if max(h, wd) > max_dim:
                        continue
                    cands.append((max(h, wd) * 1000 + h * wd - cr * 40,
                                  rr, cc, d, cr))
        if not cands:
            return None
        cands.sort(key=lambda x: x[0])
        pick = cands[rnd.randrange(min(greed, len(cands)))]
        _, r, c, d, cr = pick
        dr, dc = DIRS[d]
        for i, ch in enumerate(w):
            cells[(r + dr * i, c + dc * i)] = ch
        placements.append({"id": wid, "answer": w, "r": r, "c": c,
                           "dir": d, "crossings": cr})
    return placements


def solve(words, budget, seed=0, pinned=None, verbose=True):
    """pinned: placements που δεν ξηλώνονται ποτέ (η λέξη της εικόνας)."""
    rnd = random.Random(seed)
    pinned = pinned or []
    npin = len(pinned)
    total_letters = sum(len(w) for _, w in words) + sum(len(p["answer"]) for p in pinned)
    ordered = sorted(words, key=lambda x: -len(x[1]))
    longest = max([len(w) for _, w in words] +
                  [len(p["answer"]) for p in pinned] + [1])

    best = None
    for s in range(24):
        r = random.Random(seed * 100 + s)
        ws = list(ordered)
        r.shuffle(ws)
        ws.sort(key=lambda x: -len(x[1]))
        cand = insert_all(ws, pinned, r, max_dim=42, greed=1)
        if cand and (best is None or cost(cand) < cost(best)):
            best = cand
    if best is None:
        return None

    best_cost = cost(best)
    cur, cur_cost = best, best_cost
    t0 = time.time()
    it = 0
    while time.time() - t0 < budget:
        it += 1
        cells = rebuild(cur)
        h, w = dims(cells)
        target = max(longest, max(h, w) - (1 if rnd.random() < 0.55 else 0))

        movable = list(range(npin, len(cur)))
        if not movable:
            break
        k = rnd.randint(3, max(4, len(movable) // 3))
        k = min(k, len(movable))
        drop = set(rnd.sample(movable, k))
        kept = [cur[i] for i in range(len(cur)) if i not in drop]
        removed = [(cur[i]["id"], cur[i]["answer"]) for i in sorted(drop)]
        rnd.shuffle(removed)
        removed.sort(key=lambda x: -len(x[1]))

        cand = insert_all(removed, kept, rnd, max_dim=target, greed=3)
        if cand is None:
            continue
        c = cost(cand)
        if c <= cur_cost:
            cur, cur_cost = cand, c
            if c < best_cost:
                best, best_cost = cand, c
        elif rnd.random() < 0.02:
            cur, cur_cost = best, best_cost

    cells = rebuild(best)
    h, w = dims(cells)
    if verbose:
        print("    %d επαναλήψεις -> %dx%d, %d γράμματα, %d διασταυρώσεις"
              % (it, h, w, len(cells), total_letters - len(cells)))
    return best


# ------------------------------------------------------------ clue cells ---

def normalise(placements):
    """Μετατόπιση στο (1,1), με ένα κελί περιθώριο για τα κελιά-ορισμού."""
    global BLOCKED
    cells = rebuild(placements)
    r0, c0, _, _ = extent(cells)
    dr, dc = 1 - r0, 1 - c0
    for p in placements:
        p["r"] += dr
        p["c"] += dc
    BLOCKED = set((r + dr, c + dc) for r, c in BLOCKED)
    return placements


def clue_candidates(p):
    dr, dc = DIRS[p["dir"]]
    cands = [((p["r"] - dr, p["c"] - dc), "straight")]
    if p["dir"] == "H":
        cands += [((p["r"] - 1, p["c"]), "down-right"),
                  ((p["r"] + 1, p["c"]), "up-right")]
    else:
        cands += [((p["r"], p["c"] - 1), "right-down"),
                  ((p["r"], p["c"] + 1), "left-down")]
    return cands


def attach_clues(placements, rows, cols, skip_ids=()):
    """Δύο περάσματα: πρώτα με όριο 2 ορισμούς ανά κελί (όπως στα έντυπα),
    και μετά, μόνο για όσες έμειναν, με όριο 3."""
    cells = rebuild(placements)
    clue_cells = {}
    todo = [p for p in sorted(placements, key=lambda x: -(x["r"] + x["c"]))
            if p["id"] not in skip_ids]

    for cap in (2, 3):
        rest = []
        for p in todo:
            chosen = None
            for pos, kind in clue_candidates(p):
                if pos in cells or pos in BLOCKED:
                    continue
                if not (0 <= pos[0] < rows and 0 <= pos[1] < cols):
                    continue
                if len(clue_cells.get(pos, [])) >= cap:
                    continue
                chosen = (pos, kind)
                break
            if chosen is None:
                rest.append(p)
                continue
            pos, kind = chosen
            clue_cells.setdefault(pos, []).append({"id": p["id"], "arrow": kind})
            p["cluePos"] = list(pos)
            p["arrow"] = kind
        todo = rest
        if not todo:
            break
    return clue_cells, todo


def render(placements, clue_cells, rows, cols):
    cells = rebuild(placements)
    out = []
    for r in range(rows):
        row = []
        for c in range(cols):
            if (r, c) in cells:
                row.append(cells[(r, c)])
            elif (r, c) in BLOCKED:
                row.append("█")
            elif (r, c) in clue_cells:
                row.append("▓" if len(clue_cells[(r, c)]) > 1 else "▒")
            else:
                row.append("·")
        out.append("".join(row))
    return "\n".join(out)


# ----------------------------------------------------------------- build ---

def build_page(group, img_item, budget, seed):
    """Επιστρέφει (placements, image_word_id ή None)."""
    global BLOCKED
    BLOCKED = set()
    pinned = []
    img_id = None

    if img_item:
        img_id = img_item["id"]
        # η εικόνα στο (0,0)-(4,4), η λέξη ξεκινάει κολλητά δεξιά, στη μεσαία σειρά
        for r in range(IMAGE_SIZE):
            for c in range(IMAGE_SIZE):
                BLOCKED.add((r, c))
        row = IMAGE_SIZE // 2
        pinned.append({"id": img_id, "answer": img_item["answer"],
                       "r": row, "c": IMAGE_SIZE, "dir": "H", "crossings": 0})

    words = [(x["id"], x["answer"]) for x in group if x["id"] != img_id]
    sol = solve(words, budget, seed=seed, pinned=pinned)
    return sol, img_id


def main():
    global BLOCKED
    qna = json.load(io.open(QNA, encoding="utf-8"))
    items = qna["items"]
    img_item = next((x for x in items if x.get("image")), None)

    best = None
    for t in range(PARTITION_TRIES):
        rnd = random.Random(t + 1)
        srt = sorted(items, key=lambda x: -x["len"])
        A, B = [], []
        for i, x in enumerate(srt):
            (A if i % 2 == 0 else B).append(x)
        if t:
            pool = list(items)
            rnd.shuffle(pool)
            pool.sort(key=lambda x: -x["len"])
            A, B = [], []
            for i, x in enumerate(pool):
                (A if i % 2 == 0 else B).append(x)

        print("Χωρισμός %d/%d:" % (t + 1, PARTITION_TRIES))
        pages, blocks, ok = [], [], True
        for name, grp in (("Α", A), ("Β", B)):
            has_img = img_item in grp
            print("  σελίδα %s%s" % (name, " (με την εικόνα)" if has_img else ""))
            sol, img_id = build_page(grp, img_item if has_img else None,
                                     TIME_PER_PAGE / PARTITION_TRIES, t)
            if sol is None:
                ok = False
                break
            pages.append((sol, img_id, set(BLOCKED), grp))
        if not ok:
            continue
        score = sum(cost(p[0]) for p in pages)
        if best is None or score < best[0]:
            best = (score, pages)

    out_pages = []
    for i, (placements, img_id, blocked, grp) in enumerate(best[1], 1):
        # Κάθε λέξη ΠΡΕΠΕΙ να έχει κελί-ορισμού. Αν μια δεν βρει, ξαναφτιάχνουμε
        # τη σελίδα με άλλο σπόρο -- καλύτερα λίγα δευτερόλεπτα παραπάνω παρά
        # μια λέξη που δεν φτάνεις από το πλέγμα.
        for attempt in range(5):
            BLOCKED = set(blocked)
            trial = [dict(p) for p in placements]
            trial = normalise(trial)
            cells = rebuild(trial)
            h, w = dims(cells)
            rows, cols = h + 2, w + 2
            clue_cells, unplaced = attach_clues(trial, rows, cols,
                                                skip_ids=(img_id,) if img_id else ())
            if not unplaced:
                break
            print("  σελίδα %d: χωρίς κελί-ορισμού %s — ξαναφτιάχνω (%d)"
                  % (i, [p["answer"] for p in unplaced], attempt + 1))
            sol, _ = build_page(grp, img_item if img_id else None,
                                TIME_PER_PAGE / PARTITION_TRIES, 200 + attempt)
            if sol is None:
                break
            placements, blocked = sol, set(BLOCKED)
        placements = trial
        print("=" * 72)
        print("ΣΕΛΙΔΑ %d — %dx%d | %d λέξεις | %d γράμματα (%.0f%%) | κελί@390px %.0fpx"
              % (i, rows, cols, len(placements), len(cells),
                 100.0 * len(cells) / (rows * cols), 390.0 / max(rows, cols)))
        if unplaced:
            print("  !! χωρίς κελί-ορισμού:", [p["answer"] for p in unplaced])
        print()
        print(render(placements, clue_cells, rows, cols))
        print()

        page = {
            "label": "ΣΕΛΙΔΑ %d" % i,
            "rows": rows, "cols": cols,
            "words": placements,
            "clueCells": [{"r": r, "c": c, "clues": v}
                          for (r, c), v in sorted(clue_cells.items())],
        }
        if img_id and BLOCKED:
            rs = [r for r, _ in BLOCKED]
            cs = [c for _, c in BLOCKED]
            word = next(p for p in placements if p["id"] == img_id)
            page["imageBlock"] = {
                "id": img_id, "r": min(rs), "c": min(cs), "size": IMAGE_SIZE,
                "src": img_item["image"], "arrow": "straight",
                "dir": word["dir"], "attached": True,
            }
            word["cluePos"] = [min(rs), min(cs)]
            word["arrow"] = "straight"
            print("  εικόνα: %dx%d στο (%d,%d), κολλητά στη λέξη %s"
                  % (IMAGE_SIZE, IMAGE_SIZE, min(rs), min(cs), word["answer"]))
        out_pages.append(page)

    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump({"pages": out_pages}, f, ensure_ascii=False, indent=1)
    print("γράφτηκε:", OUT)


if __name__ == "__main__":
    main()
