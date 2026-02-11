import { useEffect, useState, useCallback } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from "recharts";
import "../styles/Main.css";

const volatilitySymbols = {
  "Volatility 10": "R_10",
  "Volatility 10s": "1HZ10V",
  "Volatility 15s": "1HZ15V",
  "Volatility 25": "R_25",
  "Volatility 25s": "1HZ25V",
  "Volatility 30s": "1HZ30V",
  "Volatility 50": "R_50",
  "Volatility 50s": "1HZ50V",
  "Volatility 75": "R_75",
  "Volatility 75s": "1HZ75V",
  "Volatility 90s": "1HZ90V",
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

const Main = () => {
  const [priceData, setPriceData] = useState([]);
  const [eqhNotifications, setEqhNotifications] = useState([]);
  const [eqlNotifications, setEqlNotifications] = useState([]);
  const [selectedVolatility, setSelectedVolatility] = useState("R_10");
  const [selectedTimeframe, setSelectedTimeframe] = useState(3600);
  const [percentageChanges, setPercentageChanges] = useState([]);
  const [averageChange, setAverageChange] = useState([]);
  
  // ✅ NEW: State for modal
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // ✅ NEW: Click handlers
  const handleNotificationClick = (notification, type) => {
    setSelectedNotification({ ...notification, type });
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedNotification(null);
  };

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

    candles.forEach((candle) => {
      dailyClosingPrices[candle.date] = candle.close;
    });

    const dates = Object.keys(dailyClosingPrices).sort();

    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];

      const prevClose = dailyClosingPrices[prevDate];
      let currClose = dailyClosingPrices[currDate];

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

    const last7Changes = changes.slice(-11);
    setPercentageChanges(last7Changes);

    const totalChange = last7Changes.reduce((sum, change) => sum + change.percentageChange, 0);
    const averageChange = (totalChange / last7Changes.length).toFixed(2);
    setAverageChange(averageChange);
  };

  const checkForViolation = (data, startIndex, endIndex, violationLevels, isEQH, proximity) => {
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
      } else {
        if (candle.high > violationLevels[violationCount]) {
          violationCount++;
          if (violationCount >= requiredViolations) {
            return true;
          }
        }
      }

      if (isEQH) {
        if (candle.close > violationLevels[violationLevels.length - 1]) {
          return false;
        }
      } else {
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

    // Detect EQH (same logic as BotLogic.js)
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

                const retestCandles = data.slice(breakoutIndex, breakoutIndex + 50);
                let retestSwing = retestCandles.find((candle, idx) => {
                  let prev = retestCandles[idx - 1];
                  let next = retestCandles[idx + 1];

                  return prev && next && candle.low <= high.high &&
                         candle.high > prev.high && candle.high > next.high;
                });

                if (retestSwing) {
                  const lastSwingHighAfterBreakout = swingHighs.find((swing) => swing.index > breakoutIndex);
                  const lastSwingLowAfterBreakout = swingLows.find((swing) => swing.index > breakoutIndex);

                  if (lastSwingHighAfterBreakout) {
                    const madeHigherHigh = retestCandles.some((candle) => 
                      candle.high > high.high
                    );
                    
                    const brokeStructure = lastSwingLowAfterBreakout && 
                      retestCandles.some((candle) => candle.low < lastSwingLowAfterBreakout.low);

                    if (madeHigherHigh && !brokeStructure) {
                      status = "Continuation";
                      color = "yellow";
                    } else if (brokeStructure) {
                      status = "Reversal";
                      color = "green";
                    } else {
                      const candlesSinceBreakout = data.length - 1 - breakoutIndex;

                      if (candlesSinceBreakout >= 50) {
                        const recentCandles = data.slice(-10);
                        const currentPrice = data[data.length - 1].close;
                        
                        const distanceFromEQH = ((currentPrice - high.high) / high.high) * 100;
                        
                        const avgHighRecent = recentCandles.reduce((sum, c) => sum + c.high, 0) / recentCandles.length;
                        const avgCloseRecent = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;
                        
                        const candlesAboveEQH = recentCandles.filter(c => c.close > high.high).length;
                        const candlesBelowEQH = recentCandles.filter(c => c.close < high.high).length;
                        
                        const priceStillAboveEQH = currentPrice > high.high;
                        const holdingAboveLevel = avgHighRecent > high.high;
                        const avgCloseAbove = avgCloseRecent > high.high;
                        const sharpMoveAway = distanceFromEQH > 0.1;
                        const mostCandlesAbove = candlesAboveEQH >= 6;
                        
                        const clearlyBelowEQH = currentPrice < (high.high * 0.9995);
                        const mostCandlesBelow = candlesBelowEQH > 6;
                        
                        if (sharpMoveAway || (priceStillAboveEQH && mostCandlesAbove) || (holdingAboveLevel && avgCloseAbove)) {
                          status = "Continuation";
                          color = "yellow";
                        } else if (clearlyBelowEQH && mostCandlesBelow) {
                          status = "Reversal";
                          color = "green";
                        } else {
                          status = "Manual Check";
                          color = "white";
                        }
                      } else {
                        status = "Manual Check";
                        color = "white";
                      }
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

    // Detect EQL (same logic as BotLogic.js)
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

                const retestCandles = data.slice(breakoutIndex, breakoutIndex + 50);
                let retestSwing = retestCandles.find((candle, idx) => {
                  let prev = retestCandles[idx - 1];
                  let next = retestCandles[idx + 1];

                  return prev && next && candle.high >= low.low &&
                         candle.low < prev.low && candle.low < next.low;
                });

                if (retestSwing) {
                  const lastSwingLowAfterBreakout = swingLows.find((swing) => swing.index > breakoutIndex);
                  const lastSwingHighAfterBreakout = swingHighs.find((swing) => swing.index > breakoutIndex);

                  if (lastSwingLowAfterBreakout) {
                    const madeLowerLow = retestCandles.some((candle) => 
                      candle.low < low.low
                    );
                    
                    const brokeStructure = lastSwingHighAfterBreakout && 
                      retestCandles.some((candle) => candle.high > lastSwingHighAfterBreakout.high);

                    if (madeLowerLow && !brokeStructure) {
                      status = "Continuation";
                      color = "yellow";
                    } else if (brokeStructure) {
                      status = "Reversal";
                      color = "green";
                    } else {
                      const candlesSinceBreakout = data.length - 1 - breakoutIndex;

                      if (candlesSinceBreakout >= 50) {
                        const recentCandles = data.slice(-10);
                        const currentPrice = data[data.length - 1].close;
                        
                        const distanceFromEQL = ((currentPrice - low.low) / low.low) * 100;
                        
                        const avgLowRecent = recentCandles.reduce((sum, c) => sum + c.low, 0) / recentCandles.length;
                        const avgCloseRecent = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;
                        
                        const candlesBelowEQL = recentCandles.filter(c => c.close < low.low).length;
                        const candlesAboveEQL = recentCandles.filter(c => c.close > low.low).length;
                        
                        const priceStillBelowEQL = currentPrice < low.low;
                        const holdingBelowLevel = avgLowRecent < low.low;
                        const avgCloseBelow = avgCloseRecent < low.low;
                        const sharpMoveAway = distanceFromEQL < -0.1;
                        const mostCandlesBelow = candlesBelowEQL >= 6;
                        
                        const clearlyAboveEQL = currentPrice > (low.low * 1.0005);
                        const mostCandlesAbove = candlesAboveEQL > 6;
                        
                        if (sharpMoveAway || (priceStillBelowEQL && mostCandlesBelow) || (holdingBelowLevel && avgCloseBelow)) {
                          status = "Continuation";
                          color = "yellow";
                        } else if (clearlyAboveEQL && mostCandlesAbove) {
                          status = "Reversal";
                          color = "green";
                        } else {
                          status = "Manual Check";
                          color = "white";
                        }
                      } else {
                        status = "Manual Check";
                        color = "white";
                      }
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

      const totalChange = percentageChangesArray.reduce((sum, change) => sum + parseFloat(change.change), 0);
      const averageChange = (totalChange / percentageChangesArray.length).toFixed(2);
      setAverageChange(averageChange);
    }
  }, [priceData]);

  return (
    <div className="main-container">
      <h2 className="main-title">Dollar Hacker (Main Version)</h2>
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
      <div className="main-controls">
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
      
      {/* ✅ MODIFIED: Clickable notifications */}
      <div className="notification-container">
        <div className="eqh-section">
          <h3>Equal Highs</h3>
          {eqhNotifications.length > 0 ? (
            eqhNotifications.map((notice, index) => (
              <p 
                key={index} 
                style={{ color: notice.color, cursor: "pointer" }}
                onClick={() => handleNotificationClick(notice, "EQH")}
                className="clickable-notification"
              >
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
              <p 
                key={index} 
                style={{ color: notice.color, cursor: "pointer" }}
                onClick={() => handleNotificationClick(notice, "EQL")}
                className="clickable-notification"
              >
                EQL at {notice.level} | Current: {notice.currentSwing} | Previous: {notice.previousPrice} | Previous: {notice.previousSwing} | Status: {notice.status} | Proximity: {notice.proximity}
              </p>
            ))
          ) : (
            <p>No EQL detected</p>
          )}
        </div>
      </div>

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

      <div className="average-percentage">
        <h3>Average Percentage Change (Per Timeframe)</h3>
        <p className={averageChange >= 0 ? "positive" : "negative"}>{averageChange}%</p>
      </div>

      {/* ✅ NEW: Modal for notification details */}
      {showDetails && selectedNotification && (
        <div className="notification-details-overlay" onClick={closeDetails}>
          <div className="notification-details-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeDetails}>×</button>
            
            <h2>{selectedNotification.type === "EQH" ? "Equal High Details" : "Equal Low Details"}</h2>
            
            <div className="details-content">
              <div className="detail-row">
                <span className="detail-label">Level:</span>
                <span className="detail-value">{selectedNotification.level}</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span 
                  className="detail-value" 
                  style={{ color: selectedNotification.color, fontWeight: "bold" }}
                >
                  {selectedNotification.status}
                </span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Current Swing:</span>
                <span className="detail-value">{selectedNotification.currentSwing}</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Previous Swing:</span>
                <span className="detail-value">{selectedNotification.previousSwing}</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Current Price:</span>
                <span className="detail-value">{selectedNotification.currentPrice}</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Previous Price:</span>
                <span className="detail-value">{selectedNotification.previousPrice}</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Proximity:</span>
                <span className="detail-value">{selectedNotification.proximity}</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Breakout:</span>
                <span className="detail-value">{selectedNotification.breakout ? "Yes" : "No"}</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Retest:</span>
                <span className="detail-value">{selectedNotification.retest ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Main;