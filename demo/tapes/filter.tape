# Demo: filter bar — key:value + numeric comparisons

Source demo/tapes/settings.tape
Require bun

Output demo/filter.gif

Hide
Type "source demo/tapes/setup.sh"
Enter
Sleep 2s
Show

Type "bun run src/index.tsx"
Enter
Sleep 3s

# Connect + open collection
Enter
Sleep 2s
Enter
Sleep 2s

# Apply an exact-match filter
Type "/"
Sleep 600ms
Type@80ms "genre:scifi"
Enter
Sleep 2s

# Close the filter bar (filter stays applied)
Escape
Sleep 1s

# Clear the filter
Escape
Sleep 1s

# Apply a numeric range filter
Type "/"
Sleep 600ms
Type@80ms "rating:>=8.5"
Enter
Sleep 2s

Escape
Sleep 500ms
Escape
Sleep 1s

Type "q"
Sleep 1s
