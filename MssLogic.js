
import React, { useEffect, useState, useRef, useCallback } from "react";
import "./MssLogic.css";

const granularityMap = {
  "1m": 60,
  "2m": 120,
  "3m": 180,
  "5m": 300,
  "10m": 600,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "2h": 7200,
  "4h": 14400,
  "8h": 28800,
  "24h": 86400,
};

const MssLogic = () => {
  const [chochEntries, setChochEntries] = useState([]);
  const [bosEntries, setBosEntries] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("R_10");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1h");

  const candlesRef = useRef([]);
  const swingHighsRef = useRef([]);
  const swingLowsRef = useRef([]);
  const structureStateRef = useRef("none");
  const brokenSwingEpochsRef = useRef(new Set());
  const lastSignalTimeRef = useRef({ bos: 0, choch: 0 });

  const detectStructure = useCallback((candles) => {
    if (candles.length < 3) return;

    // First pass to identify swing highs and lows (center candles)
    for (let i = 2; i < candles.length; i++) {
      const prevPrev = candles[i - 2];
      const prev = candles[i - 1];
      const curr = candles[i];

      // Detect Swing Highs (center candle must be higher than neighbors)
      if (prev.high > prevPrev.high && prev.high > curr.high) {
        if (swingHighsRef.current.length >= 20) swingHighsRef.current.shift();
        swingHighsRef.current.push(prev);
      }

      // Detect Swing Lows (center candle must be lower than neighbors)
      if (prev.low < prevPrev.low && prev.low < curr.low) {
        if (swingLowsRef.current.length >= 20) swingLowsRef.current.shift();
        swingLowsRef.current.push(prev);
      }
    }

    // Second pass to detect BOS and CHoCH using the identified swing points
    for (let i = 0; i < candles.length; i++) {
      const currentCandle = candles[i];
      const currentEpoch = currentCandle.epoch;

      // Bullish BOS - price closes above previous swing high's center candle
      if (swingHighsRef.current.length > 1) {
        const prevSwingHigh = swingHighsRef.current[swingHighsRef.current.length - 2];

        if (!brokenSwingEpochsRef.current.has(prevSwingHigh.epoch) &&
            currentCandle.close > prevSwingHigh.high &&
            currentEpoch > lastSignalTimeRef.current.bos + 60) {

          brokenSwingEpochsRef.current.add(prevSwingHigh.epoch);
          lastSignalTimeRef.current.bos = currentEpoch;
          structureStateRef.current = "BOS_UP";
          addEntry("BOS (Bullish)", currentCandle, prevSwingHigh);
        }
      }

      // Bearish BOS - price closes below previous swing low's center candle
      if (swingLowsRef.current.length > 1) {
        const prevSwingLow = swingLowsRef.current[swingLowsRef.current.length - 2];

        if (!brokenSwingEpochsRef.current.has(prevSwingLow.epoch) &&
            currentCandle.close < prevSwingLow.low &&
            currentEpoch > lastSignalTimeRef.current.bos + 60) {

          brokenSwingEpochsRef.current.add(prevSwingLow.epoch);
          lastSignalTimeRef.current.bos = currentEpoch;
          structureStateRef.current = "BOS_DOWN";
          addEntry("BOS (Bearish)", currentCandle, prevSwingLow);
        }
      }

      // Bullish CHoCH - higher low than previous swing low's center candle
      if (structureStateRef.current === "BOS_UP" &&
          swingLowsRef.current.length > 1 &&
          currentEpoch > lastSignalTimeRef.current.choch + 60) {

        const lastSwingLow = swingLowsRef.current[swingLowsRef.current.length - 1];
        const prevSwingLow = swingLowsRef.current[swingLowsRef.current.length - 2];

        if (lastSwingLow.low > prevSwingLow.low) {
          lastSignalTimeRef.current.choch = currentEpoch;
          structureStateRef.current = "none";
          addEntry("CHoCH (Bullish)", lastSwingLow, prevSwingLow);
        }
      }

      // Bearish CHoCH - lower high than previous swing high's center candle
      if (structureStateRef.current === "BOS_DOWN" &&
          swingHighsRef.current.length > 1 &&
          currentEpoch > lastSignalTimeRef.current.choch + 60) {

        const lastSwingHigh = swingHighsRef.current[swingHighsRef.current.length - 1];
        const prevSwingHigh = swingHighsRef.current[swingHighsRef.current.length - 2];

        if (lastSwingHigh.high < prevSwingHigh.high) {
          lastSignalTimeRef.current.choch = currentEpoch;
          structureStateRef.current = "none";
          addEntry("CHoCH (Bearish)", lastSwingHigh, prevSwingHigh);
        }
      }
    }
  }, []);

  const addEntry = (type, candle, brokenCandle) => {
    const dateObj = new Date(candle.epoch * 1000);
    const timeStr = dateObj.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
    const dateStr = dateObj.toISOString().split("T")[0];

    const entry = {
      date: dateStr,
      time: timeStr,
      type,
      high: candle.high,
      low: candle.low,
      epoch: candle.epoch
    };

    if (brokenCandle) {
      const brokenDateObj = new Date(brokenCandle.epoch * 1000);
      const brokenTimeStr = brokenDateObj.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
      const brokenDateStr = brokenDateObj.toISOString().split("T")[0];

      entry.brokenSwing = {
        time: brokenTimeStr,
        date: brokenDateStr,
        high: brokenCandle.high,
        low: brokenCandle.low,
        epoch: brokenCandle.epoch
      };
    }

    if (type.includes("CHoCH")) {
      setChochEntries((prev) => {
        if (!prev.some(e => e.epoch === entry.epoch && e.type === entry.type)) {
          return [entry, ...prev.slice(0, 9)];
        }
        return prev;
      });
    } else {
      setBosEntries((prev) => {
        if (!prev.some(e => e.epoch === entry.epoch && e.type === entry.type)) {
          return [entry, ...prev.slice(0, 9)];
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    let client = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1001");

    const reconnect = () => {
      setTimeout(() => {
        client = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1001");
      }, 1000);
    };

    client.onopen = () => {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - 86400;

      client.send(
        JSON.stringify({
          ticks_history: selectedSymbol,
          style: "candles",
          adjust_start_time: 1,
          count: 100,
          granularity: granularityMap[selectedTimeframe],
          subscribe: 1,
          start: startTime,
          end: endTime,
        })
      );
    };

    client.onclose = reconnect;
    client.onerror = reconnect;

    client.onmessage = (message) => {
      const data = JSON.parse(message.data);

      if (data.candles) {
        const adjusted = data.candles.map((c) => ({ ...c, epoch: c.epoch }));
        candlesRef.current = adjusted;
        swingHighsRef.current = [];
        swingLowsRef.current = [];
        brokenSwingEpochsRef.current = new Set();
        detectStructure(adjusted);
      }

      if (data.ohlc) {
        const newCandle = data.ohlc;
        const existing = candlesRef.current;
        const lastCandle = existing[existing.length - 1];

        if (lastCandle && lastCandle.epoch === newCandle.epoch) {
          existing[existing.length - 1] = newCandle;
        } else {
          existing.push(newCandle);
          if (existing.length > 100) existing.shift();
        }

        candlesRef.current = existing;
        detectStructure(existing);
      }
    };

    return () => client.close();
  }, [selectedSymbol, selectedTimeframe, detectStructure]);

  // Clear entries when symbol or timeframe changes
  useEffect(() => {
    setChochEntries([]);
    setBosEntries([]);
    brokenSwingEpochsRef.current = new Set();
    lastSignalTimeRef.current = { bos: 0, choch: 0 };
    structureStateRef.current = "none";
    swingHighsRef.current = [];
    swingLowsRef.current = [];
    candlesRef.current = []; // Optionally clear candles as well
  }, [selectedSymbol, selectedTimeframe]);

  return (
    <div className="mss-logic">
      <div className="controls">
        <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}>
          {["R_10", "1HZ10V", "R_25", "1HZ25V", "R_50", "1HZ50V", "R_75", "1HZ75V", "R_100", "1HZ100V"].map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>

        <select value={selectedTimeframe} onChange={(e) => setSelectedTimeframe(e.target.value)}>
          {Object.keys(granularityMap).map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </select>
      </div>

      <h2>Last 10 CHoCH Entries</h2>
      <ul className="entry-list">
        {chochEntries.length > 0 ? (
          chochEntries.map((entry, idx) => (
            <li key={idx} className="entry-item">
              <strong>Date:</strong> {entry.date} | <strong>Time:</strong> {entry.time} |{" "}
              <strong>Type:</strong> {entry.type} | <strong>High:</strong> {entry.high} |{" "}
              <strong>Low:</strong> {entry.low}
            </li>
          ))
        ) : (
          <li className="no-entries">No CHoCH detected</li>
        )}
      </ul>

      <h2>Last 10 BOS Entries</h2>
      <ul className="entry-list">
        {bosEntries.length > 0 ? (
          bosEntries.map((entry, idx) => (
            <li key={idx} className="entry-item">
              <strong>Date:</strong> {entry.date} | <strong>Time:</strong> {entry.time} |{" "}
              <strong>Type:</strong> {entry.type} | <strong>High:</strong> {entry.high} |{" "}
              <strong>Low:</strong> {entry.low} |{" "}
              {entry.brokenSwing ? (
                <>
                  <strong>Broken Swing - Time:</strong> {entry.brokenSwing.time} |{" "}
                  <strong>Broken Swing - Date:</strong> {entry.brokenSwing.date} |{" "}
                  <strong>High:</strong> {entry.brokenSwing.high} |{" "}
                  <strong>Low:</strong> {entry.brokenSwing.low}
                </>
              ) : null}
            </li>
          ))
        ) : (
          <li className="no-entries">No BOS detected</li>
        )}
      </ul>
    </div>
  );
};

export default MssLogic;
