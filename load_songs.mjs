import fs from 'fs';
const path = './songs';

const files = fs.readdirSync(path).filter(file => (file.endsWith('.pro') | file.endsWith('.chordpro')));
const metadata = files.map(file => {
  const content = fs.readFileSync(`${path}/${file}`, 'utf8') || "";
  const title = content.match(/{title:\s*(.+?)}/i)?.[1].trim() || "";
  const artist = content.match(/{artist:\s*(.+?)}/i)?.[1].trim() || "";
  const key = content.match(/{key:\s*(.+?)}/i)?.[1].trim() || "";
  const date_added = content.match(/{date_added:\s*(.+?)}/i)?.[1].trim() || "";
  const language = content.match(/{language:\s*(.+?)}/i)?.[1].trim() || "";
  const tempo = content.match(/{tempo:\s*(.+?)}/i)?.[1].trim() || "";
  const capo = content.match(/{capo:\s*(.+?)}/i)?.[1].trim() || "";
  const range = content.match(/{range:\s*(.+?)}/i)?.[1].trim() || "";
  const start_melody = content.match(/{start_melody:\s*(.+?)}/i)?.[1].trim() || "";
  const pdf_filenames = content.match(/{pdf_filenames:\s*(.+?)}/i)?.[1].trim() || "";
  return { title, artist, key, language, date_added, capo, tempo, range, file, content, start_melody, pdf_filenames };
});
fs.mkdir('public', { recursive: true }, (err) => {
  if (err) throw err;
});
fs.writeFileSync('public/songs.json', JSON.stringify(metadata, null, 2));
