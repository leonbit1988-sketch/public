import { ScriptConfig } from '../types';

export function generatePowerShellScript(config: ScriptConfig): string {
  const dateProp = config.dateField === 'mtime' 
    ? 'LastWriteTime' 
    : config.dateField === 'ctime' 
      ? 'CreationTime' 
      : 'LastAccessTime';

  const datePropRu = config.dateField === 'mtime' 
    ? 'дате изменения (LastWriteTime)' 
    : config.dateField === 'ctime' 
      ? 'дате создания (CreationTime)' 
      : 'дате доступа (LastAccessTime)';

  const dryRunParam = config.dryRun ? '$true' : '$false';
  const cleanDirsParam = config.deleteEmptyDirs ? '$true' : '$false';
  const logParam = config.enableLogging ? '$true' : '$false';

  const extFilters = config.fileExtensions.trim()
    ? config.fileExtensions.split(',').map(e => `'${e.trim().replace(/^\*\./, '.').replace(/^\*/, '')}'`).join(', ')
    : '@()';

  const excludePatterns = config.excludePatterns.trim()
    ? config.excludePatterns.split(',').map(e => `'${e.trim()}'`).join(', ')
    : "@('thumbs.db', 'desktop.ini', '~$*')";

  return `<#
================================================================================
Скрипт: Перенос старых файлов по диапазону дат с сохранением структуры каталогов
Назначение: Сканирует сетевую папку (UNC), отбирает файлы за ${config.startDate} — ${config.endDate}
и перемещает их в архивную сетевую папку, в точности воссоздавая иерархию папок.
Фильтрация: по ${datePropRu}
Режим: ${config.dryRun ? 'ТЕСТОВЫЙ (Dry-Run / -WhatIf) — файлы НЕ перемещаются' : 'БОЕВОЙ — файлы перемещаются'}
================================================================================
#>

# 1. ОСНОВНЫЕ ПАРАМЕТРЫ
$SourcePath  = '${config.sourcePath}'
$DestPath    = '${config.destPath}'
$StartDate   = [DateTime]'${config.startDate} 00:00:00'
$EndDate     = [DateTime]'${config.endDate} 23:59:59'

# 2. ОПЦИИ И ПОВЕДЕНИЕ
$DryRun           = ${dryRunParam}     # $true - только симуляция и отчет, $false - реальное перемещение
$DeleteEmptyDirs  = ${cleanDirsParam}     # Удалять ли пустые исходные папки после переноса
$EnableLog        = ${logParam}     # Записывать ли лог в файл
$LogFilePath      = '${config.logFilePath}'
$ConflictMode     = '${config.conflictResolution}' # 'skip' (пропустить), 'overwrite' (заменить), 'rename' (переименовать)
$CheckDuplicates  = ${config.checkDuplicates ? '$true' : '$false'} # Проверять и логировать дубликаты файлов (SHA256)
$MoveDuplicates   = ${config.moveDuplicates ? '$true' : '$false'} # Переносить дубликаты ($false = оставлять дубликаты в источнике)

# Фильтры расширений (пустой массив = все файлы)
$AllowedExtensions = ${extFilters}
$ExcludePatterns   = ${excludePatterns}

# -----------------------------------------------------------------------------
# Функция вывода и логирования
# -----------------------------------------------------------------------------
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('INFO', 'WARN', 'ERROR', 'SUCCESS', 'DRYRUN')]
        [string]$Level = 'INFO'
    )
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logLine = "[$timestamp] [$Level] $Message"

    switch ($Level) {
        'INFO'    { Write-Host $logLine -ForegroundColor Gray }
        'WARN'    { Write-Host $logLine -ForegroundColor Yellow }
        'ERROR'   { Write-Host $logLine -ForegroundColor Red }
        'SUCCESS' { Write-Host $logLine -ForegroundColor Green }
        'DRYRUN'  { Write-Host $logLine -ForegroundColor Cyan }
    }

    if ($EnableLog) {
        try {
            $logDir = Split-Path -Path $LogFilePath -Parent
            if ($logDir -and -not (Test-Path -LiteralPath $logDir)) {
                New-Item -ItemType Directory -Path $logDir -Force | Out-Null
            }
            Add-Content -LiteralPath $LogFilePath -Value $logLine -Encoding UTF8
        } catch {
            Write-Host "Не удалось записать в лог: $_" -ForegroundColor Red
        }
    }
}

# -----------------------------------------------------------------------------
# Проверка сетевых путей
# -----------------------------------------------------------------------------
Write-Log "Старт сканирования сетевой папки..." "INFO"
Write-Log "Источник: $SourcePath" "INFO"
Write-Log "Назначение: $DestPath" "INFO"
Write-Log "Диапазон дат: $($StartDate.ToString('dd.MM.yyyy')) — $($EndDate.ToString('dd.MM.yyyy'))" "INFO"
if ($DryRun) {
    Write-Log "ВНИМАНИЕ: Включен тестовый режим (Dry-Run). Файлы перемещены НЕ будут." "WARN"
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
    Write-Log "КРИТИЧЕСКАЯ ОШИБКА: Исходная папка '$SourcePath' недоступна или нет прав доступа!" "ERROR"
    exit 1
}

if (-not (Test-Path -LiteralPath $DestPath) -and -not $DryRun) {
    Write-Log "Целевая папка не существует. Создание: $DestPath" "INFO"
    New-Item -ItemType Directory -Path $DestPath -Force | Out-Null
}

# Нормализуем путь источника для корректного среза относительного пути
$sourceNormalized = (Resolve-Path -LiteralPath $SourcePath).Path.TrimEnd('\\', '/')

# -----------------------------------------------------------------------------
# Сканирование и обработка файлов
# -----------------------------------------------------------------------------
$scannedCount = 0
$matchedCount = 0
$movedCount   = 0
$skippedCount = 0
$errorCount   = 0
$totalBytes   = 0
$duplicateCount = 0
$seenFileHashes = @{}

# Используем Get-ChildItem -File -Recurse для обхода сетевой иерархии
$files = Get-ChildItem -LiteralPath $SourcePath -File -Recurse -Force -ErrorAction SilentlyContinue

foreach ($file in $files) {
    $scannedCount++
    
    # 1. Проверка исключений (системные/временные файлы)
    $skipFile = $false
    foreach ($pattern in $ExcludePatterns) {
        if ($file.Name -like $pattern) {
            $skipFile = $true
            break
        }
    }
    if ($skipFile) { continue }

    # 2. Фильтр по разрешенным расширениям (если задан)
    if ($AllowedExtensions.Count -gt 0) {
        if ($AllowedExtensions -notcontains $file.Extension.ToLower()) {
            continue
        }
    }

    # 3. Фильтрация по выбранной дате
    $fileDate = $file.${dateProp}
    if ($fileDate -ge $StartDate -and $fileDate -le $EndDate) {
        $matchedCount++
        $totalBytes += $file.Length

        # Вычисляем относительный путь для сохранения структуры папок
        $fullPath = $file.FullName
        $relativePath = $fullPath.Substring($sourceNormalized.Length).TrimStart('\\', '/')
        $targetFilePath = Join-Path -Path $DestPath -ChildPath $relativePath
        $targetDirectory = Split-Path -Path $targetFilePath -Parent

        $dupLogMsg = ""
        $isDuplicateFile = $false
        if ($CheckDuplicates) {
            try {
                $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256 -ErrorAction Stop).Hash
                if ($seenFileHashes.ContainsKey($hash)) {
                    $duplicateCount++
                    $isDuplicateFile = $true
                    $dupLogMsg = " [⚠️ ДУБЛИКАТ файла $($seenFileHashes[$hash])]"
                    Write-Log "Найден дубликат: $relativePath совпадает с $($seenFileHashes[$hash])" "WARN"
                } else {
                    $seenFileHashes[$hash] = $relativePath
                }
            } catch {}
        }

        Write-Log "Найден файл ($($fileDate.ToString('yyyy-MM-dd'))): $relativePath$dupLogMsg" "INFO"

        if ($CheckDuplicates -and $isDuplicateFile -and (-not $MoveDuplicates)) {
            Write-Log "Пропуск перемещения дубликата '$relativePath' (оставлен в источнике, оригинал: $($seenFileHashes[$hash]))" "WARN"
            continue
        }

        if ($DryRun) {
            Write-Log "[ТЕСТ] Будет перемещен в -> $targetFilePath" "DRYRUN"
            continue
        }

        # Создаем целевую директорию, сохраняя иерархию папок
        try {
            if (-not (Test-Path -LiteralPath $targetDirectory)) {
                New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
            }

            # Обработка конфликта (если файл уже существует в назначении)
            $destinationExists = Test-Path -LiteralPath $targetFilePath
            if ($destinationExists) {
                switch ($ConflictMode) {
                    'skip' {
                        Write-Log "Файл уже есть в архиве. Пропуск: $relativePath" "WARN"
                        $skippedCount++
                        continue
                    }
                    'rename' {
                        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($targetFilePath)
                        $ext = [System.IO.Path]::GetExtension($targetFilePath)
                        $timestampSuffix = Get-Date -Format 'yyyyMMdd_HHmmss'
                        $targetFilePath = Join-Path -Path $targetDirectory -ChildPath "\${baseName}_\${timestampSuffix}\${ext}"
                        Write-Log "Переименование из-за совпадения -> $targetFilePath" "WARN"
                    }
                    'overwrite' {
                        Write-Log "Перезапись существующего файла: $targetFilePath" "WARN"
                    }
                }
            }

            # Перемещение файла с сохранением иерархии
            Move-Item -LiteralPath $fullPath -Destination $targetFilePath -Force
            $movedCount++
            Write-Log "УСПЕШНО ПЕРЕМЕЩЕН -> $targetFilePath" "SUCCESS"

        } catch {
            $errorCount++
            Write-Log "ОШИБКА перемещения '$relativePath': $_" "ERROR"
        }
    }
}

# -----------------------------------------------------------------------------
# Удаление пустых папок в источнике (опционально)
# -----------------------------------------------------------------------------
if ($DeleteEmptyDirs -and -not $DryRun) {
    Write-Log "Очистка оставшихся пустых каталогов в источнике..." "INFO"
    $emptyDirs = Get-ChildItem -LiteralPath $SourcePath -Directory -Recurse | 
                 Sort-Object -Property { $_.FullName.Length } -Descending

    foreach ($dir in $emptyDirs) {
        $hasItems = (Get-ChildItem -LiteralPath $dir.FullName -Force | Measure-Object).Count -gt 0
        if (-not $hasItems) {
            try {
                Remove-Item -LiteralPath $dir.FullName -Force
                Write-Log "Удалена пустая папка: $($dir.FullName)" "INFO"
            } catch {
                Write-Log "Не удалось удалить папку $($dir.FullName): $_" "WARN"
            }
        }
    }
}

# -----------------------------------------------------------------------------
# ИТОГОВЫЙ ОТЧЕТ
# -----------------------------------------------------------------------------
$mbTotal = [math]::Round($totalBytes / 1MB, 2)
Write-Log "================ ИТОГИ РАБОТЫ ================" "INFO"
Write-Log "Просканировано файлов : $scannedCount" "INFO"
Write-Log "Подходит под фильтр   : $matchedCount (Объем: $mbTotal МБ)" "INFO"
if ($CheckDuplicates) {
    Write-Log "Найдено дубликатов    : $duplicateCount" $(if ($duplicateCount -gt 0) { 'WARN' } else { 'SUCCESS' })
}
if (-not $DryRun) {
    Write-Log "Успешно перемещено    : $movedCount" "SUCCESS"
    Write-Log "Пропущено (конфликты) : $skippedCount" "WARN"
    Write-Log "Ошибок               : $errorCount" $(if ($errorCount -gt 0) { 'ERROR' } else { 'SUCCESS' })
} else {
    Write-Log "Режим тестирования. Для реального перемещения установите $DryRun = $false" "DRYRUN"
}
Write-Log "Работа скрипта завершена." "INFO"
`;
}

