#!/bin/bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_RED='\033[0;31m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_RESET='\033[0m'

readonly TOLMACH_DIR="$HOME/.tolmach"
readonly MODELS_DIR="$TOLMACH_DIR/models"
readonly MODEL_NAME="ggml-large-v3-turbo.bin"
readonly MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODEL_NAME"

STEP_NUMBER=0

next_step() {
    STEP_NUMBER=$((STEP_NUMBER + 1))
    echo -e "${COLOR_YELLOW}Step $STEP_NUMBER: $1...${COLOR_RESET}"
}

print_success() {
    echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} $1"
}

print_error() {
    echo -e "  ${COLOR_RED}✗${COLOR_RESET} $1"
}

print_warning() {
    echo -e "  ${COLOR_YELLOW}⚠${COLOR_RESET} $1"
}

print_header() {
    echo -e "${COLOR_GREEN}=== Tolmach Setup ===${COLOR_RESET}"
    echo ""
}

add_to_shell_path() {
    local dir="$1"
    local line="export PATH=\"$dir:\$PATH\""
    local shell_rc="$HOME/.zshrc"
    [[ "$SHELL" == */bash ]] && shell_rc="$HOME/.bashrc"

    if [[ -f "$shell_rc" ]] && ! grep -qF "$dir" "$shell_rc"; then
        echo "" >> "$shell_rc"
        echo "$line" >> "$shell_rc"
        print_warning "Added $dir to $shell_rc (restart terminal or run: source $shell_rc)"
    fi
}

show_usage() {
    echo "Usage: ./tools/setup.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install    - Full setup (default)"
    echo "  deps       - Install system dependencies only"
    echo "  model      - Download whisper model only"
    echo "  check      - Check all dependencies"
    echo "  help       - Show this help message"
}

check_macos() {
    next_step "Checking system"
    [[ "$(uname)" == "Darwin" ]] || {
        print_error "This script supports macOS only"
        exit 1
    }
    print_success "macOS $(sw_vers -productVersion)"
}

ensure_homebrew() {
    next_step "Checking Homebrew"
    command -v brew &>/dev/null && {
        print_success "Homebrew $(brew --version | head -1 | awk '{print $2}')"
        return 0
    }
    echo "  Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    print_success "Homebrew installed"
}

install_deno() {
    next_step "Checking deno"
    export PATH="$HOME/.deno/bin:$PATH"
    command -v deno &>/dev/null && {
        print_success "deno $(deno --version 2>/dev/null | head -1 | awk '{print $2}')"
        return 0
    }
    curl -fsSL https://deno.land/install.sh | sh
    add_to_shell_path "$HOME/.deno/bin"
    print_success "deno installed"
}

install_ytdlp() {
    next_step "Checking yt-dlp"
    command -v yt-dlp &>/dev/null && {
        print_success "yt-dlp $(yt-dlp --version 2>/dev/null)"
        return 0
    }

    if command -v pipx &>/dev/null; then
        pipx install yt-dlp
    elif brew install yt-dlp 2>/dev/null; then
        true
    else
        local bin_dir="$HOME/.local/bin"
        mkdir -p "$bin_dir"
        curl -L -o "$bin_dir/yt-dlp" \
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
        chmod +x "$bin_dir/yt-dlp"
        export PATH="$bin_dir:$PATH"
    fi

    command -v yt-dlp &>/dev/null && {
        print_success "yt-dlp installed"
        return 0
    }
    print_error "Failed to install yt-dlp"
    print_warning "Install manually: pipx install yt-dlp"
}

