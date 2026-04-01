import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TVDisplay from './TVDisplay';
import Admin from './Admin';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TVDisplay />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
