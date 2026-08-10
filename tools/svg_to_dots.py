# -*- coding: utf-8 -*-
"""
assets/dots-face.svg  ->  data/dots.js

Το path του Illustrator έχει εκατοντάδες σημεία και καμπύλες. Για connect-the-dots
θέλουμε λίγες δεκάδες αριθμημένες τελείες που να κρατάνε το σχέδιο αναγνωρίσιμο.

Στρατηγική:
  1. διάβασε το path (M/L/H/V/C/S + relative) και δειγματοθέτησε τις καμπύλες
  2. ρίξε τα σημεία με Ramer-Douglas-Peucker -- κρατάει τις γωνίες, πετάει
     τα ενδιάμεσα σε ίσιες γραμμές. Οι γωνίες είναι ακριβώς αυτό που ορίζει
     ένα πρόσωπο, οπότε δεν χάνεται το σχέδιο.
  3. πέτα τελείες που πέφτουν πολύ κοντά σε προηγούμενη

    python tools/svg_to_dots.py
"""
import re, os, io, json, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "dots-face.svg")
OUT = os.path.join(ROOT, "data", "dots.js")

RDP_EPS = 11.0       # ανοχή απλοποίησης (σε μονάδες viewBox 1080)
MIN_GAP = 26.0       # ελάχιστη απόσταση μεταξύ τελειών
CURVE_STEPS = 14


# ------------------------------------------------------------ path parse ---

TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?")


def parse_path(d):
    toks = TOKEN.findall(d)
    i, n = 0, len(toks)
    pts = []
    cur = (0.0, 0.0)
    start = (0.0, 0.0)
    prev_ctrl = None       # τελευταίο control point κυβικής (για S/s)
    prev_q = None          # τελευταίο control point τετραγωνικής (για T/t)
    cmd = None

    def num():
        nonlocal i
        v = float(toks[i]); i += 1
        return v

    def bezier(p0, p1, p2, p3):
        out = []
        for s in range(1, CURVE_STEPS + 1):
            t = s / float(CURVE_STEPS)
            mt = 1 - t
            x = (mt**3 * p0[0] + 3*mt*mt*t * p1[0] + 3*mt*t*t * p2[0] + t**3 * p3[0])
            y = (mt**3 * p0[1] + 3*mt*mt*t * p1[1] + 3*mt*t*t * p2[1] + t**3 * p3[1])
            out.append((x, y))
        return out

    def quad(p0, p1, p2):
        out = []
        for s in range(1, CURVE_STEPS + 1):
            t = s / float(CURVE_STEPS)
            mt = 1 - t
            out.append((mt*mt * p0[0] + 2*mt*t * p1[0] + t*t * p2[0],
                        mt*mt * p0[1] + 2*mt*t * p1[1] + t*t * p2[1]))
        return out

    while i < n:
        t = toks[i]
        if re.match(r"^[MmLlHhVvCcSsQqTtAaZz]$", t):
            cmd = t
            i += 1
            if cmd in "Zz":
                pts.append(start)
                cur = start
                continue
        rel = cmd.islower()
        c = cmd.upper()

        if c == "M":
            x, y = num(), num()
            cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
            start = cur
            pts.append(cur)
            cmd = "l" if rel else "L"      # τα επόμενα ζεύγη είναι lineto
            prev_ctrl = prev_q = None
        elif c == "L":
            x, y = num(), num()
            cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
            pts.append(cur)
            prev_ctrl = prev_q = None
        elif c == "H":
            x = num()
            cur = (cur[0] + x, cur[1]) if rel else (x, cur[1])
            pts.append(cur)
            prev_ctrl = prev_q = None
        elif c == "V":
            y = num()
            cur = (cur[0], cur[1] + y) if rel else (cur[0], y)
            pts.append(cur)
            prev_ctrl = prev_q = None
        elif c == "C":
            x1, y1, x2, y2, x, y = (num() for _ in range(6))
            if rel:
                p1 = (cur[0] + x1, cur[1] + y1)
                p2 = (cur[0] + x2, cur[1] + y2)
                p3 = (cur[0] + x, cur[1] + y)
            else:
                p1, p2, p3 = (x1, y1), (x2, y2), (x, y)
            pts.extend(bezier(cur, p1, p2, p3))
            prev_ctrl = p2
            prev_q = None
            cur = p3
        elif c == "S":
            x2, y2, x, y = (num() for _ in range(4))
            if rel:
                p2 = (cur[0] + x2, cur[1] + y2)
                p3 = (cur[0] + x, cur[1] + y)
            else:
                p2, p3 = (x2, y2), (x, y)
            p1 = (2 * cur[0] - prev_ctrl[0], 2 * cur[1] - prev_ctrl[1]) if prev_ctrl else cur
            pts.extend(bezier(cur, p1, p2, p3))
            prev_ctrl = p2
            prev_q = None
            cur = p3
        elif c == "Q":
            x1, y1, x, y = (num() for _ in range(4))
            if rel:
                p1 = (cur[0] + x1, cur[1] + y1)
                p2 = (cur[0] + x, cur[1] + y)
            else:
                p1, p2 = (x1, y1), (x, y)
            pts.extend(quad(cur, p1, p2))
            prev_q = p1
            prev_ctrl = None
            cur = p2
        elif c == "T":
            x, y = num(), num()
            p2 = (cur[0] + x, cur[1] + y) if rel else (x, y)
            p1 = (2 * cur[0] - prev_q[0], 2 * cur[1] - prev_q[1]) if prev_q else cur
            pts.extend(quad(cur, p1, p2))
            prev_q = p1
            prev_ctrl = None
            cur = p2
        elif c == "A":
            # τόξο — δεν εμφανίζεται σε αυτά τα exports· κρατάμε το τελικό σημείο
            for _ in range(5):
                num()
            x, y = num(), num()
            cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
            pts.append(cur)
            prev_ctrl = prev_q = None
        else:
            i += 1
    return pts