export function generatePythonScript(config: ScriptConfig): string {
  const statDateAttr = config.dateField === 'mtime' 
    ? 'st_mtime' 
    : config.dateField === 'ctime' 
      ? 'st_ctime' 
      : 'st_atime';

  const dryRunBool = config.dryRun ? 'True' : 'False';
  const cleanDirsBool = config.deleteEmptyDirs ? 'True' : 'False';
  const logBool = config.enableLogging ? 'True' : 'False';

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт переноса файлов по диапазону дат (${config.startDate} - ${config.endDate})
с сохранением иерархии папок между сетевыми ресурсами (SMB/UNC или локальными).
Кроссплатформенный (Windows, Linux, macOS).
"""

import os
import sys
import shutil
import hashlib
import logging
from datetime import datetime
from pathlib import Path

# ==========================================
# 1. НАСТРОЙКИ СКРИПТА
# ==========================================
SOURCE_DIR = r"${config.sourcePath}"
DEST_DIR   = r"${config.destPath}"

START_DATE = datetime.strptime("${config.startDate} 00:00:00", "%Y-%m-%d %H:%M:%S")
END_DATE   = datetime.strptime("${config.endDate} 23:59:59", "%Y-%m-%d %H:%M:%S")

# Режим: True = симуляция (без перемещения), False = реальный перенос
DRY_RUN = ${dryRunBool}

# Очищать пустые каталоги в источнике после переноса
DELETE_EMPTY_DIRS = ${cleanDirsBool}

# Проверка дубликатов файлов (SHA-256)
CHECK_DUPLICATES = ${config.checkDuplicates ? 'True' : 'False'}

# Перемещать дубликаты (False = оставлять дубликаты в источнике)
MOVE_DUPLICATES = ${config.moveDuplicates ? 'True' : 'False'}

# Разрешенные расширения (пустой список = все файлы)
ALLOWED_EXTENSIONS = [${config.fileExtensions.trim() ? config.fileExtensions.split(',').map(e => `"${e.trim().toLowerCase().replace(/^\*/, '')}"`).join(', ') : ''}]

# Исключения (имена файлов или маски)
EXCLUDE_NAMES = {"thumbs.db", "desktop.ini", ".ds_store"}

# Политика при совпадении имен в архиве: "skip", "overwrite", "rename"
CONFLICT_MODE = "${config.conflictResolution}"

ENABLE_LOGGING = ${logBool}
LOG_FILE = r"${config.logFilePath}"


# ==========================================
# 2. НАСТРОЙКА ЛОГИРОВАНИЯ
# ==========================================
handlers = [logging.StreamHandler(sys.stdout)]
if ENABLE_LOGGING:
    log_path = Path(LOG_FILE)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    handlers.append(logging.FileHandler(LOG_FILE, encoding="utf-8"))

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=handlers
)
logger = logging.getLogger("FileArchiver")


def calculate_file_hash(filepath: str, block_size: int = 65536) -> str:
    """Вычисляет хэш SHA-256 файла для поиска дубликатов."""
    sha = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(block_size), b""):
                sha.update(chunk)
        return sha.hexdigest()
    except Exception:
        return ""


def clean_empty_directories(root_dir: str):
    """Рекурсивно удаляет пустые папки в источнике снизу вверх."""
    for root, dirs, files in os.walk(root_dir, topdown=False):
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            try:
                if not os.listdir(dir_path):
                    os.rmdir(dir_path)
                    logger.info(f"Удалена пустая папка: {dir_path}")
            except Exception as e:
                logger.warning(f"Не удалось удалить {dir_path}: {e}")


def main():
    logger.info("=== Запуск сканирования сетевой папки ===")
    logger.info(f"Источник: {SOURCE_DIR}")
    logger.info(f"Назначение: {DEST_DIR}")
    logger.info(f"Диапазон дат: {START_DATE.strftime('%d.%m.%Y')} — {END_DATE.strftime('%d.%m.%Y')}")
    if DRY_RUN:
        logger.warning("ВНИМАНИЕ: Включен тестовый режим DRY_RUN. Файлы НЕ будут перемещены!")

    src_path = Path(SOURCE_DIR)
    dst_path = Path(DEST_DIR)

    if not src_path.exists():
        logger.error(f"Исходная папка '{SOURCE_DIR}' не существует или недоступна!")
        sys.exit(1)

    if not DRY_RUN:
        dst_path.mkdir(parents=True, exist_ok=True)

    scanned_count = 0
    matched_count = 0
    moved_count = 0
    skipped_count = 0
    error_count = 0
    total_bytes = 0
    dup_count = 0
    seen_hashes = {}

    # Обходим всё дерево каталогов источника
    for root, _, files in os.walk(SOURCE_DIR):
        for filename in files:
            scanned_count += 1
            lower_name = filename.lower()

            # Исключения
            if lower_name in EXCLUDE_NAMES or lower_name.startswith("~$"):
                continue

            # Фильтр расширений
            if ALLOWED_EXTENSIONS:
                ext = Path(filename).suffix.lower()
                if ext not in ALLOWED_EXTENSIONS:
                    continue

            file_full_path = os.path.join(root, filename)

            try:
                file_stat = os.stat(file_full_path)
                file_date = datetime.fromtimestamp(file_stat.${statDateAttr})
            except Exception as err:
                logger.warning(f"Не удалось прочитать атрибуты {file_full_path}: {err}")
                continue

            # Проверка диапазона дат
            if START_DATE <= file_date <= END_DATE:
                matched_count += 1
                file_size = file_stat.st_size
                total_bytes += file_size

                # Вычисляем относительный путь для сохранения структуры папок
                rel_path = os.path.relpath(file_full_path, SOURCE_DIR)
                target_file_path = os.path.join(DEST_DIR, rel_path)
                target_dir = os.path.dirname(target_file_path)

                dup_notice = ""
                is_duplicate = False
                if CHECK_DUPLICATES:
                    f_hash = calculate_file_hash(file_full_path)
                    if f_hash:
                        if f_hash in seen_hashes:
                            dup_count += 1
                            is_duplicate = True
                            dup_notice = f" [⚠️ ДУБЛИКАТ файла {seen_hashes[f_hash]}]"
                            logger.warning(f"  Обнаружен дубликат: {rel_path} идентичен {seen_hashes[f_hash]}")
                        else:
                            seen_hashes[f_hash] = rel_path

                logger.info(f"Найден файл [{file_date.strftime('%Y-%m-%d')}]: {rel_path}{dup_notice} ({file_size / 1024:.1f} KB)")

                if CHECK_DUPLICATES and is_duplicate and not MOVE_DUPLICATES:
                    logger.warning(f"  Пропуск перемещения дубликата: {rel_path} (оставлен в источнике, оригинал: {seen_hashes[f_hash]})")
                    continue

                if DRY_RUN:
                    logger.info(f"  [DRY-RUN] -> будет перемещен в {target_file_path}")
                    continue

                try:
                    # Создаем родительскую структуру папок в архиве
                    os.makedirs(target_dir, exist_ok=True)

                    # Проверка коллизии имен
                    if os.path.exists(target_file_path):
                        if CONFLICT_MODE == "skip":
                            logger.warning(f"  Файл уже есть в назначении. Пропуск: {rel_path}")
                            skipped_count += 1
                            continue
                        elif CONFLICT_MODE == "rename":
                            stem = Path(filename).stem
                            suffix = Path(filename).suffix
                            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            target_file_path = os.path.join(target_dir, f"{stem}_{stamp}{suffix}")
                            logger.warning(f"  Файл переименован -> {target_file_path}")

                    # Безопасное перемещение
                    shutil.move(file_full_path, target_file_path)
                    moved_count += 1
                    logger.info(f"  УСПЕШНО перемещен -> {target_file_path}")

                except Exception as e:
                    error_count += 1
                    logger.error(f"  ОШИБКА переноса {rel_path}: {e}")

    # Очистка пустых папок
    if DELETE_EMPTY_DIRS and not DRY_RUN:
        logger.info("Проверка и очистка пустых папок в источнике...")
        clean_empty_directories(SOURCE_DIR)

    # Итоги
    logger.info("============== ИТОГИ ==============")
    logger.info(f"Просканировано файлов : {scanned_count}")
    logger.info(f"Найдено по дате      : {matched_count} ({total_bytes / (1024*1024):.2f} MB)")
    if CHECK_DUPLICATES:
        logger.info(f"Найдено дубликатов   : {dup_count}")
    if not DRY_RUN:
        logger.info(f"Перемещено успешно   : {moved_count}")
        logger.info(f"Пропущено коллизий   : {skipped_count}")
        logger.info(f"Ошибок               : {error_count}")
    else:
        logger.info("Для выполнения перемещения измените DRY_RUN = False")
    logger.info("Скрипт завершил работу.")


if __name__ == "__main__":
    main()
`;
}

export function generateBashScript(config: ScriptConfig): string {
  const dryRunParam = config.dryRun ? 'true' : 'false';
  const cleanDirs = config.deleteEmptyDirs ? 'true' : 'false';

  return `#!/usr/bin/env bash
# ==============================================================================
# Скрипт переноса файлов по дате с сохранением иерархии папок (Linux / Samba / NFS)
# Диапазон: ${config.startDate} — ${config.endDate}
# ==============================================================================

set -euo pipefail

SOURCE_DIR="${config.sourcePath.replace(/\\/g, '/')}"
DEST_DIR="${config.destPath.replace(/\\/g, '/')}"

START_DATE="${config.startDate} 00:00:00"
END_DATE="${config.endDate} 23:59:59"

DRY_RUN=${dryRunParam}
DELETE_EMPTY_DIRS=${cleanDirs}
LOG_FILE="${config.logFilePath.replace(/\\/g, '/')}"

log() {
    local level="$1"
    local msg="$2"
    local timestamp
    timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] [$level] $msg"
    if [ -n "$LOG_FILE" ]; then
        mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
        echo "[$timestamp] [$level] $msg" >> "$LOG_FILE"
    fi
}

log "INFO" "Старт сканирования: $SOURCE_DIR -> $DEST_DIR"
log "INFO" "Диапазон дат: $START_DATE по $END_DATE"

if [ ! -d "$SOURCE_DIR" ]; then
    log "ERROR" "Исходная директория $SOURCE_DIR не найдена!"
    exit 1
fi

if [ "$DRY_RUN" = "false" ]; then
    mkdir -p "$DEST_DIR"
fi

scanned=0
matched=0
moved=0

# Используем find с точным фильтром дат изменения (-newermt)
while IFS= read -r -d '' file_path; do
    scanned=$((scanned + 1))
    matched=$((matched + 1))

    # Вычисляем относительный путь
    rel_path="\${file_path#$SOURCE_DIR/}"
    target_path="$DEST_DIR/$rel_path"
    target_dir="$(dirname "$target_path")"

    log "INFO" "Найден: $rel_path"

    if [ "$DRY_RUN" = "true" ]; then
        log "DRYRUN" "Будет перемещен в: $target_path"
    else
        mkdir -p "$target_dir"
        if mv -n "$file_path" "$target_path"; then
            moved=$((moved + 1))
            log "SUCCESS" "Перемещен -> $target_path"
        else
            log "ERROR" "Ошибка перемещения: $file_path"
        fi
    fi
done < <(find "$SOURCE_DIR" -type f -newermt "$START_DATE" ! -newermt "$END_DATE" -print0)

# Очистка пустых папок в источнике
if [ "$DELETE_EMPTY_DIRS" = "true" ] && [ "$DRY_RUN" = "false" ]; then
    log "INFO" "Очистка пустых директорий в источнике..."
    find "$SOURCE_DIR" -mindepth 1 -type d -empty -delete || true
fi

log "INFO" "Завершено. Найдено подходящих файлов: $matched"
if [ "$DRY_RUN" = "true" ]; then
    log "INFO" "Для реального переноса установите DRY_RUN=false"
else
    log "INFO" "Успешно перемещено файлов: $moved"
fi
`;
}

export function generateRobocopyBatch(config: ScriptConfig): string {
  // Calculate date min/max for Robocopy
  // Robocopy /MAXAGE:YYYYMMDD (excludes files OLDER than this date -> keeps files newer or equal)
  // Robocopy /MINAGE:YYYYMMDD (excludes files NEWER than this date -> keeps files older or equal)
  const startCompact = config.startDate.replace(/-/g, '');
  const endCompact = config.endDate.replace(/-/g, '');
  const dryFlag = config.dryRun ? '/L ' : '';

  return `:: ============================================================================
:: Robocopy — высокоскоростная утилита Windows для сетевых шар
:: Перенос файлов за ${config.startDate} - ${config.endDate} с сохранением иерархии
:: ============================================================================
@echo off
chcp 65001 >nul
set "SOURCE=${config.sourcePath}"
set "DEST=${config.destPath}"

echo [ИНФО] Запуск Robocopy переноса...
echo [ИНФО] Источник: %SOURCE%
echo [ИНФО] Назначение: %DEST%
${config.dryRun ? 'echo [ВНИМАНИЕ] Режим /L (Тестовый прогон). Файлы НЕ будут перемещены!\necho.' : 'echo.'}

:: Ключи Robocopy:
:: /E        - копировать подпапки, включая пустые
:: /MOVE     - переместить файлы и папки (удаляет из источника после копирования)
:: /MAXAGE   - максимальный возраст (исключить файлы старше даты: ${startCompact})
:: /MINAGE   - минимальный возраст (исключить файлы новее даты: ${endCompact})
:: /MT:16    - многопоточность (16 потоков для быстрой работы по сети SMB)
:: /R:3 /W:5 - 3 попытки с паузой 5 секунд при блокировке файлов
:: /NP /NDL  - оптимизация вывода
${config.dryRun ? ':: /L       - режим симуляции (Dry-Run)' : ''}

robocopy "%SOURCE%" "%DEST%" *.* /E /MOVE ${dryFlag}/MAXAGE:${startCompact} /MINAGE:${endCompact} /MT:16 /R:3 /W:5 /LOG:"${config.logFilePath}" /TEE

echo.
echo [ГОТОВО] Работа Robocopy завершена. Отчет сохранен в ${config.logFilePath}
pause
`;
}

export function generatePythonTkinterGUI(config: ScriptConfig): string {
  const statDateAttr = config.dateField === 'mtime' 
    ? 'st_mtime' 
    : config.dateField === 'ctime' 
      ? 'st_ctime' 
      : 'st_atime';

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Графическое приложение (GUI Tkinter) для переноса старых файлов
по диапазону дат (по умолчанию 2010–2016 гг.) с сохранением иерархии папок.
Работает на Windows, Linux и macOS без установки сторонних библиотек.
"""

import os
import sys
import shutil
import hashlib
import threading
from datetime import datetime
from collections import defaultdict
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext

class NetworkFileArchiverGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Архиватор файлов по дате с сохранением иерархии (GUI)")
        self.root.geometry("860x680")
        self.root.minsize(780, 580)

        # Стили
        self.style = ttk.Style()
        self.style.theme_use('clam')

        self.is_running = False

        self._build_ui()

    def _build_ui(self):
        main_frame = ttk.Frame(self.root, padding="12 12 12 12")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # 1. Заголовок
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 10))

        title_lbl = ttk.Label(
            header_frame, 
            text="Сетевой архиватор файлов с сохранением структуры каталогов", 
            font=("Segoe UI", 12, "bold")
        )
        title_lbl.pack(anchor=tk.W)

        subtitle_lbl = ttk.Label(
            header_frame, 
            text="Сканирование папки, отбор файлов за период (напр. 2010–2016) и перенос с сохранением дерева папок", 
            font=("Segoe UI", 9)
        )
        subtitle_lbl.pack(anchor=tk.W)

        # 2. Блок путей
        paths_group = ttk.LabelFrame(main_frame, text=" Сетевые или локальные папки ", padding="10")
        paths_group.pack(fill=tk.X, pady=(0, 10))

        # Исходная папка
        ttk.Label(paths_group, text="Исходная папка (Source):").grid(row=0, column=0, sticky=tk.W, pady=3)
        self.src_var = tk.StringVar(value=r"${config.sourcePath}")
        src_entry = ttk.Entry(paths_group, textvariable=self.src_var, width=58)
        src_entry.grid(row=0, column=1, sticky=tk.EW, padx=6, pady=3)
        ttk.Button(paths_group, text="Обзор...", command=self.browse_source).grid(row=0, column=2, padx=2)

        # Папка назначения
        ttk.Label(paths_group, text="Архивная папка (Destination):").grid(row=1, column=0, sticky=tk.W, pady=3)
        self.dst_var = tk.StringVar(value=r"${config.destPath}")
        dst_entry = ttk.Entry(paths_group, textvariable=self.dst_var, width=58)
        dst_entry.grid(row=1, column=1, sticky=tk.EW, padx=6, pady=3)
        ttk.Button(paths_group, text="Обзор...", command=self.browse_dest).grid(row=1, column=2, padx=2)

        paths_group.columnconfigure(1, weight=1)

        # 3. Блок параметров даты и фильтров
        params_group = ttk.LabelFrame(main_frame, text=" Критерии поиска и фильтрации ", padding="10")
        params_group.pack(fill=tk.X, pady=(0, 10))

        # Даты
        ttk.Label(params_group, text="С даты (ГГГГ-ММ-ДД):").grid(row=0, column=0, sticky=tk.W, pady=3)
        self.start_date_var = tk.StringVar(value="${config.startDate}")
        ttk.Entry(params_group, textvariable=self.start_date_var, width=14).grid(row=0, column=1, sticky=tk.W, padx=6, pady=3)

        ttk.Label(params_group, text="По дату (ГГГГ-ММ-ДД):").grid(row=0, column=2, sticky=tk.W, padx=(12, 0), pady=3)
        self.end_date_var = tk.StringVar(value="${config.endDate}")
        ttk.Entry(params_group, textvariable=self.end_date_var, width=14).grid(row=0, column=3, sticky=tk.W, padx=6, pady=3)

        # Быстрые пресеты
        preset_frame = ttk.Frame(params_group)
        preset_frame.grid(row=0, column=4, sticky=tk.E, padx=6)
        ttk.Button(preset_frame, text="2010–2016", command=lambda: self.set_dates("2010-01-01", "2016-12-31")).pack(side=tk.LEFT, padx=2)
        ttk.Button(preset_frame, text="2000–2015", command=lambda: self.set_dates("2000-01-01", "2015-12-31")).pack(side=tk.LEFT, padx=2)

        # Расширения
        ttk.Label(params_group, text="Расширения (через запятую):").grid(row=1, column=0, sticky=tk.W, pady=3)
        self.ext_var = tk.StringVar(value="${config.fileExtensions}")
        ext_entry = ttk.Entry(params_group, textvariable=self.ext_var)
        ext_entry.grid(row=1, column=1, columnspan=3, sticky=tk.EW, padx=6, pady=3)
        ttk.Label(params_group, text="(пусто = все файлы)").grid(row=1, column=4, sticky=tk.W, padx=4)

        # Флаги
        flags_frame = ttk.Frame(params_group)
        flags_frame.grid(row=2, column=0, columnspan=5, sticky=tk.W, pady=(8, 0))

        self.dry_run_var = tk.BooleanVar(value=${config.dryRun ? 'True' : 'False'})
        self.dry_run_chk = ttk.Checkbutton(
            flags_frame, 
            text="Тестовый режим (Dry-Run — только сканирование и отчет без перемещения)", 
            variable=self.dry_run_var
        )
        self.dry_run_chk.pack(anchor=tk.W, pady=2)

        self.clean_dirs_var = tk.BooleanVar(value=${config.deleteEmptyDirs ? 'True' : 'False'})
        self.clean_dirs_chk = ttk.Checkbutton(
            flags_frame, 
            text="Удалять пустые подпапки в источнике после переноса", 
            variable=self.clean_dirs_var
        )
        self.clean_dirs_chk.pack(anchor=tk.W, pady=2)

        self.check_dups_var = tk.BooleanVar(value=${config.checkDuplicates ? 'True' : 'False'})
        self.check_dups_chk = ttk.Checkbutton(
            flags_frame,
            text="Выполнять поиск дубликатов файлов (контрольная сумма SHA-256)",
            variable=self.check_dups_var
        )
        self.check_dups_chk.pack(anchor=tk.W, pady=2)

        self.move_dups_var = tk.BooleanVar(value=${config.moveDuplicates ? 'True' : 'False'})
        self.move_dups_chk = ttk.Checkbutton(
            flags_frame,
            text="Переносить дубликаты (при снятой галочке дубликаты остаются в источнике)",
            variable=self.move_dups_var
        )
        self.move_dups_chk.pack(anchor=tk.W, pady=2, padx=(18, 0))

        # 4. Панель кнопок управления и прогресса
        control_frame = ttk.Frame(main_frame)
        control_frame.pack(fill=tk.X, pady=(0, 10))

        self.btn_scan = ttk.Button(control_frame, text="🔍 Тестовое сканирование (Dry-Run)", command=self.start_dry_run)
        self.btn_scan.pack(side=tk.LEFT, padx=(0, 4))

        self.btn_move = ttk.Button(control_frame, text="▶ Начать перенос файлов", command=self.start_real_move)
        self.btn_move.pack(side=tk.LEFT, padx=4)

        self.btn_dups = ttk.Button(control_frame, text="📑 Найти дубликаты", command=self.start_duplicate_search)
        self.btn_dups.pack(side=tk.LEFT, padx=4)

        self.btn_move_dups = ttk.Button(control_frame, text="📦 Перенести дубликаты", command=self.start_move_duplicates)
        self.btn_move_dups.pack(side=tk.LEFT, padx=4)

        self.btn_stop = ttk.Button(control_frame, text="⏹ Остановить", command=self.stop_process, state=tk.DISABLED)
        self.btn_stop.pack(side=tk.LEFT, padx=4)

        self.btn_clear = ttk.Button(control_frame, text="🗑 Очистить окно", command=self.clear_log)
        self.btn_clear.pack(side=tk.LEFT, padx=4)

        self.status_lbl = ttk.Label(control_frame, text="Готов к работе", font=("Segoe UI", 9, "italic"))
        self.status_lbl.pack(side=tk.RIGHT, padx=6)

        # Прогрессбар
        self.progress = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress.pack(fill=tk.X, pady=(0, 8))

        # 5. Терминал / Окно лога
        log_group = ttk.LabelFrame(main_frame, text=" Журнал выполнения и найденные файлы ", padding="6")
        log_group.pack(fill=tk.BOTH, expand=True)

        self.log_text = scrolledtext.ScrolledText(
            log_group, 
            wrap=tk.WORD, 
            font=("Consolas", 9), 
            bg="#1e1e1e", 
            fg="#d4d4d4",
            insertbackground="white"
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)
        self.log_text.tag_config("INFO", foreground="#9cdcfe")
        self.log_text.tag_config("SUCCESS", foreground="#4ec9b0")
        self.log_text.tag_config("WARN", foreground="#ce9178")
        self.log_text.tag_config("ERROR", foreground="#f44747")
        self.log_text.tag_config("DRYRUN", foreground="#dcdcaa")

        self.log("Приложение готово. Укажите папки и нажмите 'Тестовое сканирование' или 'Начать перенос'.", "INFO")

    def set_dates(self, start, end):
        self.start_date_var.set(start)
        self.end_date_var.set(end)

    def browse_source(self):
        folder = filedialog.askdirectory(title="Выберите исходную папку")
        if folder:
            self.src_var.set(os.path.normpath(folder))

    def browse_dest(self):
        folder = filedialog.askdirectory(title="Выберите архивную папку")
        if folder:
            self.dst_var.set(os.path.normpath(folder))

    def clear_log(self):
        self.log_text.delete("1.0", tk.END)

    def log(self, message, level="INFO"):
        now = datetime.now().strftime("%H:%M:%S")
        line = f"[{now}] [{level}] {message}\\n"
        self.log_text.insert(tk.END, line, level)
        self.log_text.see(tk.END)

    def start_dry_run(self):
        self.dry_run_var.set(True)
        self._start_thread()

    def start_real_move(self):
        if not messagebox.askyesno(
            "Подтверждение переноса",
            "Вы собираетесь выполнить РЕАЛЬНЫЙ перенос файлов с сохранением структуры каталогов.\\n\\nПродолжить?"
        ):
            return
        self.dry_run_var.set(False)
        self._start_thread()

    def start_duplicate_search(self):
        source = self.src_var.get().strip()
        if not source or not os.path.exists(source):
            messagebox.showerror("Ошибка", f"Исходная папка '{source}' не существует или недоступна!")
            return
        if self.is_running:
            return
        self.clear_log()
        self.is_running = True
        self.btn_scan.config(state=tk.DISABLED)
        self.btn_move.config(state=tk.DISABLED)
        self.btn_dups.config(state=tk.DISABLED)
        self.btn_move_dups.config(state=tk.DISABLED)
        self.btn_stop.config(state=tk.NORMAL)
        self.progress.start(10)
        self.status_lbl.config(text="Поиск дубликатов...")
        thread = threading.Thread(target=self._search_duplicates_worker, daemon=True)
        thread.start()

    def start_move_duplicates(self):
        source = self.src_var.get().strip()
        dest = self.dst_var.get().strip()
        if not source or not os.path.exists(source):
            messagebox.showerror("Ошибка", f"Исходная папка '{source}' не существует или недоступна!")
            return
        if not dest:
            messagebox.showerror("Ошибка", "Укажите архивную папку назначения для перемещения дубликатов!")
            return
        if not messagebox.askyesno(
            "Перенос дубликатов",
            f"Вы собираетесь найти все копии файлов в '{source}' и переместить дубликаты в архив '{dest}'.\\nОригиналы файлов останутся на месте.\\n\\nПродолжить?"
        ):
            return
        if self.is_running:
            return
        self.clear_log()
        self.is_running = True
        self.btn_scan.config(state=tk.DISABLED)
        self.btn_move.config(state=tk.DISABLED)
        self.btn_dups.config(state=tk.DISABLED)
        self.btn_move_dups.config(state=tk.DISABLED)
        self.btn_stop.config(state=tk.NORMAL)
        self.progress.start(10)
        self.status_lbl.config(text="Перенос дубликатов...")
        thread = threading.Thread(target=self._move_duplicates_worker, daemon=True)
        thread.start()

    def _move_duplicates_worker(self):
        source = self.src_var.get().strip()
        dest = self.dst_var.get().strip()
        self.log("=" * 60, "INFO")
        self.log(f"📦 СТАРТ ПЕРЕНОСА ДУБЛИКАТОВ ФАЙЛОВ", "INFO")
        self.log(f"Источник   : {source}", "INFO")
        self.log(f"Назначение : {dest}", "INFO")
        self.log("=" * 60, "INFO")

        size_map = defaultdict(list)
        total_files = 0

        for root_dir, _, files in os.walk(source):
            if not self.is_running:
                break
            for fname in files:
                if not self.is_running:
                    break
                total_files += 1
                fpath = os.path.join(root_dir, fname)
                try:
                    fsize = os.path.getsize(fpath)
                    if fsize > 0:
                        size_map[fsize].append(fpath)
                except Exception:
                    continue

        if not self.is_running:
            self.log("Операция прервана пользователем.", "WARN")
            self._finish()
            return

        self.log(f"Просканировано {total_files} файлов. Поиск одинаковых файлов по SHA-256...", "INFO")

        moved_dups = 0
        moved_bytes = 0

        for fsize, candidates in size_map.items():
            if not self.is_running:
                break
            if len(candidates) < 2:
                continue

            hash_map = defaultdict(list)
            for c_path in candidates:
                if not self.is_running:
                    break
                h = self._calculate_sha256(c_path)
                if h:
                    hash_map[h].append(c_path)

            for h, dup_list in hash_map.items():
                if len(dup_list) > 1:
                    orig = dup_list[0]
                    rel_orig = os.path.relpath(orig, source)
                    for copy_path in dup_list[1:]:
                        if not self.is_running:
                            break
                        rel_copy = os.path.relpath(copy_path, source)
                        target_path = os.path.join(dest, rel_copy)
                        target_dir = os.path.dirname(target_path)
                        try:
                            if not os.path.exists(target_dir):
                                os.makedirs(target_dir, exist_ok=True)
                            shutil.move(copy_path, target_path)
                            moved_dups += 1
                            moved_bytes += fsize
                            self.log(f"[ПЕРЕНЕСЕН ДУБЛИКАТ] {rel_copy} -> {target_path} (оригинал: {rel_orig})", "SUCCESS")
                        except Exception as e:
                            self.log(f"[ОШИБКА ПЕРЕНОСА] {rel_copy}: {e}", "ERROR")

        moved_mb = moved_bytes / (1024 * 1024)
        self.log("=" * 60, "INFO")
        self.log("📊 ИТОГ ПЕРЕНОСА ДУБЛИКАТОВ:", "INFO")
        self.log(f"Перемещено дубликатов: {moved_dups} шт.", "SUCCESS")
        self.log(f"Освобождено места: {moved_mb:.2f} МБ", "SUCCESS")
        self.log("Оригиналы файлов сохранены в источнике.", "INFO")
        self.log("=" * 60, "INFO")
        self._finish()

    def _calculate_sha256(self, filepath, block_size=65536):
        sha = hashlib.sha256()
        try:
            with open(filepath, 'rb') as f:
                for chunk in iter(lambda: f.read(block_size), b''):
                    if not self.is_running:
                        return None
                    sha.update(chunk)
            return sha.hexdigest()
        except Exception:
            return None

    def _search_duplicates_worker(self):
        source = self.src_var.get().strip()
        self.log("=" * 60, "INFO")
        self.log(f"🔍 ЗАПУСК ГЛУБОКОГО ПОИСКА ДУБЛИКАТОВ В: {source}", "INFO")
        self.log("=" * 60, "INFO")

        # Шаг 1: Сканирование и группировка по размеру файлов
        size_map = defaultdict(list)
        total_files = 0

        for root_dir, _, files in os.walk(source):
            if not self.is_running:
                break
            for fname in files:
                if not self.is_running:
                    break
                total_files += 1
                fpath = os.path.join(root_dir, fname)
                try:
                    fsize = os.path.getsize(fpath)
                    if fsize > 0:
                        size_map[fsize].append(fpath)
                except Exception:
                    continue

        if not self.is_running:
            self.log("Поиск дубликатов прерван пользователем.", "WARN")
            self._finish()
            return

        self.log(f"Просканировано {total_files} файлов. Найдено групп с одинаковым размером: {len([s for s, fl in size_map.items() if len(fl) > 1])}", "INFO")
        self.log("Вычисление контрольных сумм SHA-256 для кандидатов...", "INFO")

        dup_groups = 0
        extra_dups = 0
        wasted_bytes = 0

        for fsize, candidates in size_map.items():
            if not self.is_running:
                break
            if len(candidates) < 2:
                continue

            hash_map = defaultdict(list)
            for c_path in candidates:
                if not self.is_running:
                    break
                h = self._calculate_sha256(c_path)
                if h:
                    hash_map[h].append(c_path)

            for h, dup_list in hash_map.items():
                if len(dup_list) > 1:
                    dup_groups += 1
                    copies = len(dup_list) - 1
                    extra_dups += copies
                    wasted_bytes += (fsize * copies)
                    orig = dup_list[0]
                    rel_orig = os.path.relpath(orig, source)
                    size_kb = fsize / 1024

                    self.log(f"\\n[⚠️ НАЙДЕНЫ ДУБЛИКАТЫ] Размер: {size_kb:.1f} КБ (SHA-256: {h[:12]}...):", "WARN")
                    self.log(f"  ★ Оригинал: {rel_orig}", "SUCCESS")
                    for i, copy_path in enumerate(dup_list[1:], 1):
                        rel_copy = os.path.relpath(copy_path, source)
                        self.log(f"  ↪ Копия {i}:   {rel_copy}", "WARN")

        wasted_mb = wasted_bytes / (1024 * 1024)
        self.log("=" * 60, "INFO")
        self.log("📊 ИТОГИ АНАЛИЗА ДУБЛИКАТОВ:", "INFO")
        self.log(f"Групп идентичных файлов: {dup_groups}", "INFO")
        self.log(f"Лишних копий файлов: {extra_dups}", "INFO")
        self.log(f"Занимаемое впустую дисковое пространство: {wasted_mb:.2f} МБ", "INFO")
        self.log("=" * 60, "INFO")
        self._finish()

    def _start_thread(self):
        if self.is_running:
            return
        # Очистка предыдущего вывода при новом поиске или переносе
        self.clear_log()
        self.is_running = True
        self.btn_scan.config(state=tk.DISABLED)
        self.btn_move.config(state=tk.DISABLED)
        self.btn_dups.config(state=tk.DISABLED)
        self.btn_move_dups.config(state=tk.DISABLED)
        self.btn_stop.config(state=tk.NORMAL)
        self.progress.start(10)
        self.status_lbl.config(text="Идет обработка...")

        thread = threading.Thread(target=self._process_files, daemon=True)
        thread.start()

    def stop_process(self):
        self.is_running = False
        self.log("Запрошена остановка пользователем...", "WARN")

    def _process_files(self):
        source = self.src_var.get().strip()
        dest = self.dst_var.get().strip()
        dry_run = self.dry_run_var.get()
        delete_empty = self.clean_dirs_var.get()

        try:
            start_dt = datetime.strptime(self.start_date_var.get().strip() + " 00:00:00", "%Y-%m-%d %H:%M:%S")
            end_dt = datetime.strptime(self.end_date_var.get().strip() + " 23:59:59", "%Y-%m-%d %H:%M:%S")
        except Exception as e:
            self.log(f"Ошибка формата даты (требуется ГГГГ-ММ-ДД): {e}", "ERROR")
            self._finish()
            return

        if not os.path.exists(source):
            self.log(f"Исходная папка '{source}' не найдена или недоступна!", "ERROR")
            self._finish()
            return

        if not dry_run and not os.path.exists(dest):
            try:
                os.makedirs(dest, exist_ok=True)
                self.log(f"Создана целевая архивная папка: {dest}", "INFO")
            except Exception as e:
                self.log(f"Не удалось создать целевую папку: {e}", "ERROR")
                self._finish()
                return

        # Фильтры расширений
        raw_ext = self.ext_var.get().strip()
        allowed_exts = [e.strip().lower() for e in raw_ext.split(',') if e.strip()] if raw_ext else []

        self.log(f"--- Старт обработки: {source} -> {dest} ---", "INFO")
        self.log(f"Период: {start_dt.strftime('%d.%m.%Y')} — {end_dt.strftime('%d.%m.%Y')}", "INFO")
        if dry_run:
            self.log("ВНИМАНИЕ: Включен тестовый режим (Dry-Run). Файлы НЕ будут перемещены.", "DRYRUN")

        scanned = 0
        matched = 0
        moved = 0
        total_bytes = 0
        check_dups = self.check_dups_var.get()
        move_dups = self.move_dups_var.get()
        seen_hashes = {}
        dup_count = 0
        skipped_dups = 0

        for root_dir, _, files in os.walk(source):
            if not self.is_running:
                break
            for fname in files:
                if not self.is_running:
                    break
                scanned += 1
                lower = fname.lower()
                if lower in {"thumbs.db", "desktop.ini"} or lower.startswith("~$"):
                    continue

                if allowed_exts:
                    ext = Path(fname).suffix.lower()
                    if ext not in allowed_exts and ext.replace('.', '') not in allowed_exts:
                        continue

                file_path = os.path.join(root_dir, fname)
                try:
                    stat = os.stat(file_path)
                    fdate = datetime.fromtimestamp(stat.${statDateAttr})
                except Exception as err:
                    self.log(f"Не удалось прочитать атрибуты {file_path}: {err}", "WARN")
                    continue

                if start_dt <= fdate <= end_dt:
                    matched += 1
                    total_bytes += stat.st_size
                    rel_path = os.path.relpath(file_path, source)
                    target_file = os.path.join(dest, rel_path)
                    target_dir = os.path.dirname(target_file)

                    dup_info = ""
                    is_this_dup = False
                    if check_dups:
                        f_hash = self._calculate_sha256(file_path)
                        if f_hash:
                            if f_hash in seen_hashes:
                                dup_count += 1
                                is_this_dup = True
                                dup_info = f" [⚠️ ДУБЛИКАТ: {seen_hashes[f_hash]}]"
                            else:
                                seen_hashes[f_hash] = rel_path

                    if check_dups and is_this_dup and not move_dups:
                        skipped_dups += 1
                        self.log(f"[ПРОПУСК ДУБЛИКАТА] {rel_path} (оставлен в источнике, оригинал: {seen_hashes[f_hash]})", "WARN")
                        continue

                    if dry_run:
                        self.log(f"[ТЕСТ] {rel_path}{dup_info} ({fdate.strftime('%Y-%m-%d')}) -> {target_file}", "DRYRUN")
                    else:
                        try:
                            os.makedirs(target_dir, exist_ok=True)
                            if os.path.exists(target_file):
                                self.log(f"Файл уже существует в архиве. Пропуск: {rel_path}", "WARN")
                                continue
                            shutil.move(file_path, target_file)
                            moved += 1
                            self.log(f"[OK] Перемещен -> {rel_path}{dup_info}", "SUCCESS")
                        except Exception as e:
                            self.log(f"Ошибка перемещения {rel_path}: {e}", "ERROR")

        if check_dups and dup_count > 0:
            self.log(f"ВНИМАНИЕ: Среди перемещаемых/отобранных файлов обнаружено {dup_count} дубликатов!", "WARN")

        if delete_empty and not dry_run and self.is_running:
            self.log("Очистка пустых папок в источнике...", "INFO")
            for root_dir, dirs, _ in os.walk(source, topdown=False):
                for d in dirs:
                    dpath = os.path.join(root_dir, d)
                    try:
                        if not os.listdir(dpath):
                            os.rmdir(dpath)
                            self.log(f"Удалена пустая папка: {dpath}", "INFO")
                    except Exception:
                        pass

        mb = total_bytes / (1024 * 1024)
        self.log(f"=== ИТОГ: Просканировано: {scanned}, Найдено: {matched} ({mb:.2f} МБ), Перемещено: {moved} ===", "SUCCESS")
        self._finish()

    def _finish(self):
        self.is_running = False
        self.root.after(0, self._update_ui_finished)

    def _update_ui_finished(self):
        self.progress.stop()
        self.btn_scan.config(state=tk.NORMAL)
        self.btn_move.config(state=tk.NORMAL)
        self.btn_dups.config(state=tk.NORMAL)
        self.btn_move_dups.config(state=tk.NORMAL)
        self.btn_stop.config(state=tk.DISABLED)
        self.status_lbl.config(text="Завершено")

