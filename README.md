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

The site calls the public leaderboard Edge Functions directly and does not use dashboard credentials or the Supabase service-role key:

- `leaderboard` for Highscore and Prestige
- `hardcore-leaderboard` for Hardcore
- `survival-leaderboard` for Survival
- `pvp-leaderboard` for PVP

The dashboard shows the top 100 rows and refreshes automatically every 60 seconds. It supports the same period, device, and version filters as the game, plus private invite-code viewing for Highscore and Prestige boards. The current game version is `1.3.0`; update the `CURRENT_APP_VERSION` constant in `app.js` when the game runtime `VERSION` changes.

Hardcore, Survival, and PVP use their dedicated public endpoints. PVP also displays the returned computer-opponent totals. Clicking a leaderboard row opens a public profile snapshot using only data already returned by the public endpoint. Leaderboard imagery lives in `assets`.

The code field sends an optional leaderboard invite code to the public leaderboard endpoint so the board can be viewed without a player ID. Private invite-code redemption and joining still belong in the signed game client flow; do not put the game signing secret in this public website.

## GitHub Pages

Publish from the `main` branch and repository root:

```text
Settings -> Pages -> Build and deployment -> Deploy from a branch -> main / root
```
