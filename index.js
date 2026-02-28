export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PROXY = "roproxy.com";

    // --- API HANDLER (Always returns JSON) ---
    if (url.pathname.startsWith("/api/")) {
      const headers = { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      };

      try {
        if (url.pathname === "/api/validate-id") {
          const placeId = url.searchParams.get("id");
          const res = await fetch(`https://apis.${PROXY}/universes/v1/places/${placeId}/universe`);
          if (!res.ok) return new Response(JSON.stringify({ error: "Invalid Place ID" }), { status: 400, headers });
          const data = await res.json();
          return new Response(JSON.stringify({ universeId: data.universeId }), { headers });
        }

        if (url.pathname === "/api/get-stats") {
          const uId = url.searchParams.get("uid");
          const [gameRes, voteRes, favRes] = await Promise.all([
            fetch(`https://games.${PROXY}/v1/games?universeIds=${uId}`),
            fetch(`https://games.${PROXY}/v1/games/votes?universeIds=${uId}`),
            fetch(`https://games.${PROXY}/v1/games/${uId}/favorites/count`)
          ]);

          const gameData = await gameRes.json();
          const voteData = await voteRes.json();
          const favData = await favRes.json();

          if (!gameData?.data?.[0]) {
            return new Response(JSON.stringify({ error: "Game data is empty/private" }), { status: 404, headers });
          }

          const payload = {
            game: gameData.data[0],
            votes: voteData?.data?.[0] || { upVotes: 0, downVotes: 0 },
            favorites: favData?.favoritesCount || 0
          };

          return new Response(JSON.stringify(payload), { headers });
        }

        return new Response(JSON.stringify({ error: "API Endpoint Not Found" }), { status: 404, headers });

      } catch (err) {
        return new Response(JSON.stringify({ error: "Proxy Connection Failed" }), { status: 500, headers });
      }
    }

    // --- FRONTEND HANDLER ---
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }
};

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RoStats Ultra</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        :root {
            --bg: #050505;
            --glass: rgba(255, 255, 255, 0.03);
            --border: rgba(255, 255, 255, 0.07);
            --accent: #00ff88;
            --text: #ffffff;
            --text-dim: #888;
            --error: #ff4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; min-height: 100vh; }
        .container { width: 100%; max-width: 650px; }
        .search-box { background: var(--glass); border: 1px solid var(--border); padding: 30px; border-radius: 28px; text-align: center; margin-bottom: 24px; }
        h1 { font-weight: 800; font-size: 2.2rem; margin-bottom: 20px; letter-spacing: -1px; }
        .input-group { display: flex; gap: 10px; }
        input { flex: 1; background: rgba(0,0,0,0.5); border: 1px solid var(--border); color: white; padding: 16px 20px; border-radius: 14px; font-size: 1rem; outline: none; }
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 25px; border-radius: 14px; font-weight: 800; cursor: pointer; text-transform: uppercase; }
        #status { margin-top: 15px; font-size: 0.8rem; font-weight: 600; min-height: 20px; color: var(--text-dim); }
        
        .recent-container { margin-top: 20px; text-align: left; display: none; }
        .recent-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .recent-title { font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
        .clear-btn { font-size: 0.65rem; color: var(--error); cursor: pointer; background: none; border: none; font-weight: 800; }
        .recent-list { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px; }
        .recent-item { background: var(--glass); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; cursor: pointer; white-space: nowrap; font-size: 0.75rem; font-weight: 600; }

        .result-card { display: none; flex-direction: column; gap: 10px; animation: slideUp 0.4s ease; }
        .header-box { background: var(--glass); border: 1px solid var(--border); padding: 25px; border-radius: 24px; text-align: center; }
        .grid-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .stat-item { background: var(--glass); border: 1px solid var(--border); padding: 15px; border-radius: 16px; text-align: center; }
        .full-width { grid-column: span 3; }
        .label { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; font-weight: 800; margin-bottom: 4px; }
        .value { font-size: 1.2rem; font-weight: 800; }
        
        /* Expandable Description */
        #gDesc { 
            font-size: 0.8rem; 
            color: var(--text-dim); 
            line-height: 1.5; 
            max-height: 60px; 
            overflow: hidden; 
            cursor: pointer; 
            transition: max-height 0.3s ease;
            position: relative;
        }
        #gDesc.expanded { max-height: 1000px; overflow-y: visible; }
        .desc-hint { font-size: 0.6rem; color: var(--accent); margin-top: 4px; display: block; }

        .action-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px; }
        .btn-action { padding: 16px; border-radius: 16px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.75rem; border: 1px solid var(--border); transition: 0.2s; }
        .btn-copy { background: rgba(0, 255, 136, 0.05); color: var(--accent); border-color: var(--accent); }
        .btn-link { background: rgba(255, 255, 255, 0.05); color: #fff; text-decoration: none; display: flex; align-items: center; justify-content: center; }
        
        .footer-credit { position: fixed; bottom: 20px; right: 25px; font-size: 0.75rem; font-weight: 800; opacity: 0.6; letter-spacing: 2px; }
        .footer-credit a { color: var(--text-dim); text-decoration: none; }

        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
<div class="container">
    <div class="search-box">
        <h1>Ro<span style="color:var(--accent)">Stats</span>.</h1>
        <div class="input-group">
            <input type="text" id="placeId" placeholder="Enter Place ID..." onkeypress="if(event.key === 'Enter') fetchStats()">
            <button class="scan-btn" onclick="fetchStats()">Scan</button>
        </div>
        <div id="status"></div>
        <div id="recentContainer" class="recent-container">
            <div class="recent-header">
                <div class="recent-title">History</div>
                <button class="clear-btn" onclick="clearHistory()">Wipe</button>
            </div>
            <div id="recentList" class="recent-list"></div>
        </div>
    </div>

    <div id="results" class="result-card">
        <div class="header-box">
            <div id="gName" style="font-weight:800; font-size:1.8rem; margin-bottom:5px;">-</div>
            <div id="gCreator" style="color:var(--accent); font-size:0.9rem; font-weight:600;">-</div>
        </div>
        <div class="grid-stats">
            <div class="stat-item"><div class="label">Playing</div><div id="gPlaying" class="value" style="color:var(--accent);">0</div></div>
            <div class="stat-item"><div class="label">Visits</div><div id="gVisits" class="value">0</div></div>
            <div class="stat-item"><div class="label">Rating</div><div id="gRating" class="value" style="color:#fbff00;">0%</div></div>
            <div class="stat-item"><div class="label">Favorites</div><div id="gFavs" class="value">0</div></div>
            <div class="stat-item"><div class="label">Likes</div><div id="gLikes" class="value">0</div></div>
            <div class="stat-item"><div class="label">Dislikes</div><div id="gDislikes" class="value">0</div></div>
            <div class="stat-item"><div class="label">Max Server</div><div id="gMax" class="value">0</div></div>
            <div class="stat-item"><div class="label">Created</div><div id="gCreated" class="value" style="font-size:0.8rem;">-</div></div>
            <div class="stat-item"><div class="label">Updated</div><div id="gUpdated" class="value" style="font-size:0.8rem;">-</div></div>
            <div class="stat-item full-width" onclick="toggleDesc()">
                <div class="label">Description</div>
                <div id="gDesc">-</div>
                <span class="desc-hint" id="descHint">Tap to expand</span>
            </div>
        </div>
        <div class="action-group">
            <button class="btn-action btn-copy" onclick="copyData()">Copy Report</button>
            <a id="gameLink" href="#" target="_blank" class="btn-action btn-link">Visit Game</a>
        </div>
    </div>
</div>

<div class="footer-credit">
    <a href="https://www.roblox.com/users/9461867215/profile" target="_blank">BY ROQARD</a>
</div>

<script>
    const RECENT_KEY = "rostats_v9_stable";
    let currentData = null;
    let currentPlaceId = "";

    window.onload = renderRecents;

    function formatNum(n) {
        if (!n || isNaN(n)) return "0";
        if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
        if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
        if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
        return n.toLocaleString();
    }

    async function fetchStats() {
        const idInput = document.getElementById('placeId').value.trim();
        const id = idInput.match(/\\d+/)?.[0];
        const status = document.getElementById('status');
        const results = document.getElementById('results');

        if (!id) { status.innerText = "Error: ID Required."; status.style.color = "var(--error)"; return; }
        
        currentPlaceId = id;
        results.style.display = 'none';
        status.innerText = "Accessing Hub...";
        status.style.color = "var(--text-dim)";
        
        try {
            const valRes = await fetch("/api/validate-id?id=" + id);
            const valData = await valRes.json();
            if (valData.error) throw new Error(valData.error);

            const statRes = await fetch("/api/get-stats?uid=" + valData.universeId);
            const data = await statRes.json();
            if (data.error) throw new Error(data.error);

            currentData = data;
            const up = data.votes.upVotes || 0;
            const down = data.votes.downVotes || 0;
            const ratio = (up + down) > 0 ? Math.round((up / (up + down)) * 100) : 0;

            document.getElementById('gName').innerText = data.game.name;
            document.getElementById('gCreator').innerText = "By " + (data.game.creator?.name || "Unknown");
            document.getElementById('gPlaying').innerText = formatNum(data.game.playing);
            document.getElementById('gVisits').innerText = formatNum(data.game.visits);
            document.getElementById('gRating').innerText = ratio + "%";
            document.getElementById('gFavs').innerText = formatNum(data.favorites);
            document.getElementById('gLikes').innerText = formatNum(up);
            document.getElementById('gDislikes').innerText = formatNum(down);
            document.getElementById('gMax').innerText = data.game.maxPlayers || "N/A";
            document.getElementById('gCreated').innerText = new Date(data.game.created).toLocaleDateString();
            document.getElementById('gUpdated').innerText = new Date(data.game.updated).toLocaleDateString();
            
            const desc = document.getElementById('gDesc');
            desc.innerText = data.game.description || "No description provided.";
            desc.classList.remove('expanded');
            document.getElementById('descHint').innerText = "Tap to expand";

            document.getElementById('gameLink').href = "https://www.roblox.com/games/" + id;

            saveRecent(id, data.game.name);
            status.innerText = "Connected.";
            status.style.color = "var(--accent)";
            results.style.display = 'flex';
        } catch (e) {
            status.innerText = "Error: " + e.message;
            status.style.color = "var(--error)";
        }
    }

    function toggleDesc() {
        const desc = document.getElementById('gDesc');
        const hint = document.getElementById('descHint');
        desc.classList.toggle('expanded');
        hint.innerText = desc.classList.contains('expanded') ? "Tap to collapse" : "Tap to expand";
    }

    function saveRecent(id, name) {
        let recents = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
        recents = recents.filter(i => String(i.id) !== String(id));
        recents.unshift({ id, name });
        localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(0, 8)));
        renderRecents();
    }

    function renderRecents() {
        const recents = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
        const container = document.getElementById('recentContainer');
        const list = document.getElementById('recentList');
        if (recents.length === 0) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        list.innerHTML = recents.map(g => '<div class="recent-item" onclick="setAndFetch(\\'' + g.id + '\\')">' + g.name + '</div>').join('');
    }

    function clearHistory() { localStorage.removeItem(RECENT_KEY); renderRecents(); }
    function setAndFetch(id) { document.getElementById('placeId').value = id; fetchStats(); }

    function copyData() {
        if (!currentData) return;
        const report = "Game: " + currentData.game.name + "\\n" +
                       "ID: " + currentPlaceId + "\\n" +
                       "Creator: " + currentData.game.creator.name + "\\n" +
                       "Players: " + currentData.game.playing + "\\n" +
                       "Visits: " + currentData.game.visits;
        navigator.clipboard.writeText(report).then(() => alert("Report Copied."));
    }
</script>
</body>
</html>
`;
