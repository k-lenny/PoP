
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./Alert.css"; // Import the CSS file

const TELEGRAM_BOT_TOKEN = "8146767397:AAELhzrVhMQYJzHg2usACDglz2ef6Zs0mCs";
const TELEGRAM_CHAT_ID = "6454180433";
const APP_ID = 1001;

const sendTelegramAlert = async (message) => {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
        });
        console.log("✅ Telegram message sent successfully:", message);
    } catch (error) {
        console.error("❌ Error sending Telegram message:", error.response ? error.response.data : error.message);
        // Optional: Implement retry logic here
    }
};

const Alert = () => {
    const [selectedVolatility, setSelectedVolatility] = useState("");
    const [alerts, setAlerts] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(null);
    const lastPriceRef = useRef(null);
    const alertSentMap = useRef({});
    const ws = useRef(null);

    useEffect(() => {
        if (!selectedVolatility) return;

        let reconnectAttempts = 0;
        const maxReconnects = 5;
        let isClosing = false;

        const connectWebSocket = () => {
            if (ws.current) {
                ws.current.close();
            }
            if (isClosing) return;

            ws.current = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}&l=EN&brand=deriv`);

            ws.current.onopen = () => {
                if (ws.current.readyState === WebSocket.OPEN) {
                    ws.current.send(JSON.stringify({ ticks: selectedVolatility }));
                }
                reconnectAttempts = 0;
            };

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.tick) {
                    const { quote } = data.tick;
                    lastPriceRef.current = currentPrice;
                    setCurrentPrice(quote);

                    alerts.forEach(({ type, threshold }, index) => {
                        const parsedThreshold = parseFloat(threshold);

                        //is this alert sent already so no double up...saves from double the workload from this code. 
                         if(alertSentMap.current[index] || !parsedThreshold){  //guard from triggering for no set thresholds
                           return;
                         }

                        const isPriceAboveThreshold = quote >= parsedThreshold;
                        const isPriceBelowThreshold = quote <= parsedThreshold;


                         if (
                                lastPriceRef.current !== null &&  //make sure you had pastprice for comparison before logic continues...avoids logic errors
                                !alertSentMap.current[index] &&  //saves on work..dont execute unessassrily

                                ((lastPriceRef.current < parsedThreshold && isPriceAboveThreshold) ||  //previous value has to be bellow the threshold value. so new entry passes thtough or else condition never satisfied
                                (lastPriceRef.current > parsedThreshold && isPriceBelowThreshold))
                            ){
                                  const message = `Your ${type} price for ${selectedVolatility} has been crossed! Threshold: ${threshold}, Current Price: ${quote}`;
                                  console.log("🚀 Price threshold crossed. Sending Telegram alert:", message);
                                   sendTelegramAlert(message);
                                   alertSentMap.current[index] = true; // saves value per iteration.. so you have flag from iterations/cycles

                            }


                    });
                }
            };

            ws.current.onerror = (error) => {
                console.error("❌ WebSocket error:", error);
            };

            ws.current.onclose = (event) => {
                if (!event.wasClean && reconnectAttempts < maxReconnects) {
                    reconnectAttempts++;
                    const delay = Math.min(2000, 2 ** reconnectAttempts * 1000);
                   
                    setTimeout(connectWebSocket, delay);
                } else {
                   
                }
            };
        };

        connectWebSocket();

        return () => {
            isClosing = true;
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.close();
            }
        };
    }, [selectedVolatility, alerts,currentPrice]); //remove currentprice for efficiency. as use current Price wasnt used inside this effect..

    const addAlert = () => {
        const newAlert = {
            type: "Entry",
            threshold: "",
        };
        setAlerts([...alerts, newAlert]);
        alertSentMap.current = {};// added this to make sure no old alerts stick or cause issues so we dont make multiple posts because the initial logic had alertMap reset to only values that meet the alert and or prices... not adding it as you can have different set of alerts set up and have multiple values
    };

    const updateAlert = (index, field, value) => {
        const updatedAlerts = alerts.map((alert, i) =>
            i === index ? { ...alert, [field]: value } : alert
        );
        setAlerts(updatedAlerts);
         alertSentMap.current = {};//added to prevent alerts map triggering right after values added
    };

    const removeAlert = (index) => {
         const updatedAlerts = [...alerts];
         updatedAlerts.splice(index,1)
         setAlerts(updatedAlerts)
    };
    
    return (
        <div className="alert-container">
            <h2>Set Price Alerts</h2>
            <label>Volatility Index:</label>
            <select value={selectedVolatility} onChange={(e) => setSelectedVolatility(e.target.value)}>
                <option value="">Select Volatility</option>
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

            <p className={`current-price ${currentPrice && lastPriceRef.current !== null && currentPrice > lastPriceRef.current ? "up" : "down"}`}>
                {currentPrice ? (
                    <>
                        {currentPrice} {lastPriceRef.current !== null ? (currentPrice > lastPriceRef.current ? "↑" : "↓") : ""}
                    </>
                ) : (
                    "Fetching..."
                )}
            </p>

            <div className="alert-list">
                <table className="alert-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Price</th>
                            <th>Action</th> {/* Add header for the remove column */}
                        </tr>
                    </thead>
                    <tbody>
                        {alerts.map((alert, index) => (

                                <tr key={index} className={alertSentMap.current[index] ? "alert-triggered" : ""}>
                                    <td>
                                        <select value={alert.type} onChange={(e) => updateAlert(index, "type", e.target.value)}>
                                            <option value="Entry">Entry</option>
                                            <option value="Stop Loss">Stop Loss</option>
                                            <option value="Target Profit">Target Profit</option>
                                        </select>
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            value={alert.threshold}
                                            onChange={(e) => updateAlert(index, "threshold", e.target.value)}
                                            placeholder="Enter price threshold"
                                        />
                                    </td>
                                         <td> <button onClick={() => removeAlert(index)}>Remove</button>
                                     </td>
                                </tr>

                        ))}
                    </tbody>
                </table>
            </div>

            <button onClick={addAlert}>Add Alert</button>
        </div>
    );
};

export default Alert;
