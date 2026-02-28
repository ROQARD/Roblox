export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PROXIES = ["rotunnel.com", "roproxy.com"];

    if (url.pathname.startsWith("/api/")) {
      const apiHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      const tryFetch = async (subdomain, endpoint) => {
        for (let proxy of PROXIES) {
          try {
            const res = await fetch(`https://${subdomain}.${proxy}${endpoint}`, { 
              headers: { "User-Agent": "RoStats_ROQARD" }
            });
            if (res.ok) return await res.json();
          } catch (e) { continue; }
        }
        throw new Error("Network Error");
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
          return new Response(JSON.stringify({ game: game.data[0], votes: votes.data[0], favorites: favs.favoritesCount }), { headers: apiHeaders });
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
        :root { --bg: #050505; --card: #0c0c0c; --border: #1a1a1a; --accent: #4ade80; --text: #fff; --dim: #71717a; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; transition: 0.2s; }
        body { background: var(--bg); color: var(--text); padding: 40px 20px; display: flex; flex-direction: column; align-items: center; }
        .container { width: 100%; max-width: 600px; }

        /* Search Section */
        .search-area { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 24px; text-align: center; margin-bottom: 15px; }
        h1 { font-size: 2.2rem; font-weight: 800; letter-spacing: -2px; margin-bottom: 20px; }
        .input-box { display: flex; gap: 10px; background: #000; padding: 6px; border-radius: 14px; border: 1px solid var(--border); }
        input { flex: 1; background: transparent; border: none; color: white; padding: 10px 15px; font-size: 1rem; outline: none; }
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 25px; border-radius: 10px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; }
        
        #status { margin-top: 15px; font-size: 0.75rem; font-weight: 600; color: var(--dim); height: 1em; }

        /* Results Grid */
        .dashboard { display: none; flex-direction: column; gap: 12px; animation: slideUp 0.4s ease; }
        .id-header { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 20px; text-align: center; }
        .owner-link { color: var(--accent); text-decoration: none; font-weight: 600; font-size: 0.85rem; margin-top: 5px; display: inline-block; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .stat-box { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 16px; text-align: center; }
        .label { font-size: 0.6rem; color: var(--dim); text-transform: uppercase; font-weight: 800; margin-bottom: 6px; letter-spacing: 0.5px; }
        .val { font-size: 1.2rem; font-weight: 800; }

        .meta-card { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 20px; }
        .date-row { display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px solid var(--border); color: var(--dim); }
        .desc { font-size: 0.85rem; color: #a1a1aa; line-height: 1.6; white-space: pre-wrap; max-height: 150px; overflow-y: auto; padding-right: 5px; }
        .desc::-webkit-scrollbar { width: 4px; }
        .desc::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

        .play-btn { background: #fff; color: #000; text-decoration: none; text-align: center; padding: 16px; border-radius: 16px; font-weight: 800; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 1px; }
        .play-btn:hover { background: var(--accent); transform: translateY(-2px); }

        .footer { position: fixed; bottom: 20px; right: 25px; font-size: 0.65rem; font-weight: 800; color: var(--dim); letter-spacing: 2px; }

        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-area">
            <h1>Ro<span style="color:var(--accent)">Stats</span></h1>
            <div class="input-box">
                <input type="text" id="placeId" placeholder="Experience ID..." onkeypress="if(event.key==='Enter') startTracking()">
                <button class="scan-btn" onclick="startTracking()">Scan</button>
            </div>
            <div id="status"></div>
        </div>

        <div id="results" class="dashboard">
            <div class="id-header">
                <h2 id="gTitle" style="font-size: 1.6rem; font-weight: 800;">-</h2>
                <a id="gOwner" class="owner-link" target="_blank">By ROQARD</a>
            </div>

            <div class="stats-grid">
                <div class="stat-box"><div class="label">Playing</div><div id="vPlay" class="val" style="color:var(--accent)">0</div></div>
                <div class="stat-box"><div class="label">Visits</div><div id="vVisit" class="val">0</div></div>
                <div class="stat-box"><div class="label">Rating</div><div id="vRate" class="val" style="color:#fbff00">0%</div></div>
                <div class="stat-box"><div class="label">Favorites</div><div id="vFav" class="val">0</div></div>
                <div class="stat-box"><div class="label">Likes</div><div id="vLike" class="val">0</div></div>
                <div class="stat-box"><div class="label">Dislikes</div><div id="vDis" class="val">0</div></div>
            </div>

            <div class="meta-card">
                <div class="date-row">
                    <span><b>Created:</b> <span id="dCreate" style="color:#fff">-</span></span>
                    <span><b>Updated:</b> <span id="dUpdate" style="color:#fff">-</span></span>
                </div>
                <div class="label" style="margin-bottom:10px">Description</div>
                <div id="gDesc" class="desc">-</div>
            </div>

            <a id="robloxLink" class="play-btn" target="_blank">Open in Roblox</a>
        </div>
    </div>
    <div class="footer">BY ROQARD</div>

    <script>
        let liveRef;
        function n(x) { return x >= 1e6 ? (x/1e6).toFixed(1)+'M' : x >= 1e3 ? (x/1e3).toFixed(1)+'K' : x.toLocaleString(); }

        async function startTracking() {
            if(liveRef) clearInterval(liveRef);
            await update();
            liveRef = setInterval(update, 30000); 
        }

        async function update() {
            const id = document.getElementById('placeId').value.match(/\\d+/)?.[0];
            const status = document.getElementById('status');
            if (!id) return status.innerText = "Error: Invalid ID";

            try {
                const vRes = await fetch("/api/validate-id?id=" + id);
                const vData = await vRes.json();
                const sRes = await fetch("/api/get-stats?uid=" + vData.universeId);
                const data = await sRes.json();
                const game = data.game;

                const up = data.votes.upVotes || 0;
                const down = data.votes.downVotes || 0;
                const ratio = (up + down) > 0 ? Math.round((up / (up + down)) * 100) : 0;

                document.getElementById('gTitle').innerText = game.name;
                document.getElementById('gOwner').innerText = "By " + game.creator.name;
                document.getElementById('gOwner').href = (game.creator.type === "Group" ? "https://www.roblox.com/groups/" : "https://www.roblox.com/users/") + game.creator.id;
                
                document.getElementById('vPlay').innerText = n(game.playing);
                document.getElementById('vVisit').innerText = n(game.visits);
                document.getElementById('vRate').innerText = ratio + "%";
                document.getElementById('vFav').innerText = n(data.favorites);
                document.getElementById('vLike').innerText = n(up);
                document.getElementById('vDis').innerText = n(down);
                
                document.getElementById('dCreate').innerText = new Date(game.created).toLocaleDateString();
                document.getElementById('dUpdate').innerText = new Date(game.updated).toLocaleDateString();
                document.getElementById('gDesc').innerText = game.description || "None.";
                document.getElementById('robloxLink').href = "https://www.roblox.com/games/" + id;

                document.getElementById('results').style.display = 'flex';
                status.innerText = "Live tracking active (30s)";
            } catch (e) {
                status.innerText = "Error: Proxy Busy. Retrying...";
            }
        }
    </script>
</body>
</html>
`;
