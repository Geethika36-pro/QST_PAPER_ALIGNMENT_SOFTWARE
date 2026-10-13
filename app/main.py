import json
from fastapi import Body, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from .render import BASE, render_html, render_pdf

app = FastAPI()

# MVP: allow any origin so the frontend can be opened from a file or a dev server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/preview', response_class=HTMLResponse)
def preview(paper: dict = Body(...)):
    return render_html(paper)


@app.post('/generate')
def generate(paper: dict = Body(...)):
    try:
        pdf = render_pdf(paper)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': f'PDF failed: {e}'})
    return Response(
        pdf,
        media_type='application/pdf',
        headers={'Content-Disposition': 'attachment; filename=exam_paper.pdf'},
    )


@app.get('/dev/sample', response_class=HTMLResponse)
def dev_sample():
    data = json.loads((BASE / 'tests' / 'sample_paper.json').read_text(encoding='utf-8'))
    return render_html(data)


@app.get('/dev/sample.pdf')
def dev_sample_pdf():
    data = json.loads((BASE / 'tests' / 'sample_paper.json').read_text(encoding='utf-8'))
    return Response(render_pdf(data), media_type='application/pdf')
