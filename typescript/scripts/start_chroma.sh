#!/bin/bash

# This script will check if ~/.npc exists, if not it will create it.
# It then checks if ~/.npc/chroma directory exists, if not it clones the chroma repository into that directory.
# If the Docker Compose services are not running, it runs docker-compose up

# Check if ~/.npc exists and create it if it does not
if [ ! -d ~/.npc ]; then
    echo "Directory ~/.npc does not exist. Creating now..."
    mkdir ~/.npc
fi

# Check if ~/.npc/chroma exists. If it does, do nothing. If not, clone the repository
if [ ! -d ~/.npc/chroma ]; then
    echo "Directory ~/.npc/chroma does not exist. Cloning the chroma repository now..."
    cd ~/.npc
    git clone https://github.com/chroma-core/chroma.git
fi

cd ~/.npc/chroma
echo "Chroma Docker Compose Starting now..."
docker-compose up -d --build
