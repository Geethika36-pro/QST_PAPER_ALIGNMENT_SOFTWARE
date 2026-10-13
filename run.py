"""
Question Paper Alignment Software — Integrated Server Runner
Launches the FastAPI backend and serves the integrated web frontend.

Usage:
    python run.py
    or
    python -m app.main
"""

import sys
import uvicorn

if __name__ == '__main__':
    print("Starting Question Paper Alignment Software on http://127.0.0.1:8000 ...")
    uvicorn.run('app.main:app', host='127.0.0.1', port=8000, reload=True)
