import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AgendaPage from './pages/AgendaPage'
import VisitFormPage from './pages/VisitFormPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AgendaPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/visita/:clienteId/:fecha" element={<VisitFormPage />} />
      </Routes>
    </Router>
  )
}

export default App
