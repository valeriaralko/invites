/* =====================================================================
   З'ЄДНАННЯ САЙТУ З SUPABASE (нічого міняти не потрібно)
   Сайт спілкується з базою через простий інтерфейс window.claude.use('db'),
   а цей файл перекладає його в запити до Supabase.
   Таблиці: invitations (запрошення), photos (фото), rsvps (відповіді гостей).
   ===================================================================== */
(function(){
  'use strict';
  var cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabaseKey||/ВСТАВТЕ/.test(cfg.supabaseUrl+cfg.supabaseKey))return;
  var sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});

  /* ---------- хто зараз увійшов ---------- */
  var sessionUid=async function(){var r=await sb.auth.getSession();return r&&r.data&&r.data.session?r.data.session.user.id:null};
  var must=function(r){if(r&&r.error)throw r.error;return r?r.data:null};

  /* ---------- допоміжне ---------- */
  function split(path){var i=path.indexOf('/');return {col:path.slice(0,i),id:path.slice(i+1)}}
  function snap(id,data){return {id:id,exists:data!=null,data:function(){return data==null?undefined:JSON.parse(JSON.stringify(data))}}}
  function wrapRows(rows){var d=rows.map(function(r){return snap(r.id,r.data)});return {docs:d,size:d.length,empty:!d.length}}

  /* ---------- читання колекцій (де where(...,'==',...)) ---------- */
  async function fetchCol(col,f){
    if(col==='invitations'){
      var u=f.ownerId||await sessionUid();
      return must(await sb.from('invitations').select('id,data').eq('owner',u));
    }
    if(col==='photos')return must(await sb.rpc('get_photos',{p_inv:f.inv}))||[];
    if(col==='rsvps')return must(await sb.from('rsvps').select('id,data').eq('inv',f.inv));
    throw new Error('unknown collection '+col);
  }
  /* "підписка": запит одразу і далі кожні 5 с (лише для тих, хто увійшов), колбек лише коли дані змінились */
  function watch(load,cb,onErr){
    var last=null,stopped=false,timer=null,authed=false;
    async function run(){
      try{
        var rows=await load(),key=JSON.stringify(rows);
        if(key!==last){last=key;cb(wrapRows(rows))}
      }catch(e){if(onErr)onErr(e)}
      if(authed&&!stopped)timer=setTimeout(run,5000);
    }
    sessionUid().then(function(u){authed=!!u;run()});
    return function(){stopped=true;clearTimeout(timer)};
  }

  /* ---------- запит до колекції ---------- */
  function query(col,filters){
    var f={};filters.forEach(function(x){f[x[0]]=x[2]});
    return {
      where:function(a,op,b){if(op!=='==')throw new Error('only == supported');return query(col,filters.concat([[a,op,b]]))},
      get:async function(){return wrapRows(await fetchCol(col,f))},
      onSnapshot:function(cb,err){return watch(function(){return fetchCol(col,f)},cb,err)}
    };
  }
  function collection(col){
    var q=query(col,[]);
    q.add=async function(d){
      if(col==='rsvps'){must(await sb.rpc('add_rsvp',{p_inv:d.inv,p_data:d}));return {id:null}}
      throw new Error('add not supported for '+col);
    };
    return q;
  }

  /* ---------- один документ ---------- */
  function doc(path){
    var p=split(path),col=p.col,id=p.id;
    var ref={
      id:id,path:path,
      get:async function(){
        if(col==='invitations')return snap(id,must(await sb.rpc('get_invitation',{p_id:id})));
        var rows=must(await sb.from(col).select('id,data').eq('id',id))||[];
        return snap(id,rows[0]?rows[0].data:null);
      },
      set:async function(d){
        var u=await sessionUid();if(!u)throw new Error('not signed in');
        if(col==='invitations')must(await sb.from('invitations').upsert({id:id,owner:u,data:d}));
        else if(col==='photos')must(await sb.from('photos').upsert({id:id,inv:d.inv,owner:u,data:d}));
        else throw new Error('set not supported for '+col);
      },
      update:async function(d){
        if(col!=='invitations')throw new Error('update not supported for '+col);
        must(await sb.rpc('update_invitation',{p_id:id,p_patch:d}));
      },
      delete:async function(){must(await sb.from(col).delete().eq('id',id))},
      onSnapshot:function(cb,err){return watch(async function(){var s=await ref.get();return s.exists?[{id:id,data:s.data()}]:[]},function(w){cb(w.docs[0]||snap(id,null))},err)}
    };
    return ref;
  }

  /* ---------- вхід і реєстрація (пошта + пароль) ---------- */
  var errUa=function(m){
    m=String(m||'');
    if(/Invalid login/i.test(m))return 'Невірна пошта або пароль.';
    if(/already registered|already been registered/i.test(m))return 'Ця пошта вже зареєстрована. Спробуйте увійти.';
    if(/at least 6|Password should/i.test(m))return 'Пароль має містити щонайменше 6 символів.';
    if(/valid email|invalid format|Unable to validate email/i.test(m))return 'Перевірте адресу пошти.';
    if(/rate limit|too many/i.test(m))return 'Забагато спроб. Зачекайте кілька хвилин.';
    if(/Email not confirmed/i.test(m))return 'Підтвердіть пошту за листом, який ми надіслали.';
    return 'Не вдалося виконати. Спробуйте ще раз.';
  };
  var auth={
    signIn:async function(email,pw){var r=await sb.auth.signInWithPassword({email:email,password:pw});return r.error?{error:errUa(r.error.message)}:{}},
    signUp:async function(email,pw){
      var r=await sb.auth.signUp({email:email,password:pw});
      if(r.error)return {error:errUa(r.error.message)};
      if(!r.data.session)return {error:'Ми надіслали лист для підтвердження пошти. Підтвердіть її й увійдіть.'};
      return {};
    },
    /* вхід за посиланням на пошту, без пароля */
    magicLink:async function(email){
      var r=await sb.auth.signInWithOtp({email:email,options:{emailRedirectTo:location.origin+location.pathname+location.hash}});
      return r.error?{error:errUa(r.error.message)}:{};
    },
    /* лист для відновлення пароля */
    resetPassword:async function(email){
      var r=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      return r.error?{error:errUa(r.error.message)}:{};
    },
    signOut:async function(){await sb.auth.signOut()}
  };

  /* ---------- збереження файлу (CSV) ---------- */
  var downloads={save:async function(r){
    var blob=new Blob([r.data],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=r.filename||'file.csv';document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);if(a.parentNode)a.parentNode.removeChild(a)},500);
    return {status:'saved'};
  }};

  window.claude={auth:auth,use:async function(name){
    if(name==='db')return {doc:doc,collection:collection};
    if(name==='user')return {id:sessionUid};
    if(name==='downloads')return downloads;
    return null;
  }};
})();
