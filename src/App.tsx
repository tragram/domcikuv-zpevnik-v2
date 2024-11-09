import './App.css'
import { ThemeProvider } from "@/components/theme-provider"

import {
  createHashRouter,
  RouterProvider,
} from "react-router-dom";

import SongList from './routes/SongList/SongList';
import { fetchSongContent, fetchSongs } from './components/song_loader';
import SongView from './routes/SongView/SongView';
import SongGallery from './routes/gallery/SongGallery';

const router = createHashRouter([
  {
    path: "/",
    // element: <SongsList />,
    element: <SongList />,
    // errorElement: <ErrorPage />,
    loader: fetchSongs
  },
  {
    // path: "/song",
    path: "/song/:id",
    element: <SongView />,
    // errorElement: <ErrorPage />,
    loader: fetchSongContent
  },
  {
    path: "/gallery",
    element: <SongGallery />,
    // errorElement: <ErrorPage />,
    loader: fetchSongs
  }
]);

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default App
