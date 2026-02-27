export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 1. BACKEND API ROUTE
    if (url.pathname === "/api/get-stats") {
      const placeId = url.searchParams.get("id");
      if (!placeId) return new Response(JSON.stringify({ error: "No ID provided" }), { status: 400 });

      const PROXY = "roproxy.com";

      try {
        // Step A: Convert Place ID to Universe ID
        const uniRes = await fetch(`https://apis.${PROXY}/universes/v1/places/${placeId}/universe`);
        if (!uniRes.ok) throw new Error("Invalid Place ID");
        const uniData = await uniRes.json();
        const uId = uniData.universeId;

        // Step B: Fetch all data using Universe ID
        const [gameRes, voteRes, favRes, iconRes] = await Promise.all([
          fetch(`https://games.${PROXY}/v1/games?universeIds=${uId}`),
          fetch(`https://games.${PROXY}/v1/games/votes?universeIds=${uId}`),
          fetch(`https://games.${PROXY}/v1/games/${uId}/favorites/count`),
          fetch(`https://thumbnails.${PROXY}/v1/universes/icons?universeIds=${uId}&size=150x150&format=Png&isCircular=false`)
        ]);

        const gameData = await gameRes.json();
        const voteData = await voteRes.json();
        const favData = await favRes.json();
        const iconData = await iconRes.json();

        if (!gameData.data || gameData.data.length === 0) throw new Error("Game data missing");

        const payload = {
          game: gameData.data[0],
          votes: voteData.data[0] || { upVotes: 0 },
          favorites: favData.favoritesCount || 0,
          icon: iconData.data?.[0]?.imageUrl || ""
        };

        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 2. FRONTEND ROUTE
    return new Response(html, {
      headers: { "Content-Type": "text/html" }
    });
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
            --bg: #0a0a0a;
            --glass: rgba(255, 255, 255, 0.03);
            --border: rgba(255, 255, 255, 0.08);
            --accent: #00ff88;
            --text: #ffffff;
            --text-dim: #999;
            --error: #ff4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: 'Inter', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 20px;
            min-height: 100vh;
        }
        .container { width: 100%; max-width: 550px; }
        .search-box {
            background: var(--glass);
            border: 1px solid var(--border);
            padding: 30px;
            border-radius: 24px;
            text-align: center;
            margin-bottom: 24px;
            backdrop-filter: blur(10px);
        }
        h1 { font-weight: 800; font-size: 2.5rem; margin-bottom: 20px; letter-spacing: -1.5px; }
        .input-group { display: flex; gap: 12px; }
        input {
            flex: 1;
            background: rgba(0,0,0,0.4);
            border: 1px solid var(--border);
            color: white;
            padding: 14px 18px;
            border-radius: 12px;
            font-size: 1rem;
            outline: none;
        }
        input:focus { border-color: var(--accent); }
        button {
            background: var(--accent);
            color: #000;
            border: none;
            padding: 0 28px;
            border-radius: 12px;
            font-weight: 800;
            cursor: pointer;
            text-transform: uppercase;
        }
        #status { margin-top: 15px; font-size: 0.85rem; min-height: 20px; }
        .recent-container { margin-top: 20px; text-align: left; display: none; }
        .recent-title { font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; margin-bottom: 10px; font-weight: 700; }
        .recent-list { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
        .recent-item {
            background: var(--glass);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            min-width: 140px;
            transition: 0.2s;
        }
        .recent-item:hover { border-color: var(--accent); }
        .recent-item img { width: 28px; height: 28px; border-radius: 6px; }
        .recent-item span { font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .result-card { display: none; flex-direction: column; gap: 12px; animation: slideUp 0.4s ease; }
        .header-box {
            background: var(--glass);
            border: 1px solid var(--border);
            padding: 20px;
            border-radius: 20px;
            display: flex;
            gap: 20px;
            align-items: center;
        }
        .header-box img { width: 100px; height: 100px; border-radius: 15px; object-fit: cover; }
        .grid-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .stat-item { background: var(--glass); border: 1px solid var(--border); padding: 18px; border-radius: 18px; }
        .full-width { grid-column: span 2; }
        .label { font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
        .value { font-size: 1.4rem; font-weight: 800; }
        .footer-credit { position: fixed; bottom: 20px; right: 25px; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); opacity: 0.6; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
<div class="container">
    <div class="search-box">
        <h1>Ro<span style="color:var(--accent)">Stats</span>.</h1>
        <div class="input-group">
            <input type="text" id="placeId" placeholder="Enter Place ID...">
            <button onclick="fetchStats()">Scan</button>
        </div>
        <div id="status"></div>
        <div id="recentContainer" class="recent-container">
            <div class="recent-title">Recent Searches</div>
            <div id="recentList" class="recent-list"></div>
        </div>
    </div>
    <div id="results" class="result-card">
        <div class="header-box">
            <img id="gIcon" src="">
            <div style="text-align:left;">
                <div id="gName" style="font-weight:800; font-size:1.4rem;">Experience</div>
                <div id="gCreator" style="color:var(--accent); font-size:0.9rem;">By Creator</div>
            </div>
        </div>
        <div class="grid-stats">
            <div class="stat-item">
                <div class="label">Playing Now</div>
                <div id="gPlaying" class="value" style="color:var(--accent)">0</div>
            </div>
            <div class="stat-item">
                <div class="label">Total Visits</div>
                <div id="gVisits" class="value">0</div>
            </div>
            <div class="stat-item">
                <div class="label">Favorites</div>
                <div id="gFavs" class="value">0</div>
            </div>
            <div class="stat-item">
                <div class="label">Likes</div>
                <div id="gLikes" class="value">0</div>
            </div>
            <div class="stat-item full-width">
                <div class="label">About</div>
                <div id="gDesc" style="font-size: 0.85rem; color: var(--text-dim); line-height: 1.5; max-height: 100px; overflow-y: auto;">-</div>
            </div>
        </div>
    </div>
</div>
<div class="footer-credit">BY ROQARD</div>

<script>
    const RECENT_KEY = "rostats_history_v3";

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

        if (!id) {
            status.innerText = "Error: Please enter a Place ID.";
            status.style.color = "var(--error)";
            return;
        }

        status.innerText = "Synchronizing Protocol...";
        status.style.color = "var(--text-dim)";
        results.style.display = 'none';

        try {
            const res = await fetch("/api/get-stats?id=" + id);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            document.getElementById('gName').innerText = data.game.name;
            document.getElementById('gCreator').innerText = "By " + data.game.creator.name;
            document.getElementById('gPlaying').innerText = formatNum(data.game.playing);
            document.getElementById('gVisits').innerText = formatNum(data.game.visits);
            document.getElementById('gFavs').innerText = formatNum(data.favorites);
            document.getElementById('gLikes').innerText = formatNum(data.votes.upVotes);
            document.getElementById('gDesc').innerText = data.game.description || "No description.";
            document.getElementById('gIcon').src = data.icon;

            saveRecent(id, data.game.name, data.icon);
            status.innerText = "Data Secure.";
            status.style.color = "var(--accent)";
            results.style.display = 'flex';
        } catch (e) {
            status.innerText = "Error: System Offline or Invalid ID.";
            status.style.color = "var(--error)";
        }
    }

    function saveRecent(id, name, icon) {
        let recents = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
        recents = recents.filter(i => i.id !== id);
        recents.unshift({ id, name, icon });
        localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(0, 5)));
        renderRecents();
    }

    function renderRecents() {
        const recents = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
        const container = document.getElementById('recentContainer');
        const list = document.getElementById('recentList');
        if (recents.length === 0) return;
        container.style.display = 'block';
        list.innerHTML = recents.map(g => 
            \`<div class="recent-item" onclick="setAndFetch('\${g.id}')">
                <img src="\${g.icon}">
                <span>\${g.name}</span>
            </div>\`
        ).join('');
    }

    function setAndFetch(id) {
        document.getElementById('placeId').value = id;
        fetchStats();
    }
</script>
</body>
</html>
`;