if __name__ == "__main__":
    root = tk.Tk()
    app = NetworkFileArchiverGUI(root)
    root.mainloop()
`;
}

export function generatePowerShellGUI(config: ScriptConfig): string {
  return `<#
================================================================================
Графическое приложение Windows (PowerShell + Windows Presentation Foundation)
Архивация файлов по диапазону дат с сохранением иерархии каталогов
================================================================================
#>

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName System.Windows.Forms

# Обеспечение корректной кодировки UTF-8 в Windows PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Сетевой архиватор файлов (GUI WPF)" Height="700" Width="880"
        WindowStartupLocation="CenterScreen" Background="#F8FAFC">
    <Grid Margin="16">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
        </Grid.RowDefinitions>

        <!-- Заголовок -->
        <StackPanel Grid.Row="0" Margin="0,0,0,12">
            <TextBlock Text="Перенос файлов по дате с сохранением иерархии папок" FontSize="16" FontWeight="Bold" Foreground="#0F172A"/>
            <TextBlock Text="Сетевые SMB/UNC шары (\\server\share) и локальные диски (WPF PowerShell GUI)" FontSize="11" Foreground="#64748B"/>
        </StackPanel>

        <!-- Пути -->
        <Border Grid.Row="1" Background="White" BorderBrush="#E2E8F0" BorderThickness="1" CornerRadius="8" Padding="12" Margin="0,0,0,10">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="150"/>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="90"/>
                    <ColumnDefinition Width="90"/>
                </Grid.ColumnDefinitions>
                <Grid.RowDefinitions>
                    <RowDefinition Height="Auto"/>
                    <RowDefinition Height="8"/>
                    <RowDefinition Height="Auto"/>
                    <RowDefinition Height="6"/>
                    <RowDefinition Height="Auto"/>
                </Grid.RowDefinitions>

                <TextBlock Grid.Row="0" Grid.Column="0" Text="Источник (Source):" VerticalAlignment="Center" FontWeight="SemiBold" FontSize="11"/>
                <TextBox x:Name="TxtSource" Grid.Row="0" Grid.Column="1" Text="${config.sourcePath}" Padding="6,4" FontSize="11" Margin="0,0,8,0"/>
                <Button x:Name="BtnBrowseSource" Grid.Row="0" Grid.Column="2" Content="Обзор..." Height="26" Margin="0,0,4,0"/>
                <Button x:Name="BtnCheckSource" Grid.Row="0" Grid.Column="3" Content="Проверить" Height="26"/>

                <TextBlock Grid.Row="2" Grid.Column="0" Text="Архив (Destination):" VerticalAlignment="Center" FontWeight="SemiBold" FontSize="11"/>
                <TextBox x:Name="TxtDest" Grid.Row="2" Grid.Column="1" Text="${config.destPath}" Padding="6,4" FontSize="11" Margin="0,0,8,0"/>
                <Button x:Name="BtnBrowseDest" Grid.Row="2" Grid.Column="2" Content="Обзор..." Height="26" Margin="0,0,4,0"/>
                <Button x:Name="BtnCheckDest" Grid.Row="2" Grid.Column="3" Content="Проверить" Height="26"/>

                <TextBlock Grid.Row="4" Grid.Column="1" Grid.ColumnSpan="3" Text="Совет: сетевые пути UNC (\\server\share\folder) можно вставлять вручную или выбирать через 'Обзор...'" FontSize="10" Foreground="#64748B"/>
            </Grid>
        </Border>

        <!-- Параметры -->
        <Border Grid.Row="2" Background="White" BorderBrush="#E2E8F0" BorderThickness="1" CornerRadius="8" Padding="12" Margin="0,0,0,10">
            <StackPanel>
                <WrapPanel Margin="0,0,0,8">
                    <TextBlock Text="С даты:" VerticalAlignment="Center" Margin="0,0,6,0" FontSize="11" FontWeight="SemiBold"/>
                    <TextBox x:Name="TxtStart" Text="${config.startDate}" Width="90" Padding="4,3" Margin="0,0,16,0" FontSize="11"/>
                    <TextBlock Text="По дату:" VerticalAlignment="Center" Margin="0,0,6,0" FontSize="11" FontWeight="SemiBold"/>
                    <TextBox x:Name="TxtEnd" Text="${config.endDate}" Width="90" Padding="4,3" Margin="0,0,16,0" FontSize="11"/>
                    <CheckBox x:Name="ChkDryRun" Content="Тестовый режим (Dry-Run)" IsChecked="${config.dryRun ? 'True' : 'False'}" VerticalAlignment="Center" Margin="0,0,16,0" FontSize="11"/>
                    <CheckBox x:Name="ChkCleanDirs" Content="Удалять пустые папки" IsChecked="${config.deleteEmptyDirs ? 'True' : 'False'}" VerticalAlignment="Center" Margin="0,0,16,0" FontSize="11"/>
                    <CheckBox x:Name="ChkDuplicates" Content="Поиск дубликатов (SHA-256 / Размер)" IsChecked="${config.checkDuplicates ? 'True' : 'False'}" VerticalAlignment="Center" Margin="0,0,16,0" FontSize="11" Foreground="#4F46E5" FontWeight="SemiBold"/>
                    <CheckBox x:Name="ChkMoveDuplicates" Content="Переносить дубликаты" IsChecked="${config.moveDuplicates ? 'True' : 'False'}" VerticalAlignment="Center" FontSize="11" Foreground="#047857" FontWeight="SemiBold"/>
                </WrapPanel>
            </StackPanel>
        </Border>

        <!-- Кнопки управления -->
        <DockPanel Grid.Row="3" Margin="0,0,0,10">
            <StackPanel Orientation="Horizontal" DockPanel.Dock="Left">
                <Button x:Name="BtnScan" Content="🔍 Тестовый скан (Dry-Run)" Padding="12,6" Margin="0,0,6,0" Background="#F59E0B" Foreground="White" FontWeight="Bold"/>
                <Button x:Name="BtnMove" Content="▶ Выполнить перенос" Padding="12,6" Margin="0,0,6,0" Background="#10B981" Foreground="White" FontWeight="Bold"/>
                <Button x:Name="BtnFindDuplicates" Content="📑 Найти дубликаты" Padding="10,6" Margin="0,0,6,0" Background="#6366F1" Foreground="White" FontWeight="Bold"/>
                <Button x:Name="BtnMoveDuplicates" Content="📦 Перенести дубликаты" Padding="10,6" Margin="0,0,6,0" Background="#7C3AED" Foreground="White" FontWeight="Bold"/>
                <Button x:Name="BtnClearLog" Content="Очистить окно" Padding="10,6" Margin="0,0,6,0" Background="#E2E8F0" Foreground="#1E293B"/>
                <TextBlock x:Name="TxtStatus" Text="Готов к сканированию" VerticalAlignment="Center" Margin="8,0,0,0" Foreground="#475569" FontSize="11"/>
            </StackPanel>
        </DockPanel>

        <!-- Лог -->
        <TextBox x:Name="TxtLog" Grid.Row="4" Background="#0F172A" Foreground="#E2E8F0" FontFamily="Consolas" FontSize="11"
                 AcceptsReturn="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto" IsReadOnly="True" Padding="8"/>
    </Grid>
