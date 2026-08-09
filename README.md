# Market Runner Leaderboard Dashboard

Standalone public leaderboard website for Market Runner.

Run locally from this repository:

```powershell
python -m http.server 8060
```

Open:

```text
http://127.0.0.1:8060/
```

The site calls the public `GET /functions/v1/leaderboard` Edge Function directly and does not use dashboard credentials or the Supabase service-role key.

The leaderboard shows the top 100 rows and refreshes automatically every 60 seconds. Filter controls are available from the collapsible Filters section. Leaderboard imagery lives in `assets`.

The code field sends an optional leaderboard invite code to the public leaderboard endpoint so the board can be viewed without a player ID. Private invite-code redemption and joining still belong in the signed game client flow; do not put the game signing secret in this public website.

## GitHub Pages

Publish from the `main` branch and repository root:

```text
Settings -> Pages -> Build and deployment -> Deploy from a branch -> main / root
```
