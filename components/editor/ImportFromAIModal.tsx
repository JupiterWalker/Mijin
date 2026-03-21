import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Sparkles, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { GraphData } from '../../types';
import { useTranslation } from '../../i18n';

interface ImportFromAIModalProps {
  onApply: (data: GraphData) => void;
  onClose: () => void;
}

const STORAGE_KEYS = {
  baseUrl: 'ai_import_base_url',
  apiKey: 'ai_import_api_key',
  model: 'ai_import_model',
};

const PRESETS = [
  { label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4-5' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llava' },
];

const PROMPT = `Analyze this image or document and extract the nodes (components, services, systems) and their relationships (connections, flows, dependencies).

Return ONLY a valid JSON object with exactly this structure, no explanation, no markdown fences:
{"nodes":[{"id":"1","label":"Name","group":0}],"links":[{"source":"1","target":"2"}]}

Rules:
- id: unique string integer starting from "1"
- label: concise name, 2-4 words
- group: 0-5 for color (0=general, 1=frontend, 2=backend, 3=database, 4=external, 5=infra)
- links reference node ids via source/target`;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isAnthropicUrl(url: string) {
  return url.includes('anthropic.com');
}

// Route through the Vite dev-server proxy to avoid CORS restrictions.
// The proxy at /ai-proxy forwards the request server-side to the real target URL.
async function proxyFetch(targetUrl: string, headers: Record<string, string>, body: object): Promise<Response> {
  return fetch('/ai-proxy', {
    method: 'POST',
    headers: { ...headers, 'x-proxy-target': targetUrl },
    body: JSON.stringify(body),
  });
}

async function callAnthropicAPI(baseUrl: string, apiKey: string, model: string, file: File): Promise<string> {
  let fileBlock: object;
  if (file.type.startsWith('image/')) {
    const data = await fileToBase64(file);
    fileBlock = { type: 'image', source: { type: 'base64', media_type: file.type, data } };
  } else if (file.type === 'application/pdf') {
    const data = await fileToBase64(file);
    fileBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
  } else {
    const text = await file.text();
    fileBlock = { type: 'text', text: `File: ${file.name}\n\n${text}` };
  }

  const targetUrl = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
  const response = await proxyFetch(
    targetUrl,
    { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { model, max_tokens: 4096, messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }] },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error?.message || `API error ${response.status}`);
  }
  const data = await response.json();
  return (data.content?.[0]?.text as string) || '';
}

async function callOpenAICompatibleAPI(baseUrl: string, apiKey: string, model: string, file: File): Promise<string> {
  // Use array content only for vision (images); plain string for text/PDF
  // to maximise compatibility with OpenAI-compatible APIs
  let message: object;
  if (file.type.startsWith('image/')) {
    const data = await fileToBase64(file);
    message = {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${file.type};base64,${data}` } },
        { type: 'text', text: PROMPT },
      ],
    };
  } else {
    const text = file.type === 'application/pdf' ? `[PDF: ${file.name}]` : await file.text();
    message = {
      role: 'user',
      content: `File: ${file.name}\n\n${text}\n\n${PROMPT}`,
    };
  }

  const targetUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await proxyFetch(
    targetUrl,
    { 'content-type': 'application/json', 'authorization': `Bearer ${apiKey}` },
    { model, max_tokens: 4096, messages: [message] },
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    const errJson = (() => { try { return JSON.parse(errBody); } catch { return null; } })();
    const msg = errJson?.error?.message || errJson?.message || errBody || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  const data = await response.json();
  return (data.choices?.[0]?.message?.content as string) || '';
}

export const ImportFromAIModal: React.FC<ImportFromAIModalProps> = ({ onApply, onClose }) => {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState('https://api.anthropic.com');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [showPresets, setShowPresets] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GraphData | null>(null);
  const [rawJson, setRawJson] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem(STORAGE_KEYS.baseUrl);
    const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    const savedModel = localStorage.getItem(STORAGE_KEYS.model);
    if (savedUrl) setBaseUrl(savedUrl);
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setModel(savedModel);
  }, []);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setShowPresets(false);
  };

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file || !apiKey.trim() || !baseUrl.trim() || !model.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    localStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl.trim());
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey.trim());
    localStorage.setItem(STORAGE_KEYS.model, model.trim());

    try {
      const responseText = isAnthropicUrl(baseUrl)
        ? await callAnthropicAPI(baseUrl.trim(), apiKey.trim(), model.trim(), file)
        : await callOpenAICompatibleAPI(baseUrl.trim(), apiKey.trim(), model.trim(), file);

      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(t('import.parse_error'));

      const parsed: GraphData = JSON.parse(match[0]);
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.links)) {
        throw new Error(t('import.structure_error'));
      }

      setResult(parsed);
      setRawJson(JSON.stringify(parsed, null, 2));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze = !!file && !!apiKey.trim() && !!baseUrl.trim() && !!model.trim() && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[560px] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-sm text-slate-800">{t('import.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Preset Picker */}
            <div className="relative">
              <button
                onClick={() => setShowPresets(v => !v)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50"
              >
                {t('import.presets')}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showPresets && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1">
                  {PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700"
                    >
                      <div className="font-medium">{p.label}</div>
                      <div className="text-slate-400 font-mono truncate">{p.model}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {/* Model Config */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('import.base_url')}</label>
              <input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.anthropic.com"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">
                {isAnthropicUrl(baseUrl) ? t('import.format_anthropic') : t('import.format_openai')}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('import.api_key')}</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={t('import.api_key_placeholder')}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('import.model')}</label>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="claude-sonnet-4-6"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
              />
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('import.upload_prompt')}</label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-50'
                  : file
                  ? 'border-green-300 bg-green-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">{t('import.upload_hint')}</p>
                  <p className="text-xs text-slate-400 mt-1">{t('import.supported_formats')}</p>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Preview */}
          {result && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                {t('import.result_title')} — {result.nodes.length} {t('import.nodes')}, {result.links.length} {t('import.links')}
              </label>
              <pre className="bg-slate-900 text-green-400 text-xs rounded-xl p-3 overflow-auto max-h-48 font-mono">
                {rawJson}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            {t('import.cancel')}
          </button>
          {!result ? (
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                canAnalyze
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loading ? t('import.analyzing') : t('import.analyze')}
            </button>
          ) : (
            <>
              <button
                onClick={() => { setResult(null); setError(''); }}
                className="px-4 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                {t('import.reanalyze')}
              </button>
              <button
                onClick={() => onApply(result)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {t('import.apply')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