install_ffmpeg() {
    next_step "Checking ffmpeg"
    command -v ffmpeg &>/dev/null && {
        local ver
        ver=$(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')
        print_success "ffmpeg $ver"
        return 0
    }
    brew install ffmpeg
    print_success "ffmpeg installed"
}

install_whisper_cli() {
    next_step "Checking whisper-cli"
    command -v whisper-cli &>/dev/null && {
        print_success "whisper-cli installed"
        return 0
    }
    brew install whisper-cpp
    print_success "whisper-cli installed (via whisper-cpp)"
}

find_existing_model() {
    local search_paths=(
        "$MODELS_DIR/$MODEL_NAME"
        "$(brew --prefix 2>/dev/null)/share/whisper-cpp/models/$MODEL_NAME"
    )

    [[ -n "${WHISPER_MODEL_DIR:-}" ]] && \
        search_paths+=("$WHISPER_MODEL_DIR/$MODEL_NAME")

    for path in "${search_paths[@]}"; do
        [[ -f "$path" ]] && {
            echo "$path"
            return 0
        }
    done
    return 1
}

download_whisper_model() {
    next_step "Checking whisper model ($MODEL_NAME)"

    local existing
    existing=$(find_existing_model) && {
        local size
        size=$(du -h "$existing" | cut -f1 | xargs)
        print_success "Model found: $existing ($size)"
        return 0
    }

    mkdir -p "$MODELS_DIR"
    echo "  Downloading from HuggingFace (~1.62 GB)..."
    echo ""

    curl -L --progress-bar -o "$MODELS_DIR/$MODEL_NAME" "$MODEL_URL" && {
        local size
        size=$(du -h "$MODELS_DIR/$MODEL_NAME" | cut -f1 | xargs)
        print_success "Model downloaded: $MODELS_DIR/$MODEL_NAME ($size)"
        return 0
    }

    print_error "Failed to download model"
    print_warning "Download manually:"
    echo "  curl -L -o $MODELS_DIR/$MODEL_NAME $MODEL_URL"
}

ensure_node() {
    next_step "Checking Node.js"
    command -v node &>/dev/null || {
        print_error "Node.js not installed"
        print_warning "Install: brew install node@22"
        exit 1
    }

    local version
    version=$(node -v | sed 's/v//')
    local major
    major=$(echo "$version" | cut -d. -f1)

    [[ "$major" -ge 20 ]] || {
        print_error "Node.js v$version (requires >= 20)"
        print_warning "Update: brew install node@22"
        exit 1
    }
    print_success "Node.js v$version"
}

ensure_pnpm() {
    next_step "Checking pnpm"
    command -v pnpm &>/dev/null && {
        print_success "pnpm $(pnpm -v)"
        return 0
    }
    npm install -g pnpm
    print_success "pnpm installed"
}

install_project_dependencies() {
    next_step "Installing project dependencies"
    cd "$PROJECT_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    print_success "Dependencies installed"
}

build_and_link() {
    next_step "Building and linking CLI"
    cd "$PROJECT_DIR"
    pnpm build
    pnpm link --global
    print_success "tolmach command available globally"
}

create_env_file() {
    next_step "Creating .env"
    [[ -f "$PROJECT_DIR/.env" ]] && {
        print_success ".env already exists"
        return 0
    }
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    print_success ".env created from .env.example"
}

create_tolmach_directories() {
    next_step "Creating directories"
    mkdir -p "$TOLMACH_DIR"/{reports,cache,tmp,models}
    print_success "$TOLMACH_DIR/{reports,cache,tmp,models}"
}

verify_installation() {
    next_step "Verifying installation"
    local errors=0

    for cmd in deno yt-dlp ffmpeg whisper-cli node pnpm tolmach; do
        command -v "$cmd" &>/dev/null && {
            print_success "$cmd"
        } || {
            print_error "$cmd"
            errors=$((errors + 1))
        }
    done

    local model_path
    model_path=$(find_existing_model) && {
        print_success "whisper model: $model_path"
    } || {
        print_error "whisper model not found"
        errors=$((errors + 1))
    }

    return "$errors"
}

print_next_steps() {
    echo ""
    echo -e "${COLOR_GREEN}=== Setup completed! ===${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_YELLOW}Run:${COLOR_RESET}"
    echo "  tolmach https://www.youtube.com/watch?v=VIDEO_ID"
    echo ""
    echo -e "${COLOR_YELLOW}Or with --no-llm:${COLOR_RESET}"
    echo "  tolmach --no-llm https://www.youtube.com/watch?v=VIDEO_ID"
}

print_failure() {
    local errors="$1"
    echo ""
    print_error "Setup incomplete ($errors issues). Fix the errors above and run again."
}

execute_full_install() {
    check_macos
    ensure_homebrew
    install_deno
    install_ytdlp
    install_ffmpeg
    install_whisper_cli
    download_whisper_model
    ensure_node
    ensure_pnpm
    install_project_dependencies
    build_and_link
    create_env_file
    create_tolmach_directories
    verify_installation && print_next_steps || print_failure $?
}

execute_deps_only() {
    check_macos
    ensure_homebrew
    install_deno
    install_ytdlp
    install_ffmpeg
    install_whisper_cli
    verify_installation || true
}

execute_model_only() {
    download_whisper_model
}

execute_check() {
    STEP_NUMBER=0
    verify_installation && {
        echo ""
        print_success "All dependencies available"
    } || {
        echo ""
        print_error "Some dependencies missing. Run: pnpm setup"
    }
}

execute_command() {
    local command="${1:-install}"

    case "$command" in
        install)
            execute_full_install
            ;;
        deps)
            execute_deps_only
            ;;
        model)
            execute_model_only
            ;;
        check)
            execute_check
            ;;
        help|-h|--help)
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

main() {
    print_header
    execute_command "$@"
}

main "$@"
