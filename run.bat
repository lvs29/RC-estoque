@echo off
if exist "%~dp0venv\Scripts\activate.bat" (
    call "%~dp0venv\Scripts\activate.bat"
)
python -m waitress --host=0.0.0.0 --port=8000 app:app