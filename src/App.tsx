import './App.css';
import { ThemeProvider } from "@/components/theme-provider";
import { createHashRouter, Outlet, RouterProvider } from "react-router-dom";
import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { fetchCleanEditorData, fetchSongContent, fetchSongs } from './components/song_loader';
const SongList = React.lazy(() => import('./routes/SongList/SongList'));
const SongView = React.lazy(() => import('./routes/SongView/SongView'));
const SongGallery = React.lazy(() => import('./routes/gallery/SongGallery'));
import { RouteErrorBoundary, RenderErrorBoundary } from './components/UnifiedErrorBoundary';
import Editor from './routes/Editor/Editor';


const router = createHashRouter([
  {
    element: <RenderErrorBoundary><Outlet /></RenderErrorBoundary>, // Render errors
    errorElement: <RouteErrorBoundary />, // Loader errors
    children: [
      {
        path: "/",
        element: <SongList />,
        loader: fetchSongs,
      },
      {
        path: "/song/:id",
        element: <SongView />,
        loader: fetchSongContent,
      },
      {
        path: "/gallery",
        element: <SongGallery />,
        loader: fetchSongs,
      },
      {
        path: "/editor",
        element: <Editor />,
        loader: fetchCleanEditorData,
      },
      {
        path: "/editor/:id",
        element: <Editor />,
        loader: fetchSongContent,
      }
    ]
  }
]);

function App() {
  useRegisterSW();

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
