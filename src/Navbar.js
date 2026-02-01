
import React from 'react';
import { NavLink } from 'react-router-dom';
import './styles/Navbar.css'; // Make sure this path matches your file structure

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <span className="navbar-brand">PoP
        </span>
        <NavLink to="/" className="nav-link">
          Dashboard
        </NavLink>
        <NavLink to="/eq" className="nav-link">
          EQ Detector
        </NavLink>
        <NavLink to="/setup" className="nav-link">
          Setup
        </NavLink>
        <NavLink to="/Tick" className="nav-link">
          Tick
        </NavLink>
        <NavLink to="/alert" className="nav-link">
          Alert
        </NavLink>
        <NavLink to="/Algo" className="nav-link">
          Algo
        </NavLink>
        <NavLink to="/order" className="nav-link">
          Order
        </NavLink>
        <NavLink to="/simulator" className="nav-link">
          Simulator(Under development)
        </NavLink>
        <NavLink to="/mss" className="nav-link">
          Bos(Under development)
        </NavLink>
      </div>
    </nav>
  );
};

export default Navbar;
