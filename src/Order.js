
import { useState, useEffect, useCallback } from "react";
import "./Order.css";

const Order = () => {
  const [selectedVolatility, setSelectedVolatility] = useState("R_10");
  const [selectedTimeframe, setSelectedTimeframe] = useState(3600);
  const [candles, setCandles] = useState([]);
  const [orderBlocks, setOrderBlocks] = useState([]);

  useEffect(() => {
    if (!selectedVolatility || !selectedTimeframe) return;

    const app_id = 1001;
    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id}&l=EN&brand=deriv`);

    ws.onopen = () => {
      console.log("✅ WebSocket connected for candle data");
      ws.send(
        JSON.stringify({
          ticks_history: selectedVolatility,
          adjust_start_time: 1,
          count: 300,
          end: "latest",
          granularity: selectedTimeframe,
          style: "candles",
          subscribe: 1,
        })
      );
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
       
      
        if (msg.error) {
          console.error("API Error:", msg.error.message);
          return;
        }
      
        if (msg.msg_type === "candles" && msg.candles) {
          const newCandles = msg.candles.map(candle => ({
            time: candle.epoch,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume ?? 0,
          }));
          
          setCandles(newCandles);
        } else if (msg.msg_type === "ohlc") {
        
        } else {
          
        }
      };
      

    ws.onerror = (error) => {
      console.error("❌ WebSocket Error:", error);
    };

    ws.onclose = () => {
      console.log("🔌 WebSocket connection closed");
    };

    return () => ws.close();
  }, [selectedVolatility, selectedTimeframe]);

  const detectOrderBlocks = useCallback(() => {
    let detectedBlocks = [];
    let existingBlocks = new Map();
  
    if (candles.length < 3) return;
  
  
  
    for (let i = 0; i < candles.length - 2; i++) {
      const obCandle = candles[i];
      const midCandle = candles[i + 1];
      const nextCandle = candles[i + 2];
  
      console.log(`\n📊 Checking OB at index ${i}`);
      console.log("🕛 OB Candle:", obCandle);
      console.log("🕒 Mid Candle:", midCandle);
      console.log("🕕 Next Candle:", nextCandle);
  
      // Conditions for Bullish Order Block
      const isBearishOB = obCandle.close < obCandle.open;
      const midHighBelowOBHigh = midCandle.high < obCandle.high;
      const nextLowAboveOBHigh = nextCandle.low > obCandle.high;
  
      console.log("⚖️ Bullish OB Conditions:");
      console.log(`   🔴 Bearish OB Candle: ${isBearishOB}`);
      console.log(`   📉 Mid High < OB High: ${midHighBelowOBHigh}`);
      console.log(`   📈 Next Low > OB High (LV Gap): ${nextLowAboveOBHigh}`);
  
      if (isBearishOB && midHighBelowOBHigh && nextLowAboveOBHigh) {
        console.log("✅ Bullish Order Block Detected at index", i);
        const key = `OB-${obCandle.open}-${obCandle.close}`;
        if (!existingBlocks.has(key)) {
          detectedBlocks.push({
            time: obCandle.time,
            date: new Date(obCandle.time * 1000).toISOString().split("T")[0],
            type: "Bullish Order Block",
            revisited: false,
            open: obCandle.open,
            high: obCandle.high,
            low: obCandle.low,
            close: obCandle.close,
          });
          existingBlocks.set(key, true);
        }
      } else {
        console.log("❌ Not a Bullish OB at index", i);
      }
  
      // Conditions for Bearish Order Block
      const isBullishOB = obCandle.close > obCandle.open;
      const midLowAboveOBLow = midCandle.low > obCandle.low;
      const nextHighBelowOBLow = nextCandle.high < obCandle.low;
  
      console.log("\n⚖️ Bearish OB Conditions:");
      console.log(`   🟢 Bullish OB Candle: ${isBullishOB}`);
      console.log(`   📈 Mid Low > OB Low: ${midLowAboveOBLow}`);
      console.log(`   📉 Next High < OB Low (LV Gap): ${nextHighBelowOBLow}`);
  
      if (isBullishOB && midLowAboveOBLow && nextHighBelowOBLow) {
        console.log("✅ Bearish Order Block Detected at index", i);
        const key = `OB-${obCandle.open}-${obCandle.close}`;
        if (!existingBlocks.has(key)) {
          detectedBlocks.push({
            time: obCandle.time,
            date: new Date(obCandle.time * 1000).toISOString().split("T")[0],
            type: "Bearish Order Block",
            revisited: false,
            open: obCandle.open,
            high: obCandle.high,
            low: obCandle.low,
            close: obCandle.close,
          });
          existingBlocks.set(key, true);
        }
      } else {
        console.log("❌ Not a Bearish OB at index", i);
      }
    }
  
    console.log(`\n📌 Total Order Blocks Detected: ${detectedBlocks.length}`);
  
    setOrderBlocks(detectedBlocks.slice(0, 10));
  }, [candles]);
  

  useEffect(() => {
    detectOrderBlocks();
  }, [candles, detectOrderBlocks]);

  return (
    <div className="order-container">
      <h2>Order Block Detector</h2>
      <div className="controls">
        <label>Volatility Index:</label>
        <select value={selectedVolatility} onChange={(e) => setSelectedVolatility(e.target.value)}>
          <option value="R_10">Volatility 10</option>
          <option value="R_25">Volatility 25</option>
          <option value="R_50">Volatility 50</option>
          <option value="R_75">Volatility 75</option>
          <option value="R_100">Volatility 100</option>
        </select>
        <label>Timeframe:</label>
        <select value={selectedTimeframe} onChange={(e) => setSelectedTimeframe(Number(e.target.value))}>
          <option value={60}>1 Minute</option>
          <option value={300}>5 Minutes</option>
          <option value={900}>15 Minutes</option>
          <option value={3600}>1 Hour</option>
          <option value={7200}>2 Hours</option>
        </select>
      </div>
      <h3>Detected Order Blocks</h3>
      <table className="order-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Date</th>
            <th>Type</th>
            <th>Revisited</th>
            <th>Open</th>
            <th>High</th>
            <th>Low</th>
            <th>Close</th>
          </tr>
        </thead>
        <tbody>
          {orderBlocks.length > 0 ? (
            orderBlocks.map((block, idx) => (
              <tr key={idx}>
                <td>{new Date(block.time * 1000).toLocaleTimeString("en-GB", { hour12: false })}</td>
                <td>{block.date}</td>
                <td>{block.type}</td>
                <td>{block.revisited ? "✔️ Yes" : "❌ No"}</td>
                <td>{block.open}</td>
                <td>{block.high}</td>
                <td>{block.low}</td>
                <td>{block.close}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8">No Order Blocks Detected...</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Order;
