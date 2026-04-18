# Demo: connection picker + provider-aware Add Connection form

Source demo/tapes/settings.tape
Require bun

Output demo/connections.gif

Hide
Type "source demo/tapes/setup.sh"
Enter
Sleep 2s
Show

Type "bun run src/index.tsx"
Enter
Sleep 3s

# Open Add Connection
Type "a"
Sleep 1.5s

# Name
Type@80ms "chroma-cloud"
Sleep 600ms
Tab
Sleep 600ms

# Switch provider: qdrant -> pinecone -> chroma
Right
Sleep 600ms
Right
Sleep 800ms

# chroma form now shows URL / API Key / Tenant / Database fields
Tab
Tab
Sleep 800ms

# Type an API Key
Type@80ms "ck-demo-key"
Sleep 600ms
Tab

# Tenant
Type@80ms "demo-tenant"
Sleep 600ms
Tab

# Database
Type@80ms "prod"
Sleep 800ms

# Cancel (don't actually save over the user's config)
Escape
Sleep 1.5s

# Back on the picker
Type "q"
Sleep 1s
