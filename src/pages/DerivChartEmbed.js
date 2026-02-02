
import React from 'react';
import '../styles/DerivChartEmbed.css';

const DerivChartEmbed = () => {
  return (
    <div className="chat-container">
      <h3 className="chart-title">Live Deriv Chart</h3>
      <iframe
        title="Deriv Chart"
        src="https://charts.deriv.com/deriv/"
        width="100%"
        height="600"
        frameBorder="0"
        allowFullScreen
        className="deriv-chart-frame"
      ></iframe>
    </div>
  );
};

export default DerivChartEmbed;
