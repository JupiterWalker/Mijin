import React, { useState, useEffect } from 'react';
import { Clock, Pin, Trash2 } from 'lucide-react';
import { GraphProject } from '../../types';
import GraphCanvas from '../GraphCanvas';

interface ProjectCardProps {
  project: GraphProject;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onPin: (e: React.MouseEvent) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onDelete, onPin }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (isConfirmingDelete) {
      const timer = setTimeout(() => setIsConfirmingDelete(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmingDelete]);

  return (
    <div 
      onClick={onClick}
      className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer h-64 flex flex-col"
    >
      {/* Thumbnail */}
      <div className="flex-1 bg-slate-50 relative overflow-hidden pointer-events-none">
        <GraphCanvas 
          data={project.graphData} 
          theme={project.themeData} 
          readonly={true} 
        />
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-colors" />
      </div>

      {/* Content */}
      <div className="p-4 border-t border-slate-100 flex justify-between items-start relative">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate pr-2" title={project.name}>
            {project.name}
          </h3>
          <div className="flex items-center text-xs text-slate-500 mt-1">
            <Clock className="w-3 h-3 mr-1" />
            <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        {/* Actions */}
        <div className={`flex items-center space-x-1 transition-opacity relative z-10 ${project.isPinned ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}>
          <button 
            onClick={onPin}
            className={`p-1.5 rounded-md hover:bg-slate-100 transition-colors ${project.isPinned ? 'text-indigo-600' : 'text-slate-400'}`}
            title={project.isPinned ? "Unpin" : "Pin to top"}
          >
            {project.isPinned ? <Pin className="w-4 h-4 fill-current" /> : <Pin className="w-4 h-4" />}
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (isConfirmingDelete) {
                onDelete(e);
              } else {
                setIsConfirmingDelete(true);
              }
            }}
            className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center ${
              isConfirmingDelete 
                ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-200' 
                : 'hover:bg-red-50 text-slate-400 hover:text-red-600'
            }`}
            title={isConfirmingDelete ? "Click again to confirm delete" : "Delete"}
            style={{ width: isConfirmingDelete ? 'auto' : undefined }}
          >
            {isConfirmingDelete ? (
               <span className="text-xs font-bold px-1">Confirm</span>
            ) : (
               <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