</Window>
"@

$reader = (New-Object System.Xml.XmlNodeReader $xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)

# Связывание элементов интерфейса
$txtSource       = $window.FindName("TxtSource")
$txtDest         = $window.FindName("TxtDest")
$txtStart        = $window.FindName("TxtStart")
$txtEnd          = $window.FindName("TxtEnd")
$chkDryRun       = $window.FindName("ChkDryRun")
$chkCleanDirs    = $window.FindName("ChkCleanDirs")
$chkDuplicates   = $window.FindName("ChkDuplicates")
$chkMoveDups     = $window.FindName("ChkMoveDuplicates")
$btnScan         = $window.FindName("BtnScan")
$btnMove         = $window.FindName("BtnMove")
$btnFindDups     = $window.FindName("BtnFindDuplicates")
$btnMoveDups     = $window.FindName("BtnMoveDuplicates")
$btnBrowseSource = $window.FindName("BtnBrowseSource")
$btnBrowseDest   = $window.FindName("BtnBrowseDest")
$btnCheckSource  = $window.FindName("BtnCheckSource")
$btnCheckDest    = $window.FindName("BtnCheckDest")
$btnClearLog     = $window.FindName("BtnClearLog")
$txtStatus       = $window.FindName("TxtStatus")
$txtLog          = $window.FindName("TxtLog")

