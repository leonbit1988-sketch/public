import React, { useState } from 'react';
import { 
  Monitor, 
  Terminal, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  Sparkles, 
  PackageCheck, 
  FolderSync,
  Play,
  Layers
} from 'lucide-react';
import { ScriptConfig } from '../types';
import { generatePythonTkinterGUI, generatePowerShellGUI } from '../utils/scriptGenerators';

interface GuiAppModalProps {
  config: ScriptConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopGuiModal: React.FC<GuiAppModalProps> = ({ config, isOpen, onClose }) => {
  const [selectedType, setSelectedType] = useState<'python-tkinter' | 'powershell-wpf'>('python-tkinter');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonCode = generatePythonTkinterGUI(config);
  const psWpfCode = generatePowerShellGUI(config);

  const activeCode = selectedType === 'python-tkinter' ? pythonCode : psWpfCode;
  const activeFilename = selectedType === 'python-tkinter' ? 'archive_gui.py' : 'archive_gui.ps1';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // Добавляем UTF-8 BOM (\uFEFF) для корректного распознавания кириллицы в Windows PowerShell и Блокноте
    const blob = new Blob(['\uFEFF' + activeCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Автономное графическое приложение (Desktop GUI)
              </h2>
              <p className="text-xs text-slate-500">
                Запустите полнофункциональное окно на Windows/Linux с кнопками «Обзор...», прогресс-баром и журналом
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 text-lg font-mono transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          
          {/* Choice selector cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedType('python-tkinter')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedType === 'python-tkinter'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <FileCode className="w-4 h-4 text-blue-600" /> Python Tkinter GUI
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                  Кроссплатформенный
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Нативное графическое окно с поддержкой Windows, Linux и Mac. Использует стандартную библиотеку Tkinter (не требует <code className="bg-slate-100 px-1 py-0.2 rounded font-mono">pip install</code>).
              </p>
              <div className="mt-3 text-[10px] text-slate-500 font-mono">
                Команда: python archive_gui.py
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('powershell-wpf')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedType === 'powershell-wpf'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Terminal className="w-4 h-4 text-emerald-600" /> PowerShell WPF GUI
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                  Без установки софта
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Нативное Windows-приложение на базе XAML / WPF. Запускается прямо в PowerShell без необходимости устанавливать Python или компилировать код.
              </p>
              <div className="mt-3 text-[10px] text-slate-500 font-mono">
                Команда: powershell.exe -ExecutionPolicy Bypass -File archive_gui.ps1
              </div>
            </button>
          </div>

          {/* Quick packaging instruction into .exe */}
          {selectedType === 'python-tkinter' ? (
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3">
              <PackageCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-amber-950">
                  Как упаковать в один автономный .exe файл для Windows:
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Если вам нужен готовый исполняемый файл без консоли для коллег или других администраторов, выполните в терминале:
                </p>
                <div className="bg-amber-900/90 text-amber-100 font-mono text-[11px] px-3 py-1.5 rounded-lg select-all mt-1">
                  pip install pyinstaller && pyinstaller --noconsole --onefile archive_gui.py
                </div>
                <p className="text-[10px] text-amber-800">
                  Готовый <code className="font-bold">archive_gui.exe</code> появится в подпапке <code className="font-bold">dist/</code>.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-blue-950">
                  Особенности запуска PowerShell GUI и выбор сетевых папок (UNC):
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  • <strong>Сетевые пути:</strong> кнопку «Обзор...» теперь открывает Проводник с разделом «Сеть». Вы также можете просто скопировать и вставить сетевой UNC-путь прямо в текстовое поле (например, <code className="bg-blue-100 font-bold px-1 rounded">\\server\share\folder</code>) и нажать кнопку <strong>«Проверить»</strong> рядом с полем.
                </p>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  • <strong>Поиск и перенос дубликатов:</strong> добавлены отдельные кнопки <strong>«Найти дубликаты»</strong> (глубокий аудит сетевой папки по SHA-256) и <strong>«Перенести дубликаты»</strong> (перемещение только дубликатов в архив с сохранением оригиналов в источнике), а также чекбокс <strong>«Переносить дубликаты»</strong> при общем перемещении за период.
                </p>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  • <strong>Кодировка UTF-8 BOM:</strong> файл скачивается с меткой BOM для корректного отображения кириллицы в Windows PowerShell 5.1.
                </p>
              </div>
            </div>
          )}

          {/* Code Viewer preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Исходный код {activeFilename}:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Скопировано!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Копировать
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Скачать {activeFilename}
                </button>
              </div>
            </div>

            <div className="relative border border-slate-800 rounded-xl bg-slate-950 overflow-hidden shadow-inner">
              <pre className="p-3 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-[260px] leading-relaxed select-all">
                <code>{activeCode}</code>
              </pre>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Файл предварительно настроен под выбранные пути: {config.startDate} &mdash; {config.endDate}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
