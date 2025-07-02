import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css'; // Optional: for component-specific styles

interface DashboardProps {
  token: string;
  onLogout: () => void;
  apiBaseUrl: string;
}

function Dashboard({ token, onLogout, apiBaseUrl }: DashboardProps) {
  const [dashboardData, setDashboardData] = useState('Loading data...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/dashboard/data`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setDashboardData(response.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. You might be unauthorized or the service is down.');
        setDashboardData(''); // Clear loading text
      }
    };

    if (token) { // Only fetch if a token exists
      fetchDashboardData();
    }
  }, [token, apiBaseUrl]); // Re-fetch if token or base URL changes

  return (
    <div className="dashboard-container">
      <h2>Welcome to your Protege Dashboard!</h2>
      <p>Your JWT Token: `{token ? token.substring(0, 30) + '...' : 'N/A'}`</p>
      <div className="dashboard-content">
        <h3>Protected Data:</h3>
        {error ? (
          <p className="error-message">{error}</p>
        ) : (
          <p>{dashboardData}</p>
        )}
      </div>
      <button onClick={onLogout} className="logout-button">Logout</button>
    </div>
  );
}

export default Dashboard;