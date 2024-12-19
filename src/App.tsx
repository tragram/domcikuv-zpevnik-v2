import './App.css';
import { ThemeProvider } from "@/components/theme-provider";
import { createHashRouter, Outlet, RouterProvider } from "react-router-dom";

import SongList from './routes/SongList/SongList';
import { fetchSongContent, fetchSongs } from './components/song_loader';
import SongView from './routes/SongView/SongView';
import SongGallery from './routes/gallery/SongGallery';
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
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
