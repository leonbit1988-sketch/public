import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  Play, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Terminal, 
  Plus, 
  Layers, 
  Search,
  HardDrive,
  Trash2,
  CopyCheck,
  Files
} from 'lucide-react';
import { ScriptConfig, SimFile, SimLogEntry } from '../types';
import { INITIAL_SIM_FILES, formatFileSize, formatDate } from '../data/mockFileSystem';

interface SimulatorProps {
  config: ScriptConfig;
}

export const Simulator: React.FC<SimulatorProps> = ({ config }) => {
  const [files, setFiles] = useState<SimFile[]>(INITIAL_SIM_FILES);
  const [logs, setLogs] = useState<SimLogEntry[]>([
    {
      id: 'l-0',
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      level: 'info',
      message: `Симулятор инициализирован. Готов к проверке диапазона ${config.startDate} — ${config.endDate}.`
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeView, setActiveView] = useState<'both' | 'source' | 'dest'>('both');
  const [filterQuery, setFilterQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New file form
  const [newFileName, setNewFileName] = useState('Акт_приема_2014.pdf');
  const [newFileFolder, setNewFileFolder] = useState('Бухгалтерия/Акты');
  const [newFileDate, setNewFileDate] = useState('2014-05-15');

  // Check if a file matches the date range
  const matchesDate = (file: SimFile): boolean => {
    const dStr = config.dateField === 'ctime' ? file.createdDate : file.modifiedDate;
    const fileTime = new Date(dStr).getTime();
    const startTime = new Date(`${config.startDate}T00:00:00`).getTime();
    const endTime = new Date(`${config.endDate}T23:59:59`).getTime();
    
    // Check extension filter
    if (config.fileExtensions.trim()) {
      const allowed = config.fileExtensions.split(',').map(e => e.trim().toLowerCase().replace(/^\*\./, '.').replace(/^\*/, ''));
      const ext = '.' + file.extension.toLowerCase();
      if (!allowed.includes(ext) && !allowed.includes(file.extension.toLowerCase())) {
        return false;
      }
    }

    return fileTime >= startTime && fileTime <= endTime;
  };

  const addLog = (level: SimLogEntry['level'], message: string) => {
    const newEntry: SimLogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      level,
      message
    };
    setLogs(prev => [newEntry, ...prev].slice(0, 50));
  };

  // Dry run scan
  const handleScanDryRun = () => {
    setIsProcessing(true);
    // Очистка предыдущего лога и статусов перед новым поиском
    setLogs([]);
    addLog('info', `[НОВЫЙ ПОИСК] Начало сканирования: ${config.sourcePath}`);
    addLog('info', `[ФИЛЬТР ДАТ] ${config.startDate} по ${config.endDate} (предыдущие результаты очищены)`);
    if (config.checkDuplicates) {
      const modeText = config.duplicateMatchMode === 'hash' 
        ? 'Контрольная сумма SHA-256' 
        : config.duplicateMatchMode === 'name-and-size' 
          ? 'Имя + Размер файла' 
          : 'Только размер файла';
      addLog('info', `[ПОИСК ДУБЛИКАТОВ] Включен анализ дубликатов (критерий: ${modeText})`);
    }

    let matchCount = 0;
    let matchSize = 0;

    // Сначала определяем дубликаты среди файлов источника
    const duplicateMap = new Map<string, SimFile>();
    const dupCount = { total: 0 };

    const updated = files.map(f => {
      if (f.status === 'moved') return f;
      
      const isMatch = matchesDate(f);
      let isDuplicate = false;
      let duplicateOf: string | undefined = undefined;

      if (config.checkDuplicates) {
        let key = '';
        if (config.duplicateMatchMode === 'hash') {
          key = f.hash || `${f.name}_${f.size}`;
        } else if (config.duplicateMatchMode === 'name-and-size') {
          key = `${f.name.toLowerCase()}_${f.size}`;
        } else {
          key = `size_${f.size}`;
        }

        if (duplicateMap.has(key)) {
          isDuplicate = true;
          duplicateOf = duplicateMap.get(key)!.path;
          dupCount.total++;
        } else {
          duplicateMap.set(key, f);
        }
      }

      if (isMatch) {
        if (isDuplicate && !config.moveDuplicates) {
          addLog('warn', `[ПРОПУСК ДУБЛИКАТА] ${f.path} является копией ${duplicateOf} и пропущен согласно настройке (перенос дубликатов отключен).`);
          return { ...f, status: 'skipped' as const, isDuplicate, duplicateOf };
        }

        matchCount++;
        matchSize += f.size;
        const dupWarning = isDuplicate ? ` ⚠️ [ДУБЛИКАТ: ${duplicateOf}]` : '';
        addLog('action', `[ТЕСТ ПОДХОДИТ] ${f.path} (${formatDate(f.modifiedDate)}, ${formatFileSize(f.size)})${dupWarning} -> в архив ${config.destPath}/${f.path}`);
        return { ...f, status: 'matched' as const, isDuplicate, duplicateOf };
      }
      return { ...f, status: 'skipped' as const, isDuplicate, duplicateOf };
    });

    setFiles(updated);

    if (config.checkDuplicates) {
      if (dupCount.total > 0) {
        const actionNote = config.moveDuplicates 
          ? 'Они БУДУТ перенесены (галочка «Переносить дубликаты» активна).' 
          : 'Они НЕ будут перенесены (галочка «Переносить дубликаты» снята).';
        addLog('warn', `[ДУБЛИКАТЫ НАЙДЕНЫ] Обнаружено дубликатов файлов: ${dupCount.total} шт. ${actionNote}`);
      } else {
        addLog('success', `[ДУБЛИКАТЫ] Дубликатов файлов в сканируемой папке не обнаружено.`);
      }
    }

    addLog('success', `[ТЕСТ ЗАВЕРШЕН] Отобрано к переносу за ${config.startDate}—${config.endDate}: ${matchCount} файлов (${formatFileSize(matchSize)}). В тестовом режиме файлы не перемещались.`);
    setIsProcessing(false);
  };

  // Real move
  const handleExecuteMove = () => {
    setIsProcessing(true);
    addLog('info', `[ПЕРЕНОС] Старт перемещения файлов из ${config.sourcePath} в ${config.destPath}...`);

    let movedCount = 0;
    let movedSize = 0;
    let skippedDuplicatesCount = 0;

    const updated = files.map(f => {
      if (f.status === 'moved') return f;
      if (matchesDate(f)) {
        if (config.checkDuplicates && f.isDuplicate && !config.moveDuplicates) {
          skippedDuplicatesCount++;
          addLog('warn', `[ПРОПУЩЕН ДУБЛИКАТ] ${f.path} (оставлен в источнике, оригинал: ${f.duplicateOf})`);
          return f;
        }

        movedCount++;
        movedSize += f.size;
        const dupNote = f.isDuplicate ? ' (дубликат)' : '';
        addLog('success', `[OK] ${f.path}${dupNote} успешно перемещен с сохранением структуры каталога.`);
        return { ...f, status: 'moved' as const };
      }
      return f;
    });

    setFiles(updated);

    if (config.deleteEmptyDirs) {
      addLog('info', `[ОЧИСТКА] Проверка и очистка пустых подпапок в ${config.sourcePath}`);
    }

    const dupMsg = skippedDuplicatesCount > 0 ? ` (Пропущено дубликатов: ${skippedDuplicatesCount})` : '';
    addLog('success', `[ИТОГ] Перенос завершен! Успешно перемещено файлов: ${movedCount} (${formatFileSize(movedSize)})${dupMsg}. Иерархия папок в ${config.destPath} воссоздана.`);
    setIsProcessing(false);
  };

  // Find duplicates audit
  const handleFindDuplicates = () => {
    setIsProcessing(true);
    setLogs([]);
    addLog('info', `[ПОИСК ДУБЛИКАТОВ] Запущен глубокий аудит файлов в ${config.sourcePath}...`);

    const dupMap = new Map<string, SimFile>();
    let extraDups = 0;
    let wastedBytes = 0;

    const updated = files.map(f => {
      if (f.status === 'moved') return f;

      let key = '';
      if (config.duplicateMatchMode === 'hash') {
        key = f.hash || `${f.name}_${f.size}`;
      } else if (config.duplicateMatchMode === 'name-and-size') {
        key = `${f.name.toLowerCase()}_${f.size}`;
      } else {
        key = `size_${f.size}`;
      }

      if (dupMap.has(key)) {
        extraDups++;
        wastedBytes += f.size;
        const orig = dupMap.get(key)!;
        addLog('warn', `[ДУБЛИКАТ] ${f.path} (${formatFileSize(f.size)}) совпадает с оригиналом ${orig.path}`);
        return { ...f, isDuplicate: true, duplicateOf: orig.path };
      } else {
        dupMap.set(key, f);
        return { ...f, isDuplicate: false, duplicateOf: undefined };
      }
    });

    setFiles(updated);

    if (extraDups > 0) {
      addLog('warn', `[ИТОГИ АУДИТА] Найдено дубликатов: ${extraDups} шт. Лишний объем: ${formatFileSize(wastedBytes)}. Нажмите кнопку «Перенести дубликаты» для их архивации.`);
    } else {
      addLog('success', `[ИТОГИ АУДИТА] Дубликатов файлов в источнике не обнаружено.`);
    }

    setIsProcessing(false);
  };

  // Dedicated Move Duplicates Handler
  const handleMoveDuplicates = () => {
    setIsProcessing(true);
    addLog('info', `[ПЕРЕНОС ДУБЛИКАТОВ] Запуск перемещения дубликатов файлов в архив ${config.destPath}...`);

    const dupMap = new Map<string, SimFile>();

    // First detect duplicates
    const filesWithDups = files.map(f => {
      if (f.status === 'moved') return f;

      let key = '';
      if (config.duplicateMatchMode === 'hash') {
        key = f.hash || `${f.name}_${f.size}`;
      } else if (config.duplicateMatchMode === 'name-and-size') {
        key = `${f.name.toLowerCase()}_${f.size}`;
      } else {
        key = `size_${f.size}`;
      }

      if (dupMap.has(key)) {
        const orig = dupMap.get(key)!;
        return { ...f, isDuplicate: true, duplicateOf: orig.path };
      } else {
        dupMap.set(key, f);
        return { ...f, isDuplicate: false, duplicateOf: undefined };
      }
    });

    const duplicatesToMove = filesWithDups.filter(f => f.status !== 'moved' && f.isDuplicate);

    if (duplicatesToMove.length === 0) {
      addLog('info', `[ДУБЛИКАТЫ] В источнике нет неперемещенных дубликатов файлов.`);
      setIsProcessing(false);
      return;
    }

    let movedDupsCount = 0;
    let movedDupsSize = 0;

    const updated = filesWithDups.map(f => {
      if (f.status === 'moved') return f;
      if (f.isDuplicate) {
        movedDupsCount++;
        movedDupsSize += f.size;
        addLog('action', `[ПЕРЕНЕСЕН ДУБЛИКАТ] ${f.path} (копия ${f.duplicateOf}) -> ${config.destPath}/${f.path}`);
        return { ...f, status: 'moved' as const };
      }
      return f;
    });

    setFiles(updated);
    addLog('success', `[ИТОГ ПЕРЕНОСА] Успешно перемещено дубликатов: ${movedDupsCount} шт. (${formatFileSize(movedDupsSize)}). Оригиналы сохранены в источнике.`);
    setIsProcessing(false);
  };

  // Reset
  const handleReset = () => {
    setFiles(INITIAL_SIM_FILES);
    setLogs([{
      id: `l-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      level: 'info',
      message: 'Симулятор сброшен к исходному состоянию тестовой файловой системы.'
    }]);
  };

  // Add custom file
  const handleAddCustomFile = () => {
    if (!newFileName.trim()) return;
    const cleanFolder = newFileFolder.replace(/^\\+|^\/+|\\+$|\/+$/g, '');
    const cleanName = newFileName.trim();
    const fullPath = cleanFolder ? `${cleanFolder}/${cleanName}` : cleanName;
    const ext = cleanName.split('.').pop() || 'dat';

    const customFile: SimFile = {
      id: `custom-${Date.now()}`,
      name: cleanName,
      path: fullPath,
      size: Math.floor(Math.random() * 3000000) + 100000,
      modifiedDate: `${newFileDate}T12:00:00`,
      createdDate: `${newFileDate}T10:00:00`,
      extension: ext,
      status: 'initial'
    };

    setFiles(prev => [customFile, ...prev]);
    addLog('info', `Добавлен тестовый файл: ${fullPath} (дата: ${newFileDate})`);
    setShowAddModal(false);
  };

  // Source files (initial, matched, or skipped)
  const sourceFiles = files.filter(f => f.status !== 'moved');
  // Destination files (moved)
  const destFiles = files.filter(f => f.status === 'moved');

  // Stats
  const totalCount = files.length;
  const matchedCount = files.filter(f => matchesDate(f)).length;
  const movedCount = destFiles.length;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  // Count active duplicates in source files
  const activeDuplicatesCount = (() => {
    const dupMap = new Map<string, SimFile>();
    let count = 0;
    sourceFiles.forEach(f => {
      let key = config.duplicateMatchMode === 'hash'
        ? (f.hash || `${f.name}_${f.size}`)
        : config.duplicateMatchMode === 'name-and-size'
          ? `${f.name.toLowerCase()}_${f.size}`
          : `size_${f.size}`;
      if (dupMap.has(key)) {
        count++;
      } else {
        dupMap.set(key, f);
      }
    });
    return count;
  })();

  // Group files by folder
  const groupFilesByFolder = (fileList: SimFile[]) => {
    const groups: { [folder: string]: SimFile[] } = {};
    fileList.forEach(file => {
      const parts = file.path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '(Корень папки)';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(file);
    });
    return groups;
  };

  const sourceGroups = groupFilesByFolder(sourceFiles);
  const destGroups = groupFilesByFolder(destFiles);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-5">
      {/* Top Header & Simulator Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Интерактивный симулятор файловой структуры
              </h2>
              <p className="text-xs text-slate-500">
                Проверьте логику работы скрипта на виртуальной сетевой папке перед запуском на сервере
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleScanDryRun}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors shadow-xs cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-amber-600" />
            Тестовый скан (Dry-Run)
          </button>

          <button
            type="button"
            onClick={handleExecuteMove}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Выполнить перенос
          </button>

          <button
            type="button"
            onClick={handleFindDuplicates}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-xs cursor-pointer"
            title="Глубокий поиск одинаковых файлов в источнике без перемещения"
          >
            <Files className="w-3.5 h-3.5 text-indigo-600" />
            Найти дубликаты
          </button>

          <button
            type="button"
            onClick={handleMoveDuplicates}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs cursor-pointer"
            title="Найти и переместить только копии (дубликаты) файлов в архив"
          >
            <CopyCheck className="w-3.5 h-3.5" />
            <span>Перенести дубликаты</span>
            {activeDuplicatesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-[10px] font-bold">
                {activeDuplicatesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Свой файл
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Сбросить симуляцию"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-medium text-slate-500 block">Всего файлов</span>
          <span className="text-lg font-bold text-slate-900">{totalCount}</span>
          <span className="text-[10px] text-slate-400 block">{formatFileSize(totalSize)}</span>
        </div>

        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
          <span className="text-[11px] font-medium text-amber-800 block">Подходит ({config.startDate.slice(0,4)}–{config.endDate.slice(0,4)})</span>
          <span className="text-lg font-bold text-amber-900">{matchedCount}</span>
          <span className="text-[10px] text-amber-700 block">кандидаты в архив</span>
        </div>

        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
          <span className="text-[11px] font-medium text-emerald-800 block">Перемещено в архив</span>
          <span className="text-lg font-bold text-emerald-900">{movedCount}</span>
          <span className="text-[10px] text-emerald-700 block">иерархия сохранена</span>
        </div>

        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
          <span className="text-[11px] font-medium text-blue-800 block">Осталось в источнике</span>
          <span className="text-lg font-bold text-blue-900">{sourceFiles.length}</span>
          <span className="text-[10px] text-blue-700 block">файлы вне периода</span>
        </div>
      </div>

      {/* Duplicates Notification & Quick Action Banner */}
      {activeDuplicatesCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0">
              <CopyCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold block">
                В источнике обнаружено {activeDuplicatesCount} дубликатов файлов
              </span>
              <span className="text-indigo-700 text-[11px]">
                Вы можете переместить только эти копии в архивную папку отдельной операцией. Оригиналы файлов останутся на месте.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMoveDuplicates}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <CopyCheck className="w-3.5 h-3.5" />
            Перенести дубликаты ({activeDuplicatesCount})
          </button>
        </div>
      )}

      {/* Dual Column Network Tree Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Source Network Share */}
        <div className="border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col h-[380px]">
          <div className="p-3 border-b border-slate-200 bg-white rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="truncate">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Источник (Source): {config.sourcePath}
                </span>
                <span className="text-[10px] text-slate-500">
                  {sourceFiles.length} файлов в структуре
                </span>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 shrink-0">
              Исходный ресурс
            </span>
          </div>

          {/* Folder Tree Scrollable */}
          <div className="p-3 overflow-y-auto flex-1 space-y-3 font-mono text-xs">
            {Object.keys(sourceGroups).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-xs font-sans">Все файлы перемещены в архив.</p>
                {config.deleteEmptyDirs && (
                  <p className="text-[11px] font-sans text-slate-400">Пустые папки удалены.</p>
                )}
              </div>
            ) : (
              Object.entries(sourceGroups).map(([folderPath, groupFiles]) => (
                <div key={folderPath} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-semibold mb-2 text-xs">
                    <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                    <span className="truncate">{folderPath}</span>
                    <span className="text-[10px] font-normal text-slate-400 font-sans">({groupFiles.length})</span>
                  </div>

                  <div className="pl-4 space-y-1.5 border-l-2 border-slate-100">
                    {groupFiles.map(file => {
                      const isMatch = matchesDate(file);
                      return (
                        <div 
                          key={file.id} 
                          className={`flex items-center justify-between p-1.5 rounded text-[11px] transition-colors ${
                            isMatch 
                              ? 'bg-amber-50 border border-amber-200 text-amber-900 font-medium' 
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <FileText className={`w-3.5 h-3.5 shrink-0 ${isMatch ? 'text-amber-600' : 'text-slate-400'}`} />
                            <span className="truncate">{file.name}</span>
                            {file.isDuplicate && (
                              <span 
                                title={`Дубликат файла: ${file.duplicateOf}`} 
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] bg-red-100 text-red-700 font-bold border border-red-200 shrink-0"
                              >
                                <CopyCheck className="w-2.5 h-2.5" /> Дубликат
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2 font-sans text-[10px]">
                            <span className={`px-1.5 py-0.5 rounded font-mono ${
                              isMatch ? 'bg-amber-200 text-amber-900 font-bold' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {formatDate(file.modifiedDate)}
                            </span>
                            <span className="text-slate-400 hidden sm:inline">
                              {formatFileSize(file.size)}
                            </span>
                            {isMatch && (
                              <span className="text-[10px] text-amber-700 font-semibold">
                                Перенос →
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Destination Network Share */}
        <div className="border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col h-[380px]">
          <div className="p-3 border-b border-slate-200 bg-white rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FolderOutput className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Архив (Destination): {config.destPath}
                </span>
                <span className="text-[10px] text-slate-500">
                  {destFiles.length} файлов перемещено
                </span>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
              Целевой архив
            </span>
          </div>

          {/* Destination Tree Scrollable */}
          <div className="p-3 overflow-y-auto flex-1 space-y-3 font-mono text-xs">
            {destFiles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                <Folder className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-sans text-slate-600 font-medium">Архивная папка пуста</p>
                <p className="text-[11px] font-sans text-slate-400 max-w-xs mt-1">
                  Нажмите кнопку «Выполнить перенос», чтобы скрипт воссоздал иерархию подпапок и переместил файлы за {config.startDate.slice(0,4)}–{config.endDate.slice(0,4)} гг.
                </p>
              </div>
            ) : (
              Object.entries(destGroups).map(([folderPath, groupFiles]) => (
                <div key={folderPath} className="bg-white border border-emerald-200 rounded-lg p-2.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-semibold mb-2 text-xs">
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate">{folderPath}</span>
                    <span className="text-[10px] font-normal text-emerald-600 font-sans">
                      (воссоздано, {groupFiles.length} шт.)
                    </span>
                  </div>

                  <div className="pl-4 space-y-1.5 border-l-2 border-emerald-200">
                    {groupFiles.map(file => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between p-1.5 rounded text-[11px] bg-emerald-50/70 border border-emerald-100 text-emerald-900"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate font-medium">{file.name}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2 font-sans text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
                            {formatDate(file.modifiedDate)}
                          </span>
                          <span className="text-slate-500">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Real-time Console Log Output */}
      <div className="border border-slate-800 rounded-xl bg-slate-950 text-slate-200 overflow-hidden">
        <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono font-semibold text-slate-300">
              Терминал вывода работы скрипта (Console Output)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            Очистить лог
          </button>
        </div>

        <div className="p-3 font-mono text-xs h-36 overflow-y-auto space-y-1">
          {logs.length === 0 ? (
            <p className="text-slate-500 text-[11px]">Лог пуст. Выполните действие.</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="leading-tight flex items-start gap-2">
                <span className="text-slate-500 text-[10px] shrink-0">[{log.timestamp}]</span>
                <span className={
                  log.level === 'success' ? 'text-emerald-400' :
                  log.level === 'warn' ? 'text-amber-400' :
                  log.level === 'action' ? 'text-cyan-400' :
                  'text-slate-300'
                }>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal for adding custom file */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">Добавить тестовый файл</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Имя файла:</label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Отчет_2015.xlsx"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Подпапка в источнике:</label>
                <input
                  type="text"
                  value={newFileFolder}
                  onChange={(e) => setNewFileFolder(e.target.value)}
                  placeholder="Бухгалтерия/Акты"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Дата файла:</label>
                <input
                  type="date"
                  value={newFileDate}
                  onChange={(e) => setNewFileDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddCustomFile}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Добавить в дерево
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FolderOutput = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11l4 4m0 0l-4 4m4-4H8" />
  </svg>
);
