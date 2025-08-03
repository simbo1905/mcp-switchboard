#!/bin/bash

# Lima Manager for Tauri Testing
# Manages a dedicated Lima instance for cross-platform testing

set -euo pipefail

# Configuration
LIMA_INSTANCE_NAME="tauri-test"
STATE_DIR=".lima-state"
LOG_FILE="$STATE_DIR/lima-manager.log"
INSTANCE_FILE="$STATE_DIR/instance.json"
VERIFY_FILE="$STATE_DIR/last-verify.json"
MAX_LOG_SIZE=10485760  # 10MB

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize log file
touch "$LOG_FILE"

# Rotate log if too large
log_size=$(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$log_size" -gt "$MAX_LOG_SIZE" ]; then
    mv "$LOG_FILE" "$LOG_FILE.old"
    touch "$LOG_FILE"
fi

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case "$level" in
        ERROR)
            echo -e "${RED}❌ $message${NC}" >&2
            ;;
        SUCCESS)
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        WARNING)
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        INFO)
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        *)
            echo "$message"
            ;;
    esac
}

# Comprehensive prerequisite checks
check_prerequisites() {
    local issues=0
    
    # Check if we're on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log ERROR "Lima testing requires macOS"
        log INFO "Current OS: $OSTYPE"
        log INFO "Lima virtualization is designed for macOS hosts"
        issues=$((issues + 1))
    else
        log SUCCESS "Running on macOS ($OSTYPE)"
    fi
    
    # Check macOS version (require 10.15+)
    local macos_version
    macos_version=$(sw_vers -productVersion 2>/dev/null || echo "unknown")
    if [[ "$macos_version" != "unknown" ]]; then
        local major_version
        major_version=$(echo "$macos_version" | cut -d. -f1)
        local minor_version  
        minor_version=$(echo "$macos_version" | cut -d. -f2)
        
        if [[ "$major_version" -lt 10 ]] || [[ "$major_version" -eq 10 && "$minor_version" -lt 15 ]]; then
            log ERROR "macOS $macos_version is too old (require 10.15+)"
            issues=$((issues + 1))
        else
            log SUCCESS "macOS $macos_version is compatible"
        fi
    else
        log WARNING "Could not determine macOS version"
    fi
    
    # Check if Lima is installed
    if ! command -v limactl &> /dev/null; then
        log ERROR "Lima is not installed"
        log INFO "Install with: brew install lima"
        log INFO "Homebrew required: https://brew.sh"
        issues=$((issues + 1))
    else
        log SUCCESS "Lima is installed"
        
        # Check Lima version
        local lima_version
        lima_version=$(limactl --version 2>/dev/null | head -n1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' || echo "unknown")
        
        if [[ "$lima_version" == "unknown" ]]; then
            log WARNING "Could not determine Lima version"
        else
            log SUCCESS "Lima version: $lima_version"
            
            # Check if version is compatible (need 0.20.0+)
            local major minor
            IFS='.' read -r major minor _ <<< "$lima_version"
            
            if [[ "$major" -eq 0 && "$minor" -lt 20 ]]; then
                log WARNING "Lima $lima_version may be too old (recommend 0.20.0+)"
                log INFO "Consider updating: brew upgrade lima"
            fi
        fi
    fi
    
    # Check if Homebrew is available (for Lima installation)
    if ! command -v brew &> /dev/null; then
        log WARNING "Homebrew not found"
        log INFO "Install from: https://brew.sh"
        log INFO "Required for Lima installation and updates"
    else
        log SUCCESS "Homebrew is available"
        
        # Check if lima-additional-guestagents is installed (required for Linux VMs)
        if ! brew list lima-additional-guestagents &>/dev/null; then
            log ERROR "lima-additional-guestagents not installed"
            log INFO "This is required for Linux VM support"
            log INFO "Will install automatically during setup"
            issues=$((issues + 1))
        else
            log SUCCESS "lima-additional-guestagents is installed"
        fi
    fi
    
    # Check available disk space (Lima VMs need ~20GB)
    local available_space
    available_space=$(df -h "$HOME" | awk 'NR==2 {print $4}' | sed 's/G.*//')
    
    if [[ "$available_space" =~ ^[0-9]+$ ]] && [[ "$available_space" -lt 25 ]]; then
        log WARNING "Low disk space: ${available_space}GB available"
        log INFO "Lima VM requires ~20GB free space"
    else
        log SUCCESS "Sufficient disk space available"
    fi
    
    return $issues
}

# Check if Lima is installed (for backward compatibility)
check_lima_installed() {
    if ! command -v limactl &> /dev/null; then
        log ERROR "Lima is not installed"
        log INFO "Install Lima with: brew install lima"
        return 1
    fi
    return 0
}

# Save instance metadata
save_instance_metadata() {
    local status="$1"
    cat > "$INSTANCE_FILE" <<EOF
{
    "name": "$LIMA_INSTANCE_NAME",
    "status": "$status",
    "created": "$(date -Iseconds)",
    "last_updated": "$(date -Iseconds)"
}
EOF
}

# Save verification results
save_verify_result() {
    local result="$1"
    local message="$2"
    cat > "$VERIFY_FILE" <<EOF
{
    "result": "$result",
    "message": "$message",
    "timestamp": "$(date -Iseconds)",
    "instance": "$LIMA_INSTANCE_NAME"
}
EOF
}

# Detect default instance configuration
detect_default_config() {
    if ! limactl list | grep -q "^default"; then
        log WARNING "No default Lima instance found"
        return 1
    fi
    
    local config_file="$HOME/.lima/default/lima.yaml"
    if [ ! -f "$config_file" ]; then
        log WARNING "Default instance config file not found"
        return 1
    fi
    
    local vmtype arch
    vmtype=$(grep "^vmType:" "$config_file" | cut -d: -f2 | xargs)
    
    # Get actual architecture from running system
    if [ "$(uname -m)" = "arm64" ]; then
        arch="aarch64"
    else
        arch="x86_64"
    fi
    
    # If vmType is null, detect based on system
    if [ "$vmtype" = "null" ] || [ -z "$vmtype" ]; then
        if [ "$(uname -m)" = "arm64" ]; then
            vmtype="vz"  # Apple Silicon typically uses VZ
        else
            vmtype="qemu"  # Intel typically uses QEMU
        fi
    fi
    
    log INFO "Detected default instance: VMTYPE=$vmtype ARCH=$arch"
    
    # Export for use in setup
    export DETECTED_VMTYPE="$vmtype"
    export DETECTED_ARCH="$arch"
    
    return 0
}

# Setup Lima instance
lima_setup() {
    log INFO "Setting up Lima instance '$LIMA_INSTANCE_NAME'..."
    
    # Run comprehensive prerequisite checks
    log INFO "Checking prerequisites..."
    if ! check_prerequisites; then
        log ERROR "Prerequisites not met - setup cannot continue"
        log INFO "Please fix the issues above and try again"
        return 1
    fi
    
    log SUCCESS "All prerequisites met"
    
    # Detect and match default instance configuration
    log INFO "Detecting default Lima instance configuration..."
    if detect_default_config; then
        log SUCCESS "Will create tauri-test instance matching default: $DETECTED_VMTYPE/$DETECTED_ARCH"
    else
        log WARNING "No default instance found, using fallback configuration"
        DETECTED_VMTYPE="vz"
        DETECTED_ARCH="aarch64"
    fi
    
    # Install lima-additional-guestagents if missing (required for Linux VMs)
    if ! brew list lima-additional-guestagents &>/dev/null; then
        log INFO "Installing lima-additional-guestagents (required for Linux VMs)..."
        if brew install lima-additional-guestagents 2>&1 | tee -a "$LOG_FILE"; then
            log SUCCESS "lima-additional-guestagents installed"
        else
            log ERROR "Failed to install lima-additional-guestagents"
            log INFO "Try manually: brew install lima-additional-guestagents"
            return 1
        fi
    fi
    
    # Check if instance already exists
    if limactl list | grep -q "^$LIMA_INSTANCE_NAME"; then
        log WARNING "Instance '$LIMA_INSTANCE_NAME' already exists"
        if limactl list | grep "^$LIMA_INSTANCE_NAME" | grep -q "Running"; then
            log SUCCESS "Instance is already running"
            save_instance_metadata "running"
            return 0
        else
            log INFO "Starting existing instance..."
            limactl start "$LIMA_INSTANCE_NAME"
            save_instance_metadata "running"
            return 0
        fi
    fi
    
    log INFO "Creating new Lima instance '$LIMA_INSTANCE_NAME'..."
    
    # Set image URL based on detected architecture
    local image_url
    if [ "$DETECTED_ARCH" = "aarch64" ]; then
        image_url="https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-arm64.img"
    else
        image_url="https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img"
    fi
    
    # Create Lima instance with configuration matching default
    cat > "$STATE_DIR/lima-config.yaml" <<EOF
vmType: "$DETECTED_VMTYPE"
os: "Linux"
arch: "$DETECTED_ARCH"
images:
- location: "$image_url"
  arch: "$DETECTED_ARCH"
cpus: 4
memory: "4GiB"
disk: "20GiB"
mounts:
- location: "~"
  writable: true
- location: "/tmp/lima"
  writable: true
ssh:
  localPort: 0
  loadDotSSHPubKeys: true
provision:
- mode: system
  script: |
    #!/bin/bash
    set -eux -o pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y curl wget build-essential
- mode: user
  script: |
    #!/bin/bash
    set -eux -o pipefail
    echo "Lima instance created successfully"
EOF
    
    limactl create --name="$LIMA_INSTANCE_NAME" "$STATE_DIR/lima-config.yaml"
    limactl start "$LIMA_INSTANCE_NAME"
    
    log INFO "Installing development dependencies in Lima..."
    
    # Install system dependencies first
    log INFO "Installing system packages..."
    limactl shell "$LIMA_INSTANCE_NAME" bash -c '
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y build-essential curl wget file xvfb
echo "System packages installed"
' 2>&1 | tee -a "$LOG_FILE" || {
        log ERROR "Failed to install system packages"
        return 1
    }
    
    # Install Node.js
    log INFO "Installing Node.js..."
    limactl shell "$LIMA_INSTANCE_NAME" bash -c '
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
sudo apt-get install -y nodejs > /dev/null 2>&1
echo "Node.js $(node --version) installed"
' 2>&1 | tee -a "$LOG_FILE" || {
        log ERROR "Failed to install Node.js"
        return 1
    }
    
    # Install Rust
    log INFO "Installing Rust..."
    limactl shell "$LIMA_INSTANCE_NAME" bash -c '
