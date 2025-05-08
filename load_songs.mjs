import fs from 'fs';
import makeHash from 'object-hash';
import path from 'path';

const songsPath = './songs/chordpro/';
const files = fs.readdirSync(songsPath).filter(file => (file.endsWith('.pro') || file.endsWith('.chordpro')));
let metadata = files.map(chordproFile => {
  const content = fs.readFileSync(`${songsPath}/${chordproFile}`, 'utf8') || "";
  const title = content.match(/{title:\s*(.+?)}/i)?.[1].trim() || "";
  const artist = content.match(/{artist:\s*(.+?)}/i)?.[1].trim() || "";
  const songbooks = content.match(/{songbooks:\s*(.+?)}/i)?.[1].trim() || "";
  const key = content.match(/{key:\s*(.+?)}/i)?.[1].trim() || "";
  const dateAdded = content.match(/{date_added:\s*(.+?)}/i)?.[1].trim() || "";
  const language = content.match(/{language:\s*(.+?)}/i)?.[1].trim() || "";
  const tempo = content.match(/{tempo:\s*(.+?)}/i)?.[1].trim() || "";
  const capo = content.match(/{capo:\s*(.+?)}/i)?.[1].trim() || "";
  const range = content.match(/{range:\s*(.+?)}/i)?.[1].trim() || "";
  const prompt_model = content.match(/{prompt_model:\s*(.+?)}/i)?.[1].trim() || "";
  const prompt_id = content.match(/{prompt_id:\s*(.+?)}/i)?.[1].trim() || "";
  const image_model = content.match(/{image_model:\s*(.+?)}/i)?.[1].trim() || "";
  const startMelody = content.match(/{start_melody:\s*(.+?)}/i)?.[1].trim() || "";
  const pdfFilenames = content.match(/{pdf_filenames:\s*(.+?)}/i)?.[1].trim() || "";
  const contentHash = makeHash(content);
  const disabled = (content.match(/{disabled:\s*(.+?)}/i)?.[1].trim() === 'true') || false;

  // Get the filename without extension for illustrations folder check
  const filenameWithoutExt = chordproFile.replace(/\.(pro|chordpro)$/, '');

  // Check for illustrations in the corresponding folder
  const illustrationsPath = `./songs/illustrations/${filenameWithoutExt}`;
  let illustrations = [];

  // Check if the illustrations directory exists
  if (fs.existsSync(illustrationsPath) && fs.statSync(illustrationsPath).isDirectory()) {
    // Get all files in the illustrations directory
    const illustrationFiles = fs.readdirSync(illustrationsPath);

    // Extract filenames without extensions
    illustrations = illustrationFiles.map(file => {
      const ext = path.extname(file);
      return file.substring(0, file.length - ext.length);
    });
  }

  return {
    title,
    artist,
    key,
    language,
    dateAdded,
    songbooks,
    capo,
    tempo,
    range,
    prompt_model,
    prompt_id,
    image_model,
    startMelody,
    chordproFile,
    pdfFilenames,
    contentHash,
    disabled,
    illustrations // Add the illustrations array to the metadata
  };
});
metadata = metadata.filter(m => !m.disabled);
const hash = makeHash(metadata);
fs.mkdir('public', { recursive: true }, (err) => {
  if (err) throw err;
});
fs.writeFileSync('public/songDB.json', JSON.stringify(metadata, null, 2));
fs.writeFileSync('public/songDB.hash', hash);