export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PROXIES = ["rotunnel.com", "roproxy.com", "rbxproxy.com"];

    if (url.pathname.startsWith("/api/")) {
      const apiHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      const tryFetch = async (subdomain, endpoint) => {
        for (let proxy of PROXIES) {
          try {
            const res = await fetch(`https://${subdomain}.${proxy}${endpoint}`, { 
              headers: { "User-Agent": "RoStats_Final_V3" }
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
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 40px 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        .container { width: 100%; max-width: 650px; padding-bottom: 80px; }

        .search-area { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 24px; text-align: center; margin-bottom: 15px; }
        h1 { font-size: 2.2rem; font-weight: 800; letter-spacing: -2px; margin-bottom: 20px; }
        .input-box { display: flex; gap: 10px; background: #000; padding: 6px; border-radius: 14px; border: 1px solid var(--border); }
        input { flex: 1; background: transparent; border: none; color: white; padding: 10px 15px; font-size: 1rem; outline: none; }
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 25px; border-radius: 10px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; }
        
        #status { margin-top: 15px; font-size: 0.75rem; color: var(--dim); height: 1em; }

        .dashboard { display: none; flex-direction: column; gap: 12px; animation: slideUp 0.4s ease; }
        .header-card { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 20px; text-align: center; }
        .owner-link { color: var(--accent); text-decoration: none; font-weight: 600; font-size: 0.9rem; margin-top: 8px; display: inline-block; }
        
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .box { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 16px; text-align: center; }
        .label { font-size: 0.6rem; color: var(--dim); text-transform: uppercase; font-weight: 800; margin-bottom: 6px; letter-spacing: 0.5px; }
        .val { font-size: 1.2rem; font-weight: 800; }

        .content-card { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 20px; }
        .date-row { display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border); color: var(--dim); }
        .full-desc { font-size: 0.9rem; color: #d4d4d8; line-height: 1.7; white-space: pre-wrap; word-wrap: break-word; }

        .play-btn { background: #fff; color: #000; text-decoration: none; text-align: center; padding: 18px; border-radius: 18px; font-weight: 800; text-transform: uppercase; font-size: 0.9rem; margin-top: 5px; transition: 0.2s; }
        .play-btn:hover { background: var(--accent); transform: scale(1.01); }

        /* Fixed Footer Fix */
        .footer { position: fixed; bottom: 20px; right: 25px; z-index: 100; }
        .footer a { color: var(--dim); text-decoration: none; font-size: 0.7rem; font-weight: 800; letter-spacing: 2px; transition: 0.2s; }
        .footer a:hover { color: var(--accent); }

        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-area">
            <h1>Ro<span style="color:var(--accent)">Stats</span></h1>
            <div class="input-box">
                <input type="text" id="placeId" placeholder="Experience ID..." onkeypress="if(event.key==='Enter') start()">
                <button class="scan-btn" onclick="start()">Scan</button>
            </div>
            <div id="status"></div>
        </div>

        <div id="results" class="dashboard">
            <div class="header-card">
                <h2 id="gTitle" style="font-size: 1.8rem;">-</h2>
                <a id="gOwner" class="owner-link" target="_blank">By ROQARD</a>
            </div>

            <div class="grid">
                <div class="box"><div class="label">Playing</div><div id="vPlay" class="val" style="color:var(--accent)">0</div></div>
                <div class="box"><div class="label">Visits</div><div id="vVisit" class="val">0</div></div>
                <div class="box"><div class="label">Rating</div><div id="vRate" class="val" style="color:#fbff00">0%</div></div>
                
                <div class="box"><div class="label">Favorites</div><div id="vFav" class="val">0</div></div>
                <div class="box"><div class="label">Likes</div><div id="vLike" class="val">0</div></div>
                <div class="box"><div class="label">Dislikes</div><div id="vDis" class="val">0</div></div>

                <div class="box"><div class="label">Daily Growth</div><div id="vGrowth" class="val" style="color:#60a5fa">0</div></div>
                <div class="box"><div class="label">Fav Ratio</div><div id="vRatio" class="val">0</div></div>
                <div class="box"><div class="label">Popularity</div><div id="vPop" class="val">0</div></div>
            </div>

            <div class="content-card">
                <div class="date-row">
                    <span><b>Created:</b> <span id="dCreate" style="color:#fff">-</span></span>
                    <span><b>Updated:</b> <span id="dUpdate" style="color:#fff">-</span></span>
                </div>
                <div class="label" style="margin-bottom:15px">Complete Description</div>
                <div id="gDesc" class="full-desc">-</div>
            </div>

            <a id="robloxLink" class="play-btn" target="_blank">Launch Experience</a>
        </div>
    </div>

    <div class="footer">
        <a href="https://www.roblox.com/users/9461867215/profile" target="_blank">BY ROQARD</a>
    </div>

    <script>
        let loop;
        function n(x) { return x >= 1e6 ? (x/1e6).toFixed(1)+'M' : x >= 1e3 ? (x/1e3).toFixed(1)+'K' : x.toLocaleString(); }

        async function start() {
            if(loop) clearInterval(loop);
            await load();
            loop = setInterval(load, 30000); 
        }

        async function load() {
            const id = document.getElementById('placeId').value.match(/\\d+/)?.[0];
            const status = document.getElementById('status');
            if (!id) return status.innerText = "Error: Input ID";

            try {
                const vRes = await fetch("/api/validate-id?id=" + id);
                const vData = await vRes.json();
                const sRes = await fetch("/api/get-stats?uid=" + vData.universeId);
                const data = await sRes.json();
                const game = data.game;

                const up = data.votes.upVotes || 0;
                const down = data.votes.downVotes || 0;
                const ratio = (up + down) > 0 ? Math.round((up / (up + down)) * 100) : 0;
                
                // Extra Stats Calculation
                const ageDays = Math.max(1, (new Date() - new Date(game.created)) / 86400000);
                const growth = Math.round(game.visits / ageDays);
                const favRatio = ((data.favorites / game.visits) * 1000).toFixed(1); // Favs per 1k visits

                document.getElementById('gTitle').innerText = game.name;
                document.getElementById('gOwner').innerText = "By " + game.creator.name;
                document.getElementById('gOwner').href = (game.creator.type === "Group" ? "https://www.roblox.com/groups/" : "https://www.roblox.com/users/") + game.creator.id;
                
                document.getElementById('vPlay').innerText = n(game.playing);
                document.getElementById('vVisit').innerText = n(game.visits);
                document.getElementById('vRate').innerText = ratio + "%";
                document.getElementById('vFav').innerText = n(data.favorites);
                document.getElementById('vLike').innerText = n(up);
                document.getElementById('vDis').innerText = n(down);
                
                document.getElementById('vGrowth').innerText = "+" + n(growth);
                document.getElementById('vRatio').innerText = favRatio;
                document.getElementById('vPop').innerText = n(game.playing * 10); // Dynamic popularity score

                document.getElementById('dCreate').innerText = new Date(game.created).toLocaleDateString();
                document.getElementById('dUpdate').innerText = new Date(game.updated).toLocaleDateString();
                document.getElementById('gDesc').innerText = game.description || "No description provided.";
                document.getElementById('robloxLink').href = "https://www.roblox.com/games/" + id;

                document.getElementById('results').style.display = 'flex';
                status.innerText = "Monitoring Live Data...";
            } catch (e) {
                status.innerText = "Error: Connection Lost. Re-scanning...";
            }
        }
    </script>
</body>
</html>
`;
