'use client'

import { useEffect, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { Check, LoaderCircle, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { apiFetcher, apiRequest } from '@/components/vision/api-client'
import { AI_PROVIDER_IDS, AI_PROVIDER_LABELS, type AIProviderConfig, type AIProviderConfigsResponse, type AIProviderId } from '@/lib/ai/types'
import styles from './api-settings-view.module.css'

export function ApiSettingsView() {
  const { data, error, isLoading, mutate } = useSWR<AIProviderConfigsResponse>('/api/ai-config', apiFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  const providers = data?.providers ?? []
  const [provider, setProvider] = useState<AIProviderId>('google')
  const [model, setModel] = useState('gemini-2.0-flash')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [working, setWorking] = useState<'save' | 'models' | 'test' | 'key' | 'provider' | null>(null)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const savedConfig = providers.find((item) => item.provider === provider)
  const activeConfig = providers.find((item) => item.enabled && item.isDefault)

  useEffect(() => {
    if (!data) return
    const saved = data.providers.find((item) => item.provider === provider)
    setModel(saved?.model ?? 'gemini-2.0-flash')
    setBaseUrl(saved?.baseUrl ?? '')
    setEnabled(saved?.enabled ?? true)
    setIsDefault(saved?.isDefault ?? !data.providers.some((item) => item.enabled && item.isDefault))
    setApiKey('')
    setModels([])
    setMessage('')
    setErrorMessage('')
  }, [data, provider])

  function buildPayload() {
    return {
      provider,
      model: model.trim(),
      baseUrl: null,
      apiKey: apiKey.trim() || undefined,
      enabled,
      isDefault,
    }
  }

  async function loadModels() {
    setWorking('models')
    setMessage('')
    setErrorMessage('')
    try {
      const result = await apiRequest<{ models: string[] }>('/api/ai-config/models', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim() || undefined,
          baseUrl: null,
        }),
      })
      setModels(result.models)
      if (!model && result.models.length) setModel(result.models[0])
      setMessage(result.models.length ? `Loaded ${result.models.length} available models.` : 'No models were listed. You can enter a model ID manually.')
    } catch (requestError) {
      setErrorMessage(requestError instanceof Error ? requestError.message : 'Models could not be loaded.')
    } finally {
      setWorking(null)
    }
  }

  async function testConnection() {
    setWorking('test')
    setMessage('')
    setErrorMessage('')
    try {
      await apiRequest('/api/ai-config/test', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          model: model.trim(),
          apiKey: apiKey.trim() || undefined,
          baseUrl: null,
        }),
      })
      setMessage(`Connection verified for ${AI_PROVIDER_LABELS[provider]} · ${model.trim()}.`)
    } catch (requestError) {
      setErrorMessage(requestError instanceof Error ? requestError.message : 'Connection test failed.')
    } finally {
      setWorking(null)
    }
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking('save')
    setMessage('')
    setErrorMessage('')
    try {
      await apiRequest('/api/ai-config', { method: 'PUT', body: JSON.stringify(buildPayload()) })
      setApiKey('')
      await mutate()
      setMessage('Provider settings saved. New conversations use the selected default model immediately.')
    } catch (requestError) {
      setErrorMessage(requestError instanceof Error ? requestError.message : 'Provider settings could not be saved.')
    } finally {
      setWorking(null)
    }
  }

  async function updateProvider(config: AIProviderConfig, updates: { enabled: boolean; isDefault: boolean }) {
    setWorking('provider')
    setMessage('')
    setErrorMessage('')
    try {
      await apiRequest('/api/ai-config', {
        method: 'PUT',
        body: JSON.stringify({
          provider: config.provider,
          model: config.model,
          baseUrl: config.baseUrl,
          enabled: updates.enabled,
          isDefault: updates.isDefault,
        }),
      })
      await mutate()
      setMessage(`${AI_PROVIDER_LABELS[config.provider]} settings updated.`)
    } catch (requestError) {
      setErrorMessage(requestError instanceof Error ? requestError.message : 'Provider settings could not be updated.')
    } finally {
      setWorking(null)
    }
  }

  async function removeSavedKey() {
    if (!savedConfig) return
    setWorking('key')
    setMessage('')
    setErrorMessage('')
    try {
      await apiRequest('/api/ai-config', {
        method: 'PUT',
        body: JSON.stringify({
          provider,
          model: model.trim() || savedConfig.model,
          baseUrl: null,
          enabled: false,
          isDefault: false,
          removeApiKey: true,
        }),
      })
      setApiKey('')
      await mutate()
      setMessage('Saved API key removed from secure storage.')
    } catch (requestError) {
      setErrorMessage(requestError instanceof Error ? requestError.message : 'The saved API key could not be removed.')
    } finally {
      setWorking(null)
    }
  }

  async function removeProvider(config: AIProviderConfig) {
    if (!window.confirm(`Remove ${AI_PROVIDER_LABELS[config.provider]} settings and its saved API key?`)) return
    setWorking('provider')
    setMessage('')
    setErrorMessage('')
    try {
      await apiRequest('/api/ai-config', {
        method: 'DELETE',
        body: JSON.stringify({ provider: config.provider }),
      })
      await mutate()
      setMessage(`${AI_PROVIDER_LABELS[config.provider]} settings and key removed.`)
    } catch (requestError) {
      setErrorMessage(requestError instanceof Error ? requestError.message : 'Provider settings could not be removed.')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.routingSummary}>
        <div>
          <span className={styles.eyebrow}>ACTIVE AI PROVIDER</span>
          <p className={styles.routingValue}>
            {activeConfig ? `${AI_PROVIDER_LABELS[activeConfig.provider]} · ${activeConfig.model}` : 'Google Gemini · gemini-2.0-flash (Free Tier)'}
          </p>
        </div>
        <Badge variant={activeConfig ? 'secondary' : 'outline'}>{activeConfig ? 'ACTIVE KEY' : 'GEMINI FREE'}</Badge>
      </div>

      <div className={styles.layout}>
        <Card className="workspace-card">
          <CardHeader>
            <CardTitle>Provider configuration</CardTitle>
            <CardDescription>Choose a provider, load its available models, and save a key for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveConfiguration}>
              <fieldset className={styles.fieldset} disabled={isLoading || working !== null}>
                <FieldGroup className={styles.fields}>
                  <Field>
                    <FieldLabel htmlFor="ai-provider">Provider</FieldLabel>
                    <select
                      id="ai-provider"
                      className={styles.select}
                      value={provider}
                      onChange={(event) => setProvider(event.target.value as AIProviderId)}
                    >
                      {AI_PROVIDER_IDS.map((id) => <option key={id} value={id}>{AI_PROVIDER_LABELS[id]}</option>)}
                    </select>
                  </Field>


                  <Field>
                    <FieldLabel htmlFor="ai-api-key">Gemini API Key</FieldLabel>
                    <Input
                      id="ai-api-key"
                      type="password"
                      autoComplete="new-password"
                      name="vision-provider-api-key"
                      placeholder={savedConfig?.hasApiKey ? 'Enter a replacement key, or leave blank to keep the saved key' : 'Paste your Gemini free API key (AIza...)'}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                    />
                    <p className={styles.helpText}>
                      {savedConfig?.hasApiKey ? 'Your Gemini API key is saved securely in Supabase Vault.' : 'Get a free Gemini API key from Google AI Studio (https://aistudio.google.com/app/apikey).'}
                    </p>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="ai-model">Model ID</FieldLabel>
                    <div className={styles.modelRow}>
                      <Input
                        id="ai-model"
                        list="ai-model-options"
                        autoComplete="off"
                        placeholder="Load models or enter a model ID"
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        required
                      />
                      <datalist id="ai-model-options">
                        {models.map((modelId) => <option key={modelId} value={modelId} />)}
                      </datalist>
                      <Button type="button" variant="outline" onClick={() => void loadModels()} disabled={!apiKey.trim() && !savedConfig?.hasApiKey}>
                        {working === 'models' ? <LoaderCircle data-icon="inline-start" className={styles.spinner} /> : <RefreshCw data-icon="inline-start" />}
                        Load models
                      </Button>
                    </div>
                    <p className={styles.helpText}>Model IDs are fetched from the provider when available; you can also enter one manually.</p>
                  </Field>
                </FieldGroup>

                <div className={styles.options}>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={enabled} onChange={(event) => { setEnabled(event.target.checked); if (!event.target.checked) setIsDefault(false) }} />
                    <span><strong>Enable provider</strong><small>Keep this profile available for VISION.</small></span>
                  </label>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={isDefault} onChange={(event) => { setIsDefault(event.target.checked); if (event.target.checked) setEnabled(true) }} />
                    <span><strong>Use as default</strong><small>New text, research, and voice replies use this model.</small></span>
                  </label>
                </div>
              </fieldset>

              <div className={styles.actions}>
                <Button type="button" variant="outline" onClick={() => void testConnection()} disabled={isLoading || working !== null || !model.trim() || (!apiKey.trim() && !savedConfig?.hasApiKey)}>
                  {working === 'test' ? <LoaderCircle data-icon="inline-start" className={styles.spinner} /> : <ShieldCheck data-icon="inline-start" />}
                  Test connection
                </Button>
                <Button type="submit" disabled={isLoading || working !== null || !model.trim() || (!apiKey.trim() && !savedConfig?.hasApiKey)}>
                  {working === 'save' ? <LoaderCircle data-icon="inline-start" className={styles.spinner} /> : <Check data-icon="inline-start" />}
                  Save settings
                </Button>
              </div>

              {savedConfig?.hasApiKey && (
                <Button type="button" variant="ghost" className={styles.removeKeyButton} onClick={() => void removeSavedKey()} disabled={working !== null}>
                  <Trash2 data-icon="inline-start" />
                  Remove saved API key
                </Button>
              )}
            </form>

            {message && <p className={styles.successMessage} role="status">{message}</p>}
            {errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}
            {error && <p className={styles.errorMessage} role="alert">Provider settings could not be loaded. Refresh the page and try again.</p>}
          </CardContent>
        </Card>

        <div className={styles.sideColumn}>
          <Card className="workspace-card">
            <CardHeader>
              <CardTitle>Saved providers</CardTitle>
              <CardDescription>Switch the default model at any time. Changes apply to the next request.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className={styles.emptyState}>Loading provider settings…</p>
              ) : providers.length ? (
                <div className={styles.providerList}>
                  {providers.map((config) => (
                    <article className={styles.providerItem} key={config.provider}>
                      <div className={styles.providerHeading}>
                        <div>
                          <h3>{AI_PROVIDER_LABELS[config.provider]}</h3>
                          <p>{config.model}</p>
                        </div>
                        {config.isDefault && config.enabled ? <Badge variant="secondary">ACTIVE</Badge> : <Badge variant="outline">{config.enabled ? 'ENABLED' : 'DISABLED'}</Badge>}
                      </div>
                      <p className={styles.keyStatus}>{config.hasApiKey ? 'API key saved securely' : 'No API key saved'}</p>
                      <div className={styles.providerActions}>
                        <Button
                          type="button"
                          size="sm"
                          variant={config.isDefault && config.enabled ? 'secondary' : 'outline'}
                          disabled={working !== null || !config.hasApiKey || (config.isDefault && config.enabled)}
                          onClick={() => void updateProvider(config, { enabled: true, isDefault: true })}
                        >
                          {config.enabled ? 'Set as active' : 'Enable & activate'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={working !== null}
                          onClick={() => void updateProvider(config, { enabled: !config.enabled, isDefault: config.isDefault && !config.enabled })}
                        >
                          {config.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${AI_PROVIDER_LABELS[config.provider]} configuration and key`}
                          disabled={working !== null}
                          onClick={() => void removeProvider(config)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>No custom Gemini key saved in database. VISION uses your GEMINI_API_KEY environment variable or default free Gemini tier.</p>
              )}
            </CardContent>
          </Card>

          <Card className="workspace-card">
            <CardHeader>
              <CardTitle>Credential security</CardTitle>
              <CardDescription>Your provider keys stay out of the browser after saving.</CardDescription>
            </CardHeader>
            <CardContent className={styles.securityContent}>
              <ShieldCheck aria-hidden="true" />
              <p>Keys are encrypted in Supabase Vault and can be retrieved only by authenticated server-side routes. They are never returned by the settings API or written to frontend code.</p>
            </CardContent>
          </Card>

          <p className={styles.capabilityNote}>Text, research summaries, task extraction, and voice replies are powered exclusively by Google Gemini Free API Key.</p>
        </div>
      </div>
    </div>
  )
}
