# -*- coding: utf-8 -*-
"""
Ενώνει questions.json + grids.json σε ένα data/puzzle.js.

Γιατί .js και όχι fetch() του .json: έτσι ανοίγει το index.html με διπλό κλικ
(file://), χωρίς να στήσεις server. Στο GitHub Pages δουλεύει το ίδιο.

    python tools/export_js.py
"""
import json, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QNA = os.path.join(ROOT, "data", "questions.json")
GRIDS = os.path.join(ROOT, "data", "grids.json")
OUT = os.path.join(ROOT, "data", "puzzle.js")

qna = json.load(io.open(QNA, encoding="utf-8"))
grids = json.load(io.open(GRIDS, encoding="utf-8"))

questions = {}
for it in qna["items"]:
    questions[str(it["id"])] = {
        "clue": it["clue"],
        "answer": it["answer"],
        "image": it["image"],
    }

# Αρίθμηση με τη σειρά ανάγνωσης (πάνω-αριστερά πρώτα). Η εικόνα μετράει κι
# αυτή ως κελί-ορισμού, γιατί αυτόν τον ρόλο παίζει.
for page in grids["pages"]:
    anchors = [(cc["r"], cc["c"], cc) for cc in page["clueCells"]]
    ib = page.get("imageBlock")
    if ib:
        # μία πηγή αλήθειας για το αρχείο εικόνας: το questions.json. Αλλιώς
        # το grids.json κρατάει ό,τι ίσχυε όταν παρήχθη και ξεχνιέται.
        q = questions.get(str(ib["id"]))
        if q and q.get("image"):
            ib["src"] = q["image"]
        anchors.append((ib["r"], ib["c"], ib))
    anchors.sort(key=lambda a: (a[0], a[1]))

    numbers = {}
    for n, (_, _, obj) in enumerate(anchors, 1):
        obj["n"] = n
        for entry in obj.get("clues", [{"id": obj.get("id")}]):
            if entry.get("id") is not None:
                numbers[entry["id"]] = n

    missing = [w["id"] for w in page["words"] if w["id"] not in numbers]
    if missing:
        raise SystemExit("λέξεις χωρίς αριθμό στο %s: %s" % (page["label"], missing))
    for w in page["words"]:
        w["n"] = numbers[w["id"]]

payload = {
    "title": qna.get("title", "ΣΤΑΥΡΟΛΕΞΟ LUBEN"),
    "questions": questions,
    "pages": grids["pages"],
}

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write("// AUTO-GENERATED από tools/export_js.py — μην το πειράζεις στο χέρι.\n")
    f.write("window.LUBEN_PUZZLE = ")
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print("γράφτηκε:", OUT)
print("σελίδες:", len(payload["pages"]),
      "| ερωτήσεις:", len(questions),
      "| λέξεις στο πλέγμα:", sum(len(p["words"]) for p in payload["pages"]))
