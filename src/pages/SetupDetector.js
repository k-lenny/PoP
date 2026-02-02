
// World-class S Setup Detector using Deriv WebSocket data
import { useEffect, useState } from 'react';
import '../styles/Setup.css';

const SetupDetector = ({ onNewSetup, onCandles }) => {
  const [candles, setCandles] = useState([]);

  useEffect(() => {
    const websocket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    websocket.onopen = () => {
      console.log('WebSocket connected');
      const request = {
        ticks_history: 'frxEURUSD',
        style: 'candles',
        granularity: 60, // 1-minute candles
        count: 100,
        subscribe: 1,
      };
      websocket.send(JSON.stringify(request));
    };

    websocket.onclose = (event) => {
      if (event.wasClean) {
        console.log('WebSocket closed cleanly');
      } else {
        console.error(`WebSocket closed unexpectedly: Code ${event.code}`);
      }
    };

    websocket.onerror = (error) => {
      console.error(`WebSocket error: ${error.message}`);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.candles) {
        const latestCandles = data.candles.slice(-100);
        setCandles(latestCandles);
        if (onCandles) onCandles(latestCandles);
      } else if (data.tick) {
        setCandles((prev) => {
          const updated = [...prev.slice(1), data.tick];
          if (onCandles) onCandles(updated);
          return updated;
        });
      }
    };

    return () => websocket.close();
  }, [onCandles]);

  useEffect(() => {
    if (candles.length < 10) return;

    const setups = detectSSetups(candles);
    if (setups.length > 0) {
      onNewSetup(setups[setups.length - 1]); // Pass latest setup to parent
    }
  }, [candles, onNewSetup]);

  const detectSSetups = (candles) => {
    const setups = [];

    for (let i = 3; i < candles.length; i++) {
      const c0 = candles[i - 3];
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const c3 = candles[i];

      const bosDown = c2.close < c1.low && c1.close > c0.high;
      const retested = c3.low <= c1.open && c3.high >= c1.open;

      console.log('Checking setup for candles:', c0, c1, c2, c3);

      if (bosDown) {
        const orderBlock = c1;
        const retestZone = orderBlock.open;

        let retestCandle = null;
        let status = 'Not Retested';

        for (let j = i; j < candles.length; j++) {
          const c = candles[j];
          if (c.low <= retestZone && c.high >= retestZone) {
            retestCandle = c;
            status = c.close > orderBlock.high ? 'Retest Surpassed' : 'Retested';
            break;
          }
        }

        setups.push({
          type: 'Bearish S Setup',
          bosCandle: c2,
          orderBlock,
          retestCandle,
          retestZone,
          status,
          bosDown,
          retested,
        });

        console.log('Setup detected:', setups[setups.length - 1]);
      }
    }

    return setups;
  };

  return null;
};

export default SetupDetector;
