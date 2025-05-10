// this is in a separate JS file so that Node can import it too
export const preambleKeywords = [
    "title",
    "artist",
    "songbooks",
    "key",
    "date_added",
    "language",
    "tempo",
    "capo",
    "range",
    "prompt_model",
    "prompt_id",
    "image_model",
    "start_melody",
    "pdf_filenames",
];

export const JS2chordproKeywords = {
    title: "title",
    artist: "artist",
    songbooks: "songbooks",
    key: "key",
    dateAdded: "date_added",
    language: "language",
    tempo: "tempo",
    capo: "capo",
    range: "range",
    startMelody: "start_melody",
    prompt_model: "prompt_model",
    prompt_id: "prompt_id",
    image_model: "image_model",
    pdfFilenames: "pdf_filenames",
};

export const chordpro2JSKeywords = Object.fromEntries(
    Object.entries(JS2chordproKeywords).map(([key, value]) => [value, key])
);