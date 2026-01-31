
import React, { useState } from "react";
import { Routes, Route } from 'react-router-dom';
import BotLogic from "./BotLogic";
import Order from "./Order";
import Tick from "./Tick";
import Alert from "./Alert";
import Navbar from "./Navbar";
import MssLogic from "./MssLogic";
import Simulator from "./Simulator";
import Dashboard from "./Dashboard";
import TradingViewChart from "./TradingViewChart";
import Algo from "./Algo"
import EQH from "./EQH";

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
