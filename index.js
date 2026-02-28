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
              headers: { "User-Agent": "RoStats_Intelligence_ROQARD" }
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
        :root { --bg: #050505; --card: #0c0c0c; --border: #1a1a1a; --accent: #4ade80; --text: #fff; --dim: #71717a; --warn: #ff4444; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 40px 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        .container { width: 100%; max-width: 650px; padding-bottom: 100px; }

        .search-area { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 24px; text-align: center; margin-bottom: 15px; }
        .input-box { display: flex; gap: 10px; background: #000; padding: 6px; border-radius: 14px; border: 1px solid var(--border); }
        input { flex: 1; background: transparent; border: none; color: white; padding: 10px 15px; font-size: 1rem; outline: none; }
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 25px; border-radius: 10px; font-weight: 800; cursor: pointer; text-transform: uppercase; }
        
        .dashboard { display: none; flex-direction: column; gap: 12px; animation: slideUp 0.4s ease; }
        .box { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 16px; text-align: center; position: relative; }
        .label { font-size: 0.6rem; color: var(--dim); text-transform: uppercase; font-weight: 800; margin-bottom: 4px; }
        .val { font-size: 1.2rem; font-weight: 800; }
        
        .tag { font-size: 0.55rem; font-weight: 900; padding: 2px 6px; border-radius: 4px; margin-top: 5px; display: inline-block; }
        .tag-good { background: rgba(74, 222, 128, 0.2); color: var(--accent); }
        .tag-bad { background: rgba(255, 68, 68, 0.2); color: var(--warn); }
        .tag-neutral { background: rgba(255, 255, 255, 0.1); color: var(--dim); }

        .info-card { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); padding: 20px; border-radius: 20px; }
        .briefing-title { font-size: 0.7rem; font-weight: 800; color: var(--dim); text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
        .briefing-text { font-size: 0.85rem; color: #d4d4d8; line-height: 1.5; }

        .content-card { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 20px; }
        .full-desc { font-size: 0.9rem; color: #a1a1aa; line-height: 1.7; white-space: pre-wrap; margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px; }
        
        .play-btn { background: #fff; color: #000; text-decoration: none; text-align: center; padding: 18px; border-radius: 18px; font-weight: 800; text-transform: uppercase; margin-top: 5px; display: block; }
        
        /* Minimalist Credit Button */
        .footer { position: fixed; bottom: 20px; right: 25px; z-index: 9999; }
        .footer-link { color: var(--dim); text-decoration: none; font-size: 0.7rem; font-weight: 800; letter-spacing: 2px; background: transparent; border: none; padding: 10px; display: block; opacity: 0.6; }
        .footer-link:hover { opacity: 1; color: #fff; }

        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-area">
            <h1 style="font-size: 2.2rem; margin-bottom:20px;">Ro<span style="color:var(--accent)">Stats</span></h1>
            <div class="input-box">
                <input type="text" id="placeId" placeholder="Paste Place ID here...">
                <button class="scan-btn" onclick="run()">Analyze</button>
            </div>
            <div id="status" style="margin-top:10px; font-size:0.7rem; color:var(--dim);">Ready</div>
        </div>

        <div id="results" class="dashboard">
            <div class="box" style="padding: 30px;">
                <h2 id="gTitle">-</h2>
                <a id="gOwner" style="color:var(--accent); text-decoration:none; font-size:0.9rem; font-weight:600; margin-top:5px; display:inline-block;" target="_blank">-</a>
            </div>

            <div class="info-card">
                <div class="briefing-title">Intelligence Briefing</div>
                <div id="briefing" class="briefing-text">Crunching numbers...</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="box"><div class="label">Playing</div><div id="vPlay" class="val">-</div><div id="tPlay" class="tag"></div></div>
                <div class="box"><div class="label">Rating</div><div id="vRate" class="val">-</div><div id="tRate" class="tag"></div></div>
                <div class="box"><div class="label">Dislikes</div><div id="vDis" class="val" style="color:var(--warn)">-</div><div id="tDis" class="tag"></div></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="box"><div class="label">Visits</div><div id="vVisit" class="val">-</div></div>
                <div class="box"><div class="label">Likes</div><div id="vLike" class="val">-</div></div>
                <div class="box"><div class="label">Favorites</div><div id="vFav" class="val">-</div></div>
            </div>

            <div class="content-card">
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--dim);">
                    <span><b>Created:</b> <span id="dCreate" style="color:#fff"></span></span>
                    <span><b>Updated:</b> <span id="dUpdate" style="color:#fff"></span></span>
                </div>
                <div id="gDesc" class="full-desc"></div>
            </div>

            <a id="robloxLink" class="play-btn" target="_blank">Open Experience</a>
        </div>
    </div>

    <div class="footer">
        <a href="https://www.roblox.com/users/9461867215/profile" class="footer-link" target="_blank">BY ROQARD</a>
    </div>

    <script>
        let itv;
        const fmt = x => x >= 1e6 ? (x/1e6).toFixed(1)+'M' : x >= 1e3 ? (x/1e3).toFixed(1)+'K' : x.toLocaleString();

        function setTag(id, text, type) {
            const el = document.getElementById(id);
            el.innerText = text;
            el.className = 'tag tag-' + type;
            el.style.display = text ? 'inline-block' : 'none';
        }

        async function run() {
            if(itv) clearInterval(itv);
            await update();
            itv = setInterval(update, 30000);
        }

        async function update() {
            const idInput = document.getElementById('placeId').value;
            const id = idInput.match(/\\d+/)?.[0];
            if(!id) return;

            try {
                const v = await fetch("/api/validate-id?id=" + id).then(r => r.json());
                const d = await fetch("/api/get-stats?uid=" + v.universeId).then(r => r.json());
                const g = d.game;

                const up = d.votes.upVotes || 0;
                const down = d.votes.downVotes || 0;
                const rate = (up + down) > 0 ? Math.round((up / (up + down)) * 100) : 0;
                const fRatio = ((d.favorites / g.visits) * 1000).toFixed(1);

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
                document.getElementById('gDesc').innerText = g.description || "No description.";
                document.getElementById('robloxLink').href = "https://www.roblox.com/games/" + id;

                // Simple Explainer Briefing
                let brief = "This game has a ";
                if(rate >= 80) brief += "<b>very positive</b> reputation. ";
                else if(rate < 60) brief += "<b>mixed</b> reputation, meaning some players find issues. ";
                else brief += "<b>stable</b> reputation. ";

                if(g.playing > 5000) brief += "Current traffic is <b>high</b>, showing strong community interest.";
                else brief += "Current traffic is <b>moderate</b> for this size of experience.";

                document.getElementById('briefing').innerHTML = brief;

                // Tag Logic
                if(g.playing > 20000) setTag('tPlay', 'Viral', 'good');
                else if(g.playing < 20 && g.visits > 10000) setTag('tPlay', 'Inactive', 'bad');
                else setTag('tPlay', 'Stable', 'neutral');

                if(rate >= 85) setTag('tRate', 'Loved', 'good');
                else if(rate < 65) setTag('tRate', 'Controversial', 'bad');
                else setTag('tRate', 'Fair', 'neutral');

                if(down > up * 0.5) setTag('tDis', 'High Dislikes', 'bad');
                else setTag('tDis', 'Clean Record', 'good');

                document.getElementById('results').style.display = 'flex';
                document.getElementById('status').innerText = "Live tracking active";
            } catch (e) {
                document.getElementById('status').innerText = "Error: Proxy Busy";
            }
        }
    </script>
</body>
</html>
