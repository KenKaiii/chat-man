#!/usr/bin/env bash
#
# Agent Man - One-Command Installer
# ===================================
# Install Agent Man with a single command:
#   curl -fsSL https://raw.githubusercontent.com/kenkai/chat-man/main/install.sh | bash
#
# What this installer does:
# 1. Detects your OS (macOS, Linux, WSL)
# 2. Checks for/installs Ollama
# 3. Downloads the Agent Man binary
# 4. Installs to ~/.agent-man/
# 5. Adds to PATH
# 6. Sets up encryption password
# 7. Ready to use!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="$HOME/.agent-man"
BIN_NAME="agent-man"
GITHUB_REPO="kenkai/chat-man"
RELEASE_VERSION="latest"

# Print colored message
print_message() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Print step header
print_step() {
    echo ""
    print_message "$BLUE" "===> $1"
}

# Print success
print_success() {
    print_message "$GREEN" "✓ $1"
}

# Print warning
print_warning() {
    print_message "$YELLOW" "⚠ $1"
}

# Print error and exit
print_error() {
    print_message "$RED" "✗ Error: $1"
    exit 1
}

# Detect OS
detect_os() {
    print_step "Detecting operating system..."

    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Darwin)
            OS_TYPE="macos"
            print_success "macOS detected"
            ;;
        Linux)
            # Check if WSL
            if grep -qi microsoft /proc/version 2>/dev/null; then
                OS_TYPE="wsl"
                print_success "WSL (Windows Subsystem for Linux) detected"
            else
                OS_TYPE="linux"
                print_success "Linux detected"
            fi
            ;;
        *)
            print_error "Unsupported operating system: $OS"
            echo "Agent Man supports: macOS, Linux, and WSL"
            exit 1
            ;;
    esac

    case "$ARCH" in
        x86_64|amd64)
            ARCH_TYPE="x86_64"
            ;;
        arm64|aarch64)
            ARCH_TYPE="arm64"
            ;;
        *)
            print_error "Unsupported architecture: $ARCH"
            echo "Agent Man supports: x86_64 and arm64"
            exit 1
            ;;
    esac

    print_success "Architecture: $ARCH_TYPE"
}

# Check if Ollama is installed
check_ollama() {
    print_step "Checking for Ollama..."

    if command -v ollama &> /dev/null; then
        print_success "Ollama is already installed"
        OLLAMA_VERSION=$(ollama --version 2>&1 | head -n1)
        echo "  Version: $OLLAMA_VERSION"
        return 0
    else
        print_warning "Ollama not found"
        return 1
    fi
}

# Install Ollama
install_ollama() {
    print_step "Installing Ollama..."

    if [ "$OS_TYPE" = "macos" ]; then
        echo "To install Ollama on macOS, please visit: https://ollama.ai"
        echo "Or use Homebrew: brew install ollama"
        echo ""
        read -p "Press Enter once Ollama is installed, or Ctrl+C to exit..."
    else
        # Linux/WSL
        echo "Installing Ollama via official installer..."
        curl -fsSL https://ollama.ai/install.sh | sh
        print_success "Ollama installed successfully"
    fi
}

# Check/install Ollama
ensure_ollama() {
    if ! check_ollama; then
        echo ""
        read -p "Would you like to install Ollama now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_ollama
        else
            print_warning "Skipping Ollama installation"
            print_warning "You can install it later from: https://ollama.ai"
            echo ""
        fi
    fi
}

# Download Agent Man binary
download_binary() {
    print_step "Downloading Agent Man binary..."

    # Determine binary name based on OS and architecture
    if [ "$OS_TYPE" = "macos" ]; then
        if [ "$ARCH_TYPE" = "arm64" ]; then
            BINARY_NAME="agent-man-macos-arm64"
        else
            BINARY_NAME="agent-man-macos-x86_64"
        fi
    else
        # Linux/WSL
        BINARY_NAME="agent-man-linux-$ARCH_TYPE"
    fi

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Download from GitHub releases
    DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/download/$RELEASE_VERSION/$BINARY_NAME"

    echo "Downloading from: $DOWNLOAD_URL"

    if command -v curl &> /dev/null; then
        curl -fsSL -o "$INSTALL_DIR/$BIN_NAME" "$DOWNLOAD_URL" || {
            print_error "Failed to download binary"
            echo "Please check:"
            echo "  1. Your internet connection"
            echo "  2. GitHub releases page: https://github.com/$GITHUB_REPO/releases"
            exit 1
        }
    elif command -v wget &> /dev/null; then
        wget -q -O "$INSTALL_DIR/$BIN_NAME" "$DOWNLOAD_URL" || {
            print_error "Failed to download binary"
            exit 1
        }
    else
        print_error "Neither curl nor wget found. Please install one of them."
        exit 1
    fi

    # Make executable
    chmod +x "$INSTALL_DIR/$BIN_NAME"

    # Remove macOS quarantine attribute (allows running without notarization)
    if [ "$OS_TYPE" = "macos" ]; then
        xattr -d com.apple.quarantine "$INSTALL_DIR/$BIN_NAME" 2>/dev/null || true
        print_success "Removed macOS quarantine attribute"
    fi

    print_success "Binary downloaded to $INSTALL_DIR/$BIN_NAME"
}

