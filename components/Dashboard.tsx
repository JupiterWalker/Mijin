
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pin, PinOff, Clock, LayoutGrid, Activity, X } from 'lucide-react';
import { GraphProject } from '../types';
import GraphCanvas from './GraphCanvas';

interface DashboardProps {
  projects: GraphProject[];
  onCreateProject: () => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
}

const ProjectCard: React.FC<{
  project: GraphProject;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onPin: (e: React.MouseEvent) => void;
}> = ({ project, onClick, onDelete, onPin }) => {
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
                console.log('Dashboard: Delete confirmed for', project.id);
                onDelete(e);
              } else {
                console.log('Dashboard: Requesting confirmation for', project.id);
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

export const Dashboard: React.FC<DashboardProps> = ({ 
  projects, 
  onCreateProject, 
  onOpenProject,
  onDeleteProject,
  onTogglePin
}) => {
  const pinnedProjects = projects.filter(p => p.isPinned);
  const otherProjects = projects.filter(p => !p.isPinned);

  const showPinnedSection = pinnedProjects.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-7 h-7 text-indigo-600" />
              GraphFlow
            </h1>
            <p className="text-slate-500 mt-1">Manage and visualize your node graphs.</p>
          </div>
        </div>

        {/* Pinned Section */}
        {showPinnedSection && (
          <section>
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">
              <Pin className="w-4 h-4" /> Pinned
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {pinnedProjects.map(project => (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  onClick={() => onOpenProject(project.id)}
                  onDelete={(e) => onDeleteProject(project.id, e)}
                  onPin={(e) => {
                    e.stopPropagation();
                    onTogglePin(project.id, e);
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Graphs Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">
            <LayoutGrid className="w-4 h-4" /> {showPinnedSection ? 'Other Graphs' : 'All Graphs'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* New Project Button */}
            <div 
              onClick={onCreateProject}
              className="h-64 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-slate-50 bg-white/50 flex flex-col items-center justify-center cursor-pointer transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center mb-3 transition-colors">
                <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
              </div>
              <span className="font-medium text-slate-600 group-hover:text-indigo-700">Create New Graph</span>
            </div>

            {/* Project List */}
            {otherProjects
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map(project => (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  onClick={() => onOpenProject(project.id)}
                  onDelete={(e) => onDeleteProject(project.id, e)}
                  onPin={(e) => {
                    e.stopPropagation();
                    onTogglePin(project.id, e);
                  }}
                />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};
