import { SimFile } from '../types';

export const INITIAL_SIM_FILES: SimFile[] = [
  {
    id: 'f-1',
    name: 'Баланс_2011_Годовой.xlsx',
    path: 'Бухгалтерия/Отчеты/Баланс_2011_Годовой.xlsx',
    size: 2450000,
    modifiedDate: '2011-04-12T14:30:00',
    createdDate: '2011-04-10T10:00:00',
    extension: 'xlsx',
    status: 'initial',
    hash: 'a1b2c3d4e5f601'
  },
  {
    id: 'f-1-dup',
    name: 'Копия_Баланс_2011.xlsx',
    path: 'Общие_документы/Архивы_старые/Копия_Баланс_2011.xlsx',
    size: 2450000,
    modifiedDate: '2011-04-12T14:30:00',
    createdDate: '2011-04-10T10:00:00',
    extension: 'xlsx',
    status: 'initial',
    hash: 'a1b2c3d4e5f601'
  },
  {
    id: 'f-2',
    name: 'Акт_сверки_ООО_Вектор_2013.pdf',
    path: 'Бухгалтерия/Акты/Акт_сверки_ООО_Вектор_2013.pdf',
    size: 512000,
    modifiedDate: '2013-11-20T09:15:00',
    createdDate: '2013-11-20T09:10:00',
    extension: 'pdf',
    status: 'initial',
    hash: 'b2c3d4e5f6a102'
  },
  {
    id: 'f-3',
    name: 'Текущий_план_2023.xlsx',
    path: 'Бухгалтерия/Отчеты/Текущий_план_2023.xlsx',
    size: 1820000,
    modifiedDate: '2023-05-18T16:45:00',
    createdDate: '2023-01-10T11:00:00',
    extension: 'xlsx',
    status: 'initial',
    hash: 'c3d4e5f6a1b203'
  },
  {
    id: 'f-4',
    name: 'Договор_поставки_142_2010.docx',
    path: 'Юристы/Договоры/2010/Договор_поставки_142_2010.docx',
    size: 340000,
    modifiedDate: '2010-08-05T11:20:00',
    createdDate: '2010-08-05T10:00:00',
    extension: 'docx',
    status: 'initial',
    hash: 'd4e5f6a1b2c304'
  },
  {
    id: 'f-4-dup',
    name: 'Договор_поставки_142_2010_копия_для_юристов.docx',
    path: 'Юристы/Черновики/Договор_поставки_142_2010_копия_для_юристов.docx',
    size: 340000,
    modifiedDate: '2010-08-05T11:20:00',
    createdDate: '2010-08-05T10:00:00',
    extension: 'docx',
    status: 'initial',
    hash: 'd4e5f6a1b2c304'
  },
  {
    id: 'f-5',
    name: 'Доп_соглашение_2015.pdf',
    path: 'Юристы/Договоры/2015/Доп_соглашение_2015.pdf',
    size: 890000,
    modifiedDate: '2015-12-14T17:00:00',
    createdDate: '2015-12-14T15:30:00',
    extension: 'pdf',
    status: 'initial',
    hash: 'e5f6a1b2c3d405'
  },
  {
    id: 'f-6',
    name: 'Шаблон_NDA_2024.docx',
    path: 'Юристы/Шаблоны/Шаблон_NDA_2024.docx',
    size: 145000,
    modifiedDate: '2024-02-10T12:00:00',
    createdDate: '2024-02-01T09:00:00',
    extension: 'docx',
    status: 'initial'
  },
  {
    id: 'f-7',
    name: 'Спецификация_Сервер_2014.dwg',
    path: 'Проекты/ИТ_Инфраструктура/Спецификация_Сервер_2014.dwg',
    size: 12500000,
    modifiedDate: '2014-06-25T13:10:00',
    createdDate: '2014-06-20T08:30:00',
    extension: 'dwg',
    status: 'initial'
  },
  {
    id: 'f-8',
    name: 'Архивная_схема_сети_2009.vsdx',
    path: 'Проекты/ИТ_Инфраструктура/Архивная_схема_сети_2009.vsdx',
    size: 4200000,
    modifiedDate: '2009-10-01T15:40:00',
    createdDate: '2009-09-25T11:00:00',
    extension: 'vsdx',
    status: 'initial'
  },
  {
    id: 'f-9',
    name: 'Приказ_о_приеме_2016_04.pdf',
    path: 'Кадры/Приказы/2016/Приказ_о_приеме_2016_04.pdf',
    size: 290000,
    modifiedDate: '2016-04-18T10:30:00',
    createdDate: '2016-04-18T10:00:00',
    extension: 'pdf',
    status: 'initial'
  },
  {
    id: 'f-10',
    name: 'Штатное_расписание_2012.xlsx',
    path: 'Кадры/Штатка/Штатное_расписание_2012.xlsx',
    size: 670000,
    modifiedDate: '2012-01-15T18:00:00',
    createdDate: '2012-01-11T12:00:00',
    extension: 'xlsx',
    status: 'initial'
  },
  {
    id: 'f-11',
    name: 'График_отпусков_2022.xlsx',
    path: 'Кадры/Отпуска/График_отпусков_2022.xlsx',
    size: 450000,
    modifiedDate: '2022-03-01T14:10:00',
    createdDate: '2022-02-28T09:00:00',
    extension: 'xlsx',
    status: 'initial'
  },
  {
    id: 'f-12',
    name: 'Презентация_клиента_2016.pptx',
    path: 'Продажи/Презентации/Презентация_клиента_2016.pptx',
    size: 8900000,
    modifiedDate: '2016-10-30T16:20:00',
    createdDate: '2016-10-28T14:00:00',
    extension: 'pptx',
    status: 'initial'
  }
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(1) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(2) + ' GB';
}

export function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}
