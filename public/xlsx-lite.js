(function attachTopDragonXlsx(global) {
  "use strict";

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder("utf-8");

  function asBytes(value) {
    return value instanceof Uint8Array ? value : new Uint8Array(value);
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      result.set(part, offset);
      offset += part.length;
    });
    return result;
  }

  function readU16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readU32(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function writeU16(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255]);
  }

  function writeU32(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  }

  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = Array.from({ length: 256 }, (_, index) => {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        return value >>> 0;
      });
    }
    let value = 0xffffffff;
    bytes.forEach((byte) => { value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); });
    return (value ^ 0xffffffff) >>> 0;
  }

  function decodeXml(value) {
    return String(value || "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function localName(node) {
    return String(node?.localName || node?.nodeName || "").split(":").pop();
  }

  function child(node, name) {
    return Array.from(node?.childNodes || []).find((item) => localName(item) === name) || null;
  }

  function children(node, name) {
    return Array.from(node?.childNodes || []).filter((item) => localName(item) === name);
  }

  function allElements(node, name) {
    return Array.from(node?.getElementsByTagName?.("*") || []).filter((item) => localName(item) === name);
  }

  function xmlDocument(bytes) {
    if (typeof DOMParser === "undefined") throw new Error("Przeglądarka nie obsługuje odczytu arkuszy Excel.");
    const document = new DOMParser().parseFromString(textDecoder.decode(bytes), "application/xml");
    if (document.querySelector?.("parsererror")) throw new Error("Plik XLSX zawiera nieprawidłowy XML.");
    return document;
  }

  function normalizeZipPath(path) {
    const parts = String(path || "").replaceAll("\\", "/").split("/");
    const result = [];
    parts.forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") result.pop();
      else result.push(part);
    });
    return result.join("/");
  }

  function zipEntries(bytes) {
    let eocd = -1;
    for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 0xffff - 22); index -= 1) {
      if (readU32(bytes, index) === 0x06054b50) { eocd = index; break; }
    }
    if (eocd < 0) throw new Error("Plik nie jest prawidłowym archiwum XLSX.");
    const count = readU16(bytes, eocd + 10);
    const centralSize = readU32(bytes, eocd + 12);
    const centralOffset = readU32(bytes, eocd + 16);
    if (centralOffset + centralSize > bytes.length) throw new Error("Uszkodzona struktura pliku XLSX.");
    const files = new Map();
    let offset = centralOffset;
    for (let index = 0; index < count; index += 1) {
      if (readU32(bytes, offset) !== 0x02014b50) throw new Error("Nieprawidłowy wpis ZIP w pliku XLSX.");
      const method = readU16(bytes, offset + 10);
      const compressedSize = readU32(bytes, offset + 20);
      const nameLength = readU16(bytes, offset + 28);
      const extraLength = readU16(bytes, offset + 30);
      const commentLength = readU16(bytes, offset + 32);
      const localOffset = readU32(bytes, offset + 42);
      const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      files.set(normalizeZipPath(name), { method, compressedSize, localOffset });
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") throw new Error("Ta przeglądarka nie potrafi rozpakować skompresowanego XLSX.");
    let stream;
    try {
      stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    } catch (error) {
      throw new Error("Nie udało się rozpakować arkusza XLSX. Zaktualizuj przeglądarkę i spróbuj ponownie.");
    }
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZipFile(bytes, files, name) {
    const entry = files.get(normalizeZipPath(name));
    if (!entry) return null;
    const offset = entry.localOffset;
    if (readU32(bytes, offset) !== 0x04034b50) throw new Error("Uszkodzony nagłówek wpisu XLSX.");
    const nameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const compressed = bytes.slice(start, start + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return inflateRaw(compressed);
    throw new Error("Nieobsługiwany sposób kompresji arkusza XLSX.");
  }

  function columnIndex(reference) {
    const letters = String(reference || "").match(/^[A-Z]+/i)?.[0] || "A";
    return letters.toUpperCase().split("").reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  }

  function textFromNode(node) {
    return Array.from(node?.getElementsByTagName?.("*") || [])
      .filter((item) => localName(item) === "t")
      .map((item) => item.textContent || "")
      .join("");
  }

  function uniqueHeaders(values) {
    const used = new Map();
    return values.map((value, index) => {
      const base = String(value || "").trim() || `Kolumna ${index + 1}`;
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      return count === 1 ? base : `${base} (${count})`;
    });
  }

  async function readWorkbook(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const files = zipEntries(bytes);
    const workbookXml = await readZipFile(bytes, files, "xl/workbook.xml");
    const relsXml = await readZipFile(bytes, files, "xl/_rels/workbook.xml.rels");
    if (!workbookXml || !relsXml) throw new Error("Nie znaleziono struktury skoroszytu XLSX.");
    const workbook = xmlDocument(workbookXml);
    const rels = xmlDocument(relsXml);
    const relationships = new Map(Array.from(rels.getElementsByTagName?.("*") || [])
      .filter((node) => localName(node) === "Relationship")
      .map((node) => [String(node.getAttribute("Id") || ""), String(node.getAttribute("Target") || "")]));
    const sharedStringsXml = await readZipFile(bytes, files, "xl/sharedStrings.xml");
    const sharedStrings = sharedStringsXml ? allElements(xmlDocument(sharedStringsXml), "si").map(textFromNode) : [];
    const sheets = [];
    const sheetNodes = allElements(workbook, "sheet");
    for (const sheetNode of sheetNodes) {
      const relationId = sheetNode.getAttribute("r:id") || sheetNode.getAttributeNS?.("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || "";
      const target = relationships.get(relationId);
      if (!target) continue;
      const path = normalizeZipPath(target.startsWith("/") ? target.slice(1) : `xl/${target}`);
      const sheetXml = await readZipFile(bytes, files, path);
      if (!sheetXml) continue;
      const document = xmlDocument(sheetXml);
      const rows = [];
      allElements(document, "row").forEach((rowNode) => {
        const values = [];
        allElements(rowNode, "c").forEach((cellNode) => {
          const index = columnIndex(cellNode.getAttribute("r"));
          const type = String(cellNode.getAttribute("t") || "");
          const valueNode = child(cellNode, "v");
          let value = valueNode?.textContent || "";
          if (type === "inlineStr") value = textFromNode(child(cellNode, "is"));
          else if (type === "s") value = sharedStrings[Number(value)] || "";
          else if (type === "b") value = value === "1";
          else if (value !== "" && /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) value = Number(value);
          values[index] = value;
        });
        rows.push(values);
      });
      const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
      const headers = uniqueHeaders(rows.shift() || Array.from({ length: width }, (_, index) => `Kolumna ${index + 1}`));
      const normalizedRows = rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
      sheets.push({ name: String(sheetNode.getAttribute("name") || `Arkusz ${sheets.length + 1}`), headers, rows: normalizedRows });
    }
    return { sheets };
  }

  function zipStored(files) {
    const local = [];
    const central = [];
    let offset = 0;
    files.forEach((file) => {
      const name = textEncoder.encode(file.name);
      const data = asBytes(file.data);
      const crc = crc32(data);
      const header = concatBytes([new Uint8Array([0x50, 0x4b, 0x03, 0x04]), writeU16(20), writeU16(0), writeU16(0), writeU16(0), writeU16(0), writeU32(crc), writeU32(data.length), writeU32(data.length), writeU16(name.length), writeU16(0), name]);
      local.push(header, data);
      central.push(concatBytes([new Uint8Array([0x50, 0x4b, 0x01, 0x02]), writeU16(20), writeU16(20), writeU16(0), writeU16(0), writeU16(0), writeU16(0), writeU32(crc), writeU32(data.length), writeU32(data.length), writeU16(name.length), writeU16(0), writeU16(0), writeU16(0), writeU16(0), writeU32(0), writeU32(offset), name]));
      offset += header.length + data.length;
    });
    const centralBytes = concatBytes(central);
    return concatBytes([...local, centralBytes, new Uint8Array([0x50, 0x4b, 0x05, 0x06]), writeU16(0), writeU16(0), writeU16(files.length), writeU16(files.length), writeU32(centralBytes.length), writeU32(offset), writeU16(0)]);
  }

  function columnName(index) {
    let value = index + 1;
    let result = "";
    while (value) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  function cellXml(reference, value) {
    if (value == null || value === "") return `<c r="${reference}" t="inlineStr"><is><t></t></is></c>`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`;
    if (typeof value === "boolean") return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
  }

  function worksheetXml(sheet) {
    const columns = Array.isArray(sheet.columns) ? sheet.columns : [];
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const headerValues = columns.map((column) => typeof column === "string" ? column : column?.label || column?.key || "");
    const rowXml = [headerValues, ...rows.map((row) => columns.map((column) => {
      const key = typeof column === "string" ? column : column?.key || column?.label || "";
      return row?.[key] ?? (typeof column === "object" ? row?.[column.label] : "");
    }))].map((values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, columnIndex) => cellXml(`${columnName(columnIndex)}${rowIndex + 1}`, value)).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
  }

  function downloadWorkbook(filename, sheets) {
    const definitions = (Array.isArray(sheets) && sheets.length ? sheets : [{ name: "Arkusz1", columns: [], rows: [] }]).map((sheet, index) => ({ ...sheet, name: String(sheet.name || `Arkusz${index + 1}`) }));
    const workbookSheets = definitions.map((sheet, index) => `<sheet name="${escapeXml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
    const workbookRels = definitions.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
    const overrides = definitions.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
    const files = [
      { name: "[Content_Types].xml", data: textEncoder.encode(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`) },
      { name: "_rels/.rels", data: textEncoder.encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
      { name: "xl/workbook.xml", data: textEncoder.encode(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`) },
      { name: "xl/_rels/workbook.xml.rels", data: textEncoder.encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`) },
      ...definitions.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: textEncoder.encode(worksheetXml(sheet)) })),
    ];
    const blob = new Blob([zipStored(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = String(filename || "top-dragon.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  global.TopDragonXlsx = { readWorkbook, downloadWorkbook };
})(window);
