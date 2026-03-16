# Deployment — Self-Hosted MacBook + Cloudflare Tunnel

TráficoAQP runs on a MacBook in Arequipa, exposed to the internet via Cloudflare Tunnel.

## Why Self-Hosted

- `better-sqlite3` needs a local filesystem — serverless platforms (Vercel, Cloudflare Workers) can't support it
- `node-cron` needs a persistent process — serverless functions die between invocations
- Zero hosting costs, zero row/read limits, best latency for Arequipa users
- Cloudflare Tunnel provides free HTTPS, DDoS protection, and CDN caching

## Architecture

```
Internet → Cloudflare CDN → cloudflared tunnel → localhost:3000 (Next.js)
                                                       │
                                                  node-cron (5-min poll)
                                                       │
                                                  SQLite (data/traffic.db)
```

## Cost Summary

| Item | Cost |
|------|------|
| Cloudflare account | Free |
| Cloudflare Tunnel | Free |
| Domain name | ~$10/year |
| Google Maps Routes API | Free ($200/month credit) |
| Hosting | Free (your Mac) |
| **Total** | **~$10/year** |

---

## Step-by-Step Setup on a New Mac

### Step 1 — Install prerequisites

```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js LTS
brew install node

# Verify
node -v   # should be 20.x or 22.x
npm -v
```

