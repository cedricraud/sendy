#!/bin/bash

# Usage: ./npm_install.sh <npm>
cd .meteor/local/build/programs/server/node_modules && npm install $@
echo "Cool!"
