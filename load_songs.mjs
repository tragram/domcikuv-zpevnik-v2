import fs from 'fs';
import makeHash from 'object-hash';
import path from 'path';
// Update the path to match your project structure
import { preambleKeywords, chordpro2JSKeywords } from "./src/types/preambleKeywords.js";
// Import the validator
import { validateMetadataDefinitions, validateSongObject } from './src/types/metadata-validator.js';

// Validate that metadata definitions are in sync before proceeding
const validationResult = validateMetadataDefinitions();
if (!validationResult.isValid) {
  console.error('METADATA DEFINITION ERRORS:');
  validationResult.errors.forEach(error => console.error(`- ${error}`));
  console.error('\nFix these errors before continuing!');
  process.exit(1);
}

const songsPath = './songs/chordpro/';
const files = fs.readdirSync(songsPath).filter(file => (file.endsWith('.pro') || file.endsWith('.chordpro')));

const extractPreamble = (content, keywords) => {
  const preamble = {};
  keywords.forEach(keyword => {
    const match = content.match(new RegExp(`{${keyword}:\\s*(.+?)}`, 'i'));
    preamble[chordpro2JSKeywords[keyword]] = match?.[1].trim() || "";
  });
  return preamble;
};

let songDB = files.map(chordproFile => {
  const content = fs.readFileSync(`${songsPath}/${chordproFile}`, 'utf8') || "";
  const preamble = extractPreamble(content, preambleKeywords);
  const disabled = (content.match(/{disabled:\s*(.+?)}/i)?.[1].trim() === 'true') || false;
  const contentHash = makeHash(content);

  // Get the filename without extension for illustrations folder check
  const filenameWithoutExt = chordproFile.replace(/\.(pro|chordpro)$/, '');

  // Check for illustrations in the corresponding folder
  const illustrationsPath = `./songs/illustrations/${filenameWithoutExt}`;
  let availableIllustrations = [];

  // Check if the illustrations directory exists
  if (fs.existsSync(illustrationsPath) && fs.statSync(illustrationsPath).isDirectory()) {
    // Get all files in the illustrations directory
    const illustrationFiles = fs.readdirSync(illustrationsPath);

    // Extract filenames without extensions
    availableIllustrations = illustrationFiles.map(file => {
      const ext = path.extname(file);
      return file.substring(0, file.length - ext.length);
    });
  }

  const songData = {
    ...preamble,
    chordproFile,
    contentHash,
    availableIllustrations,
    disabled
  };

  return songData;
});

// Filter out disabled songs
songDB = songDB.filter(m => !m.disabled);

// Remove the disabled field from all song objects
songDB = songDB.map(({ disabled, ...rest }) => rest);

// Validate each song object in songDB
songDB.forEach(songData => {
  const songValidation = validateSongObject(songData);
  if (!songValidation.isValid) {
    console.warn(`Warning: Issues with song "${songData.chordproFile}":`);
    songValidation.errors.forEach(error => console.warn(`  - ${error}`));
  }
});

const hash = makeHash(songDB);

fs.mkdir('public', { recursive: true }, (err) => {
  if (err) throw err;
});

fs.writeFileSync('public/songDB.json', JSON.stringify(songDB, null, 2));
fs.writeFileSync('public/songDB.hash', hash);

console.log(`Successfully processed ${songDB.length} songs.`);