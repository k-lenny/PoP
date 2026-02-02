import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

const EQHDetail = () => {
  const location = useLocation();
  const { notice, priceData } = location.state || {};

  const [priceData15m, setPriceData15m] = useState([]);
  const [activeTab, setActiveTab] = useState("1h");

   // ---- Fetch 15m data ----
useEffect(() => {
  if (!notice) return; // just skip logic if notice is missing

  const app_id = 1001;
  const ws = new WebSocket(
    `wss://ws.binaryws.com/websockets/v3?app_id=${app_id}&l=EN&brand=deriv`
  );

  ws.onopen = () => {
    const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
    const request = {
      ticks_history: notice.volatility,
      granularity: 900, // 15 min
      start: oneYearAgo,
      style: "candles",
      end: "latest",
    };
    ws.send(JSON.stringify(request));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.candles) {
      const candles = msg.candles.map((c) => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        time: c.epoch,
      }));
      setPriceData15m(candles);
    }
  };

  return () => {
    ws.close();
  };
}, [notice]);

  if (!notice || !priceData || !Array.isArray(priceData) || priceData.length === 0) {
    return <p>No EQH or price data available.</p>;
  }

  // ---- Helpers ----
  const formatDerivTime = (epochTime) => {
    const date = new Date(epochTime * 1000); // UTC epoch
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");
    const sec = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
  };

  const calculateProximity = (data, index1, index2) => {
    const numCandles = Math.abs(index1 - index2);
    return numCandles <= 20 ? "close" : "far";
  };

  const checkForViolation = (data, startIndex, endIndex, violationLevels, isEQH, proximity) => {
    if (!violationLevels || violationLevels.length === 0) return false;

    let violationCount = 0;
    const requiredViolations = proximity === "close" ? 1 : 3;

    for (let i = startIndex; i <= endIndex && i < data.length; i++) {
      const candle = data[i];

      if (isEQH) {
        if (candle.low < violationLevels[violationCount]) {
          violationCount++;
          if (violationCount >= requiredViolations) return true;
        }
        if (candle.close > violationLevels[violationLevels.length - 1]) {
          return false;
        }
      } else {
        if (candle.high > violationLevels[violationCount]) {
          violationCount++;
          if (violationCount >= requiredViolations) return true;
        }
        if (candle.close < violationLevels[violationLevels.length - 1]) {
          return false;
        }
      }
    }
    return false;
  };





  // ---- Pull EQH context from notice ----
  const prevSwingTimeEpoch = notice.previousSwingEpoch;
  const currSwingTimeEpoch = notice.currentSwingEpoch;
  const prevEQHHigh = notice.previousPrice;
  const currEQHHigh = notice.currentPrice;

  // ---- Swing detection helper ----
  const detectSwings = (data) => {
    let swingHighs = [];
    let swingLows = [];
    for (let i = 1; i < data.length - 1; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      const next = data[i + 1];
      if (curr.high >= prev.high && curr.high >= next.high) {
        swingHighs.push({ ...curr, index: i });
      }
      if (curr.low <= prev.low && curr.low <= next.low) {
        swingLows.push({ ...curr, index: i });
      }
    }
    return { swingHighs, swingLows };
  };

  // ---- Reusable EQL detection ----
  const detectEQLs = (data, swingHighs, swingLows, rootSwing, breakoutSwing) => {
    const eqlsInRange = [];
    const tolerance = 0.0008;

    if (rootSwing && breakoutSwing) {
      const startTime = rootSwing.time;
      const endTime = breakoutSwing.time;

      const swingLowsInRange = swingLows.filter(
        (low) => low.time >= startTime && low.time <= endTime
      );
      const swingHighsInRange = swingHighs.filter(
        (high) => high.time >= startTime && high.time <= endTime
      );

      swingLowsInRange.forEach((low, i) => {
        for (let j = 0; j < i; j++) {
          const prevLow = swingLowsInRange[j];
          const proximity = calculateProximity(data, low.index, prevLow.index);

          if (
            low.low >= prevLow.low &&
            Math.abs(low.low - prevLow.low) <= tolerance * low.low
          ) {
            const prevLowBody = Math.min(prevLow.open, prevLow.close);

            if (low.low < prevLowBody) {
              const rootSwingHigh = swingHighsInRange
                .filter(
                  (s) =>
                    s.time > prevLow.time &&
                    s.time < low.time &&
                    s.high > prevLow.low &&
                    s.high > low.low
                )
                .reduce(
                  (max, s) => (s.high > max.high ? s : max),
                  { high: -Infinity, time: 0 }
                );

              if (rootSwingHigh.high === -Infinity) continue;

              const lastThreeSwingHighs = swingHighsInRange
                .filter((swing) => swing.index < low.index)
                .slice(-3);
              const violationLevelsEQL = lastThreeSwingHighs.map((s) => s.high);

              const violationOccurred = checkForViolation(
                data,
                low.index,
                data.length - 1,
                violationLevelsEQL,
                false,
                proximity
              );
              if (violationOccurred) continue;

              const gapExists = data.every((candle) =>
                candle.time > prevLow.time && candle.time < low.time
                  ? candle.low > prevLow.low
                  : true
              );

              if (!violationOccurred && gapExists) {
                const breakoutIndex = data.findIndex(
                  (candle) => candle.time > low.time && candle.low < prevLow.low
                );

                eqlsInRange.push({
                  level: low.low,
                  currentSwingEpoch: low.time,
                  previousSwingEpoch: prevLow.time,
                  currentSwing: formatDerivTime(low.time),
                  previousSwing: formatDerivTime(prevLow.time),
                  currentPrice: low.low,
                  previousPrice: prevLow.low,
                  rootSwingHighPrice: rootSwingHigh.high,
                  rootSwingHighTime: formatDerivTime(rootSwingHigh.time),
                  breakout: breakoutIndex !== -1,
                  retest: false,
                  status: "Manual Check",
                  color: "white",
                  proximity,
                });
              }
            }
          }
        }
      });
    }
    return eqlsInRange;
  };

  // ---- Run detection for 1h ----
  const { swingHighs: swingHighs1h, swingLows: swingLows1h } = detectSwings(priceData);

  const candlesAfterCurrent1h = priceData.filter(
    (candle) =>
      candle.time > currSwingTimeEpoch &&
      candle.high > Math.max(prevEQHHigh, currEQHHigh)
  );

  const breakoutSwing1h = candlesAfterCurrent1h.length
    ? candlesAfterCurrent1h.reduce(
        (max, candle) => (candle.high > max.high ? candle : max),
        { high: -Infinity, time: 0 }
      )
    : null;

  let rootSwing1h = null;
  if (breakoutSwing1h) {
    const lowsInWindow = priceData.filter(
      (candle) => candle.time > prevSwingTimeEpoch && candle.time < breakoutSwing1h.time
    );
    let windowSwingLows = [];
    for (let i = 1; i < lowsInWindow.length - 1; i++) {
      const prev = lowsInWindow[i - 1];
      const curr = lowsInWindow[i];
      const next = lowsInWindow[i + 1];
      if (curr.low <= prev.low && curr.low <= next.low) {
        windowSwingLows.push(curr);
      }
    }
    const candidateSwings = windowSwingLows.filter(
      (swing) => swing.low < prevEQHHigh && swing.low < currEQHHigh
    );
    rootSwing1h = candidateSwings.length
      ? candidateSwings.reduce(
          (min, swing) => (swing.low < min.low ? swing : min),
          { low: Infinity }
        )
      : null;
  }

  const eqls1h = detectEQLs(priceData, swingHighs1h, swingLows1h, rootSwing1h, breakoutSwing1h);

  // ---- Run detection for 15m ----
  const { swingHighs: swingHighs15m, swingLows: swingLows15m } = detectSwings(priceData15m);

  const candlesAfterCurrent15m = priceData15m.filter(
    (candle) =>
      candle.time > currSwingTimeEpoch &&
      candle.high > Math.max(prevEQHHigh, currEQHHigh)
  );

  const breakoutSwing15m = candlesAfterCurrent15m.length
    ? candlesAfterCurrent15m.reduce(
        (max, candle) => (candle.high > max.high ? candle : max),
        { high: -Infinity, time: 0 }
      )
    : null;

  let rootSwing15m = null;
  if (breakoutSwing15m) {
    const lowsInWindow = priceData15m.filter(
      (candle) => candle.time > prevSwingTimeEpoch && candle.time < breakoutSwing15m.time
    );
    let windowSwingLows = [];
    for (let i = 1; i < lowsInWindow.length - 1; i++) {
      const prev = lowsInWindow[i - 1];
      const curr = lowsInWindow[i];
      const next = lowsInWindow[i + 1];
      if (curr.low <= prev.low && curr.low <= next.low) {
        windowSwingLows.push(curr);
      }
    }
    const candidateSwings = windowSwingLows.filter(
      (swing) => swing.low < prevEQHHigh && swing.low < currEQHHigh
    );
    rootSwing15m = candidateSwings.length
      ? candidateSwings.reduce(
          (min, swing) => (swing.low < min.low ? swing : min),
          { low: Infinity }
        )
      : null;
  }

  const eqls15m = detectEQLs(priceData15m, swingHighs15m, swingLows15m, rootSwing15m, breakoutSwing15m);

  return (
    <div>
      <h2>EQH Detail Page</h2>

      {/* Tabs */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setActiveTab("1h")} style={{ marginRight: "1rem" }}>
          1 Hour
        </button>
        <button onClick={() => setActiveTab("15m")}>15 Minutes</button>
      </div>

      {/* Shared EQH Info */}
      <h3>Previous EQH Swing</h3>
      <p>Time (Deriv): {formatDerivTime(prevSwingTimeEpoch)}</p>
      <p>Price: {prevEQHHigh}</p>

      <h3>Current EQH Swing</h3>
      <p>Time (Deriv): {formatDerivTime(currSwingTimeEpoch)}</p>
      <p>Price: {currEQHHigh}</p>

      {/* 1h Tab */}
      {activeTab === "1h" && (
        <div>
          {breakoutSwing1h ? (
            <div>
              <h3>Breakout Swing (1h)</h3>
              <p>Time (Deriv): {formatDerivTime(breakoutSwing1h.time)}</p>
              <p>High: {breakoutSwing1h.high}</p>
            </div>
          ) : (
            <p>No breakout swing detected (1h).</p>
          )}

          {rootSwing1h ? (
            <div>
              <h3>Root Swing (1h)</h3>
              <p>Time (Deriv): {formatDerivTime(rootSwing1h.time)}</p>
              <p>Low: {rootSwing1h.low}</p>
            </div>
          ) : (
            <p>No root swing detected (1h).</p>
          )}

          {rootSwing1h && breakoutSwing1h ? (
            <div>
              <h3>EQLs Detected (1h)</h3>
              {eqls1h.length > 0 ? (
                eqls1h.map((n, idx) => (
                  <div key={idx} style={{ marginBottom: "1rem" }}>
                    <p><strong>EQL #{idx + 1}</strong></p>
                    <p>Previous Swing Low → {n.previousSwing}, Low: {n.previousPrice}</p>
                    <p>Current Swing Low → {n.currentSwing}, Low: {n.currentPrice}</p>
                    <p>Root Swing High → {n.rootSwingHighTime}, High: {n.rootSwingHighPrice}</p>
                    <p>Proximity: {n.proximity} | Breakout: {n.breakout ? "Yes" : "No"}</p>
                  </div>
                ))
              ) : (
                <p>No EQLs detected (1h).</p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* 15m Tab */}
      {activeTab === "15m" && (
        <div>
          {breakoutSwing15m ? (
            <div>
              <h3>Breakout Swing (15m)</h3>
              <p>Time (Deriv): {formatDerivTime(breakoutSwing15m.time)}</p>
              <p>High: {breakoutSwing15m.high}</p>
            </div>
          ) : (
            <p>No breakout swing detected (15m).</p>
          )}

          {rootSwing15m ? (
            <div>
              <h3>Root Swing (15m)</h3>
              <p>Time (Deriv): {formatDerivTime(rootSwing15m.time)}</p>
              <p>Low: {rootSwing15m.low}</p>
            </div>
          ) : (
            <p>No root swing detected (15m).</p>
          )}

          {rootSwing15m && breakoutSwing15m ? (
            <div>
              <h3>EQLs Detected (15m)</h3>
              {eqls15m.length > 0 ? (
                eqls15m.map((n, idx) => (
                  <div key={idx} style={{ marginBottom: "1rem" }}>
                    <p><strong>15m EQL #{idx + 1}</strong></p>
                    <p>Previous Swing Low → {n.previousSwing}, Low: {n.previousPrice}</p>
                    <p>Current Swing Low → {n.currentSwing}, Low: {n.currentPrice}</p>
                    <p>Root Swing High → {n.rootSwingHighTime}, High: {n.rootSwingHighPrice}</p>
                    <p>Proximity: {n.proximity} | Breakout: {n.breakout ? "Yes" : "No"}</p>
                  </div>
                ))
              ) : (
                <p>No EQLs detected (15m).</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default EQHDetail;
