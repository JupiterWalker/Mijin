import React from 'react';
import { Settings, X, Code2, RotateCcw, Palette, Pipette, Activity, Play } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { JsonTreeEditor } from '../common/JsonTreeEditor';
import { useTranslation } from '../../i18n';

interface DevToolsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  graphJson: string;
  setGraphJson: (val: string) => void;
  themeJson: string;
  setThemeJson: (val: string) => void;
  eventJson: string;
  setEventJson: (val: string) => void;
  errors: { graph: string; theme: string; event: string };
  onApplyGraph: () => void;
  onResetGraph: () => void;
  onApplyTheme: () => void;
  onApplyEvent: () => void;
  onRunAnimation: () => void;
}

export const DevToolsSidebar: React.FC<DevToolsSidebarProps> = ({
  isOpen,
  onClose,
  graphJson, setGraphJson,
  themeJson, setThemeJson,
  eventJson, setEventJson,
  errors,
  onApplyGraph,
  onResetGraph,
  onApplyTheme,
  onApplyEvent,
  onRunAnimation
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const btnPrimaryClass = "px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[10px] font-semibold rounded transition-colors flex items-center shadow-sm active:scale-95";
  const btnSecondaryClass = "px-3 py-1 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed text-slate-700 border border-slate-200 text-[10px] font-semibold rounded transition-colors flex items-center shadow-sm active:scale-95";

  return (
    <>
      <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
        <div className="flex items-center space-x-2 text-slate-800">
          <Settings className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-lg tracking-tight">{t('devtools.title')}</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-slate-50/50">
        
        {/* Graph Topology */}
        <CollapsibleSection 
          title={t('devtools.topology')}
          icon={<Code2 className="w-4 h-4 text-sky-500" />} 
          defaultOpen={false} 
          actions={
            <>
              <button onClick={onResetGraph} className={btnSecondaryClass}>
                <RotateCcw className="w-3 h-3 mr-1" /> {t('devtools.reset')}
              </button>
              <button onClick={onApplyGraph} disabled={!!errors.graph} className={btnPrimaryClass}>
                {t('devtools.apply')}
              </button>
            </>
          } 
          error={errors.graph}
        >
          <JsonTreeEditor value={graphJson} onChange={setGraphJson} height="280px" />
        </CollapsibleSection>

        {/* Visual Theme */}
        <CollapsibleSection 
          title={t('devtools.theme')}
          icon={<Palette className="w-4 h-4 text-pink-500" />} 
          actions={
            <button onClick={onApplyTheme} disabled={!!errors.theme} className={btnPrimaryClass}>
              {t('devtools.apply_theme')}
            </button>
          } 
          error={errors.theme}
        >
          <JsonTreeEditor value={themeJson} onChange={setThemeJson} height="280px" />
          <p className="text-[10px] text-slate-400 italic px-1 flex items-center gap-1">
            <Pipette className="w-3 h-3" /> {t('devtools.color_hint')}
          </p>
        </CollapsibleSection>

        {/* Animation Script */}
        <CollapsibleSection 
          title={t('devtools.script')}
          icon={<Activity className="w-4 h-4 text-emerald-500" />} 
          actions={
            <>
              <button onClick={onApplyEvent} disabled={!!errors.event} className={btnSecondaryClass}>
                {t('devtools.update')}
              </button>
              <button onClick={onRunAnimation} disabled={!!errors.event} className={btnPrimaryClass}>
                <Play className="w-3 h-3 mr-1 fill-current" /> {t('devtools.run')}
              </button>
            </>
          } 
          error={errors.event}
        >
          <JsonTreeEditor value={eventJson} onChange={setEventJson} height="200px" />
          <button 
            onClick={onRunAnimation} 
            disabled={!!errors.event} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-xs flex justify-center items-center shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] mt-2 group"
          >
            <Play className="w-3.5 h-3.5 mr-2 fill-current" /> {t('devtools.run_simulation')}
          </button>
        </CollapsibleSection>
      </div>
    </>
  );
};
