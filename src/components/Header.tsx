import React from 'react';
import { FolderSync, ShieldCheck, Terminal, Network, Monitor, Sparkles } from 'lucide-react';

interface HeaderProps {
  onOpenDesktopGui?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDesktopGui }) => {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <FolderSync className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Перенос сетевых файлов по диапазону дат
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Сохранение иерархии папок
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  GUI Приложение
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-0.5">
                Интерактивное графическое приложение и автономные настольные GUI-утилиты (Python Tkinter / PowerShell WPF) для архивации сетевых папок
              </p>
            </div>
          </div>

          {/* Action & Feature Badges */}
          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            {onOpenDesktopGui && (
              <button
                type="button"
                onClick={onOpenDesktopGui}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all hover:shadow-md cursor-pointer"
              >
                <Monitor className="w-4 h-4 text-amber-300" />
                <span>Автономное GUI окно (.py / .exe / .ps1)</span>
              </button>
            )}
            <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Dry-Run защита
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                <Network className="w-3.5 h-3.5 text-purple-600" /> SMB / CIFS / UNC
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
