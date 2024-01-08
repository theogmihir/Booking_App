import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import IndexPage from './components/IndexPage';
import LoginPage from './components/LoginPage';
import Layout from './Layout'
import './App.css';

function App() {
  return (
    <Router> 
      <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="/" element={<IndexPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>
      </Routes>
    </Router>
  );
}

export default App;