# ------------------------------------------------------------------ rdp ---

def rdp(points, eps):
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = points[a]; bx, by = points[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)
        best, bi = -1.0, -1
        for k in range(a + 1, b):
            px, py = points[k]
            if norm == 0:
                dist = math.hypot(px - ax, py - ay)
            else:
                dist = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if dist > best:
                best, bi = dist, k
        if best > eps:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(points, keep) if k]


def thin(points, gap):
    out = []
    for p in points:
        if not out or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= gap:
            out.append(p)
    return out


def main():
    svg = io.open(SRC, encoding="utf-8").read()
    d = re.search(r'\sd="([^"]+)"', svg).group(1)
    vb = re.search(r'viewBox="([\d.\s-]+)"', svg).group(1).split()
    vbw, vbh = float(vb[2]), float(vb[3])

    raw = parse_path(d)
    simple = rdp(raw, RDP_EPS)
    dots = thin(simple, MIN_GAP)

    xs = [p[0] for p in dots]; ys = [p[1] for p in dots]
    print("σημεία path (δειγματοληψία): %d" % len(raw))
    print("μετά από RDP (eps=%.1f):      %d" % (RDP_EPS, len(simple)))
    print("μετά από αραίωμα (gap=%.0f):  %d τελείες" % (MIN_GAP, len(dots)))
    print("πλαίσιο σχεδίου: x %.0f..%.0f  y %.0f..%.0f  (viewBox %.0fx%.0f)"
          % (min(xs), max(xs), min(ys), max(ys), vbw, vbh))

    payload = {
        "viewBox": [0, 0, vbw, vbh],
        "dots": [[round(x, 1), round(y, 1)] for x, y in dots],
        "path": d,                       # το πρωτότυπο, για την αποκάλυψη
    }
    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write("// AUTO-GENERATED από tools/svg_to_dots.py\n")
        f.write("window.LUBEN_DOTS = ")
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("γράφτηκε:", OUT)


if __name__ == "__main__":
    main()
