// WaitingGame.client.tsx
"use client";

import React, { useState, useEffect } from "react";

export default function WaitingGame() {
  const [score, setScore] = useState(0);
  const [position, setPosition] = useState({ top: 50, left: 50 });

  // Update the target's position every second
  useEffect(() => {
    const interval = setInterval(() => {
      setPosition({
        top: Math.random() * 80 + 10, // keeps the target between 10% and 90%
        left: Math.random() * 80 + 10,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Increase score when the target is clicked
  const handleClick = () => {
    setScore((prev) => prev + 1);
  };

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        textAlign: "center",
        paddingTop: "2rem",
        background: "#f5f5f5",
      }}
    >
      <h2>Your report is being generated!</h2>
      <p>While you wait, try to score as high as you can!</p>
      <p>
        <strong>Score: {score}</strong>
      </p>
      <div
        onClick={handleClick}
        style={{
          position: "absolute",
          top: `${position.top}%`,
          left: `${position.left}%`,
          width: "50px",
          height: "50px",
          backgroundColor: "salmon",
          borderRadius: "50%",
          cursor: "pointer",
        }}
      />
      <p style={{ marginTop: "2rem", color: "#555" }}>
        (Refresh the page to check if your report is ready)
      </p>
    </div>
  );
}
