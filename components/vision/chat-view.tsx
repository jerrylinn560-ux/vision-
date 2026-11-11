'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR, { mutate as mutateCache } from 'swr'
import {
  ArrowRight,
  AudioLines,
  Check,
  Clock3,
  Mic,
  MicOff,
  Plus,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Message, MessageAvatar, MessageContent, MessageGroup, MessageHeader } from '@/components/ui/message'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { apiFetcher, apiRequest } from '@/components/vision/api-client'
import type { ConversationRecord, MessageRecord, UserSettings } from '@/components/vision/types'

type VoiceStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error'
type ChatResponse = { conversationId: string; reply: string }

const starterPrompts = [
  'Help me plan a calmer, more focused day.',
  'What is one small next step for a project I have been avoiding?',
  'Remember that I prefer concise answers.',
]

function statusCopy(status: VoiceStatus) {
  const copy: Record<VoiceStatus, string> = {
    idle: 'Ready when you are',
    listening: 'Listening · tap to finish',
    transcribing: 'Understanding your voice',
    thinking: 'Thinking through your request',
    speaking: 'Speaking · tap stop to pause',
    error: 'Something interrupted the connection',
  }
  return copy[status]
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function ChatView({ initialConversationId, voiceMode = false }: { initialConversationId?: string; voiceMode?: boolean }) {
  const router = useRouter()
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const [draft, setDraft] = useState('')
  const [pendingUserMessage, setPendingUserMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  const { data: conversations } = useSWR<ConversationRecord[]>('/api/v1/conversations', apiFetcher)
  const messageKey = conversationId ? `/api/v1/conversations/${conversationId}/messages` : null
  const { data: messages, mutate: mutateMessages } = useSWR<MessageRecord[]>(messageKey, apiFetcher, { revalidateOnFocus: false })
  const { data: settings } = useSWR<UserSettings>('/api/v1/settings', apiFetcher)

  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  async function speak(text: string) {
    setErrorMessage('')
    setStatus('speaking')
    try {
      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ text, voice: settings?.voice_name ?? 'alloy', speed: settings?.speech_rate ?? 1 }),
      })
      if (!response.ok) throw new Error('Speech generation is unavailable. Try again in a moment.')
      const audioBlob = await response.blob()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      const audioUrl = URL.createObjectURL(audioBlob)
      audioUrlRef.current = audioUrl
      if (!audioRef.current) throw new Error('Audio playback is not available in this browser.')
      audioRef.current.src = audioUrl
      await audioRef.current.play()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Speech could not be played.')
    }
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setStatus('idle')
  }

  async function submitMessage(content: string, source: 'text' | 'voice' = 'text') {
    const message = content.trim()
    if (!message || isSending) return

    setIsSending(true)
    setPendingUserMessage(message)
    setErrorMessage('')
    setStatus('thinking')

    try {
      const result = await apiRequest<ChatResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message, conversationId, channel: voiceMode || source === 'voice' ? 'voice' : 'text' }),
      })
      setConversationId(result.conversationId)
      setDraft('')
      setPendingUserMessage('')
      router.replace(`${voiceMode ? '/voice' : '/chat'}?conversation=${result.conversationId}`, { scroll: false })
      await mutateCache('/api/v1/conversations')
      if (conversationId === result.conversationId) await mutateMessages()
      if (voiceMode || source === 'voice') {
        await speak(result.reply)
      } else {
        setStatus('idle')
      }
    } catch (error) {
      setStatus('error')
      setPendingUserMessage('')
      setDraft(message)
      setErrorMessage(error instanceof Error ? error.message : 'The assistant could not respond. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  async function transcribeAndSend(blob: Blob) {
    setStatus('transcribing')
    setErrorMessage('')
    try {
      const formData = new FormData()
      formData.append('audio', blob, blob.type.includes('mp4') ? 'voice.m4a' : 'voice.webm')
      const response = await fetch('/api/voice/transcribe', { method: 'POST', body: formData, credentials: 'same-origin' })
      const result = await response.json().catch(() => null)
      if (!response.ok || typeof result?.text !== 'string' || !result.text.trim()) {
        throw new Error(typeof result?.error === 'string' ? result.error : 'No speech was detected. Try again in a quieter space.')
      }
      setDraft(result.text)
      await submitMessage(result.text, 'voice')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Voice transcription failed.')
    }
  }

  async function toggleRecording() {
    if (recorderRef.current?.state === 'recording') {
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
      setStatus('transcribing')
      recorderRef.current.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('error')
      setErrorMessage('This browser does not support voice recording. You can still type a message.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      streamRef.current = stream
      chunksRef.current = []
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size > 0) void transcribeAndSend(blob)
        else {
          setStatus('error')
          setErrorMessage('No audio was captured. Check microphone access and try again.')
        }
      }
      recorder.start()
      setStatus('listening')
      setErrorMessage('')
      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, 30_000)
    } catch {
      setStatus('error')
      setErrorMessage('Microphone access was denied or unavailable. You can still type a message.')
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return
      event.preventDefault()
      void submitMessage(draft)
    }
  }

  async function deleteCurrentConversation() {
    if (!conversationId || !window.confirm('Delete this conversation and its messages? This cannot be undone.')) return
    try {
      await apiRequest(`/api/v1/conversations/${conversationId}`, { method: 'DELETE' })
      setConversationId(undefined)
      setDraft('')
      setErrorMessage('')
      router.replace(voiceMode ? '/voice' : '/chat', { scroll: false })
      await mutateCache('/api/v1/conversations')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The conversation could not be deleted.')
    }
  }

  const isBusy = isSending || status === 'transcribing' || status === 'speaking'
  const currentMessages = messages ?? []

  return (
    <div className={`chat-workspace ${voiceMode ? 'voice-workspace' : ''}`}>
      <section className="chat-main glass-panel" aria-label={voiceMode ? 'Voice conversation' : 'AI conversation'}>
        <div className="chat-toolbar">
          <div className="chat-mode-title">
            <span className="chat-mode-icon">{voiceMode ? <AudioLines aria-hidden="true" size={17} /> : <Sparkles aria-hidden="true" size={17} />}</span>
            <div>
              <strong>{voiceMode ? 'Voice conversation' : 'Private conversation'}</strong>
              <span>Google Gemini (Free API)</span>
            </div>
          </div>
          <div className="chat-toolbar-actions">
            <Badge variant="outline">{voiceMode ? 'PUSH TO TALK' : 'TEXT MODE'}</Badge>
            {conversationId && <Button variant="ghost" size="sm" onClick={() => void deleteCurrentConversation()}>Delete</Button>}
            <Button variant="outline" size="sm" render={<Link href={voiceMode ? '/chat' : '/voice'} />}>
              {voiceMode ? 'Text mode' : 'Voice mode'} <ArrowRight aria-hidden="true" data-icon="inline-end" />
            </Button>
          </div>
        </div>

        {voiceMode && (
          <section className="voice-console" aria-label="Voice controls">
            <div className="voice-orb-wrap">
              <div className="vision-orb voice-orb" data-state={status} aria-hidden="true"><span>V</span></div>
              <span className="voice-status" aria-live="polite">{statusCopy(status)}</span>
            </div>
            <div className="voice-controls">
              <Button size="lg" className="record-button" onClick={() => void toggleRecording()} disabled={isSending || status === 'transcribing'} aria-pressed={status === 'listening'} aria-label={status === 'listening' ? 'Stop recording' : 'Start voice recording'}>
                {status === 'listening' ? <MicOff aria-hidden="true" data-icon="inline-start" /> : <Mic aria-hidden="true" data-icon="inline-start" />}
                {status === 'listening' ? 'Finish recording' : 'Start talking'}
              </Button>
              {status === 'speaking' && <Button variant="outline" size="lg" onClick={stopSpeaking}><VolumeX aria-hidden="true" data-icon="inline-start" /> Stop speaking</Button>}
            </div>
            <p className="voice-caption">Your audio is sent securely to the server for transcription. Recordings are not saved as files.</p>
          </section>
        )}

        <div className="chat-transcript" aria-label="Conversation transcript">
          {!conversationId && !pendingUserMessage ? (
            <div className="chat-empty">
              {!voiceMode && <div className="chat-empty-orb vision-orb" data-state="idle" aria-hidden="true"><span>V</span></div>}
              <p className="eyebrow"><Sparkles aria-hidden="true" size={13} /> A THOUGHTFUL PLACE TO START</p>
              <h2>{voiceMode ? 'What is on your mind?' : 'What would you like to work through?'}</h2>
              <p>Ask for help, make a plan, or say something you want to remember. VISION replies in English, Urdu, or Roman Urdu.</p>
              <div className="starter-prompts">
                {starterPrompts.map((prompt) => (
                  <button key={prompt} type="button" className="starter-prompt" onClick={() => setDraft(prompt)}>
                    <span>{prompt}</span><ArrowRight aria-hidden="true" size={14} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ScrollArea className="message-scroll">
              <MessageGroup role="log" aria-live="polite" aria-relevant="additions text" className="message-log">
                {currentMessages.map((message) => (
                  <Message key={message.id} align={message.role === 'user' ? 'end' : 'start'} className="conversation-message">
                    <MessageAvatar className={message.role === 'user' ? 'message-avatar user-message-avatar' : 'message-avatar'}>
                      {message.role === 'user' ? <span>YOU</span> : <span>V</span>}
                    </MessageAvatar>
                    <MessageContent>
                      <MessageHeader className="message-header">
                        <span>{message.role === 'user' ? 'You' : 'VISION'}</span>
                        <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                      </MessageHeader>
                      <Bubble align={message.role === 'user' ? 'end' : 'start'} variant={message.role === 'user' ? 'default' : 'secondary'} className="message-bubble">
                        <BubbleContent className="message-bubble-content"><p>{message.content}</p></BubbleContent>
                      </Bubble>
                      {message.role === 'assistant' && (
                        <div className="message-actions">
                          <Button variant="ghost" size="sm" onClick={() => void speak(message.content)} aria-label="Read this response aloud">
                            <Volume2 aria-hidden="true" data-icon="inline-start" /> Listen
                          </Button>
                        </div>
                      )}
                    </MessageContent>
                  </Message>
                ))}
                {pendingUserMessage && (
                  <>
                    <Message align="end" className="conversation-message">
                      <MessageAvatar className="message-avatar user-message-avatar"><span>YOU</span></MessageAvatar>
                      <MessageContent>
                        <MessageHeader className="message-header"><span>You</span><span>Sending</span></MessageHeader>
                        <Bubble align="end" variant="default" className="message-bubble"><BubbleContent className="message-bubble-content"><p>{pendingUserMessage}</p></BubbleContent></Bubble>
                      </MessageContent>
                    </Message>
                    <Marker className="thinking-marker"><MarkerIcon><Sparkles /></MarkerIcon><MarkerContent>VISION is thinking through it</MarkerContent></Marker>
                  </>
                )}
              </MessageGroup>
            </ScrollArea>
          )}
        </div>

        {errorMessage && <p className="chat-error" role="alert">{errorMessage}</p>}

        <form className="chat-composer" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submitMessage(draft) }}>
          <label className="sr-only" htmlFor="chat-draft">Message VISION</label>
          <Textarea
            id="chat-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message VISION…"
            rows={2}
            maxLength={5000}
            disabled={isSending}
            className="chat-textarea"
          />
          <div className="composer-footer">
            <span className="composer-hint"><kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line</span>
            <div className="composer-actions">
              <span className="composer-count">{draft.length}/5000</span>
              <Button type="submit" disabled={!draft.trim() || isSending} aria-label="Send message">
                <Send aria-hidden="true" data-icon="inline-start" /> Send
              </Button>
            </div>
          </div>
        </form>
        <audio ref={audioRef} className="sr-only" aria-label="VISION spoken response" onEnded={() => setStatus('idle')} onPause={() => { if (status === 'speaking') setStatus('idle') }} />
      </section>

      <aside className="chat-side-panel" aria-label="Conversation details">
        <Card className="chat-side-card">
          <CardHeader className="chat-side-header">
            <div><CardTitle>Recent conversations</CardTitle><CardDescription>Pick up where you left off.</CardDescription></div>
            <Button variant="ghost" size="icon" aria-label="Start a new conversation" onClick={() => { setConversationId(undefined); setDraft(''); router.replace(voiceMode ? '/voice' : '/chat', { scroll: false }) }}><Plus aria-hidden="true" /></Button>
          </CardHeader>
          <CardContent className="conversation-list">
            {conversations?.length ? conversations.slice(0, 8).map((conversation) => (
              <Link key={conversation.id} className={`conversation-link ${conversation.id === conversationId ? 'conversation-link-active' : ''}`} href={`${voiceMode ? '/voice' : '/chat'}?conversation=${conversation.id}`}>
                <span className="conversation-link-icon">{conversation.channel === 'voice' ? <AudioLines aria-hidden="true" size={15} /> : <Clock3 aria-hidden="true" size={15} />}</span>
                <span><strong>{conversation.title}</strong><small>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(conversation.updated_at))}</small></span>
              </Link>
            )) : <p className="muted-copy conversation-empty-copy">Your saved conversations will appear here.</p>}
          </CardContent>
        </Card>

        <Card className="chat-side-card privacy-card">
          <CardContent>
            <div className="privacy-card-icon"><Check aria-hidden="true" size={16} /></div>
            <h3>Your conversations stay yours.</h3>
            <p>Messages are stored in your private workspace. Row-level security restricts them to your signed-in account.</p>
            <Link href="/security">Read privacy controls <ArrowRight aria-hidden="true" size={13} /></Link>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