set -euo pipefail
curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y > /dev/null 2>&1
source ~/.cargo/env
echo "Rust $(rustc --version) installed"
' 2>&1 | tee -a "$LOG_FILE" || {
        log ERROR "Failed to install Rust"
        return 1
    }
    
    # Install tauri-driver
    log INFO "Installing tauri-driver..."
    limactl shell "$LIMA_INSTANCE_NAME" bash -c '
set -euo pipefail
source ~/.cargo/env
cargo install tauri-driver > /dev/null 2>&1
echo "tauri-driver installed at $(which tauri-driver)"
' 2>&1 | tee -a "$LOG_FILE" || {
        log ERROR "Failed to install tauri-driver"
        return 1
    }
    
    log SUCCESS "All dependencies installed successfully"
    
    if [ "${PIPESTATUS[0]}" -eq 0 ]; then
        log SUCCESS "Lima instance '$LIMA_INSTANCE_NAME' setup completed"
        save_instance_metadata "running"
        save_verify_result "success" "Instance setup and verified successfully"
        return 0
    else
        log ERROR "Failed to setup Lima instance"
        save_instance_metadata "failed"
        save_verify_result "failed" "Setup failed - check logs"
        return 1
    fi
}

# Verify Lima instance is ready
lima_verify() {
    log INFO "Verifying Lima instance '$LIMA_INSTANCE_NAME'..."
    
    if ! check_lima_installed; then
        save_verify_result "failed" "Lima not installed"
        return 1
    fi
    
    if ! limactl list | grep -q "^$LIMA_INSTANCE_NAME"; then
        log ERROR "Instance '$LIMA_INSTANCE_NAME' does not exist"
        log INFO "Run: npm run lima:setup"
        save_verify_result "failed" "Instance does not exist"
        return 2
    fi
    
    if ! limactl list | grep "^$LIMA_INSTANCE_NAME" | grep -q "Running"; then
        log WARNING "Instance '$LIMA_INSTANCE_NAME' is not running"
        log INFO "Starting instance..."
        limactl start "$LIMA_INSTANCE_NAME" 2>&1 | tee -a "$LOG_FILE"
        
        if [ "${PIPESTATUS[0]}" -ne 0 ]; then
            log ERROR "Failed to start instance"
            save_verify_result "failed" "Failed to start instance"
            return 1
        fi
    fi
    
    log INFO "Checking dependencies in Lima instance..."
    
    # Verify all dependencies are installed
    limactl shell "$LIMA_INSTANCE_NAME" bash -c '
set -euo pipefail

echo "Checking dependencies..."

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not installed"
    exit 1
fi

source ~/.cargo/env 2>/dev/null || echo "Warning: cargo env not found"

if ! command -v cargo &> /dev/null; then
    echo "ERROR: Cargo not installed"
    exit 1
fi

if ! command -v tauri-driver &> /dev/null; then
    echo "ERROR: tauri-driver not installed"
    exit 1
fi

echo "Node.js: $(node --version)"
echo "Cargo: $(cargo --version)"
echo "tauri-driver: $(which tauri-driver)"
echo "All dependencies verified"
' 2>&1 | tee -a "$LOG_FILE"
    
    if [ "${PIPESTATUS[0]}" -eq 0 ]; then
        log SUCCESS "Lima instance '$LIMA_INSTANCE_NAME' is ready"
        save_verify_result "success" "All dependencies verified"
        return 0
    else
        log ERROR "Lima instance dependencies are incomplete"
        log INFO "Run: npm run lima:setup"
        save_verify_result "failed" "Dependencies incomplete"
        return 2
    fi
}

