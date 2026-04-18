# Demo: vector similarity search ("find similar")

Source demo/tapes/settings.tape
Require bun

Output demo/similar.gif

Hide
Type "source demo/tapes/setup.sh"
Enter
Sleep 2s
Show

Type "bun run src/index.tsx"
Enter
Sleep 3s

Enter
Sleep 2s
Enter
Sleep 2s

# Pick a record
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 600ms

# Find similar records by vector
Type "s"
Sleep 3s

# Back to the normal record list
Escape
Sleep 1.5s

Type "q"
Sleep 1s
