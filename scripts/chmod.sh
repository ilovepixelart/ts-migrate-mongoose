#!/usr/bin/env bash

# To make sure the cli is executable
executable="dist/cjs/bin.js"

if [[ -f "$executable" ]]
then
  chmod +x "$executable"
fi
