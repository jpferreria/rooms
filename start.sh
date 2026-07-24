#!/bin/bash

# BOOM! SPECTRAL EXTERMINATOR STARTUP SCRIPT
echo "=================================================================="
echo "          BOOM! // PROTO-NEUTRINO EXTERMINATION ENGINE"
echo "=================================================================="
echo "Initializing server instances..."

# Function to clean up background servers on Ctrl+C (SIGINT)
cleanup() {
    echo -e "\n\n[BOOM!] Terminating dev servers..."
    kill $VITE_PID $LOBBY_PID 2>/dev/null
    echo "[BOOM!] Cleanup complete. Exiting."
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Start the WebSocket and REST API Lobby Server (ports 8080/8001)
node server.js &
LOBBY_PID=$!
echo -e "\033[36m[Lobby Server] Started (PID: $LOBBY_PID, WS: 8080, REST API: 8001)\033[0m"

# Give the lobby server a split second to lock its ports
sleep 0.5

# 2. Start the Vite Client Assets Server (port 3000)
npm run dev &
VITE_PID=$!
echo -e "\033[32m[Client Server] Started (PID: $VITE_PID, URL: http://localhost:3000)\033[0m"

echo "=================================================================="
echo "Servers are running. Press [Ctrl + C] at any time to shut down."
echo "=================================================================="

# Block and wait for background processes
wait $LOBBY_PID $VITE_PID
