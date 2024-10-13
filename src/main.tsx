import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SongsList from './routes/song_list/SongList'
import './index.css'
import { Routes, Route } from "react-router-dom";
import { NextUIProvider } from '@nextui-org/react'
import {
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import ErrorPage from './routes/404'
import SongView from './routes/song_view/SongView'
import { HashRouter } from "react-router-dom";
import { fetchSongs, fetchSongContent } from './components/song_loader'
const router = createHashRouter([
  {
    path: "/",
    // element: <SongsList />,
    element: <SongsList />,
    errorElement: <ErrorPage />,
    loader: fetchSongs
  },
  {
    // path: "/song",
    path: "/song/:id",
    element: <SongView />,
    errorElement: <ErrorPage />,
    loader: fetchSongContent
  }
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
