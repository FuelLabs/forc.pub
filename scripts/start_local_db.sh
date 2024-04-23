#!/bin/bash

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to run this script."
    exit 1
fi

# Check if the PostgreSQL container is already running
if docker ps --format '{{.Names}}' | grep -q '^postgres$'; then
    echo "PostgreSQL container is already running."
    exit 0
fi

# Source environment variables
source .env

# Start PostgreSQL container
docker run --name $POSTGRES_USER -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -e POSTGRES_DB=$POSTGRES_DB_NAME -d -p $POSTGRES_PORT:$POSTGRES_PORT postgres

echo "PostgreSQL container started successfully."