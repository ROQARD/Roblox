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
              headers: { "User-Agent": "RoStats_Final" }
            });
            if (res.ok) return await res.json();
          } catch (e) { continue; }
        }
        throw new Error("Proxy Link Failed");
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
        :root {
            --bg: #050505;
            --card: #0c0c0c;
            --border: #1a1a1a;
            --accent: #4ade80;
            --text: #ffffff;
            --dim: #71717a;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 40px 20px; display: flex; flex-direction: column; align-items: center; }
        .container { width: 100%; max-width: 650px; }

        .search-area { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 20px; text-align: center; margin-bottom: 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 20px; letter-spacing: -2px; }
        .input-box { display: flex; gap: 10px; background: #000; padding: 6px; border-radius: 12px; border: 1px solid var(--border); }
        input { flex: 1; background: transparent; border: none; color: white; padding: 10px; font-size: 1rem; outline: none; }
        .btn { background: var(--accent); color: black; border: none; padding: 10px 25px; border-radius: 8px; font-weight: 800; cursor: pointer; text-transform: uppercase; }

        .result-card { display: none; flex-direction: column; gap: 15px; width: 100%; }
        
        /* Top Identity Card */
        .id-card { background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 30px; text-align: center; }
        .id-card h2 { font-size: 1.5rem; margin-bottom: 5px; }
        .owner-link { color: var(--accent); text-decoration: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; }

        /* Stats Grid */
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .stat-box { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 15px; text-align: center; }
        .label { font-size: 0.65rem; color: var(--dim); text-transform: uppercase; font-weight: 800; margin-bottom: 5px; }
        .val { font-size: 1.2rem; font-weight: 800; }

        /* Meta Info (Dates & Desc) */
        .meta-card { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 20px; display: flex; flex-direction: column; gap: 15px; }
        .date-row { display: flex; justify-content: space-between; font-size: 0.8rem; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
        .desc-text { font-size: 0.85rem; color: #a1a1aa; line-height: 1.6; white-space: pre-wrap; }

        /* Bottom Actions */
        .play-btn { background: #fff; color: #000; text-decoration: none; text-align: center; padding: 15px; border-radius: 15px; font-weight: 800; text-transform: uppercase; transition: 0.2s; }
        .play-btn:hover { transform: scale(1.02); }

        #status { margin-top: 10px; font-size: 0.8rem; color: var(--dim); height: 1.2em; }
        .footer { position: fixed; bottom: 20px; right: 25px; font-size: 0.7rem; font-weight: 800; color: var(--dim); letter-spacing: 1px; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate { animation: fadeIn 0.4s ease forwards; }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-area">
            <h1>Ro<span style="color:var(--accent)">Stats</span></h1>
            <div class="input-box">
                <input type="text" id="placeId" placeholder="Place ID..." onkeypress="if(event.key==='Enter') fetchStats()">
                <button class="btn" onclick="fetchStats()">Scan</button>
            </div>
            <div id="status"></div>
        </div>

        <div id="results" class="result-card">
            <div class="id-card animate">
                <h2 id="gTitle">-</h2>
                <a id="gOwner" class="owner-link" target="_blank">By Unknown</a>
            </div>

            <div class="stats-grid">
                <div class="stat-box animate"><div class="label">Playing</div><div id="vPlay" class="val" style="color:var(--accent)">0</div></div>
                <div class="stat-box animate"><div class="label">Visits</div><div id="vVisit" class="val">0</div></div>
                <div class="stat-box animate"><div class="label">Rating</div><div id="vRate" class="val" style="color:#fbff00">0%</div></div>
                <div class="stat-box animate"><div class="label">Favorites</div><div id="vFav" class="val">0</div></div>
                <div class="stat-box animate"><div class="label">Likes</div><div id="vLike" class="val">0</div></div>
                <div class="stat-box animate"><div class="label">Dislikes</div><div id="vDis" class="val">0</div></div>
            </div>

            <div class="meta-card animate">
                <div class="date-row">
                    <span><b>Created:</b> <span id="dCreate">-</span></span>
                    <span><b>Updated:</b> <span id="dUpdate">-</span></span>
                </div>
                <div class="label">Description</div>
                <div id="gDesc" class="desc-text">-</div>
            </div>

            <a id="robloxLink" class="play-btn animate" target="_blank">Open in Roblox</a>
        </div>
    </div>

    <div class="footer">BY ROQARD</div>

    <script>
        function fmt(n) { return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toLocaleString(); }

        async function fetchStats() {
            const id = document.getElementById('placeId').value.match(/\\d+/)?.[0];
            const status = document.getElementById('status');
            const resDiv = document.getElementById('results');
            if (!id) return status.innerText = "Error: Invalid ID";

            resDiv.style.display = 'none';
            status.innerText = "Scanning Experience...";

            try {
                const vRes = await fetch("/api/validate-id?id=" + id);
                const vData = await vRes.json();
                if (vData.error) throw new Error(vData.error);

                const sRes = await fetch("/api/get-stats?uid=" + vData.universeId);
                const data = await sRes.json();

                const game = data.game;
                const ratio = (game.upVotes + game.downVotes) > 0 ? Math.round((data.votes.upVotes / (data.votes.upVotes + data.votes.downVotes)) * 100) : 0;

                // UI Fill
                document.getElementById('gTitle').innerText = game.name;
                document.getElementById('gOwner').innerText = "By " + game.creator.name;
                document.getElementById('gOwner').href = game.creator.hasVerifiedBadge 
                    ? "https://www.roblox.com/groups/" + game.creator.id 
                    : "https://www.roblox.com/users/" + game.creator.id + "/profile";
                
                // If it's a group, override user link
                if(game.creator.type === "Group") {
                    document.getElementById('gOwner').href = "https://www.roblox.com/groups/" + game.creator.id;
                }

                document.getElementById('vPlay').innerText = fmt(game.playing);
                document.getElementById('vVisit').innerText = fmt(game.visits);
                document.getElementById('vRate').innerText = ratio + "%";
                document.getElementById('vFav').innerText = fmt(data.favorites);
                document.getElementById('vLike').innerText = fmt(data.votes.upVotes);
                document.getElementById('vDis').innerText = fmt(data.votes.downVotes);
                
                document.getElementById('dCreate').innerText = new Date(game.created).toLocaleDateString();
                document.getElementById('dUpdate').innerText = new Date(game.updated).toLocaleDateString();
                document.getElementById('gDesc').innerText = game.description || "No description provided.";
                document.getElementById('robloxLink').href = "https://www.roblox.com/games/" + id;

                status.innerText = "";
                resDiv.style.display = 'flex';
            } catch (e) {
                status.innerText = "Error: " + e.message;
            }
        }
    </script>
</body>
</html>
`;
