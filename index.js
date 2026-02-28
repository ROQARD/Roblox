export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PROXY = "roproxy.com";

    // --- API 1: Validate Place ID ---
    if (url.pathname === "/api/validate-id") {
      const placeId = url.searchParams.get("id");
      try {
        const res = await fetch(`https://apis.${PROXY}/universes/v1/places/${placeId}/universe`);
        if (!res.ok) throw new Error("Invalid Place ID");
        const data = await res.json();
        if (!data.universeId) throw new Error("No Universe ID returned");
        return new Response(JSON.stringify({ universeId: data.universeId }), { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }

    // --- API 2: Fetch Stats (Crash-Proof) ---
    if (url.pathname === "/api/get-stats") {
      const uId = url.searchParams.get("uid");
      try {
        // Fetching individually so one blocked endpoint doesn't break the whole app
        const gameReq = fetch(`https://games.${PROXY}/v1/games?universeIds=${uId}`).then(r => r.ok ? r.json() : null).catch(()=>null);
        const voteReq = fetch(`https://games.${PROXY}/v1/games/votes?universeIds=${uId}`).then(r => r.ok ? r.json() : null).catch(()=>null);
        const favReq = fetch(`https://games.${PROXY}/v1/games/${uId}/favorites/count`).then(r => r.ok ? r.json() : null).catch(()=>null);
        const iconReq = fetch(`https://thumbnails.${PROXY}/v1/universes/icons?universeIds=${uId}&size=150x150&format=Png&isCircular=false`).then(r => r.ok ? r.json() : null).catch(()=>null);

        const [gameData, voteData, favData, iconData] = await Promise.all([gameReq, voteReq, favReq, iconReq]);

        if (!gameData || !gameData.data || gameData.data.length === 0) {
            throw new Error("ID exists, but game data is empty or hidden.");
        }

        const payload = {
          game: gameData.data[0],
          votes: (voteData && voteData.data) ? voteData.data[0] : { upVotes: 0 },
          favorites: favData ? favData.favoritesCount : 0,
          icon: (iconData && iconData.data) ? iconData.data[0].imageUrl : ""
        };

        return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // --- API 3: IMAGE PROXY (Bypasses Device Blocks!) ---
    if (url.pathname === "/api/image") {
      const target = url.searchParams.get("url");
      if (!target) return new Response("No URL", { status: 400 });
      try {
        const imgRes = await fetch(target);
        const headers = new Headers(imgRes.headers);
        headers.set("Access-Control-Allow-Origin", "*"); // Let our frontend read it
        return new Response(imgRes.body, { headers });
      } catch (e) {
        return new Response("Image load failed", { status: 500 });
      }
    }

    // --- FRONTEND ROUTE ---
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
            --bg: #070707;
            --glass: rgba(255, 255, 255, 0.03);
            --border: rgba(255, 255, 255, 0.08);
            --accent: #00ff88;
            --accent-dim: rgba(0, 255, 136, 0.2);
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
        .container { width: 100%; max-width: 600px; }
        .search-box {
            background: var(--glass);
            border: 1px solid var(--border);
            padding: 30px;
            border-radius: 24px;
            text-align: center;
            margin-bottom: 24px;
            backdrop-filter: blur(15px);
        }
        h1 { font-weight: 800; font-size: 2.5rem; margin-bottom: 20px; letter-spacing: -1.5px; }
        .input-group { display: flex; gap: 12px; }
        input {
            flex: 1;
            background: rgba(0,0,0,0.6);
            border: 1px solid var(--border);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            font-size: 1rem;
            outline: none;
        }
        input:focus { border-color: var(--accent); }
        button {
            background: var(--accent);
            color: #000;
            border: none;
            padding: 0 30px;
            border-radius: 12px;
            font-weight: 800;
            cursor: pointer;
            text-transform: uppercase;
        }
        #status { margin-top: 15px; font-size: 0.85rem; font-weight: 600; min-height: 20px; }
        .recent-container { margin-top: 20px; text-align: left; display: none; }
        .recent-title { font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; margin-bottom: 10px; font-weight: 800; }
        .recent-list { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
        .recent-item {
            background: var(--glass);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            min-width: 150px;
        }
        .recent-item img { width: 30px; height: 30px; border-radius: 6px; object-fit: cover; }
        .recent-item span { font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
        .result-card { display: none; flex-direction: column; gap: 12px; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .header-box {
            background: var(--glass);
            border: 1px solid var(--border);
            padding: 20px;
            border-radius: 20px;
            display: flex;
            gap: 20px;
            align-items: center;
        }
        .header-box img { width: 100px; height: 100px; border-radius: 16px; object-fit: cover; border: 1px solid var(--border); background: #111; }
        .grid-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .stat-item { background: var(--glass); border: 1px solid var(--border); padding: 18px; border-radius: 18px; }
        .full-width { grid-column: span 2; }
        .label { font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; font-weight: 800; margin-bottom: 6px; letter-spacing: 1px; }
        .value { font-size: 1.4rem; font-weight: 800; }
        .value-small { font-size: 1rem; font-weight: 600; color: #ccc; }
        .footer-credit { position: fixed; bottom: 20px; right: 25px; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); opacity: 0.6; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
<div class="container">
    <div class="search-box">
        <h1>Ro<span style="color:var(--accent)">Stats</span>.</h1>
        <div class="input-group">
            <input type="text" id="placeId" placeholder="Enter Place ID..." onkeypress="if(event.key === 'Enter') fetchStats()">
            <button id="scanBtn" onclick="fetchStats()">Scan</button>
        </div>
        <div id="status">Ready.</div>
        
        <div id="recentContainer" class="recent-container">
            <div class="recent-title">Recent Searches</div>
            <div id="recentList" class="recent-list"></div>
        </div>
    </div>

    <div id="results" class="result-card">
        <div class="header-box">
            <img id="gIcon" src="">
            <div style="text-align:left;">
                <div id="gName" style="font-weight:800; font-size:1.5rem; margin-bottom:4px;">Experience</div>
                <div id="gCreator" style="color:var(--accent); font-size:0.9rem; font-weight:600;">By Creator</div>
            </div>
        </div>

        <div class="grid-stats">
            <div class="stat-item">
                <div class="label">Playing Now</div>
                <div id="gPlaying" class="value" style="color:var(--accent);">0</div>
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
            <div class="stat-item">
                <div class="label">Created On</div>
                <div id="gCreated" class="value value-small">-</div>
            </div>
            <div class="stat-item">
                <div class="label">Last Updated</div>
                <div id="gUpdated" class="value value-small">-</div>
            </div>
            <div class="stat-item full-width">
                <div class="label">Experience Description</div>
                <div id="gDesc" style="font-size: 0.85rem; color: var(--text-dim); line-height: 1.5; max-height: 100px; overflow-y: auto;">-</div>
            </div>
        </div>
    </div>
</div>

<div class="footer-credit">BY ROQARD</div>

<script>
    const RECENT_KEY = "rostats_history_master";

    window.onload = renderRecents;

    function formatNum(n) {
        if (!n || isNaN(n)) return "0";
        if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
        if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
        if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
        return n.toLocaleString();
    }

    function formatDate(dateString) {
        const d = new Date(dateString);
        return isNaN(d) ? "-" : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    async function fetchStats() {
        const idInput = document.getElementById('placeId').value.trim();
        const id = idInput.match(/\\d+/)?.[0];
        
        const status = document.getElementById('status');
        const results = document.getElementById('results');

        if (!id) {
            status.innerText = "Error: Please enter a valid numerical Place ID.";
            status.style.color = "var(--error)";
            return;
        }

        results.style.display = 'none';
        
        try {
            // STEP 1
            status.innerText = "Validating Place ID...";
            status.style.color = "var(--text-dim)";
            
            const valRes = await fetch("/api/validate-id?id=" + id);
            const valData = await valRes.json();
            if (valData.error) throw new Error(valData.error);
            const uId = valData.universeId;

            // STEP 2
            status.innerText = "Extracting Experience Data...";
            
            const statRes = await fetch("/api/get-stats?uid=" + uId);
            const statData = await statRes.json();
            if (statData.error) throw new Error(statData.error);

            // Populate Text
            document.getElementById('gName').innerText = statData.game.name || "Unknown";
            document.getElementById('gCreator').innerText = "By " + (statData.game.creator ? statData.game.creator.name : "Unknown");
            document.getElementById('gPlaying').innerText = formatNum(statData.game.playing);
            document.getElementById('gVisits').innerText = formatNum(statData.game.visits);
            document.getElementById('gFavs').innerText = formatNum(statData.favorites);
            document.getElementById('gLikes').innerText = formatNum(statData.votes.upVotes);
            document.getElementById('gCreated').innerText = formatDate(statData.game.created);
            document.getElementById('gUpdated').innerText = formatDate(statData.game.updated);
            document.getElementById('gDesc').innerText = statData.game.description || "No description provided.";
            
            // Proxy the Image so it bypasses device blocks
            let finalIconUrl = "";
            if (statData.icon) {
                finalIconUrl = "/api/image?url=" + encodeURIComponent(statData.icon);
                document.getElementById('gIcon').src = finalIconUrl;
            }

            saveRecent(id, statData.game.name, finalIconUrl);

            status.innerText = "Data Secure.";
            status.style.color = "var(--accent)";
            results.style.display = 'flex';

        } catch (e) {
            status.innerText = "Error: " + e.message;
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
        
        if (recents.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        list.innerHTML = recents.map(g => 
            \`<div class="recent-item" onclick="setAndFetch('\${g.id}')">
                <img src="\${g.icon || ''}">
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
