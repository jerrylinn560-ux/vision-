'use client'

import { useState, type FormEvent } from 'react'
import useSWR, { mutate as mutateCache } from 'swr'
import { Bell, CalendarClock, Check, CheckCheck, Circle, Clock3, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiFetcher, apiRequest } from '@/components/vision/api-client'
import type { ReminderRecord, TaskRecord } from '@/components/vision/types'

const statusOrder: TaskRecord['status'][] = ['planned', 'in_progress', 'completed']
const statusLabel: Record<TaskRecord['status'], string> = { planned: 'Planned', in_progress: 'In progress', completed: 'Completed' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function TasksView() {
  const { data: taskData, error: taskError, isLoading: tasksLoading, mutate: mutateTasks } = useSWR<TaskRecord[]>('/api/v1/tasks', apiFetcher)
  const { data: reminderData, error: reminderError, mutate: mutateReminders } = useSWR<ReminderRecord[]>('/api/v1/reminders', apiFetcher)
  const tasks = taskData ?? []
  const reminders = reminderData ?? []
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Personal')
  const [priority, setPriority] = useState<TaskRecord['priority']>('medium')
  const [dueAt, setDueAt] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderTaskId, setReminderTaskId] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [savingReminder, setSavingReminder] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setSavingTask(true)
    setErrorMessage('')
    try {
      const task = await apiRequest<TaskRecord>('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: category.trim() || 'Personal',
          priority,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      })
      if (remindAt) {
        try {
          await apiRequest('/api/v1/reminders', {
            method: 'POST',
            body: JSON.stringify({
              task_id: task.id,
              title: reminderTitle.trim() || task.title,
              remind_at: new Date(remindAt).toISOString(),
            }),
          })
        } catch {
          setErrorMessage('The task was saved, but its reminder could not be set. You can add it below.')
        }
      }
      setTitle('')
      setDescription('')
      setCategory('Personal')
      setPriority('medium')
      setDueAt('')
      setRemindAt('')
      setReminderTitle('')
      await Promise.all([mutateTasks(), mutateReminders(), mutateCache('/api/v1/dashboard')])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The task could not be saved.')
    } finally {
      setSavingTask(false)
    }
  }

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reminderTitle.trim() || !remindAt) return
    setSavingReminder(true)
    setErrorMessage('')
    try {
      await apiRequest('/api/v1/reminders', {
        method: 'POST',
        body: JSON.stringify({
          title: reminderTitle.trim(),
          remind_at: new Date(remindAt).toISOString(),
          task_id: reminderTaskId || null,
        }),
      })
      setReminderTitle('')
      setRemindAt('')
      setReminderTaskId('')
      await Promise.all([mutateReminders(), mutateCache('/api/v1/dashboard')])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The reminder could not be saved.')
    } finally {
      setSavingReminder(false)
    }
  }

  async function advanceTask(task: TaskRecord) {
    const next = task.status === 'completed' ? 'planned' : statusOrder[statusOrder.indexOf(task.status) + 1]
    try {
      await apiRequest(`/api/v1/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
      await Promise.all([mutateTasks(), mutateCache('/api/v1/dashboard')])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The task could not be updated.')
    }
  }

  async function removeTask(task: TaskRecord) {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return
    try {
      await apiRequest(`/api/v1/tasks/${task.id}`, { method: 'DELETE' })
      await Promise.all([mutateTasks(), mutateReminders(), mutateCache('/api/v1/dashboard')])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The task could not be deleted.')
    }
  }

  async function completeReminder(reminder: ReminderRecord) {
    try {
      await apiRequest(`/api/v1/reminders/${reminder.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) })
      await Promise.all([mutateReminders(), mutateCache('/api/v1/dashboard')])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The reminder could not be updated.')
    }
  }

  return (
    <div className="view-stack">
      {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
      <div className="tasks-layout">
        <div className="view-stack">
          <Card className="workspace-card">
            <CardHeader>
              <CardTitle>New task</CardTitle>
              <CardDescription>Keep the next step small and clear.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createTask}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="task-title">Task</FieldLabel>
                    <Input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to get done?" maxLength={180} required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="task-description">Details <span className="optional-label">Optional</span></FieldLabel>
                    <Textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a little context…" rows={3} maxLength={3000} />
                  </Field>
                  <div className="form-two-columns">
                    <Field>
                      <FieldLabel htmlFor="task-category">Category</FieldLabel>
                      <Input id="task-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
                      <select id="task-priority" className="native-select" value={priority} onChange={(event) => setPriority(event.target.value as TaskRecord['priority'])}>
                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                      </select>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="task-due">Due date <span className="optional-label">Optional</span></FieldLabel>
                    <Input id="task-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                  </Field>
                  <details className="reminder-details">
                    <summary><Bell aria-hidden="true" size={15} /> Add a reminder</summary>
                    <FieldGroup className="reminder-fields">
                      <Field>
                        <FieldLabel htmlFor="task-reminder-title">Reminder label</FieldLabel>
                        <Input id="task-reminder-title" value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="Same as task title" maxLength={180} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="task-reminder-time">Remind me at</FieldLabel>
                        <Input id="task-reminder-time" type="datetime-local" value={remindAt} onChange={(event) => setRemindAt(event.target.value)} />
                      </Field>
                    </FieldGroup>
                  </details>
                  <Button type="submit" disabled={savingTask || !title.trim()}>
                    <Plus aria-hidden="true" data-icon="inline-start" /> {savingTask ? 'Saving task…' : 'Add task'}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card className="workspace-card">
            <CardHeader className="dashboard-card-header">
              <div><CardTitle>Your tasks</CardTitle><CardDescription>{tasks.length} saved · {tasks.filter((task) => task.status !== 'completed').length} still open</CardDescription></div>
              <Badge variant="outline">{tasksLoading ? 'LOADING' : `${tasks.length} TOTAL`}</Badge>
            </CardHeader>
            <CardContent>
              {taskError ? <p className="inline-error" role="alert">{taskError.message}</p> : tasksLoading ? <div className="list-skeleton" aria-label="Loading tasks"><span /><span /><span /></div> : tasks.length ? (
                <ul className="task-list">
                  {tasks.map((task) => (
                    <li className="task-row" key={task.id}>
                      <Button variant="ghost" size="icon" className={`task-check ${task.status === 'completed' ? 'task-check-done' : ''}`} onClick={() => void advanceTask(task)} aria-label={task.status === 'completed' ? `Reopen ${task.title}` : `Advance ${task.title} status`}>
                        {task.status === 'completed' ? <CheckCheck aria-hidden="true" /> : task.status === 'in_progress' ? <Clock3 aria-hidden="true" /> : <Circle aria-hidden="true" />}
                      </Button>
                      <div className="task-row-copy">
                        <strong className={task.status === 'completed' ? 'task-title completed' : 'task-title'}>{task.title}</strong>
                        {task.description && <p>{task.description}</p>}
                        <span>{task.category}{task.due_at ? ` · Due ${formatDate(task.due_at)}` : ''}</span>
                      </div>
                      <div className="task-row-meta">
                        <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>{task.priority}</Badge>
                        <Badge variant="outline">{statusLabel[task.status]}</Badge>
                        <Button variant="ghost" size="icon" aria-label={`Delete ${task.title}`} onClick={() => void removeTask(task)}><Trash2 aria-hidden="true" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <div className="empty-state"><span className="empty-state-icon"><CheckCheck aria-hidden="true" size={17} /></span><p className="empty-state-title">Your task list is clear.</p><p className="muted-copy">Add a task above when you are ready for the next step.</p></div>}
            </CardContent>
          </Card>
        </div>

        <div className="view-stack">
          <Card className="workspace-card">
            <CardHeader><CardTitle>Set a reminder</CardTitle><CardDescription>Choose what to remember and when.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={createReminder}>
                <FieldGroup>
                  <Field><FieldLabel htmlFor="reminder-title">Reminder</FieldLabel><Input id="reminder-title" value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="What should VISION remind you?" maxLength={180} required /></Field>
                  <Field><FieldLabel htmlFor="reminder-time">Date and time</FieldLabel><Input id="reminder-time" type="datetime-local" value={remindAt} onChange={(event) => setRemindAt(event.target.value)} required /></Field>
                  <Field>
                    <FieldLabel htmlFor="reminder-task">Link to a task <span className="optional-label">Optional</span></FieldLabel>
                    <select id="reminder-task" className="native-select" value={reminderTaskId} onChange={(event) => setReminderTaskId(event.target.value)}>
                      <option value="">No linked task</option>
                      {tasks.filter((task) => task.status !== 'completed').map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}
                    </select>
                  </Field>
                  <Button type="submit" variant="outline" disabled={savingReminder || !reminderTitle.trim() || !remindAt}>
                    <Bell aria-hidden="true" data-icon="inline-start" /> {savingReminder ? 'Saving reminder…' : 'Create reminder'}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card className="workspace-card">
            <CardHeader><CardTitle>Upcoming reminders</CardTitle><CardDescription>Scheduled for this account.</CardDescription></CardHeader>
            <CardContent>
              {reminderError ? <p className="inline-error" role="alert">{reminderError.message}</p> : reminders.filter((item) => item.status === 'pending').length ? (
                <ul className="reminder-list">
                  {reminders.filter((item) => item.status === 'pending').map((reminder) => (
                    <li className="reminder-row" key={reminder.id}>
                      <span className="reminder-icon"><CalendarClock aria-hidden="true" size={15} /></span>
                      <span className="reminder-copy"><strong>{reminder.title}</strong><small>{formatDate(reminder.remind_at)}</small></span>
                      <Button variant="ghost" size="icon" aria-label={`Mark ${reminder.title} complete`} onClick={() => void completeReminder(reminder)}><Check aria-hidden="true" /></Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted-copy">No pending reminders. Add one above and it will be stored with your account.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
