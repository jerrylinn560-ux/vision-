import asyncio
import os
from datetime import datetime, timezone
from typing import Annotated, Any, Literal
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_API_KEY = os.environ.get('SUPABASE_PUBLISHABLE_KEY') or os.environ.get('SUPABASE_ANON_KEY', '')

app = FastAPI(title='VISION API', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000', 'http://127.0.0.1:3000'],
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allow_headers=['Authorization', 'Content-Type'],
)


class AuthContext(BaseModel):
    access_token: str
    user_id: str


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(default='', max_length=3000)
    category: str = Field(default='Personal', min_length=1, max_length=60)
    priority: Literal['low', 'medium', 'high'] = 'medium'
    due_at: datetime | None = None

    @field_validator('title', 'category')
    @classmethod
    def reject_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('This field cannot be blank.')
        return value.strip()


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=3000)
    category: str | None = Field(default=None, min_length=1, max_length=60)
    priority: Literal['low', 'medium', 'high'] | None = None
    status: Literal['planned', 'in_progress', 'completed'] | None = None
    due_at: datetime | None = None


class ReminderCreate(BaseModel):
    task_id: UUID | None = None
    title: str = Field(min_length=1, max_length=180)
    remind_at: datetime


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    remind_at: datetime | None = None
    status: Literal['pending', 'completed', 'cancelled'] | None = None


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    content: str = Field(default='', max_length=12000)
    category: str = Field(default='General', min_length=1, max_length=60)
    pinned: bool = False


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    content: str | None = Field(default=None, max_length=12000)
    category: str | None = Field(default=None, min_length=1, max_length=60)
    pinned: bool | None = None


class MemoryCreate(BaseModel):
    category: Literal['preference', 'language', 'instruction', 'summary'] = 'preference'
    content: str = Field(min_length=1, max_length=2000)


class MemoryUpdate(BaseModel):
    category: Literal['preference', 'language', 'instruction', 'summary'] | None = None
    content: str | None = Field(default=None, min_length=1, max_length=2000)


class SettingsUpdate(BaseModel):
    preferred_language: Literal['en', 'ur', 'roman-ur'] | None = None
    voice_name: Literal['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer'] | None = None
    speech_rate: float | None = Field(default=None, ge=0.75, le=1.25)
    memory_enabled: bool | None = None
    confirm_sensitive_actions: bool | None = None


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)


