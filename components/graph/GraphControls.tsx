import React from 'react';
import { useTranslation } from '../../i18n';

interface GraphControlsProps {
  isDirectorMode: boolean;
}

export const GraphControls: React.FC<GraphControlsProps> = ({ isDirectorMode }) => {
  const { t } = useTranslation();
  return (
    <div className={`absolute bottom-4 left-4 backdrop-blur px-3 py-1.5 rounded-md shadow-sm border text-[10px] text-slate-400 pointer-events-none flex flex-col gap-0.5 transition-colors ${isDirectorMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
      <div className="flex items-center gap-1.5">
        <kbd className={`${isDirectorMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'} px-1 rounded border`}>Del</kbd> {t('controls.del')}
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className={`${isDirectorMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'} px-1 rounded border`}>Enter</kbd> {t('controls.enter')}
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className={`${isDirectorMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'} px-1 rounded border`}>Esc</kbd> {t('controls.esc')}
      </div>
    </div>
  );
};
