'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAllModels, type VideoModel, type FormField } from '@/lib/models';

interface TaskInfo {
  taskId: string;
  modelId: string;
  modelName: string;
  status: string;
  generated?: string[];
  prompt?: string;
  error?: string;
}

interface HistoryItem {
  modelName: string;
  prompt: string;
  videoUrl: string;
  timestamp: number;
}

interface UploadState {
  uploading: boolean;
  progress: string;
  fileName?: string;
}

export default function HomePage() {
  const models = getAllModels();
  const [selectedModel, setSelectedModel] = useState<VideoModel>(models[0]);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTask, setCurrentTask] = useState<TaskInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorCountRef = useRef(0);

  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    selectedModel.fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
    setFormData(defaults);
    setError(null);
    setCurrentTask(null);
    setUploadStates({});
    if (pollRef.current) clearInterval(pollRef.current);
  }, [selectedModel]);

  useEffect(() => {
    const saved = localStorage.getItem('freepik_api_key');
    if (saved) {
      setApiKey(saved);
      setApiKeySaved(true);
    }
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('freepik_api_key', apiKey);
    setApiKeySaved(true);
  };

  const updateField = (name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (fieldName: string, file: File) => {
    setUploadStates(prev => ({
      ...prev,
      [fieldName]: { uploading: true, progress: 'Mengunggah...', fileName: file.name }
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setUploadStates(prev => ({
          ...prev,
          [fieldName]: { uploading: false, progress: result.error || 'Upload gagal' }
        }));
        return;
      }

      updateField(fieldName, result.url);
      setUploadStates(prev => ({
        ...prev,
        [fieldName]: { uploading: false, progress: 'Berhasil!', fileName: file.name }
      }));
    } catch {
      setUploadStates(prev => ({
        ...prev,
        [fieldName]: { uploading: false, progress: 'Upload gagal — koneksi error' }
      }));
    }
  };

  const pollTaskStatus = useCallback(async (taskId: string, modelId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-api-key'] = apiKey;

      const res = await fetch(`/api/status?model=${modelId}&taskId=${taskId}`, { headers });

      if (!res.ok) {
        pollErrorCountRef.current++;
        console.warn(`Poll error (attempt ${pollErrorCountRef.current}):`, res.status);
        if (pollErrorCountRef.current >= 10) {
          let errMsg = 'Gagal memeriksa status setelah beberapa percobaan';
          try { const r = await res.json(); errMsg = r.error || errMsg; } catch { }
          setCurrentTask(prev => prev ? { ...prev, status: 'FAILED', error: errMsg } : null);
          if (pollRef.current) clearInterval(pollRef.current);
        }
        return;
      }

      pollErrorCountRef.current = 0;
      const result = await res.json();
      const data = result.data || result;
      const status = data.status || 'UNKNOWN';
      const generated = data.generated?.filter((u: string) => u && u.length > 0) || [];

      setCurrentTask(prev => prev ? { ...prev, status, generated, error: undefined } : null);

      if (status === 'COMPLETED' || status === 'DONE') {
        if (pollRef.current) clearInterval(pollRef.current);
        if (generated.length > 0) {
          setHistory(prev => [{
            modelName: selectedModel.name,
            prompt: String(formData.prompt || ''),
            videoUrl: generated[0],
            timestamp: Date.now(),
          }, ...prev]);
        }
      } else if (status === 'FAILED' || status === 'ERROR') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch (err) {
      pollErrorCountRef.current++;
      console.error('Poll error:', err);
    }
  }, [selectedModel.name, formData.prompt, apiKey]);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    setCurrentTask(null);
    pollErrorCountRef.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const sanitizeValue = (value: unknown) => {
        if (typeof value !== 'string') return value;
        let cleaned = value.trim();
        if (
          (cleaned.startsWith('`') && cleaned.endsWith('`')) ||
          (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
          (cleaned.startsWith("'") && cleaned.endsWith("'"))
        ) {
          cleaned = cleaned.slice(1, -1).trim();
        }
        return cleaned;
      };

      const sanitizedForm = Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [key, sanitizeValue(value)])
      );

      const missingRequired = selectedModel.fields
        .filter(field => field.required)
        .filter(field => {
          const value = sanitizedForm[field.name];
          return value === undefined || value === null || String(value).trim() === '';
        });

      if (missingRequired.length > 0) {
        setError(`Field wajib belum diisi: ${missingRequired.map(field => field.label).join(', ')}`);
        setIsGenerating(false);
        return;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-api-key'] = apiKey;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: selectedModel.id, ...sanitizedForm }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Generation failed');
        setIsGenerating(false);
        return;
      }

      const data = result.data || result;
      const taskId = data.task_id;

      if (!taskId) {
        setError('No task ID returned');
        setIsGenerating(false);
        return;
      }

      setCurrentTask({
        taskId,
        modelId: selectedModel.id,
        modelName: selectedModel.name,
        status: data.status || 'CREATED',
        prompt: String(formData.prompt || ''),
      });

      pollRef.current = setInterval(() => {
        pollTaskStatus(taskId, selectedModel.id);
      }, 5000);

      setTimeout(() => pollTaskStatus(taskId, selectedModel.id), 5000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name];

    if (field.type === 'boolean') {
      const isActive = value === true || value === 'true';
      return (
        <div className="form-group" key={field.name}>
          <div className="form-toggle" onClick={() => updateField(field.name, !isActive)}>
            <div className={`toggle-switch ${isActive ? 'active' : ''}`} />
            <span className="toggle-label">{field.label}</span>
          </div>
          {field.helpText && <span className="form-help">{field.helpText}</span>}
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div className="form-group" key={field.name}>
          <label className="form-label">
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <select
            className="form-select"
            value={String(value ?? field.defaultValue ?? '')}
            onChange={e => updateField(field.name, e.target.value)}
          >
            {field.options?.map(opt => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
          {field.helpText && <span className="form-help">{field.helpText}</span>}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div className="form-group" key={field.name}>
          <label className="form-label">
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <textarea
            className="form-textarea"
            value={String(value ?? '')}
            onChange={e => updateField(field.name, e.target.value)}
            placeholder={field.placeholder}
          />
          {field.helpText && <span className="form-help">{field.helpText}</span>}
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <div className="form-group" key={field.name}>
          <label className="form-label">
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <input
            type="number"
            className="form-input"
            value={value !== undefined && value !== '' ? String(value) : ''}
            onChange={e => updateField(field.name, e.target.value ? Number(e.target.value) : '')}
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder || 'Enter value'}
          />
          {field.helpText && <span className="form-help">{field.helpText}</span>}
        </div>
      );
    }

    // URL fields with file upload support
    if (field.type === 'url') {
      const uploadState = uploadStates[field.name];
      const isImage = field.name.includes('image');
      const acceptTypes = isImage ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/quicktime,video/webm,video/x-m4v';

      return (
        <div className="form-group" key={field.name}>
          <label className="form-label">
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>

          {/* URL Input */}
          <input
            type="url"
            className="form-input"
            value={String(value ?? '')}
            onChange={e => updateField(field.name, e.target.value)}
            placeholder={field.placeholder}
          />

          {/* Upload Button */}
          <div className="upload-section">
            <label className={`upload-btn ${uploadState?.uploading ? 'uploading' : ''}`}>
              {uploadState?.uploading ? (
                <><span className="spinner-sm" /> {uploadState.progress}</>
              ) : (
                <>{isImage ? '📷' : '🎥'} Unggah dari perangkat</>
              )}
              <input
                type="file"
                accept={acceptTypes}
                style={{ display: 'none' }}
                disabled={uploadState?.uploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(field.name, file);
                  e.target.value = '';
                }}
              />
            </label>
            {uploadState?.fileName && !uploadState.uploading && (
              <span className={`upload-status ${uploadState.progress === 'Berhasil!' ? 'success' : 'error'}`}>
                {uploadState.progress === 'Berhasil!'
                  ? `✅ ${uploadState.fileName}`
                  : `❌ ${uploadState.progress}`
                }
              </span>
            )}
          </div>

          {field.helpText && <span className="form-help">{field.helpText}</span>}
        </div>
      );
    }

    return (
      <div className="form-group" key={field.name}>
        <label className="form-label">
          {field.label}
          {field.required && <span className="required">*</span>}
        </label>
        <input
          type="text"
          className="form-input"
          value={String(value ?? '')}
          onChange={e => updateField(field.name, e.target.value)}
          placeholder={field.placeholder}
        />
        {field.helpText && <span className="form-help">{field.helpText}</span>}
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'done') return 'completed';
    if (s === 'failed' || s === 'error') return 'failed';
    if (s === 'in_progress' || s === 'processing') return 'in_progress';
    return 'created';
  };

  const isPolling = currentTask && !['COMPLETED', 'DONE', 'FAILED', 'ERROR'].includes(currentTask.status);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-icon"><img src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjg0cmR2eTluZjU5eGd2eGszaDA1MGk4b2p5YWZqdmFzZTFwbXR4YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dXlUFmuOWFRlHYgc9i/giphy.gif" alt="Kling Motion" className="header-logo" /></div>
        <h1>Kling Motion Control</h1>
        <p>Transfer motion from reference videos to character images — powered by Kling 2.6 AI</p>
      </header>

      {/* API Key */}
      <div
        className="api-key-section fade-in"
        style={apiKeySaved ? { borderColor: 'rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.05)' } : undefined}
      >
        <label style={apiKeySaved ? { color: 'var(--success)' } : undefined}>
          {apiKeySaved ? '✅ TOKEN TERSIMPAN' : '🔑 Token Dari Admin TEXA'}
        </label>
        <div className="api-key-row">
          <input
            type={showApiKey ? 'text' : 'password'}
            className="form-input"
            value={apiKey}
            onChange={e => {
              setApiKey(e.target.value);
              if (apiKeySaved) setApiKeySaved(false);
            }}
            placeholder="Masukkan token dari admin TEXA..."
          />
          <button
            className="api-key-btn"
            onClick={() => setShowApiKey(prev => !prev)}
          >
            {showApiKey ? '🙈 Sembunyikan' : '👁️ Intip'}
          </button>
          <button className="api-key-btn" onClick={saveApiKey}>
            {apiKeySaved ? 'Perbarui' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Model Selector */}
      <div className="model-selector">
        {models.map(model => (
          <button
            key={model.id}
            className={`model-tab ${selectedModel.id === model.id ? 'active' : ''}`}
            onClick={() => setSelectedModel(model)}
          >
            <span className="model-tab-name">{model.name}</span>
            {model.badge && <span className="model-badge">{model.badge}</span>}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="main-content fade-in" key={selectedModel.id}>
        <div className="form-panel">
          <div className="form-panel-header">
            <h2 className="form-panel-title">
              {selectedModel.name}
              {selectedModel.badge && <span className="model-badge">{selectedModel.badge}</span>}
            </h2>
            <p className="form-panel-desc">{selectedModel.description}</p>
          </div>

          {/* How it works */}
          <div className="how-it-works">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-text">Upload a <strong>character image</strong></div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-text">Provide a <strong>reference video</strong> with desired motion</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-text">AI transfers <strong>motion to character</strong></div>
            </div>
          </div>

          <div className="form-fields">
            {selectedModel.fields.map(renderField)}
          </div>

          <button
            className={`generate-btn ${isGenerating || isPolling ? 'loading' : ''}`}
            onClick={handleGenerate}
            disabled={isGenerating || !!isPolling}
          >
            {isGenerating ? (
              <><span className="spinner" /> Mengirim...</>
            ) : isPolling ? (
              <><span className="spinner" /> Memproses...</>
            ) : (
              '🎬 Generate Motion Video'
            )}
          </button>

          {/* Error */}
          {error && <div className="error-box fade-in">❌ {error}</div>}

          {/* Task Status */}
          {currentTask && (
            <div className="status-section fade-in">
              <div className="status-header">
                <div className={`status-dot ${getStatusColor(currentTask.status)}`} />
                <span className="status-label">{currentTask.status}</span>
              </div>
              <div className="status-taskid">Task ID: {currentTask.taskId}</div>
              {isPolling && (
                <div className="progress-bar" style={{ marginTop: 12 }}>
                  <div className="progress-fill" style={{ width: currentTask.status === 'IN_PROGRESS' ? '60%' : '30%' }} />
                </div>
              )}
              {currentTask.error && (
                <div className="error-box" style={{ marginTop: 12 }}>
                  {currentTask.error}
                </div>
              )}

              {/* Video Result */}
              {currentTask.generated && currentTask.generated.length > 0 && (
                <div className="video-result fade-in">
                  <video
                    src={currentTask.generated[0]}
                    controls
                    autoPlay
                    loop
                    playsInline
                  />
                  <div className="video-actions">
                    <a
                      href={currentTask.generated[0]}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="video-action-btn"
                    >
                      ⬇️ Download
                    </a>
                    <button
                      className="video-action-btn"
                      onClick={() => navigator.clipboard.writeText(currentTask.generated![0])}
                    >
                      📋 Copy URL
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="history-section fade-in">
          <h3 className="history-title">📼 Riwayat Video ({history.length})</h3>
          <div className="history-grid">
            {history.map((item, i) => (
              <div key={i} className="history-card">
                <video src={item.videoUrl} controls playsInline muted />
                <div className="history-card-info">
                  <div className="history-card-model">{item.modelName}</div>
                  <div className="history-card-prompt">{item.prompt || 'No prompt'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
