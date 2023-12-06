#!/bin/bash

# Define the directory to start the search
root_directory="dist/esm"

echo "Adding .js extension to relative imports in files:"
# Find all JavaScript files and iterate through them and add the .js extension to relative imports
find "$root_directory" -type f -name "*.js" | while read -r file; do
    if awk '!/export {};|\/\/# sourceMappingURL:|^[[:space:]]*\/\//' "$file" | grep -q "import .* from '[.]\{0,2\}\/[^']*'"; then
        sed -i.bak -E "s/(import .* from '[.]{0,2}\/[^']*)'/\1.js'/g" "$file" && echo "- $file"
    fi
done

# Remove all backup files
find "$root_directory" -type f -name "*.bak" -exec rm {} +

echo -e "\nCreating package.json file in $root_directory"
# Create a package.json file to indicate that this is an ESM package
echo '{ "type": "module" }' > "$root_directory/package.json"