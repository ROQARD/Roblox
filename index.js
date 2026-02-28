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
              headers: { "User-Agent": "RoStats_Elite_ROQARD" },
              cf: { cacheTtl: 20 } 
            });
            if (res.ok) return await res.json();
          } catch (e) { continue; }
        }
        throw new Error("API Link Failure");
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
    <title>RoStats Elite</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        :root { --bg: #050505; --card: #0c0c0c; --border: #1a1a1a; --accent: #4ade80; --text: #fff; --dim: #71717a; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .container { width: 100%; max-width: 800px; }

        .search-area { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 20px; margin-bottom: 15px; text-align: center; }
        .input-box { display: flex; gap: 8px; background: #000; padding: 5px; border-radius: 12px; border: 1px solid var(--border); }
        input { flex: 1; background: transparent; border: none; color: white; padding: 10px; font-size: 1rem; }
        .btn { background: var(--accent); color: #000; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 800; cursor: pointer; }

        .dashboard { display: none; flex-direction: column; gap: 15px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
        .box { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 15px; }
        .label { font-size: 0.65rem; color: var(--dim); text-transform: uppercase; font-weight: 800; margin-bottom: 5px; }
        .val { font-size: 1.3rem; font-weight: 800; }

        .chart-container { background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 20px; height: 300px; }
        .meta-info { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 20px; line-height: 1.6; }
        .meta-row { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 15px; color: var(--dim); border-bottom: 1px solid var(--border); padding-bottom: 10px; }
        
        .play-btn { background: #fff; color: #000; text-decoration: none; text-align: center; padding: 15px; border-radius: 15px; font-weight: 800; margin-top: 10px; }
        .footer { position: fixed; bottom: 20px; right: 25px; font-size: 0.7rem; font-weight: 800; color: var(--dim); letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-area">
            <h1 style="letter-spacing:-2px; margin-bottom:15px;">Ro<span style="color:var(--accent)">Stats</span> Elite</h1>
            <div class="input-box">
                <input type="text" id="placeId" placeholder="Paste Experience/Place ID...">
                <button class="btn" onclick="initScan()">Analyze</button>
            </div>
            <div id="status" style="margin-top:10px; font-size:0.8rem; color:var(--dim);"></div>
        </div>

        <div id="results" class="dashboard">
            <div class="box" style="text-align:center;">
                <h2 id="gTitle">-</h2>
                <a id="gOwner" style="color:var(--accent); text-decoration:none; font-size:0.9rem; font-weight:600;" target="_blank">-</a>
            </div>

            <div class="grid">
                <div class="box"><div class="label">Live Players</div><div id="vPlay" class="val" style="color:var(--accent)">0</div></div>
                <div class="box"><div class="label">Total Visits</div><div id="vVisit" class="val">0</div></div>
                <div class="box"><div class="label">Favorites</div><div id="vFav" class="val">0</div></div>
                <div class="box"><div class="label">Rating</div><div id="vRate" class="val" style="color:#fbff00">0%</div></div>
                <div class="box"><div class="label">Likes</div><div id="vLike" class="val">0</div></div>
                <div class="box"><div class="label">Dislikes</div><div id="vDis" class="val">0</div></div>
            </div>

            <div class="chart-container">
                <canvas id="playerChart"></canvas>
            </div>

            <div class="meta-info">
                <div class="meta-row">
                    <span><b>Created:</b> <span id="dCreate">-</span></span>
                    <span><b>Updated:</b> <span id="dUpdate">-</span></span>
                </div>
                <div class="label">Description</div>
                <div id="gDesc" style="font-size:0.85rem; color:#a1a1aa;">-</div>
            </div>

            <a id="robloxLink" class="play-btn" target="_blank">View on Roblox</a>
        </div>
    </div>
    <div class="footer">BY ROQARD</div>

    <script>
        let chart;
        let chartData = [];
        let chartLabels = [];
        let liveInterval;

        function fmt(n) { return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toLocaleString(); }

        async function initScan() {
            if(liveInterval) clearInterval(liveInterval);
            chartData = []; chartLabels = [];
            if(chart) chart.destroy();
            
            const ctx = document.getElementById('playerChart').getContext('2d');
            chart = new Chart(ctx, {
                type: 'line',
                data: { labels: chartLabels, datasets: [{ label: 'Concurrent Players', data: chartData, borderColor: '#4ade80', tension: 0.4, fill: true, backgroundColor: 'rgba(74, 222, 128, 0.1)' }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#1a1a1a' } }, x: { display: false } }, plugins: { legend: { display: false } } }
            });

            await runUpdate();
            liveInterval = setInterval(runUpdate, 30000); // Live update every 30s
        }

        async function runUpdate() {
            const id = document.getElementById('placeId').value.match(/\\d+/)?.[0];
            if (!id) return;
            
            try {
                const vRes = await fetch("/api/validate-id?id=" + id);
                const vData = await vRes.json();
                const sRes = await fetch("/api/get-stats?uid=" + vData.universeId);
                const data = await sRes.json();

                const game = data.game;
                const ratio = (data.votes.upVotes + data.votes.downVotes) > 0 ? Math.round((data.votes.upVotes / (data.votes.upVotes + data.votes.downVotes)) * 100) : 0;

                document.getElementById('gTitle').innerText = game.name;
                document.getElementById('gOwner').innerText = "By " + game.creator.name;
                document.getElementById('gOwner').href = (game.creator.type === "Group" ? "https://www.roblox.com/groups/" : "https://www.roblox.com/users/") + game.creator.id;
                
                document.getElementById('vPlay').innerText = fmt(game.playing);
                document.getElementById('vVisit').innerText = fmt(game.visits);
                document.getElementById('vRate').innerText = ratio + "%";
                document.getElementById('vFav').innerText = fmt(data.favorites);
                document.getElementById('vLike').innerText = fmt(data.votes.upVotes);
                document.getElementById('vDis').innerText = fmt(data.votes.downVotes);
                
                document.getElementById('dCreate').innerText = new Date(game.created).toLocaleDateString();
                document.getElementById('dUpdate').innerText = new Date(game.updated).toLocaleDateString();
                document.getElementById('gDesc').innerText = game.description || "No description.";
                document.getElementById('robloxLink').href = "https://www.roblox.com/games/" + id;

                // Update Chart
                const now = new Date().toLocaleTimeString();
                chartLabels.push(now);
                chartData.push(game.playing);
                if(chartData.length > 20) { chartData.shift(); chartLabels.shift(); }
                chart.update();

                document.getElementById('results').style.display = 'flex';
                document.getElementById('status').innerText = "Live: Auto-refreshing every 30s";
            } catch (e) {
                document.getElementById('status').innerText = "Error: " + e.message;
            }
        }
    </script>
</body>
</html>
`;
