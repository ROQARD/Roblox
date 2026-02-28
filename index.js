export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Updated Proxy List for 2026 Stability
    const PROXIES = ["rotunnel.com", "roproxy.com"];

    if (url.pathname.startsWith("/api/")) {
      const apiHeaders = { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      };

      const tryFetch = async (subdomain, endpoint) => {
        let lastError = "";
        for (let proxy of PROXIES) {
          try {
            const target = `https://${subdomain}.${proxy}${endpoint}`;
            const res = await fetch(target, { 
              headers: { "User-Agent": "RoStats_App_ROQARD" },
              cf: { cacheTtl: 30 } 
            });
            
            if (res.ok) return await res.json();
            lastError = `Proxy ${proxy} returned ${res.status}`;
          } catch (e) { 
            lastError = `Proxy ${proxy} unreachable`;
            continue; 
          }
        }
        throw new Error(lastError || "All Network Paths Blocked");
      };

      try {
        if (url.pathname === "/api/validate-id") {
          const placeId = url.searchParams.get("id");
          const data = await tryFetch('apis', `/universes/v1/places/${placeId}/universe`);
          return new Response(JSON.stringify({ universeId: data.universeId }), { headers: apiHeaders });
        }

        if (url.pathname === "/api/get-stats") {
          const uId = url.searchParams.get("uid");
          
          const [gameData, voteData, favData] = await Promise.all([
            tryFetch('games', `/v1/games?universeIds=${uId}`),
            tryFetch('games', `/v1/games/votes?universeIds=${uId}`),
            tryFetch('games', `/v1/games/${uId}/favorites/count`)
          ]);

          if (!gameData?.data?.[0]) throw new Error("Game is Private");

          return new Response(JSON.stringify({
            game: gameData.data[0],
            votes: voteData?.data?.[0] || { upVotes: 0, downVotes: 0 },
            favorites: favData?.favoritesCount || 0
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
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 22px; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; }
        
        #status { margin-top: 15px; font-size: 0.75rem; font-weight: 600; color: var(--text-dim); min-height: 1.2em; }

        .result-card { display: none; flex-direction: column; gap: 10px; animation: fadeIn 0.4s ease; }
        .header-box { background: var(--glass); border: 1px solid var(--border); padding: 25px; border-radius: 20px; text-align: center; }
        .grid-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .stat-item { background: var(--glass); border: 1px solid var(--border); padding: 15px; border-radius: 16px; text-align: center; }
        .label { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; font-weight: 800; margin-bottom: 4px; }
        .value { font-size: 1.1rem; font-weight: 800; }
        
        .footer { position: fixed; bottom: 20px; right: 25px; font-size: 0.65rem; font-weight: 800; opacity: 0.5; letter-spacing: 2px; }
        .footer a { color: #fff; text-decoration: none; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
<div class="container">
    <div class="search-box">
        <h1>Ro<span style="color:var(--accent)">Stats</span></h1>
        <div class="input-group">
            <input type="text" id="placeId" placeholder="Place ID..." onkeypress="if(event.key === 'Enter') fetchStats()">
            <button class="scan-btn" onclick="fetchStats()">Scan</button>
        </div>
        <div id="status"></div>
    </div>

    <div id="results" class="result-card">
        <div class="header-box">
            <div id="gName" style="font-weight:800; font-size:1.5rem; margin-bottom:5px;">-</div>
            <div id="gCreator" style="color:var(--accent); font-size:0.8rem; font-weight:600;">-</div>
        </div>
        <div class="grid-stats">
            <div class="stat-item"><div class="label">Playing</div><div id="gPlaying" class="value" style="color:var(--accent);">0</div></div>
            <div class="stat-item"><div class="label">Visits</div><div id="gVisits" class="value">0</div></div>
            <div class="stat-item"><div class="label">Rating</div><div id="gRating" class="value">0%</div></div>
        </div>
    </div>
</div>

<div class="footer">
    <a href="https://www.roblox.com/users/9461867215/profile" target="_blank">BY ROQARD</a>
</div>

<script>
    async function fetchStats() {
        const idInput = document.getElementById('placeId').value;
        const id = idInput.match(/\\d+/)?.[0];
        const status = document.getElementById('status');
        const results = document.getElementById('results');

        if (!id) { status.innerText = "Error: Input ID"; return; }
        results.style.display = 'none';
        status.innerText = "Searching Roblox...";
        
        try {
            const vRes = await fetch("/api/validate-id?id=" + id);
            const vData = await vRes.json();
            if (vData.error) throw new Error(vData.error);

            const sRes = await fetch("/api/get-stats?uid=" + vData.universeId);
            const data = await sRes.json();
            if (data.error) throw new Error(data.error);

            const up = data.votes.upVotes || 0;
            const down = data.votes.downVotes || 0;
            const ratio = (up + down) > 0 ? Math.round((up / (up + down)) * 100) : 0;

            document.getElementById('gName').innerText = data.game.name;
            document.getElementById('gCreator').innerText = "By " + data.game.creator.name;
            document.getElementById('gPlaying').innerText = data.game.playing.toLocaleString();
            document.getElementById('gVisits').innerText = data.game.visits.toLocaleString();
            document.getElementById('gRating').innerText = ratio + "%";

            status.innerText = "";
            results.style.display = 'flex';
        } catch (e) {
            status.innerText = "Error: " + e.message;
        }
    }
</script>
</body>
</html>
`;
