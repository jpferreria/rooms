#!/bin/bash

# BOOM! SHUTDOWN SCRIPT
echo "=================================================================="
echo "          BOOM! // SHUTTING DOWN ACTIVE GAME SERVERS"
echo "=================================================================="

# Function to search and terminate process on a given port
kill_port() {
    local port=$1
    local name=$2
    # Find process ID (PID) listening on the specified port
    local pid=$(lsof -t -i :$port 2>/dev/null)
    
    if [ -n "$pid" ]; then
        echo -e "\033[33m[Shutdown] Found $name listening on port $port (PID: $pid). Terminating...\033[0m"
        kill -9 $pid 2>/dev/null
    fi
}

# 1. Terminate client asset server (port 3000)
kill_port 3000 "Vite Client Server"

# 2. Terminate lobby servers (ports 8080 and 8001)
kill_port 8080 "Lobby WebSocket Server"
kill_port 8001 "Lobby REST API Server"

echo "=================================================================="
echo "Cleanup complete. All BOOM! instances have been shut down."
echo "=================================================================="
