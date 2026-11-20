const COOKIE_NAME = "younj_admin";
const encoder = new TextEncoder();

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function html(body, status=200) {
  return new Response(body, {status, headers: {"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
}
function b64(bytes) {
  let s=""; for (const b of new Uint8Array(bytes)) s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function unb64(s) {
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4) s+="=";
  return Uint8Array.from(atob(s), c=>c.charCodeAt(0));
}
async function hmac(secret, value) {
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64(await crypto.subtle.sign("HMAC",key,encoder.encode(value)));
}
async function makeCookie(env) {
  const exp=Math.floor(Date.now()/1000)+Number(env.SESSION_TTL_HOURS||12)*3600;
  const payload=b64(encoder.encode(JSON.stringify({exp,nonce:crypto.randomUUID()})));
  return `${payload}.${await hmac(env.ADMIN_PASSWORD,payload)}`;
}
async function authorized(request, env) {
  const cookie=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE_NAME+"="));
  if(!cookie) return false;
  const token=cookie.slice(COOKIE_NAME.length+1), parts=token.split(".");
  if(parts.length!==2) return false;
  const sig=await hmac(env.ADMIN_PASSWORD,parts[0]);
  if(sig!==parts[1]) return false;
  try { return JSON.parse(new TextDecoder().decode(unb64(parts[0]))).exp>Date.now()/1000; } catch { return false; }
}
function cookieHeader(value, maxAge=43200) {
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
function slugify(s) { return s.toLowerCase().trim().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,48); }
function validUrl(value) {
  try { const u=new URL(value); return ["http:","https:"].includes(u.protocol); } catch { return false; }
}
function uaInfo(ua="") {
  const device=/ipad|tablet/i.test(ua)?"Tablet":/mobile|iphone|android/i.test(ua)?"Mobile":"Desktop";
  const browser=/edg\//i.test(ua)?"Edge":/firefox\//i.test(ua)?"Firefox":/chrome\//i.test(ua)?"Chrome":/safari\//i.test(ua)?"Safari":"Other";
  return {device,browser};
}
async function log(env, action, detail="") {
  await env.DB.prepare("INSERT INTO audit_logs(action,detail) VALUES(?,?)").bind(action,detail).run();
}
async function bodyJson(req) { try { return await req.json(); } catch { return {}; } }

const LOGIN_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YOUNJ Admin</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;font:15px Inter,system-ui;color:#182230;display:grid;place-items:center;min-height:100vh}.panel{width:min(420px,92vw);background:white;border:1px solid #e5eaf1;border-radius:18px;padding:30px;box-shadow:0 18px 50px #20334d12}h1{font-size:24px;margin:0 0 6px}.muted{color:#718096;margin:0 0 24px}label{display:block;font-weight:600;margin:14px 0 7px}input{width:100%;padding:13px;border:1px solid #d8e0ea;border-radius:10px;font:inherit}button{width:100%;border:0;background:#2563eb;color:white;padding:13px;border-radius:10px;font-weight:700;margin-top:18px;cursor:pointer}.err{color:#dc2626;margin-top:12px;min-height:20px}</style></head><body><form class="panel" id="f"><h1>YOUNJ LINK MANAGER</h1><p class="muted">Khu vực quản trị riêng tư</p><label>Mật khẩu Admin</label><input id="password" type="password" autocomplete="current-password" required autofocus><button>Đăng nhập</button><div class="err" id="err"></div></form><script>f.onsubmit=async e=>{e.preventDefault();err.textContent='Đang xác thực...';const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:password.value})});if(r.ok)location.href='/';else err.textContent='Mật khẩu không đúng hoặc máy chủ chưa cấu hình ADMIN_PASSWORD.'}</script></body></html>`;

const APP_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YOUNJ LINK MANAGER</title><style>
:root{--blue:#2563eb;--ink:#172033;--muted:#718096;--line:#e6ebf2;--bg:#f5f7fb}*{box-sizing:border-box}body{margin:0;background:var(--bg);font:14px Inter,system-ui,-apple-system,sans-serif;color:var(--ink)}button,input,select,textarea{font:inherit}button{cursor:pointer}.layout{display:flex;min-height:100vh}.side{width:245px;background:#fff;border-right:1px solid var(--line);padding:24px 16px;flex-shrink:0}.brand{font-size:17px;font-weight:850;letter-spacing:.2px;padding:5px 10px 26px}.brand span{color:var(--blue)}.nav{display:grid;gap:6px}.nav button{border:0;background:transparent;text-align:left;padding:12px;border-radius:10px;color:#596579;font-weight:600}.nav button.active,.nav button:hover{background:#edf3ff;color:var(--blue)}.main{min-width:0;flex:1;padding:28px clamp(16px,3vw,38px)}.top{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:25px}.top h1{font-size:24px;margin:0}.muted{color:var(--muted)}.btn{border:0;background:var(--blue);color:white;border-radius:9px;padding:10px 14px;font-weight:700}.btn.secondary{background:#edf2f8;color:#344054}.btn.danger{background:#feecec;color:#c62828}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.card,.panel{background:white;border:1px solid var(--line);border-radius:14px;padding:18px}.metric{font-size:28px;font-weight:800;margin-top:8px}.panel{margin-bottom:16px}.panel h3{margin:0 0 15px;font-size:16px}.tablewrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:700px}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #edf0f4;white-space:nowrap}th{font-size:12px;color:#748094;background:#fbfcfe}td{font-size:13px}.pill{display:inline-block;padding:4px 8px;border-radius:30px;background:#eaf7ef;color:#16834a;font-size:12px}.pill.off{background:#f1f3f6;color:#667085}.actions{display:flex;gap:6px}.small{padding:7px 9px;font-size:12px}.formgrid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.field label{display:block;font-weight:650;margin:0 0 6px}.field input,.field textarea,.field select{width:100%;border:1px solid #d9e1eb;border-radius:9px;padding:10px;background:white}.field.full{grid-column:1/-1}.field textarea{min-height:85px}.toolbar{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:13px}.toolbar input{padding:10px;border:1px solid var(--line);border-radius:9px;min-width:220px}.chart{height:190px;display:flex;align-items:end;gap:8px;padding:14px 5px 0}.barwrap{height:100%;flex:1;display:flex;flex-direction:column;justify-content:end;align-items:center;gap:7px;min-width:0}.bar{width:100%;max-width:42px;background:linear-gradient(180deg,#60a5fa,#2563eb);border-radius:6px 6px 2px 2px;min-height:3px}.barlabel{font-size:10px;color:#8792a3}.hidden{display:none!important}.notice{padding:12px;border-radius:9px;background:#eff6ff;color:#1d4ed8;margin-bottom:14px}.right{display:flex;gap:8px;align-items:center}.empty{text-align:center;color:#8893a4;padding:28px}.toast{position:fixed;right:20px;bottom:20px;background:#152238;color:white;padding:12px 16px;border-radius:10px;display:none;z-index:5}@media(max-width:900px){.cards{grid-template-columns:repeat(2,1fr)}.side{width:190px}}@media(max-width:650px){.layout{display:block}.side{width:100%;padding:12px;border-right:0;border-bottom:1px solid var(--line)}.brand{padding:7px 8px 12px}.nav{display:flex;overflow:auto}.nav button{white-space:nowrap;padding:9px}.main{padding:18px 12px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.formgrid{grid-template-columns:1fr}.field.full{grid-column:auto}.top h1{font-size:20px}}
</style></head><body><div class="layout"><aside class="side"><div class="brand">YOUNJ <span>LINK MANAGER</span></div><nav class="nav"><button data-page="dashboard" class="active">▦　Dashboard</button><button data-page="links">↗　Quản lý liên kết</button><button data-page="visits">◷　Lượt truy cập</button><button data-page="settings">⚙　Cài đặt</button><button data-page="logs">☷　Nhật ký</button><button id="logout">⇥　Đăng xuất</button></nav></aside><main class="main"><div class="top"><div><h1 id="heading">Dashboard</h1><div class="muted" id="subtitle">Tổng quan hoạt động hệ thống</div></div><div class="right"><span class="pill">ADMIN</span></div></div><section id="view"></section></main></div><div class="toast" id="toast"></div>
<script>
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let page='dashboard', links=[];
async function api(path,opts={}){const r=await fetch('/api/'+path,{...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});if(r.status===401){location.href='/login';throw Error('Phiên đăng nhập hết hạn')}const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Có lỗi xảy ra');return d}
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',2600)}
function setPage(p){page=p;document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#heading').textContent=({dashboard:'Dashboard',links:'Quản lý liên kết',visits:'Quản lý lượt truy cập',settings:'Cài đặt hệ thống',logs:'Nhật ký hệ thống'})[p];$('#subtitle').textContent=({dashboard:'Tổng quan hoạt động hệ thống',links:'Tạo và quản lý các liên kết',visits:'Theo dõi lịch sử truy cập',settings:'Tùy chỉnh website YOUNJ',logs:'Theo dõi hoạt động quản trị'})[p];render()}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));$('#logout').onclick=async()=>{await api('logout',{method:'POST'});location.href='/login'};
async function render(){try{if(page==='dashboard')await dashboard();if(page==='links')await linkPage();if(page==='visits')await visitsPage();if(page==='settings')await settingsPage();if(page==='logs')await logsPage()}catch(e){$('#view').innerHTML='<div class="notice">'+esc(e.message)+'</div>'}}
async function dashboard(){const d=await api('stats');const max=Math.max(1,...d.daily.map(x=>x.count));$('#view').innerHTML=\`
<div class="cards"><div class="card"><div class="muted">Tổng liên kết</div><div class="metric">\${d.total_links}</div></div><div class="card"><div class="muted">Tổng lượt truy cập</div><div class="metric">\${d.total_visits}</div></div><div class="card"><div class="muted">Lượt hôm nay</div><div class="metric">\${d.today_visits}</div></div><div class="card"><div class="muted">Link đang bật</div><div class="metric">\${d.active_links}</div></div></div>
<div class="panel"><h3>Lượt truy cập 7 ngày gần nhất</h3><div class="chart">\${d.daily.map(x=>\`<div class="barwrap"><div class="bar" style="height:\${Math.max(2,x.count/max*145)}px" title="\${x.count} lượt"></div><div class="barlabel">\${esc(x.day.slice(5))}</div></div>\`).join('')}</div></div>
<div class="panel"><h3>Liên kết mới nhất</h3>\${linkTable(d.latest||[],true)}</div>\`}
function linkTable(rows,compact=false){if(!rows.length)return '<div class="empty">Chưa có liên kết nào</div>';return '<div class="tablewrap"><table><thead><tr><th>Mã link</th><th>Tiêu đề</th><th>Link đích</th><th>Lượt truy cập</th><th>Trạng thái</th>'+(compact?'':'<th>Thao tác</th>')+'</tr></thead><tbody>'+rows.map(x=>'<tr><td><b>/r/'+esc(x.slug)+'</b></td><td>'+esc(x.title||'—')+'</td><td title="'+esc(x.destination_url)+'">'+esc(x.destination_url).slice(0,48)+'</td><td>'+x.visits+'</td><td><span class="pill '+(x.enabled?'':'off')+'">'+(x.enabled?'Đang bật':'Đã tắt')+'</span></td>'+(compact?'':'<td><div class="actions"><button class="btn secondary small" onclick="editLink('+x.id+')">Sửa</button><button class="btn secondary small" onclick="toggleLink('+x.id+','+(x.enabled?0:1)+')">'+(x.enabled?'Tắt':'Bật')+'</button><button class="btn danger small" onclick="deleteLink('+x.id+')">Xóa</button></div></td>')+'</tr>').join('')+'</tbody></table></div>'}
async function linkPage(){links=(await api('links')).links;$('#view').innerHTML='<div class="panel"><h3 id="formtitle">Thêm liên kết mới</h3><form id="linkform" class="formgrid"><input type="hidden" id="linkid"><div class="field"><label>Tiêu đề</label><input id="title" placeholder="Ví dụ: Link tài liệu"></div><div class="field"><label>Mã link (slug)</label><input id="slug" placeholder="tai-lieu-moi"></div><div class="field full"><label>Link đích (https://...)</label><input id="dest" type="url" required placeholder="https://example.com"></div><div class="field full"><button class="btn">Lưu liên kết</button> <button type="button" class="btn secondary" onclick="resetForm()">Làm mới</button></div></form></div><div class="panel"><div class="toolbar"><input id="search" placeholder="Tìm theo mã link hoặc tiêu đề..."></div><div id="linklist"></div></div>';$('#linklist').innerHTML=linkTable(links);$('#search').oninput=()=>$('#linklist').innerHTML=linkTable(links.filter(x=>(x.slug+' '+x.title+' '+x.destination_url).toLowerCase().includes($('#search').value.toLowerCase())));$('#linkform').onsubmit=saveLink}
function resetForm(){$('#linkid').value='';$('#title').value='';$('#slug').value='';$('#dest').value='';$('#formtitle').textContent='Thêm liên kết mới'}
window.editLink=id=>{const x=links.find(a=>a.id===id);if(!x)return;$('#linkid').value=x.id;$('#title').value=x.title;$('#slug').value=x.slug;$('#dest').value=x.destination_url;$('#formtitle').textContent='Chỉnh sửa liên kết';window.scrollTo({top:0,behavior:'smooth'})};
async function saveLink(e){e.preventDefault();try{await api('links',{method:'POST',body:JSON.stringify({id:$('#linkid').value||null,title:$('#title').value,slug:$('#slug').value,destination_url:$('#dest').value})});toast('Đã lưu liên kết');linkPage()}catch(e){toast(e.message)}}
window.toggleLink=async(id,enabled)=>{try{await api('links/'+id,{method:'PATCH',body:JSON.stringify({enabled})});toast('Đã cập nhật trạng thái');linkPage()}catch(e){toast(e.message)}};
window.deleteLink=async id=>{if(!confirm('Xóa liên kết này? Lịch sử truy cập vẫn được giữ.'))return;try{await api('links/'+id,{method:'DELETE'});toast('Đã xóa liên kết');linkPage()}catch(e){toast(e.message)}};
async function visitsPage(){const d=await api('visits');$('#view').innerHTML='<div class="cards"><div class="card"><div class="muted">Tổng lượt truy cập</div><div class="metric">'+d.total+'</div></div><div class="card"><div class="muted">Hôm nay</div><div class="metric">'+d.today+'</div></div></div><div class="panel"><h3>Lịch sử truy cập gần đây</h3><div class="tablewrap"><table><thead><tr><th>Thời gian</th><th>Mã link</th><th>Kết quả</th><th>Quốc gia</th><th>Thiết bị</th><th>Trình duyệt</th><th>Giới thiệu</th></tr></thead><tbody>'+(d.rows.length?d.rows.map(x=>'<tr><td>'+esc(x.visited_at)+'</td><td>'+esc(x.slug)+'</td><td>'+esc(x.outcome)+'</td><td>'+esc(x.country||'—')+'</td><td>'+esc(x.device||'—')+'</td><td>'+esc(x.browser||'—')+'</td><td>'+esc(x.referrer||'—').slice(0,40)+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">Chưa có dữ liệu</td></tr>')+'</tbody></table></div></div>'}
async function settingsPage(){const d=await api('settings');const s=d.settings;$('#view').innerHTML='<div class="panel"><h3>Cấu hình website</h3><form id="settingsform" class="formgrid"><div class="field"><label>Tên website</label><input name="site_name" value="'+esc(s.site_name)+'"></div><div class="field"><label>Logo / chữ thương hiệu</label><input name="logo_text" value="'+esc(s.logo_text)+'"></div><div class="field"><label>Favicon URL</label><input name="favicon_url" value="'+esc(s.favicon_url)+'" placeholder="https://..."></div><div class="field"><label>Thời gian chờ (giây)</label><input name="wait_seconds" type="number" min="0" max="120" value="'+esc(s.wait_seconds)+'"></div><div class="field full"><label>Nội dung trang vượt link</label><textarea name="interstitial_message">'+esc(s.interstitial_message)+'</textarea></div><div class="field"><label>Chế độ bảo trì</label><select name="maintenance"><option value="0" '+(s.maintenance==='0'?'selected':'')+'>Tắt</option><option value="1" '+(s.maintenance==='1'?'selected':'')+'>Bật</option></select></div><div class="field full"><button class="btn">Lưu cài đặt</button></div></form></div>';$('#settingsform').onsubmit=async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.target));try{await api('settings',{method:'POST',body:JSON.stringify(obj)});toast('Đã lưu cài đặt')}catch(e){toast(e.message)}}}
async function logsPage(){const d=await api('logs');$('#view').innerHTML='<div class="panel"><h3>Nhật ký hoạt động</h3><div class="tablewrap"><table><thead><tr><th>Thời gian</th><th>Hành động</th><th>Chi tiết</th></tr></thead><tbody>'+(d.rows.length?d.rows.map(x=>'<tr><td>'+esc(x.created_at)+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.detail)+'</td></tr>').join(''):'<tr><td colspan="3" class="empty">Chưa có nhật ký</td></tr>')+'</tbody></table></div></div>'}
render();
</script></body></html>`;

async function handleApi(request, env, url) {
  const path=url.pathname.replace(/^\/api\/?/,"");
  if(path==="login" && request.method==="POST"){
    const b=await bodyJson(request);
    if(!env.ADMIN_PASSWORD) return json({error:"Chưa cấu hình ADMIN_PASSWORD"},500);
    if(typeof b.password!=="string" || b.password!==env.ADMIN_PASSWORD) return json({error:"Sai mật khẩu"},401);
    const token=await makeCookie(env);
    await log(env,"admin_login","Đăng nhập thành công");
    return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":cookieHeader(token,Number(env.SESSION_TTL_HOURS||12)*3600),"cache-control":"no-store"}});
  }
  if(path==="logout" && request.method==="POST"){
    return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":cookieHeader("",0)}});
  }
  if(!await authorized(request,env)) return json({error:"Unauthorized"},401);
  if(path==="stats" && request.method==="GET"){
    const [a,b,c,d,latest]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM links").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM visits").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM visits WHERE date(visited_at)=date('now')").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM links WHERE enabled=1").first(),
      env.DB.prepare("SELECT l.*, (SELECT COUNT(*) FROM visits v WHERE v.link_id=l.id) visits FROM links l ORDER BY l.id DESC LIMIT 8").all()
    ]);
    const daily=await env.DB.prepare("SELECT date(visited_at) day,COUNT(*) count FROM visits WHERE visited_at>=datetime('now','-6 days') GROUP BY date(visited_at) ORDER BY day").all();
    const map=new Map((daily.results||[]).map(x=>[x.day,x.count]));
    const days=Array.from({length:7},(_,i)=>{const dt=new Date();dt.setUTCDate(dt.getUTCDate()-(6-i));const day=dt.toISOString().slice(0,10);return {day,count:map.get(day)||0}});
    return json({total_links:a.n,total_visits:b.n,today_visits:c.n,active_links:d.n,daily:days,latest:latest.results});
  }
  if(path==="links" && request.method==="GET"){
    const r=await env.DB.prepare("SELECT l.*, (SELECT COUNT(*) FROM visits v WHERE v.link_id=l.id) visits FROM links l ORDER BY l.id DESC").all();
    return json({links:r.results});
  }
  if(path==="links" && request.method==="POST"){
    const b=await bodyJson(request), slug=slugify(b.slug||b.title||"");
    if(!slug) return json({error:"Mã link không hợp lệ"},400);
    if(!validUrl(b.destination_url)) return json({error:"Link đích phải là URL http hoặc https hợp lệ"},400);
    try{
      if(b.id){
        await env.DB.prepare("UPDATE links SET slug=?,title=?,destination_url=?,updated_at=datetime('now') WHERE id=?").bind(slug,String(b.title||""),b.destination_url,Number(b.id)).run();
        await log(env,"link_updated",slug);
      }else{
        await env.DB.prepare("INSERT INTO links(slug,title,destination_url) VALUES(?,?,?)").bind(slug,String(b.title||""),b.destination_url).run();
        await log(env,"link_created",slug);
      }
      return json({ok:true});
    }catch(e){return json({error:"Không thể lưu. Mã link có thể đã tồn tại."},409)}
  }
  const lm=path.match(/^links\/(\d+)$/);
  if(lm && request.method==="PATCH"){
    const b=await bodyJson(request);
    await env.DB.prepare("UPDATE links SET enabled=?,updated_at=datetime('now') WHERE id=?").bind(b.enabled?1:0,Number(lm[1])).run();
    await log(env,"link_status_changed",lm[1]+" => "+(b.enabled?"on":"off"));
    return json({ok:true});
  }
  if(lm && request.method==="DELETE"){
    const row=await env.DB.prepare("SELECT slug FROM links WHERE id=?").bind(Number(lm[1])).first();
    await env.DB.prepare("DELETE FROM links WHERE id=?").bind(Number(lm[1])).run();
    await log(env,"link_deleted",row?.slug||lm[1]);
    return json({ok:true});
  }
  if(path==="visits" && request.method==="GET"){
    const [total,today,rows]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM visits").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM visits WHERE date(visited_at)=date('now')").first(),
      env.DB.prepare("SELECT * FROM visits ORDER BY id DESC LIMIT 300").all()
    ]);
    return json({total:total.n,today:today.n,rows:rows.results});
  }
  if(path==="settings" && request.method==="GET"){
    const r=await env.DB.prepare("SELECT key,value FROM settings").all();
    return json({settings:Object.fromEntries(r.results.map(x=>[x.key,x.value]))});
  }
  if(path==="settings" && request.method==="POST"){
    const b=await bodyJson(request);
    const allowed=["site_name","logo_text","favicon_url","wait_seconds","interstitial_message","maintenance"];
    for(const k of allowed) if(b[k]!==undefined){
      const v=String(b[k]).slice(0,1000);
      await env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k,v).run();
    }
    await log(env,"settings_updated","Cập nhật cấu hình website");
    return json({ok:true});
  }
  if(path==="logs" && request.method==="GET"){
    const r=await env.DB.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300").all();
    return json({rows:r.results});
  }
  return json({error:"Not found"},404);
}

