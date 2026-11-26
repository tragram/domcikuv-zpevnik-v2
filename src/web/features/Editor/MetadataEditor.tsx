import { Link } from "@tanstack/react-router";
import { ChevronDown, Layers, Music2, Play, SlidersHorizontal, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode, type FC } from "react";

import { UserData } from "src/web/hooks/use-user-data";
import SelectOrEditList from "~/components/SelectOrEditList";
import { Button } from "~/components/ui/button";
import { useSongDB } from "~/hooks/use-songDB";
import { EditorState } from "~/types/types";
import { guessKey } from "../SongView/utils/songRendering";
import MetadataField from "./components/MetadataField";
import { VersionDetailsFields } from "./components/VersionDetailsFields";
import YoutubeField from "./components/YoutubeField";
import TransposeControl from "./components/TransposeControl";
import SmartFeatures from "./components/SmartFeatures";
import type { EvaluatedFeature, SmartFeature } from "./Editor";
import EditorSettingsComponent, { EditorSettings } from "./EditorSettings";
import { indexEditorCatalog } from "./editor-catalog";

interface MetadataEditorProps {
  editingSongId?: string;
  defaultMetadata: EditorState;
  metadata: EditorState;
  extractedMetadata: Partial<EditorState>;
  fieldErrors: Partial<Record<keyof EditorState, string>>;
  updateMetadata: (field: keyof EditorState, value: string) => void;
  editorSettings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  userData: UserData;
  hasIllustration?: boolean;
  features: EvaluatedFeature[];
  isProcessing: boolean;
  onTranspose: (steps: -1 | 1) => void;
  onExecuteFeature: (feature: SmartFeature) => void;
}

function MetadataSection({ title, summary, icon: Icon, initiallyOpen = false, error, children }: {
  title: string;
  summary?: string;
  icon: LucideIcon;
  initiallyOpen?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const section = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (error && section.current) section.current.open = true;
  }, [error]);

  return (
    <details ref={section} open={initiallyOpen} className="group/section border-b border-primary/60">
      <summary className="group/toggle flex h-12 cursor-pointer list-none items-center gap-2.5 px-3 py-1 text-foreground group-open/section:bg-primary group-open/section:text-primary-foreground focus-visible:outline-2 focus-visible:-outline-offset-4 [&::-webkit-details-marker]:hidden">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold tracking-tight">{title}</span>
          {summary && <span className="block truncate text-xs text-muted-foreground group-open/section:text-primary-foreground">{summary}</span>}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 motion-safe:transition-transform group-hover/toggle:translate-y-0.5 group-open/section:rotate-180 group-open/section:group-hover/toggle:-translate-y-0.5" />
      </summary>
      <div className="@container space-y-2 px-3 py-2.5">{children}</div>
    </details>
  );
}

