
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import "./TickVolume.css";

const TickVolume = () => {
  const [selectedVolatility, setSelectedVolatility] = useState("R_10");
  const [selectedTimeframe, setSelectedTimeframe] = useState(60);
  const [tickData, setTickData] = useState([]);
  const [displayedPrice, setDisplayedPrice] = useState(null);
  const [latestTick, setLatestTick] = useState(null);
  const [previousAsk, setPreviousAsk] = useState(null);

  useEffect(() => {
    if (!selectedVolatility || !selectedTimeframe) return;

    const app_id = 1001;
    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id}&l=EN&brand=deriv`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      ws.send(JSON.stringify({ ticks: selectedVolatility, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.error) {
        console.error("API Error:", msg.error.message);
        return;
      }

      if (msg.msg_type === "tick" && msg.tick) {
        const tickTime = msg.tick.epoch;
        const bidPrice = msg.tick.bid;
        const askPrice = msg.tick.ask;
        const midPrice = (bidPrice + askPrice) / 2;

        const filled = previousAsk !== null && bidPrice >= previousAsk;

        const newTick = {
          bid: bidPrice,
          ask: askPrice,
          mid: midPrice,
          time: tickTime,
          filled,
          unfilled: !filled,
        };

        setLatestTick(newTick);
        setDisplayedPrice(midPrice);

        setTickData((prev) => {
          let updatedData = prev.map((tick) =>
            tick.unfilled && bidPrice >= tick.ask ? { ...tick, filled: true, unfilled: false } : tick
          );

          updatedData = [...updatedData.slice(-9), newTick];
          return updatedData;
        });

        setPreviousAsk(askPrice);
      }
    };

    return () => ws.close();
  }, [selectedVolatility, selectedTimeframe, previousAsk]);

  const filledCount = tickData.filter(tick => tick.filled).length;
  const unfilledCount = tickData.length - filledCount;

  const barChartData = [
    { name: "Filled", value: filledCount },
    { name: "Unfilled", value: unfilledCount },
  ];

  return (
    <div className="tick-container">
      <h2>Bid & Ask Prices (Last 10 Ticks)</h2>

      <div className="controls">
        <label>Volatility Index:</label>
        <select value={selectedVolatility} onChange={(e) => setSelectedVolatility(e.target.value)}>
          <option value="R_10">Volatility 10</option>
          <option value="1HZ10V">Volatility 10s</option>
          <option value="R_25">Volatility 25</option>
          <option value="1HZ25V">Volatility 25s</option>
          <option value="R_50">Volatility 50</option>
          <option value="1HZ50V">Volatility 50s</option>
          <option value="R_75">Volatility 75</option>
          <option value="1HZ75V">Volatility 75s</option>
          <option value="R_100">Volatility 100</option>
          <option value="1HZ100V">Volatility 100s</option>
        </select>

        <label>Timeframe:</label>
        <select value={selectedTimeframe} onChange={(e) => setSelectedTimeframe(Number(e.target.value))}>
          <option value={60}>1 Minute</option>
          <option value={300}>5 Minutes</option>
          <option value={900}>15 Minutes</option>
          <option value={3600}>1 Hour</option>
        </select>
      </div>

      {latestTick && (
        <div className="latest-tick-info">
          <p>
            <strong>Latest Tick:</strong> Time: {new Date(latestTick.time * 1000).toLocaleTimeString()} | Bid:{" "}
            {latestTick.bid.toFixed(2)} | Ask: {latestTick.ask.toFixed(2)} | Mid: {latestTick.mid.toFixed(2)}
          </p>
        </div>
      )}

      {displayedPrice && (
        <div className="displayed-price-info">
          <p>
            <strong>Displayed Price:</strong> {displayedPrice.toFixed(2)}
          </p>
        </div>
      )}

      <table className="tick-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>Mid</th>
            <th>Filled</th>
            <th>Status</th>
            <th>Unfilled</th>
          </tr>
        </thead>
        <tbody>
          {tickData.length > 0 ? (
            tickData.map((tick, idx) => (
              <tr key={idx}>
                <td>{new Date(tick.time * 1000).toLocaleTimeString()}</td>
                <td>{tick.bid.toFixed(2)}</td>
                <td>{tick.ask.toFixed(2)}</td>
                <td>{tick.mid.toFixed(2)}</td>
                <td className={tick.filled ? "filled" : ""}>{tick.filled ? "✔️" : "-"}</td>
                <td className={tick.filled ? "filled" : "unfilled"}>
                  {tick.filled ? "✔️ Filled" : "❌ Unfilled"}
                </td>
                <td className={tick.unfilled ? "unfilled" : ""}>{tick.unfilled ? "❌" : "-"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7">Waiting for tick data...</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="chart-wrapper">
  <h3>Filled vs Unfilled (Last 10 Ticks)</h3>

  <div className="percentage-info">
    <p>
      <strong>Filled:</strong> {((filledCount / tickData.length) * 100 || 0).toFixed(1)}% | 
      <strong> Unfilled:</strong> {((unfilledCount / tickData.length) * 100 || 0).toFixed(1)}%
    </p>
  </div>

  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={barChartData}>
      <XAxis dataKey="name" />
      <YAxis allowDecimals={false} domain={[0, 10]} />
      <Tooltip />
      <Bar dataKey="value">
        {barChartData.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.name === "Filled" ? "#4caf50" : "#f44336"} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
</div>

    </div>
  );
};

export default TickVolume;
