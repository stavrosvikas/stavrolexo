# -*- coding: utf-8 -*-
"""
Web εκδοχές των γραφιστικών. Τα πρωτότυπα δεν πειράζονται ποτέ.

  assets/cover.png   (1200x1600 PNG)  ->  assets/cover-web.jpg
  assets/cover.png                    ->  assets/og.jpg (1200x630)
  assets/q58.png     (halftone)       ->  assets/q58-web.png (900px)

Το q58 μένει PNG: είναι halftone με κουκκίδες, και το JPEG θα το γέμιζε
artifacts. Τα 900px είναι ό,τι χρειάζεται στο μέγιστο ζουμ σε retina.

    python tools/make_web_assets.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")

RED = (251, 45, 70)


def kb(path):
    return os.path.getsize(path) / 1024.0


def main():
    src = os.path.join(A, "cover.png")
    cover = Image.open(src).convert("RGB")
    print("πρωτότυπο: %dx%d  %.0f KB" % (cover.size[0], cover.size[1], kb(src)))

    # 1) εξώφυλλο για το web -- η οθόνη δεν χρειάζεται ποτέ πάνω από ~1200px
    web = cover.copy()
    web.thumbnail((1200, 1600), Image.LANCZOS)
    out = os.path.join(A, "cover-web.jpg")
    web.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    print("cover-web.jpg: %dx%d  %.0f KB  (-%.0f%%)"
          % (web.size[0], web.size[1], kb(out), 100 - 100.0 * kb(out) / kb(src)))

    # 2) og:image 1200x630 -- το εξώφυλλο κεντραρισμένο σε κόκκινο
    og = Image.new("RGB", (1200, 630), RED)
    h = 560
    w = int(cover.size[0] * h / cover.size[1])
    shot = cover.resize((w, h), Image.LANCZOS)
    og.paste(shot, ((1200 - w) // 2, (630 - h) // 2))
    out = os.path.join(A, "og.jpg")
    og.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print("og.jpg: 1200x630  %.0f KB" % kb(out))

    # 3) η φωτογραφία-ορισμός μέσα στο πλέγμα
    qsrc = os.path.join(A, "q58.png")
    if os.path.exists(qsrc):
        q = Image.open(qsrc).convert("L")
        q.thumbnail((900, 900), Image.LANCZOS)
        out = os.path.join(A, "q58-web.png")
        q.save(out, "PNG", optimize=True)
        print("q58-web.png: %dx%d  %.0f KB  (-%.0f%%)"
              % (q.size[0], q.size[1], kb(out), 100 - 100.0 * kb(out) / kb(qsrc)))


if __name__ == "__main__":
    main()
