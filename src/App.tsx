import { useState } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'
import { Button } from "@/components/ui/button"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from './components/mode-toggle'

function App() {
  const [count, setCount] = useState(0)

  return (

    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div>
        <a href="https://vite.dev" target="_blank">
          <img className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <Button variant="outline" onClick={() => setCount((count) => count + 1)}>
          count is {count}</Button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <ModeToggle />
    </ThemeProvider>
  )
}

export default App
