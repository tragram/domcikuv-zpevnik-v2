import fs from 'fs';
const path = './songs';

const files = fs.readdirSync(path).filter(file => (file.endsWith('.pro') | file.endsWith('.chordpro')));
const metadata = files.map(file => {
  const content = fs.readFileSync(`${path}/${file}`, 'utf8');
  const title = content.match(/{title:\s*(.+?)}/i)?.[1] || 'Unknown Title';
  const artist = content.match(/{artist:\s*(.+?)}/i)?.[1] || 'Unknown Artist';
  const key = content.match(/{key:\s*(.+?)}/i)?.[1] || 'Unknown Key';
  const date_added = content.match(/{date_added:\s*(.+?)}/i)?.[1] || 'Unknown Date';
  const language = content.match(/{language:\s*(.+?)}/i)?.[1] || 'Unknown Language';
  return { title, artist, key, language, date_added, file, content };
});
fs.mkdir('public', { recursive: true }, (err) => {
  if (err) throw err;
});
fs.writeFileSync('public/songs.json', JSON.stringify(metadata, null, 2));
