import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AgendaPage from './pages/AgendaPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AgendaPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        {/* Task 10: Visita form route will be added */}
        {/* <Route path="/visita/:clienteId/:fecha" element={<VisitaForm />} /> */}
      </Routes>
    </Router>
  )
}

export default App
