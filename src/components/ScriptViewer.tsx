import React, { useState } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  FileCode, 
  Info, 
  Cpu, 
  Layers, 
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { ScriptConfig, ScriptLanguage } from '../types';
import { 
  generatePowerShellScript, 
  generatePythonScript, 
  generateBashScript, 
  generateRobocopyBatch,
  generatePythonTkinterGUI,
  generatePowerShellGUI
} from '../utils/scriptGenerators';

interface ScriptViewerProps {
  config: ScriptConfig;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({ config }) => {
  const [activeLang, setActiveLang] = useState<ScriptLanguage>('gui-python');
  const [copied, setCopied] = useState(false);

  // Get current script code
  const getScriptCode = (): { code: string; filename: string; ext: string } => {
    const startYear = config.startDate.slice(0, 4);
    const endYear = config.endDate.slice(0, 4);
    const baseName = `archive_files_${startYear}_${endYear}`;

    switch (activeLang) {
      case 'gui-python':
        return {
          code: generatePythonTkinterGUI(config),
          filename: `archive_gui_${startYear}_${endYear}.py`,
          ext: 'py'
        };
      case 'gui-powershell':
        return {
          code: generatePowerShellGUI(config),
          filename: `archive_gui_${startYear}_${endYear}.ps1`,
          ext: 'ps1'
        };
      case 'powershell':
        return {
          code: generatePowerShellScript(config),
          filename: `${baseName}.ps1`,
          ext: 'ps1'
        };
      case 'python':
        return {
          code: generatePythonScript(config),
          filename: `${baseName}.py`,
          ext: 'py'
        };
      case 'bash':
        return {
          code: generateBashScript(config),
          filename: `${baseName}.sh`,
          ext: 'sh'
        };
      case 'robocopy':
        return {
          code: generateRobocopyBatch(config),
          filename: `${baseName}_robocopy.bat`,
          ext: 'bat'
        };
    }
  };

  const { code, filename } = getScriptCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // Добавляем UTF-8 BOM (\uFEFF) — это критически важно для Windows PowerShell 5.1 и Блокнота,
    // иначе русский текст читается как ANSI/Windows-1251 (кракозябры "РЎРµС‚РµРІРѕР№")
    const blob = new Blob(['\uFEFF' + code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-5">
      {/* Header & Language Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Сгенерированный скрипт для сетевой папки
              </h2>
              <p className="text-xs text-slate-500">
                Выберите подходящий язык для вашей ОС и серверной инфраструктуры
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Copy & Download */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Скопировано!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Копировать код
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Скачать {filename}
          </button>
        </div>
      </div>

      {/* Language Selector Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveLang('gui-python')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-semibold transition-colors shrink-0 ${
            activeLang === 'gui-python'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-amber-500" />
          <span>GUI Приложение (Python Tkinter)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
            activeLang === 'gui-python' ? 'bg-blue-700 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            Графическое окно
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLang('gui-powershell')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-semibold transition-colors shrink-0 ${
            activeLang === 'gui-powershell'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-500" />
          <span>GUI Приложение (PowerShell WPF)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
            activeLang === 'gui-powershell' ? 'bg-blue-700 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            Windows GUI
          </span>
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => setActiveLang('powershell')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-semibold transition-colors shrink-0 ${
            activeLang === 'powershell'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>PowerShell CLI (.ps1)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            activeLang === 'powershell' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            Windows Server
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLang('python')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-semibold transition-colors shrink-0 ${
            activeLang === 'python'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Python CLI (.py)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            activeLang === 'python' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            Кроссплатформенный
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLang('bash')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-semibold transition-colors shrink-0 ${
            activeLang === 'bash'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Bash (.sh)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            activeLang === 'bash' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            Linux / Samba
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLang('robocopy')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-semibold transition-colors shrink-0 ${
            activeLang === 'robocopy'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Robocopy (.bat)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            activeLang === 'robocopy' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            Высокая скорость
          </span>
        </button>
      </div>

      {/* Code Display Area */}
      <div className="relative border border-slate-800 rounded-xl bg-slate-950 overflow-hidden shadow-inner">
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>{filename}</span>
          <span className="text-[11px] text-slate-500">UTF-8 • Строк: {code.split('\n').length}</span>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[480px] leading-relaxed select-all">
          <code>{code}</code>
        </pre>
      </div>

      {/* Deep-Dive: How Hierarchy Preservation Works */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
          <Layers className="w-4 h-4 text-blue-600" />
          Как технически гарантируется сохранение иерархии папок:
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">1. Вычисление подпути</span>
            <p className="text-[11px] leading-relaxed">
              Скрипт отсекает базовый путь источника от полного пути файла. Например, из{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">\\server\share\Отдел\2012\док.pdf</code>{' '}
              получается относительный путь <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">Отдел\2012\док.pdf</code>.
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">2. Автосоздание дерева</span>
            <p className="text-[11px] leading-relaxed">
              Перед перемещением создается полный путь каталога в архиве с помощью{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">New-Item -Directory -Force</code> или{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">os.makedirs(exist_ok=True)</code>.
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">3. Перемещение файла</span>
            <p className="text-[11px] leading-relaxed">
              Файл перемещается точно в созданную подпапку. Если в папке не было старых файлов, структура в источнике не нарушается.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
