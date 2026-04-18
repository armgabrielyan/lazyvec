# Demo: lazyvec overview
# Short hero clip — connect, browse collections, inspect a record, exit.

Source demo/tapes/settings.tape
Require bun

Output demo/overview.gif

# Setup: start Chroma, seed data, sandbox config
Hide
Type "source demo/tapes/setup.sh"
Enter
Sleep 2s
Show

# Launch lazyvec against the seeded local Chroma
Type "bun run src/index.tsx"
Enter
Sleep 3s

# Connect to the default connection
Enter
Sleep 2s

# Browse collections
Type "j"
Sleep 600ms
Type "k"
Sleep 600ms

# Open the first collection
Enter
Sleep 2s

# Scroll through records
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms

# Fetch vector details for the focused record
Enter
Sleep 2s

# Quit
Type "q"
Sleep 1s