# Add to PATH
setup_path() {
    print_step "Setting up PATH..."

    # Determine shell config file
    SHELL_CONFIG=""
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_CONFIG="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        if [ -f "$HOME/.bashrc" ]; then
            SHELL_CONFIG="$HOME/.bashrc"
        elif [ -f "$HOME/.bash_profile" ]; then
            SHELL_CONFIG="$HOME/.bash_profile"
        fi
    fi

    # Add to PATH if not already there
    PATH_EXPORT="export PATH=\"\$HOME/.agent-man:\$PATH\""

    if [ -n "$SHELL_CONFIG" ]; then
        if ! grep -q ".agent-man" "$SHELL_CONFIG" 2>/dev/null; then
            echo "" >> "$SHELL_CONFIG"
            echo "# Agent Man" >> "$SHELL_CONFIG"
            echo "$PATH_EXPORT" >> "$SHELL_CONFIG"
            print_success "Added to PATH in $SHELL_CONFIG"
            echo "  Run: source $SHELL_CONFIG"
        else
            print_success "Already in PATH"
        fi
    else
        print_warning "Could not detect shell config file"
        echo "Please add this line to your shell config manually:"
        echo "  $PATH_EXPORT"
    fi

    # Add to current PATH
    export PATH="$INSTALL_DIR:$PATH"
}

# Setup encryption password
setup_encryption() {
    print_step "Setting up encryption password..."

    echo ""
    echo "Agent Man uses AES-256 encryption to protect your data."
    echo "Please choose a strong password (minimum 12 characters)."
    echo ""

    while true; do
        read -s -p "Enter encryption password: " PASSWORD
        echo ""

        if [ ${#PASSWORD} -lt 12 ]; then
            print_warning "Password must be at least 12 characters"
            continue
        fi

        read -s -p "Confirm password: " PASSWORD_CONFIRM
        echo ""

        if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
            print_warning "Passwords don't match. Try again."
            continue
        fi

        break
    done

    # Save to environment variable hint file
    cat > "$INSTALL_DIR/env-setup.sh" <<EOF
#!/bin/bash
# Agent Man Environment Setup
# Source this file before running Agent Man:
#   source ~/.agent-man/env-setup.sh && agent-man

export CHAT_MAN_PASSWORD='YOUR_PASSWORD_HERE'
export NODE_ENV=production
EOF

    chmod 600 "$INSTALL_DIR/env-setup.sh"

    print_success "Encryption configured"
    print_warning "Important: Remember your password! It cannot be recovered."
}

# Check disk encryption
check_disk_encryption() {
    print_step "Checking disk encryption..."

    if [ "$OS_TYPE" = "macos" ]; then
        if fdesetup status 2>/dev/null | grep -q "On"; then
            print_success "FileVault is enabled"
        else
            print_warning "FileVault is NOT enabled"
            echo "  For maximum security, enable FileVault:"
            echo "  System Preferences → Security & Privacy → FileVault"
        fi
    elif [ "$OS_TYPE" = "linux" ] || [ "$OS_TYPE" = "wsl" ]; then
        if lsblk -o NAME,FSTYPE 2>/dev/null | grep -q crypto_LUKS; then
            print_success "LUKS encryption detected"
        else
            print_warning "Disk encryption not detected"
            echo "  For maximum security, consider enabling LUKS encryption"
        fi
    fi
}

# Print completion message
print_completion() {
    echo ""
    echo "=========================================="
    print_success "Installation Complete!"
    echo "=========================================="
    echo ""
    echo "To start Agent Man:"
    echo ""
    echo "  1. Set your encryption password:"
    echo "     export CHAT_MAN_PASSWORD='your-password-here'"
    echo "     export NODE_ENV=production"
    echo ""
    echo "  2. Run:"
    echo "     agent-man"
    echo ""
    echo "  3. Open your browser:"
    echo "     http://localhost:3010"
    echo ""
    echo "Or use the helper script:"
    echo "  Edit ~/.agent-man/env-setup.sh with your password"
    echo "  Then run: source ~/.agent-man/env-setup.sh && agent-man"
    echo ""
    print_message "$YELLOW" "Need models? Download via the UI or run:"
    echo "  ollama pull llama3.2"
    echo "  ollama pull qwen2.5-coder"
    echo ""
    echo "Documentation: https://github.com/$GITHUB_REPO"
    echo ""
}

# Main installation flow
main() {
    echo ""
    echo "=========================================="
    echo "   Agent Man Installer"
    echo "=========================================="
    echo ""

    detect_os
    ensure_ollama
    download_binary
    setup_path
    check_disk_encryption
    setup_encryption
    print_completion
}

# Run installation
main
