#!/bin/bash

# Usage: ./npm_install.sh <npm>
cd .meteor/local/build/programs/server/node_modules && npm install $1
echo "Cool!"