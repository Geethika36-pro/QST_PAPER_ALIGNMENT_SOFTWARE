import json
from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .docx_render import render_docx
from .render import BASE, render_html, render_pdf
from .sanitize import (
    ALLOWED_FONTS,
    ALLOWED_SIZES,
    ALLOWED_WIDTHS,
    MAX_FIGURE_BYTES,
    MAX_FIGURES_COUNT,
    clean_paper,
)

app = FastAPI(
    title='Question Paper Alignment Software',
    description='Educational examination paper alignment and formatting backend and web interface',
    version='1.0.0',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
    expose_headers=['Content-Disposition'],
)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/options')
def options():
    return {
        'fonts': ALLOWED_FONTS,
        'sizes': ALLOWED_SIZES,
        'formats': ['pdf', 'docx'],
        'figure': {
            'maxBytes': MAX_FIGURE_BYTES,
            'maxCount': MAX_FIGURES_COUNT,
            'widths': ALLOWED_WIDTHS,
        },
    }


@app.post('/preview', response_class=HTMLResponse)
def preview(paper: dict = Body(...)):
    cleaned, errors = clean_paper(paper)
    if errors:
        return JSONResponse(status_code=422, content={'detail': errors})
    try:
        return HTMLResponse(content=render_html(cleaned))
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': f'Preview failed: {e}'})


@app.post('/generate')
def generate(format: str = Query('pdf'), paper: dict = Body(...)):
    fmt = (format or 'pdf').lower()
    if fmt not in ('pdf', 'docx'):
        return JSONResponse(
            status_code=422,
            content={'detail': [{'loc': ['query', 'format'], 'msg': "Export format must be 'pdf' or 'docx'"}]},
        )

    cleaned, errors = clean_paper(paper)
    if errors:
        return JSONResponse(status_code=422, content={'detail': errors})

    school = cleaned.get('school', 'exam_paper')
    slug = ''.join(c if c.isalnum() else '_' for c in school).strip('_')[:30] or 'exam_paper'

    if fmt == 'pdf':
        try:
            pdf_bytes = render_pdf(cleaned)
        except Exception as e:
            return JSONResponse(status_code=500, content={'error': f'PDF failed: {e}'})
        filename = f'{slug}.pdf'
        return Response(
            pdf_bytes,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Access-Control-Expose-Headers': 'Content-Disposition',
            },
        )
    else:
        try:
            docx_bytes = render_docx(cleaned)
        except Exception as e:
            return JSONResponse(status_code=500, content={'error': f'DOCX failed: {e}'})
        filename = f'{slug}.docx'
        return Response(
            docx_bytes,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Access-Control-Expose-Headers': 'Content-Disposition',
            },
        )


@app.get('/dev/sample', response_class=HTMLResponse)
def dev_sample():
    data = json.loads((BASE / 'tests' / 'sample_paper.json').read_text(encoding='utf-8'))
    cleaned, _ = clean_paper(data)
    return HTMLResponse(content=render_html(cleaned))


@app.get('/dev/sample.pdf')
def dev_sample_pdf():
    data = json.loads((BASE / 'tests' / 'sample_paper.json').read_text(encoding='utf-8'))
    cleaned, _ = clean_paper(data)
    return Response(render_pdf(cleaned), media_type='application/pdf')


# Mount static print CSS
static_dir = BASE / 'static'
if static_dir.exists():
    app.mount('/static', StaticFiles(directory=static_dir), name='static')

# Mount and serve integrated frontend application
frontend_dir = BASE / 'frontend'
if frontend_dir.exists():
    app.mount('/', StaticFiles(directory=frontend_dir, html=True), name='frontend')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('app.main:app', host='127.0.0.1', port=8000, reload=True)