async function redirectPage(slug, env, request) {
  const link=await env.DB.prepare("SELECT * FROM links WHERE slug=? AND enabled=1").bind(slug).first();
  const settingsRows=await env.DB.prepare("SELECT key,value FROM settings").all();
  const settings=Object.fromEntries(settingsRows.results.map(x=>[x.key,x.value]));
  if(settings.maintenance==="1") return html("<h2>Website đang bảo trì</h2>",503);
  if(!link) return html("<h2>Liên kết không tồn tại hoặc đã bị tắt.</h2>",404);
  const ua=request.headers.get("User-Agent")||"", info=uaInfo(ua);
  const country=request.headers.get("CF-IPCountry")||"";
  const ref=(request.headers.get("Referer")||"").slice(0,500);
  await env.DB.prepare("INSERT INTO visits(link_id,slug,outcome,country,device,browser,referrer) VALUES(?,?,?,?,?,?,?)")
    .bind(link.id,slug,"visit",country,info.device,info.browser,ref).run();
  const wait=Math.max(0,Math.min(120,Number(settings.wait_seconds||0)));
  const message=String(settings.interstitial_message||"Đang chuyển hướng...").replace(/[<>&"]/g,"");
  const destination=JSON.stringify(link.destination_url);
  return html(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${String(settings.site_name||"YOUNJ").replace(/[<>&"]/g,"")}</title><body style="font:16px system-ui;background:#f5f7fb;color:#172033;display:grid;place-items:center;min-height:100vh;margin:0"><main style="background:white;padding:32px;border-radius:16px;text-align:center;max-width:440px;width:90%;box-shadow:0 12px 40px #0001"><h2>${message}</h2><p>Bạn sẽ được chuyển đến liên kết sau <b id="n">${wait}</b> giây.</p><button id="go" style="border:0;background:#2563eb;color:white;border-radius:9px;padding:12px 18px;font-weight:700">Tiếp tục</button></main><script>const dest=${destination};let n=${wait};const el=document.getElementById('n');const go=()=>location.replace(dest);document.getElementById('go').onclick=go;if(n<=0)go();else{const t=setInterval(()=>{n--;el.textContent=n;if(n<=0){clearInterval(t);go()}},1000)}</script></body></html>`);
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    try {
      if(url.pathname.startsWith("/api/")) return await handleApi(request,env,url);
      if(url.pathname==="/login") return html(LOGIN_HTML);
      if(url.pathname==="/" || url.pathname==="/index.html"){
        if(!await authorized(request,env)) return Response.redirect(url.origin+"/login",302);
        return html(APP_HTML);
      }
      if(url.pathname.startsWith("/r/")) return await redirectPage(decodeURIComponent(url.pathname.slice(3)),env,request);
      if(env.ASSETS) {
        const asset=await env.ASSETS.fetch(request);
        if(asset.status!==404) return asset;
      }
      return new Response("Not found",{status:404});
    } catch(e) {
      return json({error:"Internal server error",detail:env.ENVIRONMENT==="development"?String(e):undefined},500);
    }
  }
};
