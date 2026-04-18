# Demo: delete records — single + visual range

Source demo/tapes/settings.tape
Require bun

Output demo/delete.gif

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

# Single delete with confirmation
Type "j"
Sleep 500ms
Type "d"
Sleep 1.5s

# Cancel the confirm (don't actually delete during demo)
Escape
Sleep 1s

# Visual selection mode
Type "V"
Sleep 800ms
Type "j"
Sleep 500ms
Type "j"
Sleep 500ms
Type "j"
Sleep 800ms

# Cancel selection
Escape
Sleep 1s

Type "q"
Sleep 1s
