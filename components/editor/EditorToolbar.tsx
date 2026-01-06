import React from 'react';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { Toggle } from '../Toggle';
import { useTranslation } from '../../i18n';

interface EditorToolbarProps {
  projectName: string;
  setProjectName: (name: string) => void;
  onBack: () => void;
  onAddNode: () => void;
  isLinkMode: boolean;
  setIsLinkMode: (val: boolean) => void;
  isDirectorMode: boolean;
  onToggleDirectorMode: () => void;
  devMode: boolean;
  setDevMode: (val: boolean) => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved';
  isDirty: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  projectName,
  setProjectName,
  onBack,
  onAddNode,
  isLinkMode,
  setIsLinkMode,
  isDirectorMode,
  onToggleDirectorMode,
  devMode,
  setDevMode,
  onSave,
  saveStatus,
  isDirty
}) => {
  const { t } = useTranslation();

  return (
    <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
      <div className={`backdrop-blur shadow-xl border rounded-2xl p-2 pointer-events-auto flex items-center space-x-3 pr-4 transition-all ${isDirectorMode ? 'bg-slate-900/80 border-white/10 ring-1 ring-white/5' : 'bg-white/90 border-slate-200'}`}>
        
        {/* Back Button */}
        <button onClick={onBack} title={t('editor.back')} className={`p-2 rounded-xl transition-colors ${isDirectorMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className={`h-6 w-px ${isDirectorMode ? 'bg-slate-800' : 'bg-slate-300'}`}></div>
        
        {/* Project Name */}
        <input 
          value={projectName} 
          onChange={(e) => setProjectName(e.target.value)} 
          className={`bg-transparent font-bold focus:outline-none rounded px-2 py-1 text-sm w-40 transition-colors ${isDirectorMode ? 'text-slate-200 focus:bg-slate-800' : 'text-slate-800 focus:bg-slate-100'}`} 
          placeholder={t('editor.project_name_placeholder')} 
        />
        
        {/* Add Node */}
        <button 
          onClick={onAddNode} 
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${isDirectorMode ? 'bg-indigo-950/50 text-indigo-300 border-indigo-500/30 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}
        >
          <Plus className="w-3.5 h-3.5" /> {t('editor.node')}
        </button>

        <div className={`h-6 w-px ${isDirectorMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
        
        {/* Link Mode Toggle */}
        <Toggle 
          checked={isLinkMode} 
          onChange={setIsLinkMode} 
          label={isLinkMode ? (isDirectorMode ? t('editor.link_activated') : t('editor.link_activated')) : t('editor.link_mode')} 
        />
        
        <div className={`h-6 w-px ${isDirectorMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>

        {/* Director Mode Toggle */}
        <button 
          onClick={onToggleDirectorMode}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'}`}
        >
          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isDirectorMode ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-slate-400'}`}></div>
          {t('editor.director_mode')}
        </button>

        <div className={`h-6 w-px ${isDirectorMode ? 'bg-slate-800' : 'bg-slate-300'}`}></div>

        {/* Save Button */}
        <button 
          onClick={onSave} 
          disabled={!isDirty || saveStatus === 'saving'} 
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${isDirty ? ( 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm') : ('bg-slate-100 text-slate-400 cursor-default')}`}
        >
          <Save className="w-3.5 h-3.5" />
          {saveStatus === 'saving' ? t('editor.saving') : saveStatus === 'saved' ? t('editor.saved') : t('editor.save')}
        </button>
        
        <div className={`h-6 w-px ${'bg-slate-300'}`}></div>
        
        {/* Dev Mode Toggle */}
        <div className="flex items-center gap-2">
          <Toggle checked={devMode} onChange={setDevMode} label={t('editor.dev_mode')} />
        </div>
      </div>
    </div>
  );
};
