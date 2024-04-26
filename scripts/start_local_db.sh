#!/bin/bash

# Source environment variables
source .env
NETWORK_NAME="forc_pub_net"
CONTAINER_NAME="forc_pub_db"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to run this script."
    exit 1
fi

# Check if the PostgreSQL container is already running
if docker ps --format '{{.Names}}' | grep -q ^$CONTAINER_NAME$; then
    echo "PostgreSQL container is already running."
    exit 0
fi

# Create docker network if it does not exist
if [ -z $(docker network ls --filter name=^${NETWORK_NAME}$ --format="{{ .Name }}") ] ; then
    echo "Creating docker network ${NETWORK_NAME}."
    docker network create $NETWORK_NAME
fi

# Start PostgreSQL container
docker run \
  --rm -d \
  --name $CONTAINER_NAME \
  --network $NETWORK_NAME \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$POSTGRES_DB_NAME \
  -p $POSTGRES_PORT:$POSTGRES_PORT \
  postgres

echo "PostgreSQL container started successfully."