function Log-Message([string]$msg) {
    $time = Get-Date -Format "HH:mm:ss"
    $txtLog.AppendText("[$time] $msg\`r\`n")
    $txtLog.ScrollToEnd()
}

function Clear-LogWindow {
    $txtLog.Clear()
}

if ($btnClearLog) {
    $btnClearLog.Add_Click({
        Clear-LogWindow
        Log-Message "Окно журнала очищено."
    })
}

# Функция выбора папки с поддержкой Проводника Windows (включая узел 'Сеть' и ввод UNC путей)
function Select-NetworkFolder([string]$title, [string]$initialPath) {
    # Способ 1: Использование OpenFileDialog с выбором каталога (полноценный современный Проводник Windows)
    try {
        $dlg = New-Object System.Windows.Forms.OpenFileDialog
        $dlg.ValidateNames = $false
        $dlg.CheckFileExists = $false
        $dlg.CheckPathExists = $true
        $dlg.FileName = "Выбор текущей папки"
        $dlg.Title = "$title (Перейдите в сетевую/локальную папку и нажмите Открыть)"
        $dlg.Filter = "Папки|*.folder_select_marker"
        if ($initialPath -and (Test-Path -LiteralPath $initialPath)) {
            $dlg.InitialDirectory = $initialPath
        }

        if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            $selectedFile = $dlg.FileName
            $folderPath = [System.IO.Path]::GetDirectoryName($selectedFile)
            if ($folderPath -and (Test-Path -LiteralPath $folderPath)) {
                return $folderPath
            }
        }
    } catch {}

    # Способ 2: FolderBrowserDialog с принудительным открытием от Рабочего стола / Сети и полем ввода пути
    try {
        $fbd = New-Object System.Windows.Forms.FolderBrowserDialog
        $fbd.Description = $title
        $fbd.ShowNewFolderButton = $true
        $fbd.RootFolder = [System.Environment+SpecialFolder]::Desktop
        if ($initialPath -and (Test-Path -LiteralPath $initialPath)) {
            $fbd.SelectedPath = $initialPath
        }
        if ($fbd.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            return $fbd.SelectedPath
        }
    } catch {}

    # Способ 3: COM-объект Shell.Application с флагами BIF_EDITBOX (0x10) и BIF_NEWDIALOGSTYLE (0x40)
    try {
        $shell = New-Object -ComObject Shell.Application
        # 0x0010 = поле ввода пути, 0x0040 = современный стиль, 0x8000 = сетевые ресурсы
        $flags = 0x0010 -bor 0x0040 -bor 0x8000
        $folder = $shell.BrowseForFolder(0, $title, $flags, 0)
        if ($folder -ne $null) {
            $p = $folder.Self.Path
            if ($p) { return $p }
        }
    } catch {}

    return $null
}

