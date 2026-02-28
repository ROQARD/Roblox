export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PROXIES = ["rotunnel.com", "roproxy.com", "rbxproxy.com"];

    if (url.pathname.startsWith("/api/")) {
      const apiHeaders = { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      };

      const tryFetch = async (subdomain, endpoint) => {
        for (let proxy of PROXIES) {
          try {
            const res = await fetch(`https://${subdomain}.${proxy}${endpoint}`, { 
              headers: { "User-Agent": "RoStats_Pure_ROQARD" }
            });
            if (res.ok) return await res.json();
          } catch (e) { continue; }
        }
        throw new Error("Proxy Error");
      };

      try {
        if (url.pathname === "/api/validate-id") {
          const id = url.searchParams.get("id");
          const data = await tryFetch('apis', `/universes/v1/places/${id}/universe`);
          return new Response(JSON.stringify({ universeId: data.universeId }), { headers: apiHeaders });
        }
        if (url.pathname === "/api/get-stats") {
          const uId = url.searchParams.get("uid");
          const [game, votes, favs] = await Promise.all([
            tryFetch('games', `/v1/games?universeIds=${uId}`),
            tryFetch('games', `/v1/games/votes?universeIds=${uId}`),
            tryFetch('games', `/v1/games/${uId}/favorites/count`)
          ]);
          return new Response(JSON.stringify({ 
            game: game.data[0], 
            votes: votes.data[0], 
            favorites: favs.favoritesCount 
          }), { headers: apiHeaders });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: apiHeaders });
      }
    }
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }
};

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RoStats</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        :root { --bg: #050505; --card: #0c0c0c; --border: #1a1a1a; --accent: #4ade80; --text: #fff; --dim: #71717a; --warn: #ff4444; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 40px 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        .container { width: 100%; max-width: 650px; padding-bottom: 100px; }

        .search-area { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 24px; text-align: center; margin-bottom: 15px; }
        .input-box { display: flex; gap: 10px; background: #000; padding: 6px; border-radius: 14px; border: 1px solid var(--border); }
        input { flex: 1; background: transparent; border: none; color: white; padding: 10px 15px; font-size: 1rem; outline: none; }
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 25px; border-radius: 10px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; }
        
        .dashboard { display: none; flex-direction: column; gap: 12px; animation: slideUp 0.4s ease; }
        .box { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 16px; text-align: center; }
        .label { font-size: 0.65rem; color: var(--dim); text-transform: uppercase; font-weight: 800; margin-bottom: 6px; letter-spacing: 0.5px; }
        .val { font-size: 1.4rem; font-weight: 800; }

        .content-card { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 20px; }
        .date-row { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--dim); border-bottom: 1px solid var(--border); padding-bottom: 15px; margin-bottom: 15px; }
        .full-desc { font-size: 0.9rem; color: #a1a1aa; line-height: 1.7; white-space: pre-wrap; }
        
        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px; }
        .btn { text-decoration: none; text-align: center; padding: 18px; border-radius: 18px; font-weight: 800; text-transform: uppercase; font-size: 0.85rem; cursor: pointer; border: none; transition: 0.2s; }
        .play-btn { background: #fff; color: #000; }
        .copy-btn { background: var(--card); color: #fff; border: 1px solid var(--border); }
        .btn:hover { opacity: 0.8; }

        .footer { position: fixed; bottom: 20px; right: 25px; z-index: 9999; }
        .footer-link { color: var(--dim); text-decoration: none; font-size: 0.7rem; font-weight: 800; letter-spacing: 2px; opacity: 0.5; }
        .footer-link:hover { opacity: 1; color: #fff; }

        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-area">
            <h1 style="font-size: 2.2rem; margin-bottom:20px; letter-spacing: -1.5px;">Ro<span style="color:var(--accent)">Stats</span></h1>
            <div class="input-box">
                <input type="text" id="placeId" placeholder="Enter Experience ID...">
                <button class="scan-btn" onclick="run()">Scan</button>
            </div>
            <div id="status" style="margin-top:12px; font-size:0.7rem; color:var(--dim); font-weight: 600;">READY</div>
        </div>

        <div id="results" class="dashboard">
            <div class="box">
                <h2 id="gTitle" style="font-size: 1.8rem; letter-spacing: -0.5px;">-</h2>
                <a id="gOwner" style="color:var(--accent); text-decoration:none; font-size:0.95rem; font-weight:600; margin-top:8px; display:inline-block;" target="_blank">-</a>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="box"><div class="label">Playing</div><div id="vPlay" class="val" style="color:var(--accent)">-</div></div>
                <div class="box"><div class="label">Rating</div><div id="vRate" class="val">-</div></div>
                <div class="box"><div class="label">Dislikes</div><div id="vDis" class="val" style="color:var(--warn)">-</div></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="box"><div class="label">Visits</div><div id="vVisit" class="val">-</div></div>
                <div class="box"><div class="label">Likes</div><div id="vLike" class="val">-</div></div>
                <div class="box"><div class="label">Favorites</div><div id="vFav" class="val">-</div></div>
            </div>

            <div class="content-card">
                <div class="date-row">
                    <span><b>Created:</b> <span id="dCreate" style="color:#fff"></span></span>
                    <span><b>Updated:</b> <span id="dUpdate" style="color:#fff"></span></span>
                </div>
                <div class="label" style="margin-bottom:10px;">Description</div>
                <div id="gDesc" class="full-desc"></div>
            </div>

            <div class="action-grid">
                <button class="btn copy-btn" onclick="copyStats()">Copy Summary</button>
                <a id="robloxLink" class="btn play-btn" target="_blank">Open Roblox</a>
            </div>
        </div>
    </div>

    <div class="footer">
        <a href="https://www.roblox.com/users/9461867215/profile" class="footer-link" target="_blank">BY ROQARD</a>
    </div>

    <script>
        let itv;
        const fmt = x => x >= 1e6 ? (x/1e6).toFixed(1)+'M' : x >= 1e3 ? (x/1e3).toFixed(1)+'K' : x.toLocaleString();

        async function run() {
            const idInput = document.getElementById('placeId').value;
            if (!idInput) return;
            if(itv) clearInterval(itv);
            await update();
            itv = setInterval(update, 30000);
        }

        async function update() {
            const idInput = document.getElementById('placeId').value;
            const id = idInput.replace(/\\D/g, ''); 
            if(!id) return;

            try {
                const v = await fetch("/api/validate-id?id=" + id).then(r => r.json());
                const d = await fetch("/api/get-stats?uid=" + v.universeId).then(r => r.json());
                const g = d.game;
                const up = d.votes.upVotes || 0;
                const down = d.votes.downVotes || 0;
                const rate = (up + down) > 0 ? Math.round((up / (up + down)) * 100) : 0;

                document.getElementById('gTitle').innerText = g.name;
                document.getElementById('gOwner').innerText = "By " + g.creator.name;
                document.getElementById('gOwner').href = (g.creator.type === "Group" ? "https://www.roblox.com/groups/" : "https://www.roblox.com/users/") + g.creator.id;
                
                document.getElementById('vPlay').innerText = fmt(g.playing);
                document.getElementById('vRate').innerText = rate + "%";
                document.getElementById('vDis').innerText = fmt(down);
                document.getElementById('vVisit').innerText = fmt(g.visits);
                document.getElementById('vLike').innerText = fmt(up);
                document.getElementById('vFav').innerText = fmt(d.favorites);
                
                document.getElementById('dCreate').innerText = new Date(g.created).toLocaleDateString();
                document.getElementById('dUpdate').innerText = new Date(g.updated).toLocaleDateString();
                document.getElementById('gDesc').innerText = g.description || "No description provided.";
                document.getElementById('robloxLink').href = "https://www.roblox.com/games/" + id;

                document.getElementById('results').style.display = 'flex';
                document.getElementById('status').innerText = "LIVE UPDATING";
            } catch (e) {
                document.getElementById('status').innerText = "OFFLINE / ERROR";
            }
        }

        function copyStats() {
            const title = document.getElementById('gTitle').innerText;
            const playing = document.getElementById('vPlay').innerText;
            const rate = document.getElementById('vRate').innerText;
            const visits = document.getElementById('vVisit').innerText;
            
            const text = title + " Stats:\\nActive: " + playing + "\\nRating: " + rate + "\\nVisits: " + visits + "\\nAnalyzed via RoStats";
            navigator.clipboard.writeText(text);
            
            const btn = document.querySelector('.copy-btn');
            btn.innerText = "COPIED!";
            setTimeout(() => { btn.innerText = "COPY SUMMARY"; }, 2000);
        }
    </script>
</body>
</html>
