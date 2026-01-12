#!/bin/bash

# Development script for Story Graph
# Runs Vite dev server and Electron concurrently

echo "Starting Story Graph development environment..."

# Build main process first
echo "Building main process..."
npm run build:main

# Start Vite dev server in background
echo "Starting Vite dev server..."
npm run dev:renderer &
VITE_PID=$!

# Wait for Vite to start
sleep 3

# Set environment variable for development
export NODE_ENV=development

# Start Electron
echo "Starting Electron..."
npm start

# Cleanup when script exits
trap "kill $VITE_PID" EXIT