$btnBrowseSource.Add_Click({
    $selected = Select-NetworkFolder "Выберите исходную папку" $txtSource.Text
    if ($selected) {
        $txtSource.Text = $selected
        Log-Message "Выбрана исходная папка: $selected"
    }
})

$btnBrowseDest.Add_Click({
    $selected = Select-NetworkFolder "Выберите архивную папку" $txtDest.Text
    if ($selected) {
        $txtDest.Text = $selected
        Log-Message "Выбрана архивная папка: $selected"
    }
})

# Кнопки быстрой проверки доступности сетевого пути
$btnCheckSource.Add_Click({
    $p = $txtSource.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($p)) {
        Log-Message "Укажите путь к источнику!"
        return
    }
    if (Test-Path -LiteralPath $p) {
        Log-Message "[OK] Исходный путь доступен: $p"
    } else {
        Log-Message "[ОШИБКА] Путь недоступен или нет прав: $p"
    }
})

$btnCheckDest.Add_Click({
    $p = $txtDest.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($p)) {
        Log-Message "Укажите путь к архиву!"
        return
    }
    if (Test-Path -LiteralPath $p) {
        Log-Message "[OK] Архивный путь доступен: $p"
    } else {
        Log-Message "[ВНИМАНИЕ] Путь не существует или недоступен: $p (будет создан при переносе, если есть права)"
    }
})

