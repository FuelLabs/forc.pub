#!/bin/bash

# Script best practices
set -euo pipefail  # Exit on error, undefined vars, pipe failures
IFS=$'\n\t'        # Secure Internal Field Separator

# Color codes for logging
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly GRAY='\033[0;90m'
readonly LIGHT_GRAY='\033[0;37m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    printf "${BLUE}[INFO]${NC} %s\n" "$1" >&2
}

log_success() {
    printf "${GREEN}[SUCCESS]${NC} %s\n" "$1" >&2
}

log_warning() {
    printf "${YELLOW}[WARNING]${NC} %s\n" "$1" >&2
}

log_error() {
    printf "${RED}[ERROR]${NC} %s\n" "$1" >&2
}

log_debug() {
    if [[ "${DEBUG:-}" == "true" ]]; then
        printf "${GRAY}[DEBUG]${NC} ${LIGHT_GRAY}%s${NC}\n" "$1" >&2
    fi
}

# Error handler
error_handler() {
    local line_number=$1
    log_error "Script failed at line ${line_number}"
    exit 1
}

# Set up error handling
trap 'error_handler ${LINENO}' ERR

# Initialize variables
FORCE_REBUILD=false
DEBUG=false

# Parse arguments first
while getopts "fhd" opt; do
    case ${opt} in
        f) FORCE_REBUILD=true ;;
        h) echo "Usage: $0 [-f] [-h] [-d]"; echo "  -f: Force rebuild"; echo "  -h: Help"; echo "  -d: Debug"; exit 0 ;;
        d) DEBUG=true ;;
        *) log_error "Invalid option: -$OPTARG"; exit 1 ;;
    esac
done

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi

if ! docker compose version &> /dev/null 2>&1; then
    log_error "Docker Compose is not available. Please ensure you have Docker with Compose plugin installed."
    exit 1
fi

COMPOSE_CMD=("docker" "compose")
log_debug "Using Docker Compose"

# Load environment variables
if [[ -f .env.local ]]; then
    log_info "Loading environment from .env.local"
    source .env.local
else
    log_warning ".env.local not found. Create one with required variables"
fi



# Build if needed
if [[ "$FORCE_REBUILD" == "true" ]]; then
    log_info "Force rebuilding application image..."
    "${COMPOSE_CMD[@]}" build --no-cache app
    log_success "Application image rebuilt"
fi

# Start services
log_info "Starting services with Docker Compose..."
"${COMPOSE_CMD[@]}" up -d

log_success "Services started!"
log_info "Database: PostgreSQL on port ${POSTGRES_PORT:-5432}"
log_info "Application: forc.pub on port 8080"
log_info "pgAdmin: Database admin UI on port ${PGADMIN_PORT:-5050}"
printf "\n${CYAN}Access URLs:${NC}\n"
printf "  backend:   http://localhost:8080\n"
printf "  pgAdmin:       http://localhost:${PGADMIN_PORT:-5050}\n"
printf "\n${CYAN}Commands:${NC}\n"
printf "  View logs:     docker compose logs -f\n"
printf "  Stop services: docker compose down\n"
