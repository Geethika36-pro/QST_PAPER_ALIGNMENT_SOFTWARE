import json
from fastapi import Body, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from .render import BASE, render_html, render_pdf

app = FastAPI(
    title="Question Paper Alignment Software",
    description="Educational examination paper alignment and formatting backend and web interface",
    version="1.0.0",
)

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
    school = paper.get('school', 'exam_paper')
    slug = "".join(c if c.isalnum() else "_" for c in school).strip("_")[:30] or "exam_paper"
    filename = f"{slug}.pdf"
    return Response(
        pdf,
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Access-Control-Expose-Headers': 'Content-Disposition',
        },
    )


# @app.get('/dev/sample', response_class=HTMLResponse)
# def dev_sample():
#     data = json.loads((BASE / 'tests' / 'sample_paper.json').read_text(encoding='utf-8'))
#     return render_html(data)


# @app.get('/dev/sample.pdf')
# def dev_sample_pdf():
#     data = json.loads((BASE / 'tests' / 'sample_paper.json').read_text(encoding='utf-8'))
#     return Response(render_pdf(data), media_type='application/pdf')


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

