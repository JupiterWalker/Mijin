import React from 'react';
import { Plus, Pin, LayoutGrid, Activity } from 'lucide-react';
import { GraphProject } from '../types';
import { ProjectCard } from './dashboard/ProjectCard';

interface DashboardProps {
  projects: GraphProject[];
  onCreateProject: () => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
}

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
    <div className="h-screen bg-slate-50 p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8 pb-10">
        
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
