import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { GraphData } from '../../types';
import { useTranslation } from '../../i18n';

interface ImportFromAIModalProps {
  onApply: (data: GraphData) => void;
  onClose: () => void;
}

const STORAGE_KEYS = {
  backendUrl: 'ai_import_backend_url',
  apiKey: 'ai_import_api_key',
  model: 'ai_import_model',
  baseUrl: 'ai_import_base_url',
};

const DEFAULT_BACKEND_URL = 'http://localhost:8000';

export const ImportFromAIModal: React.FC<ImportFromAIModalProps> = ({ onApply, onClose }) => {
  const { t } = useTranslation();
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.openai.com/v1');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GraphData | null>(null);
  const [rawJson, setRawJson] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedBackend = localStorage.getItem(STORAGE_KEYS.backendUrl);
    const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    const savedModel = localStorage.getItem(STORAGE_KEYS.model);
    const savedBaseUrl = localStorage.getItem(STORAGE_KEYS.baseUrl);
    if (savedBackend) setBackendUrl(savedBackend);
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setModel(savedModel);
    if (savedBaseUrl) setAiBaseUrl(savedBaseUrl);
  }, []);

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
    if (!file || !apiKey.trim() || !backendUrl.trim() || !model.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    localStorage.setItem(STORAGE_KEYS.backendUrl, backendUrl.trim());
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey.trim());
    localStorage.setItem(STORAGE_KEYS.model, model.trim());
    localStorage.setItem(STORAGE_KEYS.baseUrl, aiBaseUrl.trim());

    try {
      const configPayload = JSON.stringify({
        api_key: apiKey.trim(),
        base_url: aiBaseUrl.trim() || undefined,
        model: model.trim(),
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('config', configPayload);

      const endpoint = `${backendUrl.replace(/\/$/, '')}/generate/graph-from-file`;
      const response = await fetch(endpoint, { method: 'POST', body: formData });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const graphData: GraphData = data.graph_data;

      if (!Array.isArray(graphData?.nodes) || !Array.isArray(graphData?.links)) {
        throw new Error(t('import.structure_error'));
      }

      setResult(graphData);
      setRawJson(JSON.stringify(graphData, null, 2));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze = !!file && !!apiKey.trim() && !!backendUrl.trim() && !!model.trim() && !loading;

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
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {/* Backend URL */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Backend URL</label>
            <input
              value={backendUrl}
              onChange={e => setBackendUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
            />
          </div>

          {/* AI Model Config */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('import.base_url')}</label>
              <input
                value={aiBaseUrl}
                onChange={e => setAiBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
              />
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
                placeholder="gpt-4o"
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
                accept=".txt,.md,.csv,.json,.yaml,.yml,.toml,.xml,.log"
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
