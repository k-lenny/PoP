
import { useEffect, useRef, useState } from 'react';
import SetupDetector from './SetupDetector';
import '../styles/Setup.css';

const TradingViewChart = () => {
  const chartContainerRef = useRef();
  const [setups, setSetups] = useState([]);

  // Embed the Deriv chart iframe
  useEffect(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://charts.deriv.com/deriv';
    iframe.style.width = '100%';
    iframe.style.height = '500px';
    iframe.style.border = 'none';
    iframe.style.position = 'relative'; // Ensure iframe is positioned relative to the chart container
    
    const chartContainer = chartContainerRef.current; // Store reference in a variable for cleanup
    chartContainer.appendChild(iframe);

    // Cleanup on unmount
    return () => {
      if (chartContainer) {
        chartContainer.removeChild(iframe);
      }
    };
  }, []); // Empty dependency array ensures this runs once when component mounts

  // Handle newly detected setup
  const handleNewSetup = (setup) => {
    console.log('New Setup:', setup);  // Log the setup to verify data
    setSetups(prev => [...prev.slice(-9), setup]);  // Keep track of the last 10 setups
  };

  return (
    <div className="setup-container">
      <div ref={chartContainerRef} className="chart-wrapper">
        {/* Add markers as absolute positioned elements over the iframe */}
        {setups.map((setup, idx) => (
          <div
            key={idx}
            className={`setup-marker ${setup.type.includes('Bearish') ? 'bearish' : 'bullish'}`}
            style={{
              position: 'absolute',
              left: `${setup.position || 50}%`, // Default to 50% if position is not provided
              top: `${setup.verticalPosition || 50}%`, // Default to 50% if vertical position is not provided
              transform: 'translateX(-50%)', // Center the marker horizontally
            }}
          >
            {setup.type}
          </div>
        ))}
      </div>

      {/* Setup detector runs in background and feeds chart + setup list */}
      <SetupDetector onNewSetup={handleNewSetup} />

      <div className="setup-list">
        <h3>Recent S Setups</h3>
        {setups.map((s, idx) => (
          <div key={idx} className={`setup-card ${s.type.includes('Bearish') ? 'bearish' : 'bullish'}`}>
            <p><strong>Type:</strong> {s.type}</p>
            <p><strong>Status:</strong> {s.status}</p>
            <p><strong>Retest Price:</strong> {s.retestZone.toFixed(5)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TradingViewChart;