### Step 2 — Get a Google Maps API key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "TráficoAQP")
3. Navigate to APIs & Services → Library
4. Search for **Routes API** and enable it (not "Directions API" — they're different)
5. Go to APIs & Services → Credentials → Create Credentials → API Key
6. Click "Restrict Key" → under API restrictions, select "Routes API" only
7. Copy the key

Google gives $200/month in free credit automatically. You need to add a billing account (credit card) but you won't be charged unless you exceed $200/month. Our usage is ~$17/month worth of calls.

### Step 3 — Create a Cloudflare account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up (free)
2. The free plan includes everything we need: Tunnel, CDN, HTTPS, analytics

### Step 4 — Get a domain name

**Option A — Buy through Cloudflare (simplest):**
1. In the Cloudflare dashboard → Domain Registration → Register Domains
2. Search for a domain (e.g. `traficoaqp.com`, `traficoaqp.org`)
3. Prices are at-cost (~$10/year for `.com`), no markup
4. DNS is pre-configured — no extra steps

**Option B — Buy elsewhere (Namecheap, Google Domains, etc.):**
1. Purchase the domain from any registrar
2. In the Cloudflare dashboard → Add a Site → enter your domain
3. Cloudflare will give you two nameservers (e.g. `ada.ns.cloudflare.com`)
4. Go to your registrar and change the nameservers to the ones Cloudflare provided
5. Wait 1-24 hours for DNS propagation

### Step 5 — Clone and build the project

```bash
git clone <your-repo-url>
cd uchumayo/trafico-aqp

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and paste your Google Maps API key
nano .env

# Run tests
npm test

# Build and test locally
npm run build
npm run start
# Visit http://localhost:3000 — confirm it works
# Press Ctrl+C to stop
```

### Step 6 — Set up Cloudflare Tunnel

```bash
# Install cloudflared
brew install cloudflared

# Authenticate (opens your browser to log in to Cloudflare)
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create traficoaqp
# This prints a Tunnel ID (e.g. a1b2c3d4-...) — save it
# It also creates a credentials file at ~/.cloudflared/<TUNNEL_ID>.json
```

Create the tunnel config file:

```bash
nano ~/.cloudflared/config.yml
```

Paste this (replace `<TUNNEL_ID>` and `<your-username>` and `<yourdomain.com>`):

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /Users/<your-username>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: <yourdomain.com>
    service: http://localhost:3000
  - service: http_status:404
```

Add the DNS record (this creates the CNAME automatically in Cloudflare):

```bash
cloudflared tunnel route dns traficoaqp <yourdomain.com>
```

Test the tunnel manually:

```bash
# In one terminal, start the Next.js server
cd /path/to/uchumayo/trafico-aqp
npm run start

# In another terminal, start the tunnel
cloudflared tunnel run traficoaqp

# Visit https://<yourdomain.com> in your browser — it should work
```

Install the tunnel as a system service (starts automatically on boot):

```bash
sudo cloudflared service install
```

### Step 7 — Prevent Mac from sleeping

```bash
sudo pmset -a sleep 0
sudo pmset -a disablesleep 1
```

Also in System Settings → Energy:
- "Start up automatically after a power failure" → ✓
- "Prevent automatic sleeping when the display is off" → ✓

### Step 8 — Auto-start the Next.js server (launchd)

Create the service file:

```bash
sudo nano /Library/LaunchDaemons/com.traficoaqp.server.plist
```

Paste this (update `/path/to/trafico-aqp` and the node path):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.traficoaqp.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>node_modules/.bin/next</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/path/to/trafico-aqp</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/var/log/traficoaqp.log</string>
  <key>StandardErrorPath</key>
  <string>/var/log/traficoaqp.error.log</string>
</dict>
</plist>
```

Find your actual node path with `which node` and update the plist if different from `/usr/local/bin/node`.

Load and start the service:

```bash
sudo launchctl load -w /Library/LaunchDaemons/com.traficoaqp.server.plist
```

### Step 9 — Verify everything works

| Check | Command / Action |
|-------|-----------------|
| Server running locally | `curl http://localhost:3000` |
| Tunnel connected | `cloudflared tunnel info traficoaqp` |
| Public access | Visit `https://<yourdomain.com>` in a browser |
| HTTPS working | Green lock icon in browser address bar (automatic) |
| Server auto-starts | `sudo launchctl list \| grep traficoaqp` → should show PID |
| Logs | `tail -f /var/log/traficoaqp.log` |

---

## Cloudflare Dashboard & Analytics

After your domain is set up, the Cloudflare dashboard at [dash.cloudflare.com](https://dash.cloudflare.com) gives you:

- **Analytics → Traffic**: Unique visitors, total requests, bandwidth, page views
- **Analytics → Security**: Threats blocked, bot traffic, DDoS attempts
- **Analytics → Performance**: Load times, cache hit ratio
- **Geography breakdown**: See which countries/cities your visitors come from
- **Real-time**: Live view of requests hitting your site

All of this is automatic and free — no extra setup needed. Just click your domain in the dashboard and go to the Analytics tab.

---

## Managing the Service

```bash
# Check if server is running
sudo launchctl list | grep traficoaqp

# Stop the server
sudo launchctl unload /Library/LaunchDaemons/com.traficoaqp.server.plist

# Restart (stop + start)
sudo launchctl unload /Library/LaunchDaemons/com.traficoaqp.server.plist
sudo launchctl load -w /Library/LaunchDaemons/com.traficoaqp.server.plist

# View live logs
tail -f /var/log/traficoaqp.log
tail -f /var/log/traficoaqp.error.log

# Rebuild after code changes
cd /path/to/trafico-aqp
npm test           # Run tests first
npm run build      # Then build
# Then restart the service (unload + load above)
```

---

## Monitoring & Reliability

### UptimeRobot (free)

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account
2. Add a new monitor: HTTP(s) → `https://<yourdomain.com>`
3. Set check interval to 5 minutes
4. Add your email for alerts

You'll get notified within minutes if the site goes down.

### SQLite backup

Add a daily cron job to back up the database:

```bash
# Edit crontab
crontab -e

# Add this line (backs up at 4:00 AM daily)
0 4 * * * cp /path/to/trafico-aqp/data/traffic.db /path/to/backup/traffic-$(date +\%Y\%m\%d).db
```

Or sync the backup folder to iCloud Drive / Google Drive for offsite copies.

### UPS battery backup

A ~$50-80 UPS keeps the MacBook running through short power outages (common in Arequipa), preventing data gaps in the traffic snapshots.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Site unreachable | `sudo launchctl list \| grep traficoaqp` — is the server running? |
| Site unreachable | `cloudflared tunnel info traficoaqp` — is the tunnel connected? |
| Tunnel won't start | `sudo cloudflared service install` — was it installed as a service? |
| Stale traffic data | `tail -f /var/log/traficoaqp.error.log` — API key issues? rate limits? |
| "GOOGLE_MAPS_API_KEY not set" | Check `.env` exists in the project root with the key |
| SQLite locked | Only one process should access `data/traffic.db` — check for duplicate servers with `lsof -i :3000` |
| High CPU at 3 AM | Normal — `better-sqlite3` recomputation query runs at 03:00 PET, brief spike |
| Node not found in launchd | Run `which node` and update the plist `ProgramArguments` path |
| Domain not resolving | Check Cloudflare dashboard → DNS tab — CNAME record should point to `<TUNNEL_ID>.cfargotunnel.com` |
