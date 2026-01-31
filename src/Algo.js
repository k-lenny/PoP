import { useEffect, useState, useCallback } from "react";
import "./BotLogic.css";
import { Link } from "react-router-dom";

const volatilitySymbols = {
  "Volatility 10": "R_10",
  "Volatility 10s": "1HZ10V",
  "Volatility 25": "R_25",
  "Volatility 25s": "1HZ25V",
  "Volatility 50": "R_50",
  "Volatility 50s": "1HZ50V",
  "Volatility 75": "R_75",
  "Volatility 75s": "1HZ75V",
  "Volatility 100": "R_100",
  "Volatility 100s": "1HZ100V",
};

const timeframes = {
  "1 min": 60,
  "2 min": 120,
  "3 min": 180,
  "5 min": 300,
  "10 min": 600,
  "15 min": 900,
  "30 min": 1800,
  "1 hour": 3600,
  "2 hours": 7200,
  "4 hours": 14400,
  "8 hours": 28800,
  "24 hours": 86400,
};

const formatTime = (epochTime) => {
  const date = new Date(epochTime * 1000);
  return `${date.toISOString().split("T")[0]} ${date
    .toISOString()
    .split("T")[1]
    .split(".")[0]}`;
};

const BotLogic = () => {
  const [priceData, setPriceData] = useState([]);
  const [eqhNotifications, setEqhNotifications] = useState([]);
  const [,setEqlNotifications] = useState([]);
  const [selectedVolatility, setSelectedVolatility] = useState("R_10");
  const [selectedTimeframe, setSelectedTimeframe] = useState(3600);

  // Clear notifications when timeframe or volatility changes
  useEffect(() => {
    setEqhNotifications([]);
    setEqlNotifications([]);
  }, [selectedTimeframe, selectedVolatility]);

  // Fetch price data
  useEffect(() => {
    const app_id = 1001;
    const ws = new WebSocket(
      `wss://ws.binaryws.com/websockets/v3?app_id=${app_id}&l=EN&brand=deriv`
    );

    ws.onopen = () => {
      console.log("WebSocket connected");
      const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
      const request = {
        ticks_history: selectedVolatility,
        granularity: selectedTimeframe,
        start: oneYearAgo,
        style: "candles",
        end: "latest",
        subscribe: 1,
      };
      ws.send(JSON.stringify(request));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.error) {
        console.error("API Error:", msg.error.message);
        return;
      }
      if (msg.msg_type === "candles" && msg.candles) {
        const candles = msg.candles.map((candle) => ({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          time: candle.epoch,
          date: new Date(candle.epoch * 1000).toISOString().split("T")[0],
        }));
        setPriceData(candles);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => ws.close();
  }, [selectedVolatility, selectedTimeframe]);

  // Check for violation
  const checkForViolation = (
    data,
    startIndex,
    endIndex,
    violationLevels,
    isEQH,
    proximity
  ) => {
    let violationCount = 0;
    const requiredViolations = proximity === "close" ? 1 : 3;

    for (let i = startIndex; i <= endIndex; i++) {
      const candle = data[i];

      if (isEQH) {
        if (candle.low < violationLevels[violationCount]) {
          violationCount++;
          if (violationCount >= requiredViolations) {
            return true;
          }
        }
        if (candle.close > violationLevels[violationLevels.length - 1]) {
          return false;
        }
      } else {
        if (candle.high > violationLevels[violationCount]) {
          violationCount++;
          if (violationCount >= requiredViolations) {
            return true;
          }
        }
        if (candle.close < violationLevels[violationLevels.length - 1]) {
          return false;
        }
      }
    }
    return false;
  };

  const calculateProximity = (data, index1, index2) => {
    const numCandles = Math.abs(index1 - index2);
    return numCandles <= 20 ? "close" : "far";
  };

  const detectSwings = useCallback((data) => {
    let swingHighs = [];
    let swingLows = [];

    for (let i = 1; i < data.length - 1; i++) {
      let prev = data[i - 1];
      let curr = data[i];
      let next = data[i + 1];

      if (curr.high >= prev.high && curr.high >= next.high) {
        swingHighs.push({ ...curr, index: i });
      }
      if (curr.low <= prev.low && curr.low <= next.low) {
        swingLows.push({ ...curr, index: i });
      }
    }

    swingHighs = swingHighs.slice(-100);
    swingLows = swingLows.slice(-100);

    const tolerance = 0.0008;
    let eqhNotices = [];
    let eqlNotices = [];

    // Detect EQH
    swingHighs.forEach((high, i) => {
      for (let j = 0; j < i; j++) {
        const prevHigh = swingHighs[j];
        const proximity = calculateProximity(data, high.index, prevHigh.index);

        if (
          high.high <= prevHigh.high &&
          Math.abs(high.high - prevHigh.high) <= tolerance * high.high
        ) {
          const prevHighBody = Math.max(prevHigh.open, prevHigh.close);

          if (high.high > prevHighBody) {
            const rootSwingLow = swingLows
              .filter(
                (s) =>
                  s.time > prevHigh.time &&
                  s.time < high.time &&
                  s.low < prevHigh.high &&
                  s.low < high.high
              )
              .reduce((min, s) => (s.low < min.low ? s : min), {
                low: Infinity,
                time: 0,
              });

            if (rootSwingLow.low === Infinity) continue;

            const lastThreeSwingLows = swingLows
              .filter((swing) => swing.index < high.index)
              .slice(-3);
            const violationLevelsEQH = lastThreeSwingLows.map(
              (swing) => swing.low
            );
            const violationOccurred = checkForViolation(
              data,
              high.index,
              data.length - 1,
              violationLevelsEQH,
              true,
              proximity
            );
            if (violationOccurred) continue;

            const gapExists = data.every((candle) =>
              candle.time > prevHigh.time && candle.time < high.time
                ? candle.high < prevHigh.high
                : true
            );

            if (!violationOccurred && gapExists) {
              const breakoutIndex = data.findIndex(
                (candle) => candle.time > high.time && candle.high > prevHigh.high
              );

              eqhNotices.push({
                level: high.high,
                currentSwing: formatTime(high.time),
                previousSwing: formatTime(prevHigh.time),
                currentPrice: high.high,
                previousPrice: prevHigh.high,
                currentSwingEpoch: high.time,
                previousSwingEpoch: prevHigh.time,
                rootSwingLowPrice: rootSwingLow.low,
                rootSwingLowTime: formatTime(rootSwingLow.time),
                breakout: breakoutIndex !== -1,
                retest: false,
                status: "Manual Check",
                color: "white",
                proximity,
                volatility: selectedVolatility,
                timeframe: selectedTimeframe,
              });
            }
          }
        }
      }
    });

   

    setEqhNotifications((prev) => [...prev, ...eqhNotices].slice(-10));
    setEqlNotifications((prev) => [...prev, ...eqlNotices].slice(-10));
  }, [selectedVolatility, selectedTimeframe]);

  useEffect(() => {
    if (priceData.length >= 5) detectSwings(priceData);
  }, [priceData, detectSwings]);

  return (
    <div className="bot-container">
      <h2 className="bot-title">Algo Hacker(AH)</h2>

      <div className="bot-controls">
        <label>Choose Volatility: </label>
        <select
          value={selectedVolatility}
          onChange={(e) => setSelectedVolatility(e.target.value)}
        >
          {Object.entries(volatilitySymbols).map(([name, symbol]) => (
            <option key={symbol} value={symbol}>
              {name}
            </option>
          ))}
        </select>

        <label> Choose Timeframe: </label>
        <select
          value={selectedTimeframe}
          onChange={(e) => setSelectedTimeframe(Number(e.target.value))}
        >
          {Object.entries(timeframes).map(([name, seconds]) => (
            <option key={seconds} value={seconds}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="notification-container">
        <div className="eqh-section">
          <h3>Equal Highs (Close Status)</h3>
          {eqhNotifications.filter((notice) => notice.proximity === "close")
            .length > 0 ? (
            eqhNotifications
              .filter((notice) => notice.proximity === "close")
              .map((notice, index) => (
                <Link
                  key={index}
                  to={`/eqh/${notice.currentSwing}`}
                  state={{ notice, priceData }}
                  style={{
                    color: notice.color,
                    display: "block",
                    cursor: "pointer",
                    textDecoration: "none",
                  }}
                >
                  EQH at {notice.level} | Current Swing: {notice.currentSwing} (
                  {notice.currentPrice}) | Previous Swing: {notice.previousSwing} (
                  {notice.previousPrice}) | Root Swing Low:{" "}
                  {notice.rootSwingLowPrice} @ {notice.rootSwingLowTime} |
                  Proximity: {notice.proximity} | Volatility:{" "}
                  {notice.volatility} | TF: {notice.timeframe}
                </Link>
              ))
          ) : (
            <p>No close-proximity EQH detected</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BotLogic;
