#!/bin/bash

# Lima environment setup for Tauri E2E testing
# Sets up a Linux VM with all dependencies needed for Tauri development and WebDriver testing

set -euo pipefail

SETUP_MARKER="$HOME/.lima-tauri-setup-complete"

echo "=== Lima Environment Setup for Tauri E2E Testing ==="

# Check if Lima is installed
if ! command -v limactl &> /dev/null; then
    echo "ERROR: Lima is not installed. Install with: brew install lima"
    exit 1
fi

# Check if default Lima instance exists and start if needed
echo "Checking Lima instance status..."
if ! limactl list | grep -q "default"; then
    echo "Creating default Lima instance..."
    limactl create --name=default
fi

if ! limactl list | grep -q "default.*Running"; then
    echo "Starting Lima instance..."
    limactl start default
    echo "Waiting for Lima to be ready..."
    sleep 10
fi

echo "Lima instance is running"

# Check if setup is already complete
if limactl shell default test -f "$SETUP_MARKER"; then
    echo "Lima environment already configured (marker file exists)"
    echo "To force re-setup, run: limactl shell default rm $SETUP_MARKER"
    exit 0
fi

echo "Setting up development environment in Lima..."

# Install system dependencies
limactl shell default bash -c 'set -euo pipefail
set -x

echo "Updating package lists..."
sudo apt-get update

echo "Installing system dependencies for Tauri..."
sudo apt-get install -y \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    libwebkit2gtk-4.0-dev \
    librsvg2-dev \
    webkit2gtk-driver \
    xvfb

echo "Installing Rust via rustup..."
if ! command -v rustc &> /dev/null; then
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
fi

echo "Installing Node.js 20.x..."
if ! command -v node &> /dev/null || ! node --version | grep -q "v20"; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Installing tauri-driver via cargo..."
source ~/.cargo/env
if ! command -v tauri-driver &> /dev/null; then
    cargo install tauri-driver
fi

echo "Verifying installations..."
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Rust version: $(rustc --version)"
echo "Cargo version: $(cargo --version)"
echo "tauri-driver available: $(command -v tauri-driver)"

echo "Creating setup marker file..."
touch "$SETUP_MARKER"

echo "Lima environment setup complete!"
'

if [ "${PIPESTATUS[0]}" -eq 0 ]; then
    echo "✅ Lima environment setup completed successfully"
    echo "You can now run E2E tests with ./test-e2e-lima.sh"
else
    echo "❌ Lima environment setup failed"
    exit 1
fi