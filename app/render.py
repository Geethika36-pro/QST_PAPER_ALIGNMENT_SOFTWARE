import os
import sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Windows only: tell WeasyPrint where MSYS2 installed Pango
if sys.platform == 'win32':
    os.environ.setdefault('WEASYPRINT_DLL_DIRECTORIES', r'C:\msys64\mingw64\bin')

BASE = Path(__file__).resolve().parent.parent
env = Environment(
    loader=FileSystemLoader(BASE / 'templates'),
    autoescape=select_autoescape(['html']),
)


def partial_for(qtype):
    name = 'text' if qtype in ('short', 'long') else str(qtype)
    if (BASE / 'templates' / 'partials' / f'{name}.html').exists():
        return name
    return 'unknown'


def build_view(paper: dict) -> dict:
    number = 0
    sections = []
    for s in paper.get('sections', []):
        questions = s.get('questions', [])
        rows = []
        for q in questions:
            number += 1
            rows.append({'no': number, 'q': q, 'tpl': partial_for(q.get('type'))})
        per = s.get('marksPerQuestion', 1)
        count = len(questions)
        sections.append({
            'label': s.get('label', ''),
            'instruction': s.get('instruction', ''),
            'rows': rows,
            'marks_line': f'{per}×{count}={per * count}',
        })
    css = (BASE / 'static' / 'paper.css').read_text(encoding='utf-8')
    return {'paper': paper, 'sections': sections, 'css': css}


def render_html(paper: dict) -> str:
    return env.get_template('paper.html').render(**build_view(paper))


def render_pdf(paper: dict) -> bytes:
    from weasyprint import HTML  # imported here so the server starts even if WeasyPrint is missing
    return HTML(string=render_html(paper)).write_pdf()
