#!/usr/bin/env bash

# To make sure the cli is executable
executable="dist/cli.js"

if [[ -f "$executable" ]]
then
  chmod +x "$executable"
  if [[ -x "$executable" ]]
  then
    echo "$executable is now executable"
  else
    echo "Failed to make $executable executable"
  fi
else
  echo "$executable does not exist"
fi