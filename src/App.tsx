import React, { useState } from 'react';
import { ScriptConfig } from './types';
import { Header } from './components/Header';
import { ConfigPanel } from './components/ConfigPanel';
import { Simulator } from './components/Simulator';
import { ScriptViewer } from './components/ScriptViewer';
import { BestPracticesGuide } from './components/BestPracticesGuide';
import { DesktopGuiModal } from './components/DesktopGuiModal';
import { Sliders, Layers, Code2, BookOpen, Monitor } from 'lucide-react';

const DEFAULT_CONFIG: ScriptConfig = {
  sourcePath: '\\\\fileserver\\Share\\Department_Docs',
  destPath: '\\\\fileserver\\Archive\\2010_2016',
  startDate: '2010-01-01',
  endDate: '2016-12-31',
  dateField: 'mtime',
  dryRun: true,
  deleteEmptyDirs: true,
  conflictResolution: 'skip',
  fileExtensions: '',
  excludePatterns: 'thumbs.db, desktop.ini, ~$*',
  enableLogging: true,
  logFilePath: 'C:\\Logs\\archive_2010_2016.log',
  supportLongPaths: true,
  retryAttempts: 3,
  checkDuplicates: false,
  duplicateMatchMode: 'hash',
  moveDuplicates: true,
  duplicateFolder: ''
};

export default function App() {
  const [config, setConfig] = useState<ScriptConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'all' | 'simulator' | 'scripts' | 'guide'>('all');
  const [isDesktopGuiOpen, setIsDesktopGuiOpen] = useState(false);

  const updateConfig = (updated: Partial<ScriptConfig>) => {
    setConfig(prev => ({ ...prev, ...updated }));
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header onOpenDesktopGui={() => setIsDesktopGuiOpen(true)} />

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        
        {/* Navigation / View Mode Filters */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Все разделы
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'simulator'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Интерактивный симулятор
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scripts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'scripts'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Скрипты и GUI (Python / PS / Bash)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'guide'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Руководство администратора
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDesktopGuiOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-2xs cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Окно GUI (.py / .exe)</span>
            </button>
            <div className="text-[11px] font-mono text-slate-500 hidden md:block border-l border-slate-200 pl-2">
              {config.startDate} &mdash; {config.endDate}
            </div>
          </div>
        </div>

        {/* 1. Configuration Panel (always accessible or visible) */}
        {(activeTab === 'all' || activeTab === 'simulator' || activeTab === 'scripts') && (
          <section>
            <ConfigPanel 
              config={config} 
              onChange={updateConfig} 
              onReset={handleReset} 
            />
          </section>
        )}

        {/* 2. Interactive Simulator */}
        {(activeTab === 'all' || activeTab === 'simulator') && (
          <section>
            <Simulator config={config} />
          </section>
        )}

        {/* 3. Generated Code Viewer */}
        {(activeTab === 'all' || activeTab === 'scripts') && (
          <section>
            <ScriptViewer config={config} />
          </section>
        )}

        {/* 4. Best Practices & Server Guide */}
        {(activeTab === 'all' || activeTab === 'guide') && (
          <section>
            <BestPracticesGuide />
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Скрипт переноса файлов по диапазону дат с сохранением иерархии каталогов
          </div>
          <div className="flex items-center gap-3">
            <span>Поддержка: Windows Server SMB / Linux Samba / NFS</span>
          </div>
        </div>
      </footer>

      {/* Desktop GUI Window Generator Modal */}
      <DesktopGuiModal 
        config={config} 
        isOpen={isDesktopGuiOpen} 
        onClose={() => setIsDesktopGuiOpen(false)} 
      />
    </div>
  );
}
