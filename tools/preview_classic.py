# -*- coding: utf-8 -*-
"""Ζωγραφίζει το κλασικό πλέγμα σε PNG, για να κρίνεται με το μάτι και όχι
   μόνο από ποσοστά. Μαύρο = κενό, λευκό = γράμμα, γκρι = η φωτογραφία."""
import json, io, sys
from PIL import Image, ImageDraw, ImageFont

CELL = 26


def load_font(size):
    for path in (r'C:\Windows\Fonts\arialbd.ttf', r'C:\Windows\Fonts\arial.ttf'):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def main(src='data/classic_page1.json', out='tools/classic_preview.png',
         letters=True):
    D = json.loads(io.open(src, encoding='utf-8').read())
    rows, cols = D['rows'], D['cols']
    img = Image.new('RGB', (cols * CELL + 2, rows * CELL + 2), (26, 26, 30))
    d = ImageDraw.Draw(img)
    fnum = load_font(9)
    fch = load_font(15)

    grid = {}
    starts = {}
    for w in D['words']:
        r, c, dr, dc = w['r'], w['c'], (1 if w['dir'] == 'V' else 0), \
                       (1 if w['dir'] == 'H' else 0)
        starts.setdefault((r, c), []).append(w['id'])
        for k, ch in enumerate(w['answer']):
            grid[(r + dr * k, c + dc * k)] = ch

    for cc in D.get('clueCells', []):
        x, y = cc['c'] * CELL + 1, cc['r'] * CELL + 1
        d.rectangle([x, y, x + CELL, y + CELL], fill=(70, 20, 34),
                    outline=(150, 60, 80))

    ib = D.get('imageBlock')
    for (r, c), ch in grid.items():
        x, y = c * CELL + 1, r * CELL + 1
        d.rectangle([x, y, x + CELL, y + CELL], fill=(255, 255, 255),
                    outline=(150, 150, 155))
        if letters:
            d.text((x + CELL / 2, y + CELL / 2), ch, font=fch,
                   fill=(20, 20, 20), anchor='mm')

    # αρίθμηση όπως στα κλασικά: με τη σειρά ανάγνωσης
    n = 0
    for r in range(rows):
        for c in range(cols):
            if (r, c) in starts:
                n += 1
                d.text((c * CELL + 3, r * CELL + 2), str(n), font=fnum,
                       fill=(200, 30, 60))

    if ib:
        x, y = ib['c'] * CELL + 1, ib['r'] * CELL + 1
        s = ib['size'] * CELL
        d.rectangle([x, y, x + s, y + s], fill=(120, 120, 128),
                    outline=(255, 255, 255))
        d.text((x + s / 2, y + s / 2), 'ΦΩΤΟ', font=fch, fill=(255, 255, 255),
               anchor='mm')

    img.save(out)
    fill = 100.0 * len(grid) / (rows * cols)
    print('%s  %dx%d  γράμματα %d  γέμισμα %.0f%%' % (out, rows, cols,
                                                      len(grid), fill))


if __name__ == '__main__':
    main(*(sys.argv[1:] or []))
