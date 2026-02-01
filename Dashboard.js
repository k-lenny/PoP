
import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';
import DerivChartEmbed from './DerivChartEmbed';
import { 
  FaPlug, 
  FaSyncAlt, 
  FaBolt, 
  FaExclamationTriangle, 
  FaSignInAlt, 
  FaChartLine, 
  FaExchangeAlt, 
  FaSpinner,
  FaClock,
  FaInfoCircle
} from 'react-icons/fa';

const getStatusColor = (status) => {
  switch (status) {
    case 'Good': return 'status-good';
    case 'Warning': return 'status-warning';
    case 'Error': return 'status-error';
    default: return 'status-good';
  }
};

const Dashboard = () => {
  const [status, setStatus] = useState({
    websocket: 'Connecting...',
    apiSync: 'Pending',
    ping: null,
    errorLogs: 0,
    lastActivity: 'Just now',
    uptime: '00:00:00'
  });

  const [trades, setTrades] = useState([]);
  const [authToken, setAuthToken] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  const ws = useRef(null);
  const pingStart = useRef(null);
  const uptimeInterval = useRef(null);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update uptime counter
  useEffect(() => {
    let seconds = 0;
    uptimeInterval.current = setInterval(() => {
      seconds++;
      const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      setStatus(prev => ({ ...prev, uptime: `${hours}:${mins}:${secs}` }));
    }, 1000);

    return () => clearInterval(uptimeInterval.current);
  }, []);

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handlePing = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      pingStart.current = Date.now();
      ws.current.send(JSON.stringify({ ping: 1 }));
      setStatus(prev => ({ ...prev, lastActivity: 'Just now' }));
    }
  };

  const handleAuthorize = (token) => {
    if (!token) return;
    setAuthToken(token);
    ws.current.send(JSON.stringify({ authorize: token }));
  };

  const fetchTrades = () => {
    if (ws.current && authToken) {
      ws.current.send(JSON.stringify({
        statement: 1,
        description: 1,
        limit: 10,
      }));
    }
  };

  const openOAuthWindow = (e) => {
    e.preventDefault();
    showToastMessage('Account connection feature is currently under development!');
  };

  const initWebSocket = React.useCallback(() => {
    if (ws.current) {
      ws.current.close();
    }

    ws.current = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    ws.current.onopen = () => {
      setStatus(prev => ({ ...prev, websocket: 'Good', apiSync: 'Good' }));
      handlePing();
      if (authToken) {
        ws.current.send(JSON.stringify({ authorize: authToken }));
      }
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.ping) {
        const pingTime = Date.now() - pingStart.current;
        const connectionStatus = pingTime < 500 ? 'Good' : pingTime < 600 ? 'Warning' : 'Error';
        setStatus(prev => ({
          ...prev,
          ping: pingTime,
          websocket: connectionStatus,
          apiSync: connectionStatus,
          lastActivity: 'Just now'
        }));
      }

      if (data.msg_type === 'statement') {
        setTrades(data.statement || []);
      }
    };

    ws.current.onerror = () => {
      setStatus(prev => ({ 
        ...prev, 
        websocket: 'Error', 
        apiSync: 'Error', 
        errorLogs: prev.errorLogs + 1,
        lastActivity: 'Just now'
      }));
    };

    ws.current.onclose = () => {
      setStatus(prev => ({ ...prev, websocket: 'Error', apiSync: 'Error' }));
    };
  }, [authToken]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token1 = urlParams.get('token1');
    if (token1) handleAuthorize(token1);
  }, []);

  useEffect(() => {
    initWebSocket();
    const pingInterval = setInterval(handlePing, 1000);
    return () => {
      if (ws.current) ws.current.close();
      clearInterval(pingInterval);
    };
  }, [initWebSocket]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Trading Dashboard</h1>
          <p className="dashboard-subtitle">Real-time monitoring and analytics</p>
        </div>
        <div className="status-display">
          <div className="live-status">
            <div className={`status-dot ${getStatusColor(status.websocket)}`} />
            <span>Live</span>
          </div>
          <div className="time-display">
            <FaClock className="time-icon" />
            <span>{currentTime}</span>
          </div>
        </div>
      </header>

      <div className="status-grid">
        {/* WebSocket Status Card */}
        <div className="status-card websocket-card">
          <div className="card-header">
            <div>
              <h3>WebSocket Status</h3>
              <div className="status-value">
                <div className={`status-dot ${getStatusColor(status.websocket)}`} />
                <span>{status.websocket}</span>
              </div>
            </div>
            <div className="status-icon">
              <FaPlug />
            </div>
          </div>
          <div className="card-details">
            <div className="detail-item">
              <span>Last activity:</span>
              <span>{status.lastActivity}</span>
            </div>
            <div className="detail-item">
              <span>Uptime:</span>
              <span>{status.uptime}</span>
            </div>
          </div>
        </div>

        {/* API Sync Status Card */}
        <div className="status-card api-card">
          <div className="card-header">
            <div>
              <h3>API Sync Status</h3>
              <div className="status-value">
                <div className={`status-dot ${getStatusColor(status.apiSync)}`} />
                <span>{status.apiSync}</span>
              </div>
            </div>
            <div className="status-icon">
              <FaSyncAlt />
            </div>
          </div>
          <div className="card-details">
            <div className="detail-item">
              <span>Last sync:</span>
              <span>{status.lastActivity}</span>
            </div>
            <div className="detail-item">
              <span>Sync frequency:</span>
              <span>1s</span>
            </div>
          </div>
        </div>

        {/* Ping Card */}
        <div className="status-card ping-card">
          <div className="card-header">
            <div>
              <h3>Connection Ping</h3>
              <div className="ping-value">
                {status.ping !== null ? (
                  <>
                    <div className="ping-animation" />
                    <span>{status.ping} ms</span>
                  </>
                ) : (
                  <FaSpinner className="spinner" />
                )}
              </div>
            </div>
            <div className="status-icon">
              <FaBolt />
            </div>
          </div>
          <button onClick={handlePing} className="refresh-btn">
            <FaSyncAlt className="btn-icon" />
            Refresh Ping
          </button>
        </div>

        {/* Error Logs Card */}
        <div className="status-card error-card">
          <div className="card-header">
            <div>
              <h3>Error Logs</h3>
              <div className="status-value">
                <div className={`status-dot ${status.errorLogs > 0 ? 'status-error' : 'status-good'}`} />
                <span>{status.errorLogs > 0 ? `${status.errorLogs} Errors` : 'No Errors'}</span>
              </div>
            </div>
            <div className="status-icon">
              <FaExclamationTriangle />
            </div>
          </div>
          <div className="card-details">
            <div className="detail-item">
              <span>Last error:</span>
              <span>{status.errorLogs > 0 ? status.lastActivity : 'Never'}</span>
            </div>
            <div className="detail-item">
              <span>Error rate:</span>
              <span>0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="chart-section">
        <div className="chart-container1">
          <div className="flex justify-between items-center">
            <h2>
              <FaChartLine className="mr-2" />
              Market Chart
            </h2>
          </div>
          <DerivChartEmbed authToken={authToken} />
        </div>
      </div>

      {/* Account Section */}
      <div className="account-section">
        <div className="account-card">
          <div className="flex justify-between items-center">
            <h2>
            
              Account
            </h2>
            <span className="account-badge">Demo</span>
          </div>
          
          {!authToken ? (
            <div className="account-not-connected">
              <div className="account-lock-icon">
                <FaExchangeAlt />
              </div>
              <h3>Connect Your Account</h3>
              <p>Connect your Deriv account to view trades and analytics</p>
              <button onClick={openOAuthWindow} className="connect-btn">
                <FaSignInAlt className="mr-2" />
                Connect Account
              </button>
            </div>
          ) : (
            <div className="account-connected">
              <div className="flex items-center mb-4">
                <div className="account-check-icon">
                  <FaExchangeAlt />
                </div>
                <div>
                  <h3>Account Connected</h3>
                  <p>demo@deriv.com</p>
                </div>
              </div>
              
              <button onClick={fetchTrades} className="fetch-trades-btn">
                <FaSyncAlt className="mr-2" />
                Fetch Last 10 Trades
              </button>
              
              <div className="recent-trades">
                <h4>Recent Trades</h4>
                <div className="trades-list">
                  {trades.length > 0 ? (
                    trades.map((trade, index) => (
                      <div key={index} className="trade-item">
                        <div className="flex justify-between">
                          <div>
                            <span className={`trade-action ${trade.action_type === 'buy' ? 'buy' : 'sell'}`}>
                              {trade.action_type}
                            </span>
                            <span className="trade-symbol">{trade.transaction_id}</span>
                          </div>
                          <div>
                            <div>{trade.amount} {trade.currency}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-trades">
                      <FaExchangeAlt />
                      <p>No trades to display</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="toast-notification">
          <FaInfoCircle className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
