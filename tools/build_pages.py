# -*- coding: utf-8 -*-
"""Συναρμολογεί το data/grids.json από τα δύο διαφορετικά πλέγματα:

  σελίδα 1 — ΚΛΑΣΙΚΟ: ένα ενιαίο σώμα, χωρίς κελιά-ορισμούς μέσα. Οι λέξεις
             αριθμούνται με τη σειρά ανάγνωσης και οι ορισμοί ζουν έξω.
  σελίδα 2 — ΣΚΑΝΔΙΝΑΒΙΚΟ: όπως πριν, με τα βελάκια μέσα στο πλέγμα.

Ποιες 30 λέξεις πάνε πού το έχει ήδη αποφασίσει το tools/classic_grid.py.

    python tools/build_pages.py
"""
import importlib.util, json, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLASSIC = os.path.join(ROOT, 'data', 'classic_page1.json')
QNA = os.path.join(ROOT, 'data', 'questions.json')
OUT = os.path.join(ROOT, 'data', 'grids.json')

spec = importlib.util.spec_from_file_location(
    'og', os.path.join(ROOT, 'tools', 'optimize_grid.py'))
og = importlib.util.module_from_spec(spec)
spec.loader.exec_module(og)


def classic_page(D, qna):
    """Οι διασταυρώσεις μετριούνται εδώ, ώστε να φαίνονται και στα δεδομένα."""
    own = {}
    for w in D['words']:
        dr, dc = (1, 0) if w['dir'] == 'V' else (0, 1)
        for k in range(len(w['answer'])):
            own.setdefault((w['r'] + dr * k, w['c'] + dc * k), []).append(w['id'])
    words = []
    for w in D['words']:
        dr, dc = (1, 0) if w['dir'] == 'V' else (0, 1)
        x = sum(1 for k in range(len(w['answer']))
                if len(own[(w['r'] + dr * k, w['c'] + dc * k)]) > 1)
        words.append({'id': w['id'], 'answer': w['answer'], 'r': w['r'],
                      'c': w['c'], 'dir': w['dir'], 'crossings': x})
    page = {'label': 'ΣΕΛΙΔΑ 1 · ΚΛΑΣΙΚΟ', 'style': 'classic',
            'rows': D['rows'], 'cols': D['cols'],
            'words': words, 'clueCells': []}
    if D.get('imageBlock'):
        b = D['imageBlock']
        img_id = next((w['id'] for w in D['words']
                       if abs(w['r'] - (b['r'] + b['size'] // 2)) <= 1
                       and w['c'] == b['c'] + b['size']), None)
        page['imageBlock'] = {'id': img_id, 'r': b['r'], 'c': b['c'],
                              'size': b['size'], 'dir': 'H', 'attached': True}
    return page


def scandi_page(ids, qna, seeds=(0, 1, 2, 3, 4)):
    items = {int(x['id']): x for x in qna['items']}
    group = [items[i] for i in sorted(ids)]
    for seed in seeds:
        sol, _ = og.build_page(group, None, 45.0, seed=seed)
        if sol is None:
            continue
        trial = og.normalise([dict(p) for p in sol])
        h, w = og.dims(og.rebuild(trial))
        rows, cols = h + 2, w + 2
        clue, unplaced = og.attach_clues(trial, rows, cols)
        if unplaced:
            print('  σπόρος %d: %d λέξεις χωρίς κελί-ορισμού, ξαναδοκιμάζω'
                  % (seed, len(unplaced)))
            continue
        return {'label': 'ΣΕΛΙΔΑ 2 · ΣΚΑΝΔΙΝΑΒΙΚΟ', 'style': 'scandi',
                'rows': rows, 'cols': cols,
                'words': [{'id': p['id'], 'answer': p['answer'], 'r': p['r'],
                           'c': p['c'], 'dir': p['dir'],
                           'crossings': p.get('crossings', 0)} for p in trial],
                'clueCells': [{'r': k[0], 'c': k[1], 'clues': v}
                              for k, v in clue.items()]}
    raise SystemExit('δεν βρέθηκε σκανδιναβικό όπου κάθε λέξη έχει ορισμό')


def main():
    qna = json.load(io.open(QNA, encoding='utf-8'))
    D = json.loads(io.open(CLASSIC, encoding='utf-8').read())

    p1 = classic_page(D, qna)
    print('σελίδα 1 (κλασικό): %dx%d, %d λέξεις'
          % (p1['rows'], p1['cols'], len(p1['words'])))

    p2 = scandi_page(set(D['leftover']), qna)
    print('σελίδα 2 (σκανδιναβικό): %dx%d, %d λέξεις, %d κελιά-ορισμοί'
          % (p2['rows'], p2['cols'], len(p2['words']), len(p2['clueCells'])))

    json.dump({'pages': [p1, p2]}, io.open(OUT, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('-> data/grids.json')


if __name__ == '__main__':
    main()
