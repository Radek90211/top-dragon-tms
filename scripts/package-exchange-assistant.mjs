import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
const root=fileURLToPath(new URL('..',import.meta.url));
const base=path.join(root,'browser-extension');
const files=fs.readdirSync(base,{withFileTypes:true}).filter(f=>f.isFile()).map(f=>[f.name,fs.readFileSync(path.join(base,f.name))]);
files.push(['setup/035_exchange_assistant.sql',fs.readFileSync(path.join(root,'supabase/migrations/035_exchange_assistant.sql'))]);
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let c=0xffffffff;for(const byte of bytes)c=table[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;
for(const [relative,data]of files.sort(([a],[b])=>a.localeCompare(b))){
  const name=Buffer.from('top-dragon-assistant/'+relative),compressed=deflateRawSync(data),sum=crc(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(sum,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
  local.push(header,name,compressed);
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(33,14);record.writeUInt32LE(sum,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(offset,42);central.push(record,name);offset+=header.length+name.length+compressed.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const out=path.join(root,'public/top-dragon-assistant.zip');fs.writeFileSync(out,Buffer.concat([...local,directory,end]));
console.log(`Paczka asystenta: ${files.length} plików, ${fs.statSync(out).size} bajtów`);
