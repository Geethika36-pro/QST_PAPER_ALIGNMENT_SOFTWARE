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

FONT_STACKS = {
    'Times New Roman': "'Times New Roman', 'Liberation Serif', Tinos, serif",
    'Arial': "'Arial', 'Liberation Sans', Arimo, sans-serif",
    'Calibri': "'Calibri', Carlito, sans-serif",
    'Cambria': "'Cambria', Caladea, serif",
    'Georgia': "'Georgia', 'Liberation Serif', serif",
    'Verdana': "'Verdana', 'Liberation Sans', sans-serif",
    'Courier New': "'Courier New', 'Liberation Mono', monospace",
}


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

    style = paper.get('style', {}) or {}
    font_family = style.get('fontFamily', 'Times New Roman')
    font_size = style.get('fontSize', 11)
    font_stack = FONT_STACKS.get(font_family, FONT_STACKS['Times New Roman'])

    return {
        'paper': paper,
        'sections': sections,
        'css': css,
        'font_stack': font_stack,
        'font_size': font_size,
    }


def render_html(paper: dict) -> str:
    return env.get_template('paper.html').render(**build_view(paper))


def render_pdf(paper: dict) -> bytes:
    from weasyprint import HTML  # imported here so the server starts even if WeasyPrint is missing
    from weasyprint.urls import URLFetcher

    # Restrictive URL fetcher permitting only data: URIs
    fetcher = URLFetcher(allowed_protocols=('data',))
    return HTML(string=render_html(paper), url_fetcher=fetcher).write_pdf()
