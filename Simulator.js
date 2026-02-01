
import React, { useState } from "react";
import { saveAs } from "file-saver";
import "./Simulator.css";

const Simulator = () => {
  const [initialCapital, setInitialCapital] = useState(1000);
  const [winRate, setWinRate] = useState(60);
  const [riskPerTrade, setRiskPerTrade] = useState(1);
  const [rrRatio, setRrRatio] = useState(2);
  const [tradesPerMonth, setTradesPerMonth] = useState(100);
  const [months, setMonths] = useState(12);
  const [results, setResults] = useState([]);

  const simulate = () => {
    const winRateDecimal = winRate / 100;
    const riskPerTradeDecimal = riskPerTrade / 100;
    const avgReturnPerTrade =
      winRateDecimal * rrRatio - (1 - winRateDecimal);
    const monthlyReturnRate =
      avgReturnPerTrade * riskPerTradeDecimal * tradesPerMonth;

    const balances = [initialCapital];
    for (let i = 0; i < months; i++) {
      const newBalance = balances[balances.length - 1] * (1 + monthlyReturnRate);
      balances.push(newBalance);
    }

    const resultData = balances.map((balance, index) => ({
      month: index,
      balance: balance.toFixed(2),
    }));

    setResults(resultData);
  };

  const downloadCSV = () => {
    const header = "Month,Balance ($)\n";
    const rows = results.map((r) => `${r.month},${r.balance}`).join("\n");
    const csvContent = header + rows;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "trading_simulation.csv");
  };

  return (
    <div className="simulator-container">
      <h1 className="simulator-title">Trading Return Simulator</h1>
      <div className="simulator-grid">
        <div className="input-group">
          <label>Initial Capital ($)</label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>Win Rate (%)</label>
          <input
            type="number"
            value={winRate}
            onChange={(e) => setWinRate(Number(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>Risk per Trade (%)</label>
          <input
            type="number"
            value={riskPerTrade}
            onChange={(e) => setRiskPerTrade(Number(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>Reward:Risk Ratio</label>
          <input
            type="number"
            value={rrRatio}
            onChange={(e) => setRrRatio(Number(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>Trades per Month</label>
          <input
            type="number"
            value={tradesPerMonth}
            onChange={(e) => setTradesPerMonth(Number(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>Simulation Months</label>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="button-group">
        <button onClick={simulate} className="simulate-btn">Run Simulation</button>
        {results.length > 0 && (
          <button onClick={downloadCSV} className="download-btn">Download CSV</button>
        )}
      </div>

      {results.length > 0 && (
        <div className="results-section">
          <h2>Projection Results</h2>
          <table className="results-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Balance ($)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res) => (
                <tr key={res.month}>
                  <td>{res.month}</td>
                  <td>{res.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Simulator;

