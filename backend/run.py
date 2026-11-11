import os
import sys
from pathlib import Path
from dotenv import dotenv_values


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DOTENV_PATH = PROJECT_ROOT / '.env.development.local'
ALLOWED_KEYS = ('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY')
SAFE_PROCESS_KEYS = ('PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'PYTHONPATH')


def main() -> None:
    file_values = dotenv_values(DOTENV_PATH) if DOTENV_PATH.exists() else {}
    child_env = {key: os.environ[key] for key in SAFE_PROCESS_KEYS if key in os.environ}

    for key in ALLOWED_KEYS:
        value = os.environ.get(key) or file_values.get(key)
        if value:
            child_env[key] = value

    if not child_env.get('SUPABASE_URL'):
        raise SystemExit('SUPABASE_URL is required to start the API.')
    if not (child_env.get('SUPABASE_PUBLISHABLE_KEY') or child_env.get('SUPABASE_ANON_KEY')):
        raise SystemExit('A Supabase publishable or anon key is required to start the API.')

    command = [
        sys.executable,
        '-m',
        'uvicorn',
        'backend.main:app',
        '--host',
        '0.0.0.0',
        '--port',
        '8000',
    ]
    os.execvpe(sys.executable, command, child_env)


if __name__ == '__main__':
    main()
