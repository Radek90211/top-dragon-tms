(function (global) {
  'use strict';

  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');

  function xmlEscape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }

  function columnName(index) {
    let value = Number(index) + 1;
    let result = '';
    while (value > 0) {
      value -= 1;
      result = String.fromCharCode(65 + (value % 26)) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }

  function columnIndexFromRef(ref) {
    const match = String(ref || '').toUpperCase().match(/^([A-Z]+)/);
    if (!match) return -1;
    return match[1].split('').reduce((sum, letter) => sum * 26 + (letter.charCodeAt(0) - 64), 0) - 1;
  }

  function normalizeSheetName(name, fallback = 'Dane') {
    const clean = String(name || fallback).replace(/[\\/*?:\[\]]/g, ' ').trim().slice(0, 31);
    return clean || fallback;
  }

  function cellXml(value, ref) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<c r="${ref}" t="n"><v>${value}</v></c>`;
    }
    if (typeof value === 'boolean') {
      return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
    }
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }

  function worksheetXml(columns, rows) {
    const safeColumns = Array.isArray(columns) ? columns : [];
    const safeRows = Array.isArray(rows) ? rows : [];
    const allRows = [
      safeColumns.map(column => column.label ?? column.key ?? ''),
      ...safeRows.map(row => safeColumns.map(column => row?.[column.key] ?? '')),
    ];

    const rowXml = allRows.map((values, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = values.map((value, columnIndex) => cellXml(value, `${columnName(columnIndex)}${rowNumber}`)).join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    }).join('');

    const lastColumn = columnName(Math.max(0, safeColumns.length - 1));
    const lastRow = Math.max(1, allRows.length);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<dimension ref="A1:${lastColumn}${lastRow}"/>` +
      `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>` +
      `<sheetData>${rowXml}</sheetData>` +
      `</worksheet>`;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31);
    const day = ((year - 1980) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
    return { time, day };
  }

  function concatBytes(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    chunks.forEach(chunk => {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    return result;
  }

  function writeU16(view, offset, value) { view.setUint16(offset, value, true); }
  function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

  function buildZip(entries) {
    const localChunks = [];
    const centralChunks = [];
    let localOffset = 0;
    const stamp = dosDateTime();

    entries.forEach(entry => {
      const nameBytes = encoder.encode(entry.name);
      const dataBytes = typeof entry.data === 'string' ? encoder.encode(entry.data) : new Uint8Array(entry.data || []);
      const crc = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      writeU32(localView, 0, 0x04034b50);
      writeU16(localView, 4, 20);
      writeU16(localView, 6, 0x0800);
      writeU16(localView, 8, 0);
      writeU16(localView, 10, stamp.time);
      writeU16(localView, 12, stamp.day);
      writeU32(localView, 14, crc);
      writeU32(localView, 18, dataBytes.length);
      writeU32(localView, 22, dataBytes.length);
      writeU16(localView, 26, nameBytes.length);
      writeU16(localView, 28, 0);
      localHeader.set(nameBytes, 30);
      localChunks.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      writeU32(centralView, 0, 0x02014b50);
      writeU16(centralView, 4, 20);
      writeU16(centralView, 6, 20);
      writeU16(centralView, 8, 0x0800);
      writeU16(centralView, 10, 0);
      writeU16(centralView, 12, stamp.time);
      writeU16(centralView, 14, stamp.day);
      writeU32(centralView, 16, crc);
      writeU32(centralView, 20, dataBytes.length);
      writeU32(centralView, 24, dataBytes.length);
      writeU16(centralView, 28, nameBytes.length);
      writeU16(centralView, 30, 0);
      writeU16(centralView, 32, 0);
      writeU16(centralView, 34, 0);
      writeU16(centralView, 36, 0);
      writeU32(centralView, 38, 0);
      writeU32(centralView, 42, localOffset);
      centralHeader.set(nameBytes, 46);
      centralChunks.push(centralHeader);

      localOffset += localHeader.length + dataBytes.length;
    });

    const centralDirectory = concatBytes(centralChunks);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    writeU32(endView, 0, 0x06054b50);
    writeU16(endView, 4, 0);
    writeU16(endView, 6, 0);
    writeU16(endView, 8, entries.length);
    writeU16(endView, 10, entries.length);
    writeU32(endView, 12, centralDirectory.length);
    writeU32(endView, 16, localOffset);
    writeU16(endView, 20, 0);

    return concatBytes([...localChunks, centralDirectory, end]);
  }

  function buildWorkbook(sheets) {
    const safeSheets = (Array.isArray(sheets) ? sheets : []).map((sheet, index) => ({
      name: normalizeSheetName(sheet?.name, `Arkusz ${index + 1}`),
      columns: Array.isArray(sheet?.columns) ? sheet.columns : [],
      rows: Array.isArray(sheet?.rows) ? sheet.rows : [],
    }));
    if (!safeSheets.length) throw new Error('Brak danych do utworzenia pliku Excel.');

    const contentOverrides = safeSheets.map((_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join('');
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      contentOverrides + `</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`;

    const workbookSheets = safeSheets.map((sheet, index) =>
      `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    ).join('');
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>${workbookSheets}</sheets></workbook>`;

    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      safeSheets.map((_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
      ).join('') + `</Relationships>`;

    const entries = [
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rootRels },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
      ...safeSheets.map((sheet, index) => ({
        name: `xl/worksheets/sheet${index + 1}.xml`,
        data: worksheetXml(sheet.columns, sheet.rows),
      })),
    ];
    return buildZip(entries);
  }

  function downloadWorkbook(filename, sheets) {
    if (typeof document === 'undefined') throw new Error('Eksport Excel wymaga przeglądarki.');
    const bytes = buildWorkbook(sheets);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = String(filename || 'top-dragon.xlsx').replace(/\.xlsx$/i, '') + '.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function findEndOfCentralDirectory(bytes) {
    const min = Math.max(0, bytes.length - 0xffff - 22);
    for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
      if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) return offset;
    }
    return -1;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Ta przeglądarka nie obsługuje odczytu skompresowanego pliku XLSX.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocdOffset = findEndOfCentralDirectory(bytes);
    if (eocdOffset < 0) throw new Error('Nie znaleziono struktury ZIP w pliku XLSX.');
    const entryCount = view.getUint16(eocdOffset + 10, true);
    let offset = view.getUint32(eocdOffset + 16, true);
    const files = new Map();

    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Uszkodzony katalog pliku XLSX.');
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));

      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) throw new Error('Uszkodzony wpis pliku XLSX.');
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateRaw(compressed);
      else throw new Error(`Nieobsługiwana metoda kompresji XLSX: ${method}.`);
      files.set(name, data);
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  function parseXml(text) {
    if (typeof DOMParser === 'undefined') throw new Error('Odczyt XLSX wymaga przeglądarki z DOMParser.');
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Nie udało się odczytać XML w pliku XLSX.');
    return doc;
  }

  function xmlText(bytes) { return decoder.decode(bytes || new Uint8Array()); }

  function parseSharedStrings(bytes) {
    if (!bytes) return [];
    const doc = parseXml(xmlText(bytes));
    return Array.from(doc.getElementsByTagName('si')).map(item =>
      Array.from(item.getElementsByTagName('t')).map(node => node.textContent || '').join('')
    );
  }

  function parseWorksheet(bytes, sharedStrings) {
    const doc = parseXml(xmlText(bytes));
    const rows = [];
    Array.from(doc.getElementsByTagName('row')).forEach(rowNode => {
      const values = [];
      Array.from(rowNode.getElementsByTagName('c')).forEach(cell => {
        const index = columnIndexFromRef(cell.getAttribute('r'));
        if (index < 0) return;
        const type = cell.getAttribute('t') || '';
        let value = '';
        if (type === 'inlineStr') {
          value = Array.from(cell.getElementsByTagName('t')).map(node => node.textContent || '').join('');
        } else {
          const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
          if (type === 's') value = sharedStrings[Number(raw)] ?? '';
          else if (type === 'b') value = raw === '1';
          else if (type === 'e') value = ''; // 3L.56: błąd Excela (#REF!, #N/A...) nie jest danymi importowymi
          else if (type === 'str') value = raw;
          else if (raw !== '' && Number.isFinite(Number(raw))) value = Number(raw);
          else value = raw;
        }
        values[index] = value;
      });
      rows.push(values);
    });
    if (!rows.length) return { headers: [], rows: [] };
    const headers = (rows[0] || []).map(value => String(value ?? '').trim());
    const dataRows = rows.slice(1).filter(values => values.some(value => value !== '' && value !== null && value !== undefined)).map(values => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = values[index] ?? '';
      });
      return record;
    });
    return { headers, rows: dataRows };
  }

  async function readWorkbook(fileOrBuffer) {
    const buffer = fileOrBuffer instanceof ArrayBuffer
      ? fileOrBuffer
      : (ArrayBuffer.isView(fileOrBuffer)
        ? fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength)
        : await fileOrBuffer.arrayBuffer());
    const files = await unzip(buffer);
    const workbookBytes = files.get('xl/workbook.xml');
    const relBytes = files.get('xl/_rels/workbook.xml.rels');
    if (!workbookBytes || !relBytes) throw new Error('Plik nie zawiera prawidłowego skoroszytu XLSX.');

    const workbookDoc = parseXml(xmlText(workbookBytes));
    const relDoc = parseXml(xmlText(relBytes));
    const relationshipTargets = new Map();
    Array.from(relDoc.getElementsByTagName('Relationship')).forEach(rel => {
      relationshipTargets.set(rel.getAttribute('Id'), rel.getAttribute('Target'));
    });
    const sharedStrings = parseSharedStrings(files.get('xl/sharedStrings.xml'));
    const sheets = [];

    for (const sheetNode of Array.from(workbookDoc.getElementsByTagName('sheet'))) {
      const relationId = sheetNode.getAttribute('r:id') || sheetNode.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const target = relationshipTargets.get(relationId);
      if (!target) continue;
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      const sheetBytes = files.get(path);
      if (!sheetBytes) continue;
      const parsed = parseWorksheet(sheetBytes, sharedStrings);
      sheets.push({ name: sheetNode.getAttribute('name') || 'Arkusz', ...parsed });
    }
    if (!sheets.length) throw new Error('Plik XLSX nie zawiera czytelnego arkusza.');
    return { sheets };
  }

  global.TopDragonXlsx = {
    buildWorkbook,
    downloadWorkbook,
    readWorkbook,
  };
})(typeof window !== 'undefined' ? window : globalThis);
