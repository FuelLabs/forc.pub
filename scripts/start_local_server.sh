#!/bin/bash

# Source environment variables
source .env

CONTAINER_NAME="forc_pub_dev"
NETWORK_NAME="forc_pub_net"
DB_CONTAINER_NAME="forc_pub_db"
FORCE_REBUILD=false

# Check for command line arguments
while getopts "f" opt; do
    case ${opt} in
        f) 
            FORCE_REBUILD=true
            ;;
        \?)
            echo "Usage: $0 [-f]"
            exit 1
            ;;
    esac
done

# Check if Docker image exists
if $FORCE_REBUILD || [[ "$(docker images -q $DOCKER_IMAGE 2> /dev/null)" == "" ]]; then
    echo "Building Docker image $DOCKER_IMAGE..."
    
    # Build Docker image
    docker build -t $CONTAINER_NAME -f deployment/Dockerfile .
    
    # Check if build was successful
    if [ $? -eq 0 ]; then
        echo "Docker image $DOCKER_IMAGE built successfully."
    else
        echo "Failed to build Docker image $DOCKER_IMAGE."
        exit 1
    fi
else
    echo "Docker image $DOCKER_IMAGE already exists. Use -f flag to force rebuild."
fi

# Remove the container if it exists
if [[ "$(docker ps -aqf name=$CONTAINER_NAME)" ]]; then
    # Stop the container if it's running
    if [[ "$(docker ps -q -f name=$CONTAINER_NAME)" ]]; then
        echo "Stopping container $CONTAINER_NAME..."
        docker stop $CONTAINER_NAME
        if [ $? -eq 0 ]; then
            echo "Container $CONTAINER_NAME stopped successfully."
        else
            echo "Failed to stop container $CONTAINER_NAME."
            exit 1
        fi
    fi
fi

# Start the services using docker-compose
docker-compose up -d

# Start the Docker container on the same network as the PostgreSQL container
docker run \
  --rm -d \
  --name $CONTAINER_NAME \
  --network $NETWORK_NAME \
  -p 8080:8080 \
  -e POSTGRES_USER=$POSTGRES_USER \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_URI=$DB_CONTAINER_NAME \
  -e POSTGRES_DB_NAME=$POSTGRES_DB_NAME \
  $CONTAINER_NAME

echo "Server container started successfully."
