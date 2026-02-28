export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PROXY_BASE = "roproxy.com"; 

    // --- API GATEWAY (Forced JSON Mode) ---
    if (url.pathname.startsWith("/api/")) {
      const apiHeaders = { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      };

      try {
        if (url.pathname === "/api/validate-id") {
          const placeId = url.searchParams.get("id");
          const res = await fetch(`https://apis.${PROXY_BASE}/universes/v1/places/${placeId}/universe`);
          if (!res.ok) return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400, headers: apiHeaders });
          
          const data = await res.json();
          return new Response(JSON.stringify({ universeId: data.universeId }), { headers: apiHeaders });
        }

        if (url.pathname === "/api/get-stats") {
          const uId = url.searchParams.get("uid");
          const [gameRes, voteRes, favRes] = await Promise.all([
            fetch(`https://games.${PROXY_BASE}/v1/games?universeIds=${uId}`),
            fetch(`https://games.${PROXY_BASE}/v1/games/votes?universeIds=${uId}`),
            fetch(`https://games.${PROXY_BASE}/v1/games/${uId}/favorites/count`)
          ]);

          const gameData = await gameRes.json();
          const voteData = await voteRes.json();
          const favData  = await favRes.json();

          if (!gameData?.data?.[0]) {
            return new Response(JSON.stringify({ error: "Private Game" }), { status: 404, headers: apiHeaders });
          }

          return new Response(JSON.stringify({
            game: gameData.data[0],
            votes: voteData?.data?.[0] || { upVotes: 0, downVotes: 0 },
            favorites: favData?.favoritesCount || 0
          }), { headers: apiHeaders });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: "Connection Failed" }), { status: 500, headers: apiHeaders });
      }
    }

    // --- HTML FRONTEND ---
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
            --glass: rgba(255, 255, 255, 0.03);
            --border: rgba(255, 255, 255, 0.08);
            --accent: #00ff88;
            --text: #ffffff;
            --text-dim: #888;
            --error: #ff4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; outline: none; }
        body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; min-height: 100vh; }
        .container { width: 100%; max-width: 600px; }
        
        .search-box { background: var(--glass); border: 1px solid var(--border); padding: 30px; border-radius: 24px; text-align: center; margin-bottom: 20px; }
        h1 { font-weight: 800; font-size: 2rem; margin-bottom: 20px; letter-spacing: -1px; }
        .input-group { display: flex; gap: 10px; }
        input { flex: 1; background: #000; border: 1px solid var(--border); color: white; padding: 14px 18px; border-radius: 12px; font-size: 1rem; }
        input:focus { border-color: var(--accent); }
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 22px; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; }
        
        #status { margin-top: 15px; font-size: 0.75rem; font-weight: 600; color: var(--text-dim); min-height: 1.2em; }

        .recent-container { margin-top: 20px; text-align: left; display: none; }
        .recent-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.65rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: var(--text-dim); }
        .recent-list { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: none; }
        .recent-item { background: var(--glass); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; cursor: pointer; white-space: nowrap; font-size: 0.7rem; transition: 0.2s; }
        .recent-item:hover { border-color: var(--accent); color: var(--accent); }

        .result-card { display: none; flex-direction: column; gap: 10px; animation: fadeIn 0.4s ease; }
        .header-box { background: var(--glass); border: 1px solid var(--border); padding: 25px; border-radius: 20px; text-align: center; }
        .grid-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .stat-item { background: var(--glass); border: 1px solid var(--border); padding: 15px; border-radius: 16px; text-align: center; }
        .full-width { grid-column: span 3; }
        .label { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; font-weight: 800; margin-bottom: 4px; }
        .value { font-size: 1.1rem; font-weight: 800; }
        
        .desc-box { cursor: pointer; text-align: left; padding: 15px; }
        #gDesc { font-size: 0.8rem; color: var(--text-dim); line-height: 1.5; max-height: 3em; overflow: hidden; transition: 0.3s; }
        #gDesc.expanded { max-height: 1000px; color: #fff; }

        .action-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .btn-action { padding: 14px; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.7rem; border: 1px solid var(--border); transition: 0.2s; text-decoration: none; color: #fff; display: flex; align-items: center; justify-content: center; }
        .btn-copy { background: rgba(0, 255, 136, 0.05); color: var(--accent); border-color: var(--accent); }
        .btn-action:hover { transform: translateY(-2px); }

        .footer { position: fixed; bottom: 20px; right: 25px; font-size: 0.65rem; font-weight: 800; opacity: 0.5; letter-spacing: 2px; }
        .footer a { color: #fff; text-decoration: none; }
        .footer a:hover { color: var(--accent); opacity: 1; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
<div class="container">
    <div class="search-box">
        <h1>Ro<span style="color:var(--accent)">Stats</span></h1>
        <div class="input-group">
            <input type="text" id="placeId" placeholder="Enter Place ID..." onkeypress="if(event.key === 'Enter') fetchStats()">
            <button class="scan-btn" onclick="fetchStats()">Scan</button>
        </div>
        <div id="status"></div>
        <div id="recentContainer" class="recent-container">
            <div class="recent-header">History <span onclick="clearHistory()" style="color:var(--error); cursor:pointer">Wipe</span></div>
            <div id="recentList" class="recent-list"></div>
        </div>
    </div>

    <div id="results" class="result-card">
        <div class="header-box">
            <div id="gName" style="font-weight:800; font-size:1.5rem; margin-bottom:5px;">-</div>
            <div id="gCreator" style="color:var(--accent); font-size:0.8rem; font-weight:600;">-</div>
        </div>
        <div class="grid-stats">
            <div class="stat-item"><div class="label">Playing</div><div id="gPlaying" class="value" style="color:var(--accent);">0</div></div>
            <div class="stat-item"><div class="label">Visits</div><div id="gVisits" class="value">0</div></div>
            <div class="stat-item"><div class="label">Rating</div><div id="gRating" class="value" style="color:#fbff00;">0%</div></div>
            <div class="stat-item"><div class="label">Daily Growth</div><div id="gGrowth" class="value" style="color:#00e5ff;">0</div></div>
            <div class="stat-item"><div class="label">Likes</div><div id="gLikes" class="value">0</div></div>
            <div class="stat-item"><div class="label">Favorites</div><div id="gFavs" class="value">0</div></div>
            <div class="stat-item full-width desc-box" onclick="toggleDesc()">
                <div class="label">Description (Tap to Expand)</div>
                <div id="gDesc">-</div>
            </div>
        </div>
        <div class="action-group">
            <button class="btn-action btn-copy" onclick="copyData()">Copy Info</button>
            <a id="gameLink" href="#" target="_blank" class="btn-action">Roblox Link</a>
        </div>
    </div>
</div>

<div class="footer">
    <a href="https://www.roblox.com/users/9461867215/profile" target="_blank">BY ROQARD</a>
</div>

<script>
    const KEY = "rostats_live_v1";
    let current = null;

    function n(x) {
        if (!x || isNaN(x)) return "0";
        if (x >= 1e6) return (x / 1e6).toFixed(1) + "M";
        if (x >= 1e3) return (x / 1e3).toFixed(1) + "K";
        return x.toLocaleString();
    }

    async function fetchStats() {
        const idInput = document.getElementById('placeId').value;
        const id = idInput.match(/\\d+/)?.[0];
        const status = document.getElementById('status');
        const results = document.getElementById('results');

        if (!id) { 
            status.innerText = "Error: Input ID"; 
            status.style.color = "var(--error)";
            return; 
        }
        
        results.style.display = 'none';
        status.innerText = "Processing...";
        status.style.color = "var(--text-dim)";
        
        try {
            const vRes = await fetch("/api/validate-id?id=" + id);
            const vData = await vRes.json();
            if (vData.error) throw new Error(vData.error);

            const sRes = await fetch("/api/get-stats?uid=" + vData.universeId);
            const data = await sRes.json();
            if (data.error) throw new Error(data.error);

            current = data;
            const up = data.votes.upVotes || 0;
            const down = data.votes.downVotes || 0;
            const ratio = (up + down) > 0 ? Math.round((up / (up + down)) * 100) : 0;

            const daysOld = Math.max(1, (new Date() - new Date(data.game.created)) / 86400000);
            const growth = Math.round(data.game.visits / daysOld);

            document.getElementById('gName').innerText = data.game.name;
            document.getElementById('gCreator').innerText = "By " + data.game.creator.name;
            document.getElementById('gPlaying').innerText = n(data.game.playing);
            document.getElementById('gVisits').innerText = n(data.game.visits);
            document.getElementById('gRating').innerText = ratio + "%";
            document.getElementById('gGrowth').innerText = "+" + n(growth);
            document.getElementById('gLikes').innerText = n(up);
            document.getElementById('gFavs').innerText = n(data.favorites);
            document.getElementById('gDesc').innerText = data.game.description || "No description.";
            document.getElementById('gameLink').href = "https://www.roblox.com/games/" + id;

            saveHistory(id, data.game.name);
            status.innerText = "";
            results.style.display = 'flex';
        } catch (e) {
            status.innerText = "Failed: " + e.message;
            status.style.color = "var(--error)";
        }
    }

    function toggleDesc() { document.getElementById('gDesc').classList.toggle('expanded'); }

    function saveHistory(id, name) {
        let h = JSON.parse(localStorage.getItem(KEY)) || [];
        h = h.filter(x => String(x.id) !== String(id));
        h.unshift({ id, name });
        localStorage.setItem(KEY, JSON.stringify(h.slice(0, 5)));
        renderHistory();
    }

    function renderHistory() {
        const h = JSON.parse(localStorage.getItem(KEY)) || [];
        document.getElementById('recentContainer').style.display = h.length ? 'block' : 'none';
        document.getElementById('recentList').innerHTML = h.map(x => '<div class="recent-item" onclick="document.getElementById(\\'placeId\\').value=\\''+x.id+'\\';fetchStats()">'+x.name+'</div>').join('');
    }

    function clearHistory() { localStorage.removeItem(KEY); renderHistory(); }

    function copyData() {
        const t = "RoStats: " + current.game.name + " | Visits: " + n(current.game.visits) + " | Rating: " + document.getElementById('gRating').innerText;
        navigator.clipboard.writeText(t).then(() => alert("Copied."));
    }

    window.onload = renderHistory;
</script>
</body>
</html>
`;