function Find-Duplicates([string]$path) {
    Clear-LogWindow
    Log-Message "=========================================================="
    Log-Message "🔍 ЗАПУСК ПОИСКА ДУБЛИКАТОВ ФАЙЛОВ В ПАПКЕ: $path"
    Log-Message "=========================================================="

    if (-not (Test-Path -LiteralPath $path)) {
        Log-Message "[ОШИБКА] Путь '$path' недоступен!"
        return
    }

    $allFiles = Get-ChildItem -LiteralPath $path -File -Recurse -Force -ErrorAction SilentlyContinue
    Log-Message "Просканировано файлов: $($allFiles.Count). Анализ одинаковых файлов..."

    # Шаг 1: Быстрая группировка по размеру (файлы разного размера не могут быть дубликатами)
    $sizeGroups = $allFiles | Where-Object { $_.Length -gt 0 } | Group-Object Length | Where-Object { $_.Count -gt 1 }

    if (-not $sizeGroups -or $sizeGroups.Count -eq 0) {
        Log-Message "✅ [ОТЛИЧНО] Файлов с одинаковыми размерами и содержимым не найдено."
        return
    }

    Log-Message "Найдено групп с одинаковым размером: $($sizeGroups.Count). Вычисление хэшей SHA-256..."

    $duplicateGroupsCount = 0
    $totalDupFiles = 0
    $wastedBytes = 0

    foreach ($group in $sizeGroups) {
        $hashDict = @{}
        foreach ($file in $group.Group) {
            try {
                $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256 -ErrorAction Stop).Hash
                if (-not $hashDict.ContainsKey($hash)) {
                    $hashDict[$hash] = @()
                }
                $hashDict[$hash] += $file
            } catch {
                Log-Message "[ВНИМАНИЕ] Не удалось прочитать хэш: $($file.Name)"
            }
        }

        foreach ($h in $hashDict.Keys) {
            $matchingFiles = $hashDict[$h]
            if ($matchingFiles.Count -gt 1) {
                $duplicateGroupsCount++
                $totalDupFiles += ($matchingFiles.Count - 1)
                $firstFile = $matchingFiles[0]
                $wastedBytes += ($firstFile.Length * ($matchingFiles.Count - 1))
                $sizeKb = [Math]::Round($firstFile.Length / 1KB, 1)

                Log-Message "\`r\`n[⚠️ ДУБЛИКАТЫ НАЙДЕНЫ] Размер: $sizeKb КБ (SHA256: $($h.Substring(0,12))...):"
                Log-Message "  ★ Оригинал: $($firstFile.FullName)"
                for ($i = 1; $i -lt $matchingFiles.Count; $i++) {
                    Log-Message "  ↪ Копия $i:   $($matchingFiles[$i].FullName)"
                }
            }
        }
    }

    $wastedMb = [Math]::Round($wastedBytes / 1MB, 2)
    Log-Message "\`r\`n=========================================================="
    Log-Message "📊 ИТОГИ АНАЛИЗА ДУБЛИКАТОВ:"
    Log-Message "Групп дубликатов: $duplicateGroupsCount"
    Log-Message "Лишних копий файлов: $totalDupFiles"
    Log-Message "Занимаемое впустую место: $wastedMb МБ"
    Log-Message "=========================================================="
}

