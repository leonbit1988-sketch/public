export type ScriptLanguage = 'gui-python' | 'gui-powershell' | 'powershell' | 'python' | 'bash' | 'robocopy';

export type DateFieldType = 'mtime' | 'ctime' | 'atime';

export type ConflictResolution = 'skip' | 'overwrite' | 'rename';

export type DuplicateMatchMode = 'hash' | 'name-and-size' | 'size-only';

export interface ScriptConfig {
  sourcePath: string;
  destPath: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dateField: DateFieldType;
  dryRun: boolean;
  deleteEmptyDirs: boolean;
  conflictResolution: ConflictResolution;
  fileExtensions: string; // comma separated or empty for all
  excludePatterns: string; // e.g. "thumbs.db, ~$*, *.tmp"
  enableLogging: boolean;
  logFilePath: string;
  supportLongPaths: boolean;
  retryAttempts: number;
  // Поиск и обработка дубликатов
  checkDuplicates: boolean;
  duplicateMatchMode: DuplicateMatchMode;
  moveDuplicates: boolean; // Переносить ли найденные дубликаты
  duplicateFolder: string; // Специальная папка для дубликатов при переносе (опционально)
}

export interface SimFile {
  id: string;
  name: string;
  path: string; // relative path e.g. "Documents/Finance/2012_report.xlsx"
  size: number; // bytes
  modifiedDate: string; // ISO string
  createdDate: string;
  extension: string;
  status: 'initial' | 'matched' | 'moved' | 'skipped';
  hash?: string;
  isDuplicate?: boolean;
  duplicateOf?: string; // path of the original/duplicate file
}

export interface SimFolder {
  id: string;
  path: string; // e.g. "Documents/Finance"
  name: string;
}

export interface SimLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'success' | 'action';
  message: string;
}
