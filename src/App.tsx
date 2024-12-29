import './App.css';
import { ThemeProvider } from "@/components/theme-provider";
import { createHashRouter, Outlet, RouterProvider } from "react-router-dom";
import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { fetchSongContent, fetchSongs } from './components/song_loader';
const SongList = React.lazy(() => import('./routes/SongList/SongList'));
const SongView = React.lazy(() => import('./routes/SongView/SongView'));
const SongGallery = React.lazy(() => import('./routes/gallery/SongGallery'));
import { RouteErrorBoundary, RenderErrorBoundary } from './components/UnifiedErrorBoundary';


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