function Move-Duplicates([string]$src, [string]$dst) {
    Clear-LogWindow
    Log-Message "=========================================================="
    Log-Message "📦 СТАРТ ПЕРЕНОСА ДУБЛИКАТОВ ФАЙЛОВ"
    Log-Message "Источник   : $src"
    Log-Message "Назначение : $dst"
    Log-Message "=========================================================="

    if (-not (Test-Path -LiteralPath $src)) {
        Log-Message "Ошибка: Исходная папка '$src' не найдена или недоступна!"
        return
    }
    if (-not $dst) {
        Log-Message "Ошибка: Укажите архивную папку назначения!"
        return
    }

    $allFiles = Get-ChildItem -LiteralPath $src -File -Recurse -Force -ErrorAction SilentlyContinue
    Log-Message "Просканировано файлов в источнике: $($allFiles.Count)"

    $sizeGroups = $allFiles | Where-Object { $_.Length -gt 0 } | Group-Object Length | Where-Object { $_.Count -gt 1 }
    if (-not $sizeGroups -or $sizeGroups.Count -eq 0) {
        Log-Message "✅ [ОТЛИЧНО] Дубликатов файлов в источнике не найдено."
        return
    }

    $movedCount = 0
    $movedBytes = 0

    foreach ($group in $sizeGroups) {
        $hashDict = @{}
        foreach ($file in $group.Group) {
            try {
                $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256 -ErrorAction Stop).Hash
                if ($hashDict.ContainsKey($hash)) {
                    $orig = $hashDict[$hash]
                    $relCopy = $file.FullName.Substring($src.Length).TrimStart('\', '/')
                    $targetPath = Join-Path $dst $relCopy
                    $targetDir = Split-Path -Path $targetPath -Parent

                    if (-not (Test-Path -LiteralPath $targetDir)) {
                        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                    }

                    Move-Item -LiteralPath $file.FullName -Destination $targetPath -Force
                    $movedCount++
                    $movedBytes += $file.Length
                    Log-Message "[ПЕРЕНЕСЕН ДУБЛИКАТ] $relCopy -> $targetPath (оригинал: $($orig.FullName))"
                } else {
                    $hashDict[$hash] = $file
                }
            } catch {
                Log-Message "[ОШИБКА ДУБЛИКАТА] $($file.Name): $($_.Exception.Message)"
            }
        }
    }

    $mb = [Math]::Round($movedBytes / 1MB, 2)
    Log-Message "\`r\`n=========================================================="
    Log-Message "📊 ИТОГИ: Перемещено дубликатов: $movedCount шт. ($mb МБ). Оригиналы сохранены в источнике."
    Log-Message "=========================================================="
}

function Run-Process([bool]$dryRun) {
    # Очистка предыдущего вывода при запуске нового поиска или переноса
    Clear-LogWindow

    $src = $txtSource.Text.Trim()
    $dst = $txtDest.Text.Trim()
    $startDate = [DateTime]::Parse($txtStart.Text)
    $endDate = [DateTime]::Parse($txtEnd.Text).AddDays(1).AddSeconds(-1)
    $checkDups = $chkDuplicates.IsChecked -eq $true
    $moveDups  = if ($chkMoveDups) { $chkMoveDups.IsChecked -eq $true } else { $true }

    Log-Message "Старт: $src -> $dst"
    Log-Message "Период: $($startDate.ToString('dd.MM.yyyy')) по $($endDate.ToString('dd.MM.yyyy'))"
    if ($checkDups) {
        if ($moveDups) {
            Log-Message "Параметр дубликатов: ВКЛЮЧЕН перенос дубликатов."
        } else {
            Log-Message "Параметр дубликатов: ПРОПУСК дубликатов (будут оставлены в источнике)."
        }
    }
    if ($dryRun) { 
        Log-Message "РЕЖИМ: Новый тестовый поиск (Dry-Run). Предыдущие результаты очищены." 
    } else {
        Log-Message "РЕЖИМ: Реальный перенос файлов."
    }

    if (-not (Test-Path $src)) {
        Log-Message "ОШИБКА: Исходная папка '$src' не существует!"
        return
    }

    $sourceNormalized = (Resolve-Path $src).Path.TrimEnd('\\', '/')
    $files = Get-ChildItem -LiteralPath $src -File -Recurse -Force -ErrorAction SilentlyContinue

    $matched = 0
    $moved = 0
    $dupCount = 0
    $seenHashes = @{}

    foreach ($f in $files) {
        if ($f.LastWriteTime -ge $startDate -and $f.LastWriteTime -le $endDate) {
            $matched++
            $rel = $f.FullName.Substring($sourceNormalized.Length).TrimStart('\\', '/')
            $target = Join-Path $dst $rel
            $targetDir = Split-Path $target -Parent

            $dupNote = ""
            $isThisDup = $false
            if ($checkDups) {
                try {
                    $fHash = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256 -ErrorAction Stop).Hash
                    if ($seenHashes.ContainsKey($fHash)) {
                        $dupCount++
                        $isThisDup = $true
                        $dupNote = " [⚠️ ДУБЛИКАТ файла $($seenHashes[$fHash])]"
                    } else {
                        $seenHashes[$fHash] = $rel
                    }
                } catch {}
            }

            if ($checkDups -and $isThisDup -and (-not $moveDups)) {
                Log-Message "[ПРОПУСК ДУБЛИКАТА] $rel (оставлен в источнике)"
                continue
            }

            if ($dryRun) {
                Log-Message "[ТЕСТ] $rel$dupNote -> $target"
            } else {
                if (-not (Test-Path $targetDir)) {
                    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                }
                Move-Item -LiteralPath $f.FullName -Destination $target -Force
                $moved++
                Log-Message "[OK] Перемещен -> $rel$dupNote"
            }
        }
    }

    if ($checkDups -and $dupCount -gt 0) {
        Log-Message "[ВНИМАНИЕ] Обнаружено дубликатов среди отобранных файлов: $dupCount шт."
    }

    Log-Message "Завершено. Найдено: $matched, Перемещено: $moved."
}

$btnScan.Add_Click({ Run-Process $true })
$btnMove.Add_Click({ Run-Process $false })
if ($btnFindDups) {
    $btnFindDups.Add_Click({ 
        $p = $txtSource.Text.Trim()
        if (-not $p) {
            Log-Message "Укажите исходную сетевую папку для поиска дубликатов!"
            return
        }
        Find-Duplicates $p 
    })
}
if ($btnMoveDups) {
    $btnMoveDups.Add_Click({
        $s = $txtSource.Text.Trim()
        $d = $txtDest.Text.Trim()
        if (-not $s) {
            Log-Message "Укажите исходную сетевую папку!"
            return
        }
        if (-not $d) {
            Log-Message "Укажите архивную папку назначения!"
            return
        }
        Move-Duplicates $s $d
    })
}

Log-Message "Графическое приложение инициализировано. Выберите папки и нажмите 'Тестовый скан', 'Выполнить перенос', 'Найти дубликаты' или 'Перенести дубликаты'."
$window.ShowDialog() | Out-Null
`;
}
