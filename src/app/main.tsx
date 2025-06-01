
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./components/theme-provider.tsx";
import "./index.css";
import { lazy } from 'react';
import { useState, useEffect } from "react";
import { ModeToggle } from "./components/custom-ui/mode-toggle";

import { Route, Switch } from "wouter";
import { fetchSongContent, fetchSongs } from "./lib/songLoader.tsx";
import { SongDB } from "src/types/types.ts";
import { SongData } from "src/types/songData.ts";
import LoginPage from "./components/LoginPage.tsx";
import { Toaster } from "sonner";
const SongList = lazy(() => import("./routes/SongList/SongList.tsx"));
const Editor = lazy(() => import("./routes/Editor/Editor.tsx"));
const SongView = lazy(() => import("./routes/SongView/SongView.tsx"));
const SongGallery = lazy(() => import("./routes/Gallery/SongGallery.tsx"));

function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState("unknown");

  return (
    <>
      <div>
      </div>
      <h1>Vite + React + Hono + Cloudflare</h1>
      <div className="card">
        <button
          onClick={() => setCount((count) => count + 1)}
          aria-label="increment"
        >
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <div className="card">
        <button
          onClick={() => {
            fetch("/api/")
              .then((res) => res.json() as Promise<{ name: string }>)
              .then((data) => setName(data.name));
          }}
          aria-label="get name"
        >
          Name from API is: {name}
        </button>
        <p>
          Edit <code>worker/index.ts</code> to change the name
        </p>
      </div>
      <p className="read-the-docs">Click on the logos to learn more</p>
      <ModeToggle />
    </>
  );
}

function SongLoaderWrapper({ songId, Child }: { songId: string, Child: React.FC }) {
  const [songData, setSongData] = useState<SongData | null>(null);
  const [songDB, setSongDB] = useState<SongDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const loadSongs = async () => {
      try {
        setLoading(true);
        const data = await fetchSongContent({ params: { id: songId } });
        setSongDB(data.songDB)
        setSongData(data.songData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load songs');
        console.error('Error fetching songs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSongs();
  }, [songId]);

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-2"></div>
          <p>Loading songs...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="mb-2">Error loading songs:</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!songDB || !songData) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <p>No song data available</p>
      </div>
    );
  }

  return <Child songDB={songDB} songData={songData} />

}

const Router = () => {
  // const [songDB, setSongDB] = useState<SongDB | null>(null);
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   const loadSongs = async () => {
  //     try {
  //       setLoading(true);
  //       const data = await fetchSongs();
  //       setSongDB(data);
  //       setError(null);
  //     } catch (err) {
  //       setError(err instanceof Error ? err.message : 'Failed to load songs');
  //       console.error('Error fetching songs:', err);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   loadSongs();
  // }, []);

  // // Loading state
  // if (loading) {
  //   return (
  //     <div className="h-screen w-full flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-2"></div>
  //         <p>Loading songs...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // // Error state
  // if (error) {
  //   return (
  //     <div className="h-screen w-full flex items-center justify-center">
  //       <div className="text-center text-red-600 dark:text-red-400">
  //         <p className="mb-2">Error loading songs:</p>
  //         <p className="text-sm">{error}</p>
  //       </div>
  //     </div>
  //   );
  // }

  // // No data state
  // if (!songDB) {
  //   return (
  //     <div className="h-screen w-full flex items-center justify-center">
  //       <p>No song data available</p>
  //     </div>
  //   );
  // }

  return (
    <>
      <Route path="/"><SongList /></Route>
      <Route path="/login"><LoginPage /></Route>
      {/* <Route path="/gallery"><SongGallery songDB={songDB} /></Route> */}
      <Route path="/demo"><App /></Route>
      <Route path="/song/:id" >{params => <SongLoaderWrapper songId={params.id} Child={SongView} />}</Route>
      <Switch>
        {/* <Route path="/edit"  ><Editor songDB={songDB} /></Route> */}
        <Route path="/edit/:id" >{params => <SongLoaderWrapper songId={params.id} Child={Editor} />}</Route>
      </Switch>
    </>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);