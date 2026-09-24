import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Terminal, 
  Clock, 
  Server, 
  FileLock2, 
  CheckCircle2 
} from 'lucide-react';

export const BestPracticesGuide: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-5">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Рекомендации по запуску на серверах и сетевых хранилищах (SMB / NAS)
          </h2>
          <p className="text-xs text-slate-500">
            Чеклист системного администратора для безопасной миграции терабайтов данных
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Step 1 & 2 */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                1
              </span>
              Первый запуск: всегда в режиме Dry-Run
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Никогда не выполняйте массовый перенос сразу в боевом режиме. Оставьте включенным флаг{' '}
              <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono">$DryRun = $true</code>.
              Скрипт просканирует всю сетевую шару и сформирует подробный лог со списком подходящих файлов и их путей, ничего не меняя на диске.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                2
              </span>
              Права доступа (NTFS и SMB Permissions)
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Пользователь или сервисная учетная запись, под которой запускается скрипт, должна иметь:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] pl-1">
              <li><strong>В источнике:</strong> «Чтение» и «Удаление» (Read & Delete) для файлов.</li>
              <li><strong>В архиве:</strong> «Запись» и «Создание папок/файлов» (Write, Create Folders/Files).</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                3
              </span>
              Заблокированные сетевые файлы (Excel/Word)
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Если сотрудник прямо сейчас открыл файл в сети, операционная система блокирует его перемещение. В сгенерированном скрипте используется блок{' '}
              <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono">try &#123; Move-Item &#125; catch</code>,
              поэтому скрипт не прервется, а зафиксирует ошибку в логе и продолжит обработку остальных файлов.
            </p>
          </div>
        </div>

        {/* Step 3 & 4 */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                4
              </span>
              Как запустить PowerShell скрипт в Windows
            </div>
            <p className="text-slate-600 text-[11px]">
              Откройте PowerShell от имени Администратора и разрешите выполнение скрипта для текущей сессии:
            </p>
            <div className="bg-slate-950 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] space-y-1">
              <p className="text-slate-400"># 1. Разрешить запуск скрипта в текущем окне:</p>
              <p className="text-cyan-400">Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass</p>
              <p className="text-slate-400 mt-2"># 2. Запустить скрипт:</p>
              <p className="text-cyan-400">.\archive_files_2010_2016.ps1</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                5
              </span>
              Запуск по расписанию (Windows Task Scheduler)
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Для минимизации нагрузки на локальную сеть перенос больших архивов рекомендуется планировать на ночь или выходные дни:
            </p>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1 text-slate-700">
              <p><strong>Программа:</strong> powershell.exe</p>
              <p><strong>Аргументы:</strong> -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "C:\Scripts\archive_files_2010_2016.ps1"</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Длина путей Windows (&gt;260 символов)
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              При очень глубокой иерархии вложенных папок Windows может выдать ошибку длины пути <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">PathTooLongException</code>. 
              В скрипте используются современные командлеты с флагом <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">-LiteralPath</code>, либо рекомендуется активировать параметр реестра <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">LongPathsEnabled=1</code> в Windows Server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
