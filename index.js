export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PROXIES = ["rotunnel.com", "roproxy.com", "rbxproxy.com"];

    if (url.pathname.startsWith("/api/")) {
      const apiHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      const tryFetch = async (s, e) => {
        for (let p of PROXIES) {
          try {
            const r = await fetch(`https://${s}.${p}${e}`, { headers: { "User-Agent": "RoStats_Elite" }});
            if (r.ok) return await r.json();
          } catch (err) { continue; }
        }
        throw new Error("Proxy Error");
      };

      try {
        if (url.pathname === "/api/validate-id") {
          const id = url.searchParams.get("id");
          const d = await tryFetch('apis', `/universes/v1/places/${id}/universe`);
          return new Response(JSON.stringify({ universeId: d.universeId }), { headers: apiHeaders });
        }
        if (url.pathname === "/api/get-stats") {
          const u = url.searchParams.get("uid");
          const [g, v, f] = await Promise.all([
            tryFetch('games', `/v1/games?universeIds=${u}`),
            tryFetch('games', `/v1/games/votes?universeIds=${u}`),
            tryFetch('games', `/v1/games/${u}/favorites/count`)
          ]);
          return new Response(JSON.stringify({ game: g.data[0], votes: v.data[0], favorites: f.favoritesCount }), { headers: apiHeaders });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: apiHeaders });
      }
    }
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>RoStats Elite</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        :root { --bg: #050505; --card: #0c0c0c; --border: #1a1a1a; --accent: #4ade80; --text: #fff; --dim: #71717a; --warn: #ff4444; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        .container { width: 100%; max-width: 650px; padding-bottom: 80px; }
        
        /* UI Components */
        .search-area { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 24px; text-align: center; margin-bottom: 15px; position: relative; }
        .input-box { display: flex; gap: 10px; background: #000; padding: 6px; border-radius: 14px; border: 1px solid var(--border); }
        input { flex: 1; background: transparent; border: none; color: white; padding: 10px 15px; font-size: 1rem; outline: none; }
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 25px; border-radius: 10px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.75rem; }
        
        .dashboard { display: none; flex-direction: column; gap: 12px; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .box { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 18px; position: relative; overflow: hidden; }
        .label { font-size: 0.6rem; color: var(--dim); text-transform: uppercase; font-weight: 800; margin-bottom: 6px; letter-spacing: 0.8px; display: flex; justify-content: space-between; }
        .val { font-size: 1.3rem; font-weight: 800; display: flex; align-items: center; gap: 6px; }
        .trend { font-size: 0.75rem; font-weight: 600; }
        
        /* Skeleton Pulse */
        .loading .val { height: 24px; width: 60%; background: #1a1a1a; border-radius: 6px; animation: pulse 1.5s infinite; color: transparent; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        .content-card { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 20px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
        .meta-item { font-size: 0.75rem; color: var(--dim); }
        .meta-item b { color: #fff; display: block; font-size: 0.85rem; margin-top: 2px; }

        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .btn { text-decoration: none; text-align: center; padding: 16px; border-radius: 14px; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; cursor: pointer; border: none; transition: 0.2s; }
        .play-btn { background: #fff; color: #000; }
        .copy-btn { background: #111; color: #fff; border: 1px solid var(--border); }
        
        .refresh-toggle { position: absolute; top: 15px; right: 20px; font-size: 0.6rem; color: var(--dim); font-weight: 800; display: flex; align-items: center; gap: 5px; }
        .dot { width: 6px; height: 6px; background: var(--accent); border-radius: 50%; animation: blink 1s infinite; }
        @keyframes blink { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }

        .footer { position: fixed; bottom: 20px; right: 25px; z-index: 9999; }
        .footer-link { color: var(--dim); text-decoration: none; font-size: 0.65rem; font-weight: 800; letter-spacing: 1.5px; opacity: 0.4; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-area">
            <div id="liveIndicator" class="refresh-toggle" style="display:none"><div class="dot"></div> LIVE TRACKING</div>
            <h1 style="font-size: 2rem; margin-bottom:20px; letter-spacing: -1px;">Ro<span style="color:var(--accent)">Stats</span></h1>
            <div class="input-box">
                <input type="text" id="placeId" placeholder="Paste Place ID...">
                <button class="scan-btn" onclick="run()">Scan</button>
            </div>
            <div id="status" style="margin-top:12px; font-size:0.6rem; color:var(--dim); font-weight: 800;">SYSTEM IDLE</div>
        </div>

        <div id="results" class="dashboard">
            <div class="box" style="text-align:center">
                <h2 id="gTitle" style="font-size: 1.6rem; letter-spacing: -0.5px;">-</h2>
                <div id="gGenre" style="font-size:0.6rem; color:var(--dim); text-transform:uppercase; margin-top:5px; font-weight:800">GENRE: -</div>
                <a id="gOwner" style="color:var(--accent); text-decoration:none; font-size:0.9rem; font-weight:600; margin-top:10px; display:inline-block;" target="_blank">-</a>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="box"><div class="label">Active</div><div class="val" id="vPlay">-</div><div id="tPlay" class="trend"></div></div>
                <div class="box"><div class="label">Rating</div><div class="val" id="vRate">-</div></div>
                <div class="box"><div class="label">Dislikes</div><div class="val" id="vDis" style="color:var(--warn)">-</div></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="box"><div class="label">Visits</div><div class="val" id="vVisit">-</div></div>
                <div class="box"><div class="label">Likes</div><div class="val" id="vLike">-</div></div>
                <div class="box"><div class="label">Favorites</div><div class="val" id="vFav">-</div></div>
            </div>

            <div class="content-card">
                <div class="meta-grid">
                    <div class="meta-item">Created<b><span id="dCreate">-</span></b></div>
                    <div class="meta-item">Last Update<b><span id="dUpdate">-</span></b></div>
                    <div class="meta-item">Max Players<b><span id="vMax">-</span></b></div>
                    <div class="meta-item">Avg Growth<b><span id="vGrowth">-</span></b></div>
                </div>
                <div class="label" style="margin-bottom:10px;">Description</div>
                <div id="gDesc" class="full-desc"></div>
            </div>

            <div class="action-grid">
                <button class="btn copy-btn" onclick="copyStats()">Copy Summary</button>
                <a id="robloxLink" class="btn play-btn" target="_blank">Open Experience</a>
            </div>
        </div>
    </div>

    <div class="footer"><a href="https://www.roblox.com/users/9461867215/profile" class="footer-link" target="_blank">BY ROQARD</a></div>

    <script>
        let itv;
        let lastCount = 0;
        const fmt = x => x >= 1e6 ? (x/1e6).toFixed(1)+'M' : x >= 1e3 ? (x/1e3).toFixed(1)+'K' : x.toLocaleString();

        async function run() { 
            const i = document.getElementById('placeId').value;
            if(!i) return;
            document.getElementById('results').classList.add('loading');
            document.getElementById('results').style.display = 'flex';
            if(itv) clearInterval(itv);
            await update();
            itv = setInterval(update, 30000);
        }

        async function update() {
            const i = document.getElementById('placeId').value.replace(/\\D/g, '');
            if(!i) return;

            try {
                const v = await fetch("/api/validate-id?id=" + i).then(r => r.json());
                const d = await fetch("/api/get-stats?uid=" + v.universeId).then(r => r.json());
                const g = d.game;
                const up = d.votes.upVotes || 0;
                const down = d.votes.downVotes || 0;
                const rate = (up+down) > 0 ? Math.round((up/(up+down))*100) : 0;

                // Growth calculation (Visits per day since creation)
                const ageDays = Math.max(1, (new Date() - new Date(g.created)) / (1000 * 60 * 60 * 24));
                const growth = Math.round(g.visits / ageDays);

                // Update UI
                document.getElementById('gTitle').innerText = g.name;
                document.getElementById('gGenre').innerText = "Genre: " + (g.genre || "All");
                document.getElementById('gOwner').innerText = "By " + g.creator.name;
                document.getElementById('gOwner').href = (g.creator.type === "Group" ? "https://www.roblox.com/groups/" : "https://www.roblox.com/users/") + g.creator.id;
                
                // Trend Logic
                const playVal = document.getElementById('vPlay');
                const trendEl = document.getElementById('tPlay');
                if(lastCount > 0) {
                    if(g.playing > lastCount) { trendEl.innerText = "↑ +" + (g.playing - lastCount); trendEl.style.color = "var(--accent)"; }
                    else if(g.playing < lastCount) { trendEl.innerText = "↓ -" + (lastCount - g.playing); trendEl.style.color = "var(--warn)"; }
                }
                lastCount = g.playing;

                playVal.innerText = fmt(g.playing);
                document.getElementById('vRate').innerText = rate + "%";
                document.getElementById('vDis').innerText = fmt(down);
                document.getElementById('vVisit').innerText = fmt(g.visits);
                document.getElementById('vLike').innerText = fmt(up);
                document.getElementById('vFav').innerText = fmt(d.favorites);
                
                document.getElementById('dCreate').innerText = new Date(g.created).toLocaleDateString();
                document.getElementById('dUpdate').innerText = new Date(g.updated).toLocaleDateString();
                document.getElementById('vMax').innerText = g.maxPlayers || "--";
                document.getElementById('vGrowth').innerText = fmt(growth) + "/day";
                document.getElementById('gDesc').innerText = g.description || "No description.";
                document.getElementById('robloxLink').href = "https://www.roblox.com/games/" + i;

                document.getElementById('results').classList.remove('loading');
                document.getElementById('liveIndicator').style.display = 'flex';
                document.getElementById('status').innerText = "LIVE ANALYTICS ACTIVE";
            } catch (e) { document.getElementById('status').innerText = "CONNECTION BUSY - RETRYING"; }
        }

        function copyStats() {
            const t = document.getElementById('gTitle').innerText;
            const p = document.getElementById('vPlay').innerText;
            const r = document.getElementById('vRate').innerText;
            const text = t + " Profile\\nActive: " + p + "\\nRating: " + r + "\\nChecked on RoStats";
            navigator.clipboard.writeText(text);
            const b = document.querySelector('.copy-btn'); b.innerText = "COPIED!";
            setTimeout(() => { b.innerText = "COPY SUMMARY"; }, 2000);
        }
    </script>
</body></html>`;
