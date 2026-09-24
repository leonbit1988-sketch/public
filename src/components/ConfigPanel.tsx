import React from 'react';
import { 
  FolderInput, 
  FolderOutput, 
  Calendar, 
  Settings2, 
  AlertTriangle, 
  FileCheck2, 
  Clock,
  Trash2,
  FileText,
  RotateCcw,
  CopyCheck,
  Files
} from 'lucide-react';
import { ScriptConfig, DateFieldType, ConflictResolution, DuplicateMatchMode } from '../types';

interface ConfigPanelProps {
  config: ScriptConfig;
  onChange: (updated: Partial<ScriptConfig>) => void;
  onReset: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChange, onReset }) => {
  const applyPreset = (start: string, end: string) => {
    onChange({ startDate: start, endDate: end });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Параметры сетевого переноса</h2>
            <p className="text-xs text-slate-500">Настройте сетевые пути и критерии отбора файлов</p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Сбросить к значениям по умолчанию"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Сбросить
        </button>
      </div>

      {/* Network Paths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
            <FolderInput className="w-4 h-4 text-blue-600" />
            Исходная сетевая папка (Source):
          </label>
          <div className="relative">
            <input
              type="text"
              value={config.sourcePath}
              onChange={(e) => onChange({ sourcePath: e.target.value })}
              placeholder="\\fs01\PublicDocs\Department"
              className="w-full text-sm font-mono px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
            <span>Примеры:</span>
            <button 
              type="button"
              onClick={() => onChange({ sourcePath: '\\\\fileserver\\Share\\Docs' })}
              className="text-blue-600 hover:underline font-mono"
            >
              \\fileserver\Share\Docs
            </button>
            <span>|</span>
            <button 
              type="button"
              onClick={() => onChange({ sourcePath: '/mnt/storage/shared_docs' })}
              className="text-blue-600 hover:underline font-mono"
            >
              /mnt/storage/shared_docs
            </button>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
            <FolderOutput className="w-4 h-4 text-emerald-600" />
            Архивная сетевая папка (Destination):
          </label>
          <div className="relative">
            <input
              type="text"
              value={config.destPath}
              onChange={(e) => onChange({ destPath: e.target.value })}
              placeholder="\\fs01\Archive\2010_2016"
              className="w-full text-sm font-mono px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900 transition-colors"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Каталоги будут созданы автоматически с сохранением полного дерева подпапок.
          </p>
        </div>
      </div>

      {/* Date Range Section */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-800">Диапазон дат отбора файлов:</span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-slate-500 text-[11px]">Быстрый выбор:</span>
            <button
              type="button"
              onClick={() => applyPreset('2010-01-01', '2016-12-31')}
              className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                config.startDate === '2010-01-01' && config.endDate === '2016-12-31'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              2010 – 2016 (из запроса)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('2000-01-01', '2015-12-31')}
              className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                config.startDate === '2000-01-01' && config.endDate === '2015-12-31'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              2000 – 2015
            </button>
            <button
              type="button"
              onClick={() => applyPreset('2012-01-01', '2018-12-31')}
              className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                config.startDate === '2012-01-01' && config.endDate === '2018-12-31'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              2012 – 2018
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">С даты (включительно):</label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">По дату (включительно):</label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) => onChange({ endDate: e.target.value })}
              className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Атрибут даты файла:</label>
            <select
              value={config.dateField}
              onChange={(e) => onChange({ dateField: e.target.value as DateFieldType })}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              <option value="mtime">Дата изменения (LastWriteTime) — Рекомендуется</option>
              <option value="ctime">Дата создания (CreationTime)</option>
              <option value="atime">Дата последнего доступа (LastAccessTime)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Safety & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Toggles */}
        <div className="space-y-3 bg-slate-50/50 border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <ShieldIcon /> Безопасность и поведение
          </h3>

          {/* Dry Run Toggle */}
          <label className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
            config.dryRun 
              ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
              : 'bg-white border-slate-200 text-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={config.dryRun}
              onChange={(e) => onChange({ dryRun: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="text-xs">
              <span className="font-semibold block">Тестовый режим (Dry-Run / -WhatIf)</span>
              <span className="text-slate-500">
                Скрипт только сканирует и формирует отчет без реального перемещения файлов. Рекомендуется запускать в первый раз.
              </span>
            </div>
          </label>

          {/* Delete Empty Dirs */}
          <label className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.deleteEmptyDirs}
              onChange={(e) => onChange({ deleteEmptyDirs: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="text-xs">
              <span className="font-semibold block">Удалять опустевшие папки в источнике</span>
              <span className="text-slate-500">
                После переноса всех файлов удаляет оставшиеся пустые подпапки, сохраняя чистоту на шаре.
              </span>
            </div>
          </label>

          {/* Duplicate Detection Toggle */}
          <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-200/80 text-indigo-950 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.checkDuplicates}
                onChange={(e) => onChange({ checkDuplicates: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold block flex items-center gap-1.5 text-indigo-900">
                  <CopyCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Поиск дубликатов файлов при сканировании
                </span>
                <span className="text-indigo-700/80 text-[11px]">
                  Выявляет одинаковые файлы в разных сетевых папках и выводит подробный отчет.
                </span>
              </div>
            </label>

            {config.checkDuplicates && (
              <div className="pt-2 border-t border-indigo-200/60 pl-7 space-y-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-indigo-900 mb-1">
                    Метод сравнения дубликатов:
                  </label>
                  <select
                    value={config.duplicateMatchMode}
                    onChange={(e) => onChange({ duplicateMatchMode: e.target.value as DuplicateMatchMode })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-indigo-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  >
                    <option value="hash">Контрольная сумма SHA-256 (100% точное совпадение содержимого)</option>
                    <option value="name-and-size">Имя файла + Точный размер в байтах (быстро)</option>
                    <option value="size-only">Только размер файла (поиск переименованных копий)</option>
                  </select>
                </div>

                {/* Toggle: Перенос дубликатов */}
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.moveDuplicates}
                    onChange={(e) => onChange({ moveDuplicates: e.target.checked })}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-indigo-950 block">
                      Переносить дубликаты в архив
                    </span>
                    <span className="text-indigo-700/80 text-[10px] leading-tight block mt-0.5">
                      {config.moveDuplicates
                        ? 'Включено: найденные дубликаты будут перенесены вместе со всеми файлами за выбранный период.'
                        : 'Выключено: дубликаты будут пропущены и останутся в источнике (или вы можете удалить/проверить их отдельно).'}
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Conflict Mode */}
          <div className="pt-1">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Действие, если файл с таким именем уже есть в архиве:
            </label>
            <select
              value={config.conflictResolution}
              onChange={(e) => onChange({ conflictResolution: e.target.value as ConflictResolution })}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              <option value="skip">Пропустить файл (Skip) — Безопасно</option>
              <option value="rename">Переименовать файл, добавив дату-время (Rename)</option>
              <option value="overwrite">Перезаписать существующий файл (Overwrite)</option>
            </select>
          </div>
        </div>

        {/* Right: File Filters & Logging */}
        <div className="space-y-3 bg-slate-50/50 border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <FileCheck2 className="w-4 h-4 text-emerald-600" /> Фильтры файлов и лог-файл
          </h3>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Фильтр расширений (пусто = переносить все):
            </label>
            <input
              type="text"
              value={config.fileExtensions}
              onChange={(e) => onChange({ fileExtensions: e.target.value })}
              placeholder="Например: .xlsx, .pdf, .docx, .dwg"
              className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Исключаемые системные имена / маски:
            </label>
            <input
              type="text"
              value={config.excludePatterns}
              onChange={(e) => onChange({ excludePatterns: e.target.value })}
              placeholder="thumbs.db, desktop.ini, ~$*"
              className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Путь к файлу подробного отчета (лог):
              </label>
              <label className="text-[11px] text-slate-500 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enableLogging}
                  onChange={(e) => onChange({ enableLogging: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                Запись лога
              </label>
            </div>
            <input
              type="text"
              value={config.logFilePath}
              onChange={(e) => onChange({ logFilePath: e.target.value })}
              disabled={!config.enableLogging}
              className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                config.enableLogging ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ShieldIcon = () => (
  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
