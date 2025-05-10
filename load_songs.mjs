import fs from 'fs';
import makeHash from 'object-hash';
import path from 'path';
// Update the path to the correct location of the types module
import {preambleKeywords} from "./src/types/preambleKeywords.js";

const songsPath = './songs/chordpro/';
const files = fs.readdirSync(songsPath).filter(file => (file.endsWith('.pro') || file.endsWith('.chordpro')));

const extractPreamble = (content, keywords) => {
  const preamble = {};
  keywords.forEach(keyword => {
    const match = content.match(new RegExp(`{${keyword}:\\s*(.+?)}`, 'i'));
    preamble[keyword] = match?.[1].trim() || "";
  });
  return preamble;
};
let metadata = files.map(chordproFile => {
  const content = fs.readFileSync(`${songsPath}/${chordproFile}`, 'utf8') || "";
  const preamble = extractPreamble(content, preambleKeywords);
  const disabled = (content.match(/{disabled:\s*(.+?)}/i)?.[1].trim() === 'true') || false;
  const contentHash = makeHash(content);

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
    ...preamble,
    chordproFile,
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