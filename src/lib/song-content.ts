export const songContentFields = [
  "title",
  "artist",
  "chordpro",
  "key",
  "language",
  "capo",
  "range",
  "startMelody",
  "tempo",
  "youtubeId",
  "label",
  "description",
] as const;

export const songContentLabels: Record<
  (typeof songContentFields)[number],
  string
> = {
  title: "Title",
  artist: "Artist",
  chordpro: "Sheet",
  key: "Key",
  language: "Language",
  capo: "Capo",
  range: "Vocal range",
  startMelody: "Starting melody",
  tempo: "Tempo",
  youtubeId: "YouTube video",
  label: "Version name",
  description: "Description",
};
