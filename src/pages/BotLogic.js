
import { useEffect, useState, useCallback } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from "recharts";
import "../styles/BotLogic.css";

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
  return `${date.toISOString().split("T")[0]} ${date.toISOString().split("T")[1].split(".")[0]}`;
};

const BotLogic = () => {
  const [priceData, setPriceData] = useState([]);
  const [eqhNotifications, setEqhNotifications] = useState([]);
  const [eqlNotifications, setEqlNotifications] = useState([]);
  const [selectedVolatility, setSelectedVolatility] = useState("R_10");
  const [selectedTimeframe, setSelectedTimeframe] = useState(3600);
  const [percentageChanges, setPercentageChanges] = useState([]);
  const [averageChange, setAverageChange] = useState([]);





  // Clear notifications when timeframe or volatility changes
  useEffect(() => {
    setEqhNotifications([]);
    setEqlNotifications([]);
  }, [selectedTimeframe, selectedVolatility]);

  useEffect(() => {
    const app_id = 1001;
    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id}&l=EN&brand=deriv`);

    ws.onopen = () => {
      console.log("WebSocket connected");

      const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60; // Epoch time for 1 year ago
      const request = {
        ticks_history: selectedVolatility,
        granularity: selectedTimeframe,
        start: oneYearAgo, // Request data from one year ago
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
          date: new Date(candle.epoch * 1000).toISOString().split("T")[0], // Extracting date only
        }));

        setPriceData(candles);
        calculatePercentageChanges(candles);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      ws.close();
    };
  }, [selectedVolatility, selectedTimeframe]);

  const calculatePercentageChanges = (candles) => {
    if (candles.length < 2) return;

    const changes = [];
    const dailyClosingPrices = {};

    // Extract closing prices for each day based on timeframe
    candles.forEach((candle) => {
      dailyClosingPrices[candle.date] = candle.close;
    });

    const dates = Object.keys(dailyClosingPrices).sort();

    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];

      const prevClose = dailyClosingPrices[prevDate];
      let currClose = dailyClosingPrices[currDate];

      // If the current day is not over, use the latest price
      if (i === dates.length - 1) {
        const latestPrice = candles[candles.length - 1]?.close;
        if (latestPrice) {
          currClose = latestPrice;
        }
      }

      const percentageChange = ((currClose - prevClose) / prevClose) * 100;
      changes.push({
        date: currDate,
        percentageChange,
        color: percentageChange >= 0 ? "blue" : "red",
      });
    }

    // Keep only the last 7 days
    const last7Changes = changes.slice(-11);
    setPercentageChanges(last7Changes);

    // Calculate the average percentage change
    const totalChange = last7Changes.reduce((sum, change) => sum + change.percentageChange, 0);
    const averageChange = (totalChange / last7Changes.length).toFixed(2);
    setAverageChange(averageChange);
  };

  const checkForViolation = (data, startIndex, endIndex, violationLevels, isEQH, proximity) => {
    let violationCount = 0;
  
    // Determine the number of swing levels required to invalidate the pattern
    const requiredViolations = proximity === "close" ? 1 : 3;
  
    console.log("Violation Levels:", violationLevels); // Debug
    console.log("Proximity:", proximity); // Debug
    console.log("Required Violations:", requiredViolations); // Debug
  
    for (let i = startIndex; i <= endIndex; i++) {
      const candle = data[i];
  
      // Check for violations first
      if (isEQH) {
        if (candle.low < violationLevels[violationCount]) {
          violationCount++;
          console.log(`Violation Count (EQH): ${violationCount}`); // Debug
          if (violationCount >= requiredViolations) {
            console.log("Pattern invalidated (EQH)"); // Debug
            return true; // Pattern invalidated
          }
        }
      } else {
        if (candle.high > violationLevels[violationCount]) {
          violationCount++;
          console.log(`Violation Count (EQL): ${violationCount}`); // Debug
          if (violationCount >= requiredViolations) {
            console.log("Pattern invalidated (EQL)"); // Debug
            return true; // Pattern invalidated
          }
        }
      }
  
      // Check for breakout after checking violations
      if (isEQH) {
        if (candle.close > violationLevels[violationLevels.length - 1]) {
          console.log("Breakout occurred (EQH)"); // Debug
          return false;
        }
      } else {
        if (candle.close < violationLevels[violationLevels.length - 1]) {
          console.log("Breakout occurred (EQL)"); // Debug
          return false;
        }
      }
    }
  
    console.log("No violation or breakout not yet occurred"); // Debug
    return false; // No violation or breakout not yet occurred
  };

     // Define calculateProximity function
     const calculateProximity = (data, index1, index2) => {
      const numCandles = Math.abs(index1 - index2);
      console.log("Number of Candles:", numCandles); // Debug
      return numCandles <= 20 ? "close" : "far";
    };
 const detectSwings = useCallback((data) => {
  let swingHighs = [];
  let swingLows = [];

  // Detect swing highs and lows
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

      if (high.high <= prevHigh.high && Math.abs(high.high - prevHigh.high) <= tolerance * high.high) {
        const prevHighBody = Math.max(prevHigh.open, prevHigh.close);

        if (high.high <= prevHigh.high && high.high > prevHighBody) {
          const lastThreeSwingLows = swingLows.filter((swing) => swing.index < high.index).slice(-3);
          const violationLevelsEQH = lastThreeSwingLows.map((swing) => swing.low);
          const requiredViolations = proximity === "close" ? 1 : 3;
          const violationOccurred = checkForViolation(
            data,
            high.index,
            data.length - 1,
            violationLevelsEQH,
            true,
            proximity,
            requiredViolations
          );

          if (violationOccurred) continue;

          const gapExists = data.every(
            (candle) => candle.time > prevHigh.time && candle.time < high.time ? candle.high < prevHigh.high : true
          );

          if (!violationOccurred && gapExists) {
            // ✅ Breakout occurs when the price WICKS above the PREVIOUS swing high
            const breakoutIndex = data.findIndex((candle) => candle.time > high.time && candle.high > prevHigh.high);
            let status = "Manual Check";
            let color = "white";

            if (breakoutIndex !== -1) {
              eqhNotices.push({
                level: high.high,
                currentSwing: formatTime(high.time),
                previousSwing: formatTime(prevHigh.time),
                currentPrice: high.high,
                previousPrice: prevHigh.high,
                breakout: true,
                retest: false,
                status,
                color,
                proximity,
              });

              const retestCandles = data.slice(breakoutIndex, breakoutIndex + 20);
              let retestSwing = retestCandles.find((candle, idx) => {
                let prev = retestCandles[idx - 1];
                let next = retestCandles[idx + 1];

                return prev && next && candle.low <= high.high &&
                       candle.high > prev.high && candle.high > next.high; // Swing high check
              });

              if (retestSwing) {
                const lastSwingHighAfterBreakout = swingHighs.find((swing) => swing.index > breakoutIndex);

                if (lastSwingHighAfterBreakout) {
                  const closesAboveSwingHigh = retestCandles.some((candle) => candle.close > lastSwingHighAfterBreakout.high);

                  if (closesAboveSwingHigh) {
                    status = "Continuation";
                    color = "yellow";
                  } else {
                    status = "Reversal";
                    color = "green";
                  }
                }

                eqhNotices.pop();
                eqhNotices.push({
                  level: high.high,
                  currentSwing: formatTime(high.time),
                  previousSwing: formatTime(prevHigh.time),
                  currentPrice: high.high,
                  previousPrice: prevHigh.high,
                  breakout: true,
                  retest: true,
                  status,
                  color,
                  proximity,
                });
              }
            }
          }
        }
      }
    }
  });

  // Detect EQL
  swingLows.forEach((low, i) => {
    for (let j = 0; j < i; j++) {
      const prevLow = swingLows[j];
      const proximity = calculateProximity(data, low.index, prevLow.index);

      if (low.low >= prevLow.low && Math.abs(low.low - prevLow.low) <= tolerance * low.low) {
        const prevLowBody = Math.min(prevLow.open, prevLow.close);

        if (low.low >= prevLow.low && low.low < prevLowBody) {
          const lastThreeSwingHighs = swingHighs.filter((swing) => swing.index < low.index).slice(-3);
          const violationLevelsEQL = lastThreeSwingHighs.map((swing) => swing.high);
          const requiredViolations = proximity === "close" ? 1 : 3;
          const violationOccurred = checkForViolation(
            data,
            low.index,
            data.length - 1,
            violationLevelsEQL,
            false,
            proximity,
            requiredViolations
          );

          if (violationOccurred) continue;

          const gapExists = data.every(
            (candle) => candle.time > prevLow.time && candle.time < low.time ? candle.low > prevLow.low : true
          );

          if (!violationOccurred && gapExists) {
            // ✅ Breakout occurs when the price WICKS below the PREVIOUS swing low
            const breakoutIndex = data.findIndex((candle) => candle.time > low.time && candle.low < prevLow.low);
            let status = "Manual Check";
            let color = "white";

            if (breakoutIndex !== -1) {
              eqlNotices.push({
                level: low.low,
                currentSwing: formatTime(low.time),
                previousSwing: formatTime(prevLow.time),
                currentPrice: low.low,
                previousPrice: prevLow.low,
                breakout: true,
                retest: false,
                status,
                color,
                proximity,
              });

              const retestCandles = data.slice(breakoutIndex, breakoutIndex + 20);
              let retestSwing = retestCandles.find((candle, idx) => {
                let prev = retestCandles[idx - 1];
                let next = retestCandles[idx + 1];

                return prev && next && candle.high >= low.low &&
                       candle.low < prev.low && candle.low < next.low; // Swing low check
              });

              if (retestSwing) {
                const lastSwingLowAfterBreakout = swingLows.find((swing) => swing.index > breakoutIndex);

                if (lastSwingLowAfterBreakout) {
                  const closesBelowSwingLow = retestCandles.some((candle) => candle.close < lastSwingLowAfterBreakout.low);

                  if (closesBelowSwingLow) {
                    status = "Continuation";
                    color = "yellow";
                  } else {
                    status = "Reversal";
                    color = "green";
                  }
                }

                eqlNotices.pop();
                eqlNotices.push({
                  level: low.low,
                  currentSwing: formatTime(low.time),
                  previousSwing: formatTime(prevLow.time),
                  currentPrice: low.low,
                  previousPrice: prevLow.low,
                  breakout: true,
                  retest: true,
                  status,
                  color,
                  proximity,
                });
              }
            }
          }
        }
      }
    }
  });

  setEqhNotifications((prev) => [...prev, ...eqhNotices].slice(-10));
  setEqlNotifications((prev) => [...prev, ...eqlNotices].slice(-10));
}, []);
 
    
    
    
    
  useEffect(() => {
    if (priceData.length >= 5) {
      console.log("Price Data:", priceData); // Debug log
      detectSwings(priceData);
    }
  }, [priceData, detectSwings]);


  useEffect(() => {
    if (priceData.length >= 2) {
      const last7Days = priceData.slice(-11);
      const percentageChangesArray = [];

      for (let i = 1; i < last7Days.length; i++) {
        const prevClose = last7Days[i - 1].close;
        const currentClose = last7Days[i].close;
        const percentageChange = ((currentClose - prevClose) / prevClose) * 100;

        percentageChangesArray.push({
          time: formatTime(last7Days[i].time),
          change: percentageChange.toFixed(2),
          color: percentageChange >= 0 ? "blue" : "red",
        });
      }

      setPercentageChanges(percentageChangesArray);

      // Calculate average percentage change
      const totalChange = percentageChangesArray.reduce((sum, change) => sum + parseFloat(change.change), 0);
      const averageChange = (totalChange / percentageChangesArray.length).toFixed(2);
      setAverageChange(averageChange);
    }
  }, [priceData]);

  return (
    <div className="bot-container">
      <h2 className="bot-title">Dollar Hacker(DH)</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={(t) => new Date(t * 1000).toLocaleString()} />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <Line type="monotone" dataKey="open" stroke="#ff0000" dot={false} />
            <Line type="monotone" dataKey="close" stroke="#8884d8" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="bot-controls">
        <label>Choose Volatility: </label>
        <select value={selectedVolatility} onChange={(e) => setSelectedVolatility(e.target.value)}>
          {Object.entries(volatilitySymbols).map(([name, symbol]) => (
            <option key={symbol} value={symbol}>{name}</option>
          ))}
        </select>
        <label> Choose Timeframe: </label>
        <select value={selectedTimeframe} onChange={(e) => setSelectedTimeframe(Number(e.target.value))}>
          {Object.entries(timeframes).map(([name, seconds]) => (
            <option key={seconds} value={seconds}>{name}</option>
          ))}
        </select>
      </div>
      <div className="notification-container">
        <div className="eqh-section">
          <h3>Equal Highs</h3>
          {eqhNotifications.length > 0 ? (
            eqhNotifications.map((notice, index) => (
              <p key={index} style={{ color: notice.color }}>
                EQH at {notice.level} | Current: {notice.currentSwing} | Previous: {notice.previousPrice} | Previous: {notice.previousSwing} | Status: {notice.status} | Proximity: {notice.proximity}
              </p>
            ))
          ) : (
            <p>No EQH detected</p>
          )}
        </div>
        <div className="eql-section">
          <h3>Equal Lows</h3>
          {eqlNotifications.length > 0 ? (
            eqlNotifications.map((notice, index) => (
              <p key={index} style={{ color: notice.color }}>
                EQL at {notice.level} | Current: {notice.currentSwing} | Previous: {notice.previousPrice} | Previous: {notice.previousSwing} | Status: {notice.status} | Proximity: {notice.proximity}
              </p>
            ))
          ) : (
            <p>No EQL detected</p>
          )}
        </div>
      </div>

      {/* Percentage Change Display */}
      <div className="percentage-changes">
  <h3>Percentage Change(Per Timeframe)</h3>
  {percentageChanges.length > 0 ? (
    percentageChanges.map((change, index) => (
      <p key={index} className={change.change >= 0 ? "positive" : "negative"}>
        {change.time}: {change.change}%
      </p>
    ))
  ) : (
    <p>No percentage data available</p>
  )}
</div>

 {/* Average Percentage Change Display */}
 <div className="average-percentage">
        <h3>Average Percentage Change (Per Timeframe)</h3>
        <p className={averageChange >= 0 ? "positive" : "negative"}>{averageChange}%</p>
      </div>

    </div>
  );
};

export default BotLogic;