async def require_user(authorization: Annotated[str | None, Header()] = None) -> AuthContext:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sign in to continue.')
    if not SUPABASE_URL or not SUPABASE_API_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='The data service is not configured.')

    access_token = authorization.removeprefix('Bearer ').strip()
    if not access_token or len(access_token) > 8192:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sign in to continue.')

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            result = await client.get(
                f'{SUPABASE_URL}/auth/v1/user',
                headers={
                    'apikey': SUPABASE_API_KEY,
                    'Authorization': f'Bearer {access_token}',
                },
            )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='The authentication service is unavailable.') from error

    if result.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Your session has expired. Sign in again.')

    user = result.json()
    user_id = user.get('id') if isinstance(user, dict) else None
    if not isinstance(user_id, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sign in to continue.')

    return AuthContext(access_token=access_token, user_id=user_id)


async def supabase_request(
    auth: AuthContext,
    method: str,
    table: str,
    *,
    params: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
    prefer: str = 'return=representation',
) -> Any:
    if not SUPABASE_URL or not SUPABASE_API_KEY:
        raise HTTPException(status_code=503, detail='The data service is not configured.')

    headers = {
        'apikey': SUPABASE_API_KEY,
        'Authorization': f'Bearer {auth.access_token}',
        'Accept': 'application/json',
        'Prefer': prefer,
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            result = await client.request(
                method,
                f'{SUPABASE_URL}/rest/v1/{table}',
                params=params,
                json=body,
                headers=headers,
            )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=503, detail='The data service is unavailable.') from error

    if not result.is_success:
        if result.status_code in (401, 403):
            raise HTTPException(status_code=403, detail='You do not have access to this item.')
        if result.status_code == 409:
            raise HTTPException(status_code=409, detail='This change conflicts with a newer update.')
        if result.status_code == 404:
            raise HTTPException(status_code=404, detail='The requested item was not found.')
        raise HTTPException(status_code=400, detail='The requested data change could not be completed.')

    if not result.content:
        return None
    try:
        return result.json()
    except ValueError:
        return None


def first_row(rows: Any) -> dict[str, Any]:
    if isinstance(rows, list) and rows and isinstance(rows[0], dict):
        return rows[0]
    if isinstance(rows, dict):
        return rows
    raise HTTPException(status_code=404, detail='The requested item was not found.')


async def log_activity(auth: AuthContext, action: str, details: dict[str, Any] | None = None) -> None:
    try:
        await supabase_request(
            auth,
            'POST',
            'activity_logs',
            body={'user_id': auth.user_id, 'action': action, 'details': details or {}},
            prefer='return=minimal',
        )
    except HTTPException:
        return


@app.get('/api/v1/health')
async def health() -> dict[str, str]:
    return {'status': 'ok', 'service': 'vision-api'}


@app.get('/api/v1/dashboard')
async def dashboard(auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    base = {'user_id': f'eq.{auth.user_id}'}
    tasks_request = supabase_request(
        auth, 'GET', 'tasks',
        params={**base, 'select': 'id,title,status,priority,category,due_at,created_at,updated_at', 'order': 'due_at.asc.nullslast', 'limit': '100'},
    )
    reminders_request = supabase_request(
        auth, 'GET', 'reminders',
        params={**base, 'select': 'id,title,remind_at,status,task_id', 'status': 'eq.pending', 'order': 'remind_at.asc', 'limit': '100'},
    )
    notes_request = supabase_request(
        auth, 'GET', 'notes',
        params={**base, 'select': 'id,title,category,pinned,updated_at', 'order': 'updated_at.desc', 'limit': '5'},
    )
    memories_request = supabase_request(
        auth, 'GET', 'user_memories',
        params={**base, 'select': 'id', 'limit': '100'},
    )
    activity_request = supabase_request(
        auth, 'GET', 'activity_logs',
        params={**base, 'select': 'id,action,details,created_at', 'order': 'created_at.desc', 'limit': '6'},
    )
    tasks, reminders, notes, memories, activity = await asyncio.gather(
        tasks_request, reminders_request, notes_request, memories_request, activity_request,
    )
    task_rows = tasks if isinstance(tasks, list) else []
    open_tasks = [task for task in task_rows if task.get('status') != 'completed']
    return {
        'tasks': open_tasks[:5],
        'task_count': len(task_rows),
        'open_task_count': len(open_tasks),
        'reminders': reminders if isinstance(reminders, list) else [],
        'reminder_count': len(reminders) if isinstance(reminders, list) else 0,
        'notes': notes if isinstance(notes, list) else [],
        'memory_count': len(memories) if isinstance(memories, list) else 0,
        'activity': activity if isinstance(activity, list) else [],
    }


@app.get('/api/v1/tasks')
async def list_tasks(auth: AuthContext = Depends(require_user)) -> list[dict[str, Any]]:
    rows = await supabase_request(
        auth, 'GET', 'tasks',
        params={'user_id': f'eq.{auth.user_id}', 'select': 'id,title,description,category,priority,status,due_at,created_at,updated_at', 'order': 'created_at.desc', 'limit': '100'},
    )
    return rows if isinstance(rows, list) else []


@app.post('/api/v1/tasks', status_code=201)
async def create_task(body: TaskCreate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    payload = body.model_dump(mode='json')
    payload.update({'user_id': auth.user_id, 'title': body.title.strip(), 'category': body.category.strip()})
    row = first_row(await supabase_request(auth, 'POST', 'tasks', body=payload))
    await log_activity(auth, 'task.created', {'task_id': row.get('id')})
    return row


@app.patch('/api/v1/tasks/{task_id}')
async def update_task(task_id: UUID, body: TaskUpdate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    changes = body.model_dump(exclude_unset=True, mode='json')
    if not changes:
        raise HTTPException(status_code=400, detail='Choose a field to update.')
    if 'title' in changes and isinstance(changes['title'], str):
        changes['title'] = changes['title'].strip()
    if 'category' in changes and isinstance(changes['category'], str):
        changes['category'] = changes['category'].strip()
    rows = await supabase_request(auth, 'PATCH', 'tasks', params={'id': f'eq.{task_id}', 'user_id': f'eq.{auth.user_id}'}, body=changes)
    row = first_row(rows)
    await log_activity(auth, 'task.updated', {'task_id': str(task_id)})
    return row


@app.delete('/api/v1/tasks/{task_id}', status_code=204)
async def delete_task(task_id: UUID, auth: AuthContext = Depends(require_user)) -> Response:
    rows = await supabase_request(
        auth, 'DELETE', 'tasks',
        params={'id': f'eq.{task_id}', 'user_id': f'eq.{auth.user_id}'},
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='The requested item was not found.')
    await log_activity(auth, 'task.deleted', {'task_id': str(task_id)})
    return Response(status_code=204)


@app.get('/api/v1/reminders')
async def list_reminders(auth: AuthContext = Depends(require_user)) -> list[dict[str, Any]]:
    rows = await supabase_request(
        auth, 'GET', 'reminders',
        params={'user_id': f'eq.{auth.user_id}', 'select': 'id,title,task_id,remind_at,status,created_at', 'order': 'remind_at.asc', 'limit': '100'},
    )
    return rows if isinstance(rows, list) else []


@app.post('/api/v1/reminders', status_code=201)
async def create_reminder(body: ReminderCreate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    payload = body.model_dump(mode='json')
    payload['user_id'] = auth.user_id
    row = first_row(await supabase_request(auth, 'POST', 'reminders', body=payload))
    await log_activity(auth, 'reminder.created', {'reminder_id': row.get('id')})
    return row


@app.patch('/api/v1/reminders/{reminder_id}')
async def update_reminder(reminder_id: UUID, body: ReminderUpdate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    changes = body.model_dump(exclude_unset=True, mode='json')
    if not changes:
        raise HTTPException(status_code=400, detail='Choose a field to update.')
    rows = await supabase_request(auth, 'PATCH', 'reminders', params={'id': f'eq.{reminder_id}', 'user_id': f'eq.{auth.user_id}'}, body=changes)
    row = first_row(rows)
    await log_activity(auth, 'reminder.updated', {'reminder_id': str(reminder_id)})
    return row


@app.delete('/api/v1/reminders/{reminder_id}', status_code=204)
async def delete_reminder(reminder_id: UUID, auth: AuthContext = Depends(require_user)) -> Response:
    rows = await supabase_request(auth, 'DELETE', 'reminders', params={'id': f'eq.{reminder_id}', 'user_id': f'eq.{auth.user_id}'})
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='The requested item was not found.')
    await log_activity(auth, 'reminder.deleted', {'reminder_id': str(reminder_id)})
    return Response(status_code=204)


@app.get('/api/v1/notes')
async def list_notes(auth: AuthContext = Depends(require_user)) -> list[dict[str, Any]]:
    rows = await supabase_request(
        auth, 'GET', 'notes',
        params={'user_id': f'eq.{auth.user_id}', 'select': 'id,title,content,category,pinned,created_at,updated_at', 'order': 'pinned.desc,updated_at.desc', 'limit': '100'},
    )
    return rows if isinstance(rows, list) else []


@app.post('/api/v1/notes', status_code=201)
async def create_note(body: NoteCreate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    payload = body.model_dump()
    payload.update({'user_id': auth.user_id, 'title': body.title.strip(), 'category': body.category.strip()})
    row = first_row(await supabase_request(auth, 'POST', 'notes', body=payload))
    await log_activity(auth, 'note.created', {'note_id': row.get('id')})
    return row


@app.patch('/api/v1/notes/{note_id}')
async def update_note(note_id: UUID, body: NoteUpdate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail='Choose a field to update.')
    if isinstance(changes.get('title'), str):
        changes['title'] = changes['title'].strip()
    if isinstance(changes.get('category'), str):
        changes['category'] = changes['category'].strip()
    row = first_row(await supabase_request(auth, 'PATCH', 'notes', params={'id': f'eq.{note_id}', 'user_id': f'eq.{auth.user_id}'}, body=changes))
    await log_activity(auth, 'note.updated', {'note_id': str(note_id)})
    return row


@app.delete('/api/v1/notes/{note_id}', status_code=204)
async def delete_note(note_id: UUID, auth: AuthContext = Depends(require_user)) -> Response:
    rows = await supabase_request(auth, 'DELETE', 'notes', params={'id': f'eq.{note_id}', 'user_id': f'eq.{auth.user_id}'})
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='The requested item was not found.')
    await log_activity(auth, 'note.deleted', {'note_id': str(note_id)})
    return Response(status_code=204)


@app.get('/api/v1/memories')
async def list_memories(auth: AuthContext = Depends(require_user)) -> list[dict[str, Any]]:
    rows = await supabase_request(
        auth, 'GET', 'user_memories',
        params={'user_id': f'eq.{auth.user_id}', 'select': 'id,category,content,source,created_at,updated_at', 'order': 'created_at.desc', 'limit': '100'},
    )
    return rows if isinstance(rows, list) else []


@app.post('/api/v1/memories', status_code=201)
async def create_memory(body: MemoryCreate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    payload = body.model_dump()
    payload.update({'user_id': auth.user_id, 'content': body.content.strip(), 'source': 'user'})
    row = first_row(await supabase_request(auth, 'POST', 'user_memories', body=payload))
    await log_activity(auth, 'memory.created', {'memory_id': row.get('id')})
    return row


@app.patch('/api/v1/memories/{memory_id}')
async def update_memory(memory_id: UUID, body: MemoryUpdate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail='Choose a field to update.')
    if isinstance(changes.get('content'), str):
        changes['content'] = changes['content'].strip()
    row = first_row(await supabase_request(auth, 'PATCH', 'user_memories', params={'id': f'eq.{memory_id}', 'user_id': f'eq.{auth.user_id}'}, body=changes))
    await log_activity(auth, 'memory.updated', {'memory_id': str(memory_id)})
    return row


@app.delete('/api/v1/memories/{memory_id}', status_code=204)
async def delete_memory(memory_id: UUID, auth: AuthContext = Depends(require_user)) -> Response:
    rows = await supabase_request(auth, 'DELETE', 'user_memories', params={'id': f'eq.{memory_id}', 'user_id': f'eq.{auth.user_id}'})
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='The requested item was not found.')
    await log_activity(auth, 'memory.deleted', {'memory_id': str(memory_id)})
    return Response(status_code=204)


@app.get('/api/v1/settings')
async def get_settings(auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    rows = await supabase_request(
        auth, 'GET', 'user_settings',
        params={'user_id': f'eq.{auth.user_id}', 'select': 'preferred_language,voice_name,speech_rate,memory_enabled,confirm_sensitive_actions'},
    )
    if isinstance(rows, list) and rows:
        return rows[0]
    return {
        'preferred_language': 'en',
        'voice_name': 'alloy',
        'speech_rate': 1.0,
        'memory_enabled': True,
        'confirm_sensitive_actions': True,
    }


@app.put('/api/v1/settings')
async def update_settings(body: SettingsUpdate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    payload = body.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=400, detail='Choose a setting to update.')
    rows = await supabase_request(
        auth, 'POST', 'user_settings',
        params={'on_conflict': 'user_id'},
        body={'user_id': auth.user_id, **payload},
        prefer='resolution=merge-duplicates,return=representation',
    )
    await log_activity(auth, 'settings.updated', {'fields': sorted(payload.keys())})
    return first_row(rows)


@app.put('/api/v1/profile')
async def update_profile(body: ProfileUpdate, auth: AuthContext = Depends(require_user)) -> dict[str, Any]:
    rows = await supabase_request(
        auth, 'POST', 'profiles',
        params={'on_conflict': 'id'},
        body={'id': auth.user_id, 'display_name': body.display_name.strip()},
        prefer='resolution=merge-duplicates,return=representation',
    )
    await log_activity(auth, 'profile.updated')
    return first_row(rows)


@app.get('/api/v1/devices')
async def list_devices(auth: AuthContext = Depends(require_user)) -> list[dict[str, Any]]:
    rows = await supabase_request(
        auth, 'GET', 'connected_devices',
        params={'user_id': f'eq.{auth.user_id}', 'select': 'id,name,platform,status,last_seen_at,created_at', 'order': 'last_seen_at.desc', 'limit': '50'},
    )
    return rows if isinstance(rows, list) else []


@app.delete('/api/v1/devices/{device_id}', status_code=204)
async def remove_device(device_id: UUID, auth: AuthContext = Depends(require_user)) -> Response:
    rows = await supabase_request(auth, 'DELETE', 'connected_devices', params={'id': f'eq.{device_id}', 'user_id': f'eq.{auth.user_id}'})
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='The requested device was not found.')
    await log_activity(auth, 'device.removed', {'device_id': str(device_id)})
    return Response(status_code=204)


@app.get('/api/v1/activity')
async def list_activity(auth: AuthContext = Depends(require_user)) -> list[dict[str, Any]]:
    rows = await supabase_request(
        auth, 'GET', 'activity_logs',
        params={'user_id': f'eq.{auth.user_id}', 'select': 'id,action,details,created_at', 'order': 'created_at.desc', 'limit': '100'},
    )
    return rows if isinstance(rows, list) else []


@app.get('/api/v1/conversations')
async def list_conversations(auth: AuthContext = Depends(require_user)) -> list[dict[str, Any]]:
    rows = await supabase_request(
        auth, 'GET', 'conversations',
        params={'user_id': f'eq.{auth.user_id}', 'select': 'id,title,channel,created_at,updated_at', 'order': 'updated_at.desc', 'limit': '100'},
    )
    return rows if isinstance(rows, list) else []


@app.get('/api/v1/conversations/{conversation_id}/messages')
async def list_messages(conversation_id: UUID, auth: AuthContext = Depends(require_user)) -> list[dict[str, Any]]:
    rows = await supabase_request(
        auth, 'GET', 'messages',
        params={'conversation_id': f'eq.{conversation_id}', 'user_id': f'eq.{auth.user_id}', 'select': 'id,conversation_id,role,content,created_at', 'order': 'created_at.asc', 'limit': '100'},
    )
    return rows if isinstance(rows, list) else []


@app.delete('/api/v1/conversations/{conversation_id}', status_code=204)
async def delete_conversation(conversation_id: UUID, auth: AuthContext = Depends(require_user)) -> Response:
    rows = await supabase_request(auth, 'DELETE', 'conversations', params={'id': f'eq.{conversation_id}', 'user_id': f'eq.{auth.user_id}'})
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail='The requested conversation was not found.')
    await log_activity(auth, 'conversation.deleted', {'conversation_id': str(conversation_id)})
    return Response(status_code=204)
