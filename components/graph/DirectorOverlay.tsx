import React from 'react';
import { MousePointer2, Link as LinkIcon, X } from 'lucide-react';

interface DirectorOverlayProps {
  directorPicking: 'source' | 'target' | null;
  isLinkMode: boolean;
  linkingSourceId: string | null;
  onCancel: () => void;
}

export const DirectorOverlay: React.FC<DirectorOverlayProps> = ({
  directorPicking,
  isLinkMode,
  linkingSourceId,
  onCancel
}) => {
  if (directorPicking) {
    return (
      <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-5 py-2.5 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-4 duration-300 z-50 flex items-center gap-3 border-2 border-white/20 backdrop-blur-md ring-4 ring-purple-500/20 pointer-events-auto">
        <MousePointer2 className="w-4 h-4 animate-pulse" />
        {directorPicking === 'source' ? "🎬 第一步：点击选择起点节点" : "🎬 第二步：点击选择终点节点"}
        <div className="w-px h-4 bg-white/20"></div>
        <button onClick={onCancel} className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] hover:bg-white/30 transition-colors">Esc 取消</button>
      </div>
    );
  }

  if (isLinkMode || linkingSourceId) {
    return (
      <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-bounce z-50 flex items-center gap-2 pointer-events-auto">
        <LinkIcon className="w-4 h-4" />
        {linkingSourceId ? "点击目标节点以连接" : "选择源节点开始连线"}
        <button 
          onClick={onCancel} 
          className="ml-2 hover:bg-white/20 rounded-full p-0.5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
};