# Start Lima instance
lima_start() {
    log INFO "Starting Lima instance '$LIMA_INSTANCE_NAME'..."
    
    if ! check_lima_installed; then
        return 1
    fi
    
    if ! limactl list | grep -q "^$LIMA_INSTANCE_NAME"; then
        log ERROR "Instance '$LIMA_INSTANCE_NAME' does not exist"
        log INFO "Run: npm run lima:setup"
        return 2
    fi
    
    if limactl list | grep "^$LIMA_INSTANCE_NAME" | grep -q "Running"; then
        log SUCCESS "Instance '$LIMA_INSTANCE_NAME' is already running"
        return 0
    fi
    
    limactl start "$LIMA_INSTANCE_NAME" 2>&1 | tee -a "$LOG_FILE"
    
    if [ "${PIPESTATUS[0]}" -eq 0 ]; then
        log SUCCESS "Lima instance '$LIMA_INSTANCE_NAME' started"
        save_instance_metadata "running"
        return 0
    else
        log ERROR "Failed to start Lima instance"
        return 1
    fi
}

# Stop Lima instance
lima_stop() {
    log INFO "Stopping Lima instance '$LIMA_INSTANCE_NAME'..."
    
    if ! check_lima_installed; then
        return 1
    fi
    
    if ! limactl list | grep -q "^$LIMA_INSTANCE_NAME"; then
        log WARNING "Instance '$LIMA_INSTANCE_NAME' does not exist"
        return 0
    fi
    
    if ! limactl list | grep "^$LIMA_INSTANCE_NAME" | grep -q "Running"; then
        log SUCCESS "Instance '$LIMA_INSTANCE_NAME' is already stopped"
        return 0
    fi
    
    limactl stop "$LIMA_INSTANCE_NAME" 2>&1 | tee -a "$LOG_FILE"
    
    if [ "${PIPESTATUS[0]}" -eq 0 ]; then
        log SUCCESS "Lima instance '$LIMA_INSTANCE_NAME' stopped"
        save_instance_metadata "stopped"
        return 0
    else
        log ERROR "Failed to stop Lima instance"
        return 1
    fi
}

