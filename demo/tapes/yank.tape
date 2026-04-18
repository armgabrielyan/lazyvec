# Demo: yank mode — copy ID / metadata / vector to clipboard

Source demo/tapes/settings.tape
Require bun

Output demo/yank.gif

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

Type "j"
Sleep 500ms

# Fetch the vector first (needed for `y v`)
Enter
Sleep 2s

# y i — copy record ID
Type "y"
Sleep 600ms
Type "i"
Sleep 1.5s

# y m — copy metadata JSON
Type "y"
Sleep 600ms
Type "m"
Sleep 1.5s

# y v — copy vector JSON
Type "y"
Sleep 600ms
Type "v"
Sleep 1.5s

Type "q"
Sleep 1s