const MetadataEditor: FC<MetadataEditorProps> = ({
  editingSongId,
  defaultMetadata,
  metadata,
  extractedMetadata,
  fieldErrors,
  updateMetadata,
  editorSettings,
  onSettingsChange,
  userData,
  hasIllustration = false,
  features,
  isProcessing,
  onExecuteFeature,
  onTranspose,
}) => {
  const { songDB, catalog } = useSongDB(userData);
  const catalogIndex = useMemo(() => indexEditorCatalog(catalog), [catalog]);
  const artistSuggestions = useMemo(
    () => catalogIndex.suggestArtists(metadata.artist),
    [catalogIndex, metadata.artist],
  );
  const { matches: matchingSongs, versionTarget } = useMemo(
    () => catalogIndex.findMatches(metadata.artist, metadata.title, editingSongId),
    [catalogIndex, metadata.artist, metadata.title, editingSongId],
  );
  const titleSuggestions = useMemo(
    () => versionTarget ? [] : catalogIndex.suggestTitles(metadata.artist, metadata.title, editingSongId),
    [catalogIndex, metadata.artist, metadata.title, editingSongId, versionTarget],
  );
  function fieldProps(field: keyof EditorState) {
    return {
      value: metadata[field]?.toString(),
      onChange: (value: string) => updateMetadata(field, value),
      modified: defaultMetadata[field] !== metadata[field],
      error: fieldErrors[field],
      disabled: extractedMetadata[field] !== undefined,
    };
  }

  const musicSummary = [
    metadata.key,
    metadata.capo != null && `Capo ${metadata.capo}`,
    metadata.tempo && `${metadata.tempo} BPM`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="metadata-panel w-full">
      <MetadataSection
        title="Song details" icon={Music2}
        summary={[metadata.title, metadata.artist].filter(Boolean).join(" · ")}
        error={fieldErrors.artist || fieldErrors.title || fieldErrors.language}
      >
        <MetadataField
          {...fieldProps("artist")}
          label="Artist"
          placeholder="František Omáčka"
          required
          suggestions={artistSuggestions}
        />
        <MetadataField
          {...fieldProps("title")}
          label="Title"
          placeholder="Apassionata v F"
          required
          suggestions={titleSuggestions}
        />
        <div role="status" className="empty:sr-only">
          {matchingSongs.length > 0 && (
            <div className="rounded-md border border-primary/50 bg-primary/10 p-2 text-sm">
              <p>
                {matchingSongs.length === 1
                  ? "This song is already in the catalog."
                  : "Matching songs are already in the catalog."}
              </p>
              <ul>
                {matchingSongs.map((song) => (
                  <li key={song.id}>
                    <Link
                      to="/song/$songId"
                      params={{ songId: song.id }}
                      className="font-medium underline underline-offset-2"
                    >
                      {song.artist} — {song.title}
                    </Link>
                    {song.id === versionTarget?.id && (
                      <p>Submitting this draft will add a separate version of this song.</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <MetadataField
          {...fieldProps("language")}
          label="Language"
          description="Choose a language or add one. New languages may appear without a flag."
          renderInput={props => (
            <SelectOrEditList
              {...props}
              options={Object.keys(songDB.languages)}
              placeholderCollapsed="Select language"
              placeholderSearch="Find or add language"
              noOptionsFoundText="No language found."
              addNewText="Add new language"
              className="h-10 rounded-lg border-input/50 bg-card px-3 text-foreground shadow-none"
            />
          )}
        />
      </MetadataSection>
      <MetadataSection
        title="Musical details" icon={SlidersHorizontal} summary={musicSummary}
        initiallyOpen={!!editingSongId}
        error={fieldErrors.key || fieldErrors.capo || fieldErrors.tempo || fieldErrors.range || fieldErrors.startMelody}
      >
        <MetadataField
          {...fieldProps("key")}
          label="Key"
          description="Use a note name for major (F, Bb) or add m or mi for minor (Dm). Guess key reads the chords in the editor."
          placeholder="Dm"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="metadata-field-action"
              disabled={extractedMetadata.key !== undefined}
              onClick={() => {
                const guessedKey = guessKey(metadata.chordpro);
                if (guessedKey) {
                  updateMetadata("key", guessedKey.toString());
                }
              }}
            >
              Guess key
            </Button>
          }
        />
        <div className="grid gap-2 @[10rem]:grid-cols-2">
          <MetadataField
            {...fieldProps("capo")}
            label="Capo"
            description="Fret number. Use 0 for no capo."
            inputMode="numeric"
            placeholder="0"
          />
          <MetadataField
            {...fieldProps("tempo")}
            label="Tempo"
            description="Song tempo in beats per minute."
            inputMode="numeric"
            placeholder="96"
            unit="BPM"
          />
        </div>
        <div className="grid gap-2 @[19rem]:grid-cols-2">
        <MetadataField
          {...fieldProps("range")}
          label="Vocal range"
          description="Lowest and highest sung notes with octave numbers, e.g. c1-g2. Used by the vocal range filter."
          placeholder="e.g. c1-g2"
        />
        <MetadataField
          {...fieldProps("startMelody")}
          label="Start melody"
          description="The opening notes in order, e.g. c# d e. This optional field has no fixed notation."
          placeholder="c# d e"
        />
        </div>
        <TransposeControl content={metadata.chordpro} isProcessing={isProcessing} onTranspose={onTranspose} />
      </MetadataSection>
      <MetadataSection title="Recording" icon={Play} summary={metadata.youtubeId || "No video linked"} error={fieldErrors.youtubeId}>
        <YoutubeField
          value={metadata.youtubeId}
          onChange={(value) => updateMetadata("youtubeId", value)}
          title={metadata.title}
          artist={metadata.artist}
          modified={defaultMetadata.youtubeId !== metadata.youtubeId}
          error={fieldErrors.youtubeId}
        />
      </MetadataSection>
      <MetadataSection
        title="Version details" icon={Layers}
        summary={metadata.label || metadata.description || "Add version name"}
        initiallyOpen={!!(defaultMetadata.label || defaultMetadata.description)}
        error={fieldErrors.label || fieldErrors.description}
      >
        <VersionDetailsFields details={metadata} defaults={defaultMetadata} errors={fieldErrors} onChange={updateMetadata} />
      </MetadataSection>
      <MetadataSection title="Editor tools" icon={Wrench}>
        <SmartFeatures features={features} isProcessing={isProcessing} onExecuteFeature={onExecuteFeature} />
        <EditorSettingsComponent settings={editorSettings} onSettingsChange={onSettingsChange} userData={userData} hasIllustration={hasIllustration} />
      </MetadataSection>
    </div>
  );
};

export default MetadataEditor;
