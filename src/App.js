
import React, { useState } from "react";
import { Routes, Route } from 'react-router-dom';
import BotLogic from "./pages/BotLogic";
import Order from "./pages/Order";
import Tick from "./pages/Tick";
import Alert from "./pages/Alert";
import Navbar from "./components/Navbar";
import MssLogic from "./pages/MssLogic";
import Simulator from "./pages/Simulator";
import Dashboard from "./pages/Dashboard";
import TradingViewChart from "./pages/TradingViewChart";
import Algo from "./pages/Algo"
import EQH from "./pages/EQH";

const App = () => {
  const [candles, ] = useState([]);

  return (
    <div className="p-4">
      <Navbar />
      <Routes>
        <Route path="/eq" element={<BotLogic />} />
         <Route path="/Algo" element={<Algo />} />
        <Route path="/Tick" element={<Tick />} />
        <Route path="/eqh/:timestamp" element={<EQH />} />
        <Route path="/order" element={<Order />} />
        <Route path="/alert" element={<Alert />} />
        <Route path="/mss" element={<MssLogic />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/setup" element={<TradingViewChart candles={candles} />} />
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </div>
  );
};

export default App;
