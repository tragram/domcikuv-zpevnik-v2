import fs from 'fs';
import makeHash from 'object-hash';

const path = './songs/chordpro/';
const files = fs.readdirSync(path).filter(file => (file.endsWith('.pro') || file.endsWith('.chordpro')));
let metadata = files.map(chordproFile => {
  const content = fs.readFileSync(`${path}/${chordproFile}`, 'utf8') || "";
  const title = content.match(/{title:\s*(.+?)}/i)?.[1].trim() || "";
  const artist = content.match(/{artist:\s*(.+?)}/i)?.[1].trim() || "";
  const key = content.match(/{key:\s*(.+?)}/i)?.[1].trim() || "";
  const dateAdded = content.match(/{date_added:\s*(.+?)}/i)?.[1].trim() || "";
  const language = content.match(/{language:\s*(.+?)}/i)?.[1].trim() || "";
  const tempo = content.match(/{tempo:\s*(.+?)}/i)?.[1].trim() || "";
  const capo = content.match(/{capo:\s*(.+?)}/i)?.[1].trim() || "";
  const range = content.match(/{range:\s*(.+?)}/i)?.[1].trim() || "";
  const illustrationAuthor = content.match(/{illustration_author:\s*(.+?)}/i)?.[1].trim() || "";
  const startMelody = content.match(/{start_melody:\s*(.+?)}/i)?.[1].trim() || "";
  const pdfFilenames = content.match(/{pdf_filenames:\s*(.+?)}/i)?.[1].trim() || "";
  const contentHash = makeHash(content);
  const disabled = (content.match(/{disabled:\s*(.+?)}/i)?.[1].trim() === 'true') || false;
  return { title, artist, key, language, dateAdded, capo, tempo, range, illustrationAuthor, startMelody, chordproFile, pdfFilenames, contentHash, disabled };
});
metadata = metadata.filter(m => !m.disabled);
const hash = makeHash(metadata);
fs.mkdir('public', { recursive: true }, (err) => {
  if (err) throw err;
});
fs.writeFileSync('public/songDB.json', JSON.stringify(metadata, null, 2));
fs.writeFileSync('public/songDB.hash', hash);