# Destroy Lima instance
lima_destroy() {
    log WARNING "Destroying Lima instance '$LIMA_INSTANCE_NAME'..."
    log INFO "This will permanently remove the instance and all data"
    
    if ! check_lima_installed; then
        return 1
    fi
    
    if ! limactl list | grep -q "^$LIMA_INSTANCE_NAME"; then
        log WARNING "Instance '$LIMA_INSTANCE_NAME' does not exist"
        rm -f "$INSTANCE_FILE" "$VERIFY_FILE"
        return 0
    fi
    
    # Stop first, then delete
    limactl stop "$LIMA_INSTANCE_NAME" 2>/dev/null || true
    limactl delete "$LIMA_INSTANCE_NAME" 2>&1 | tee -a "$LOG_FILE"
    
    if [ "${PIPESTATUS[0]}" -eq 0 ]; then
        log SUCCESS "Lima instance '$LIMA_INSTANCE_NAME' destroyed"
        rm -f "$INSTANCE_FILE" "$VERIFY_FILE"
        return 0
    else
        log ERROR "Failed to destroy Lima instance"
        return 1
    fi
}

# Show status
lima_status() {
    log INFO "Lima Status Report"
    echo
    
    if ! check_lima_installed; then
        echo "Lima Status: NOT INSTALLED"
        echo "Install with: brew install lima"
        return 1
    fi
    
    echo "Lima Installation: ✅ INSTALLED"
    echo "Lima Version: $(limactl --version)"
    echo
    
    if limactl list | grep -q "^$LIMA_INSTANCE_NAME"; then
        local instance_status
        instance_status=$(limactl list | grep "^$LIMA_INSTANCE_NAME" | awk '{print $2}')
        echo "Instance '$LIMA_INSTANCE_NAME': $instance_status"
        
        if [ "$instance_status" = "Running" ]; then
            echo
            echo "Instance Details:"
            limactl list | grep "^$LIMA_INSTANCE_NAME"
            echo
            
            # Check last verification
            if [ -f "$VERIFY_FILE" ]; then
                local verify_result
                local verify_time
                verify_result=$(grep '"result"' "$VERIFY_FILE" | cut -d'"' -f4)
                verify_time=$(grep '"timestamp"' "$VERIFY_FILE" | cut -d'"' -f4)
                echo "Last Verification: $verify_result ($verify_time)"
            else
                echo "Last Verification: Never verified"
            fi
        fi
    else
        echo "Instance '$LIMA_INSTANCE_NAME': NOT FOUND"
    fi
    
    echo
    echo "Log File: $LOG_FILE"
    echo "State Directory: $STATE_DIR"
}

# Usage information
usage() {
    echo "Lima Manager for Tauri Testing"
    echo
    echo "Usage: $0 <command>"
    echo
    echo "Commands:"
    echo "  setup    Create and configure Lima instance"
    echo "  verify   Check if Lima is ready for testing"
    echo "  start    Start existing Lima instance" 
    echo "  stop     Stop Lima instance"
    echo "  destroy  Remove Lima instance completely"
    echo "  status   Show detailed status information"
    echo
    echo "Examples:"
    echo "  $0 setup     # One-time setup"
    echo "  $0 verify    # Check if ready"
    echo "  $0 status    # Show current status"
    echo
    echo "Exit codes:"
    echo "  0 = Success"
    echo "  1 = Error"  
    echo "  2 = Not ready but fixable"
}

# Handle Ctrl+C gracefully
trap 'log WARNING "Operation interrupted by user"; exit 130' INT

# Main command processing
case "${1:-}" in
    setup)
        lima_setup
        ;;
    verify)
        lima_verify
        ;;
    start)
        lima_start
        ;;
    stop)
        lima_stop
        ;;
    destroy)
        lima_destroy
        ;;
    status)
        lima_status
        ;;
    *)
        usage
        exit 1
        ;;
esac