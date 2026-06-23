# Tarsen architecture

Tarsen keeps package code local by default. The CLI fetches registry metadata and a tarball, extracts it into a temporary directory without running lifecycle scripts, performs static analysis through `@tarsen/core`, removes the temporary directory, and prints either a human report or clean JSON.

Cloud synchronization sends summarized signals—not package source—to Convex. Organization policy can turn the local recommendation into an allow, warn, or block decision.
