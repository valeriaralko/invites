/* Компактний генератор QR-кодів (байтовий режим, рівні L/M, версії 1–10). Без залежностей.
   QR.svg(text, {margin, dark, light, level}) повертає рядок SVG. */
(function(g){
'use strict';
var EC={
  L:{fb:1,cw:[0,7,10,15,20,26,18,20,24,30,18],bl:[0,1,1,1,1,1,2,2,2,2,4]},
  M:{fb:0,cw:[0,10,16,26,18,24,16,18,22,22,26],bl:[0,1,1,1,2,2,4,4,4,5,5]}
};
function raw(v){var r=(16*v+128)*v+64;if(v>=2){var n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}return r}
var EXP=[],LOG=[];
(function(){var x=1,i;for(i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11D}for(i=255;i<512;i++)EXP[i]=EXP[i-255]})();
function mul(a,b){return a&&b?EXP[LOG[a]+LOG[b]]:0}
function gen(d){var p=[1],i,j;for(i=0;i<d;i++){var q=[];for(j=0;j<=p.length;j++)q.push(0);for(j=0;j<p.length;j++){q[j]^=p[j];q[j+1]^=mul(p[j],EXP[i])}p=q}return p}
function rem(data,gp){var d=gp.length-1,r=[],i;for(i=0;i<d;i++)r.push(0);data.forEach(function(b){var f=b^r.shift();r.push(0);for(var k=0;k<d;k++)r[k]^=mul(gp[k+1],f)});return r}
function utf8(s){return unescape(encodeURIComponent(s)).split('').map(function(c){return c.charCodeAt(0)})}
function bit(x,i){return ((x>>>i)&1)!==0}

function encode(text,level){
  var e=EC[level]||EC.M,bytes=utf8(text),v,cap;
  for(v=1;v<=10;v++){
    var cc=v<10?8:16,dc=Math.floor(raw(v)/8)-e.cw[v]*e.bl[v];
    if(4+cc+8*bytes.length<=dc*8){cap=dc;break}
  }
  if(!cap)throw new Error('QR: text too long');
  var bits=[];function put(val,len){for(var i=len-1;i>=0;i--)bits.push((val>>>i)&1)}
  put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(function(b){put(b,8)});
  var tl=Math.min(4,cap*8-bits.length);put(0,tl);while(bits.length%8)bits.push(0);
  var data=[],i;for(i=0;i<bits.length;i+=8){var b=0;for(var k=0;k<8;k++)b=(b<<1)|bits[i+k];data.push(b)}
  for(var pad=0xEC;data.length<cap;pad^=0xEC^0x11)data.push(pad);

  var total=Math.floor(raw(v)/8),nb=e.bl[v],ecl=e.cw[v],ns=nb-total%nb,sl=Math.floor(total/nb),gp=gen(ecl),blocks=[],off=0;
  for(i=0;i<nb;i++){
    var dl=sl-ecl+(i<ns?0:1),dat=data.slice(off,off+dl);off+=dl;
    var ec=rem(dat,gp);if(i<ns)dat.push(0);
    blocks.push(dat.concat(ec));
  }
  var out=[];
  for(i=0;i<blocks[0].length;i++)blocks.forEach(function(bl,j){if(i!==sl-ecl||j>=ns)out.push(bl[i])});

  var size=v*4+17,M=[],F=[],y,x;
  for(y=0;y<size;y++){M.push([]);F.push([]);for(x=0;x<size;x++){M[y].push(false);F[y].push(false)}}
  function set(x,y,d){if(x>=0&&x<size&&y>=0&&y<size){M[y][x]=d;F[y][x]=true}}
  for(i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
  function finder(cx,cy){for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){var d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4)}}
  finder(3,3);finder(size-4,3);finder(3,size-4);
  var ap=[];
  if(v>1){var na=Math.floor(v/7)+2,step=Math.ceil((v*4+4)/(na*2-2))*2;ap=[6];for(var pos=size-7;ap.length<na;pos-=step)ap.splice(1,0,pos)}
  ap.forEach(function(a,ia){ap.forEach(function(b,ib){
    if((ia===0&&ib===0)||(ia===0&&ib===ap.length-1)||(ia===ap.length-1&&ib===0))return;
    for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++)set(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  })});
  function fmt(mask){
    var d=(e.fb<<3)|mask,r=d,k;for(k=0;k<10;k++)r=(r<<1)^((r>>>9)*0x537);
    var b=((d<<10)|r)^0x5412;
    for(k=0;k<=5;k++)set(8,k,bit(b,k));
    set(8,7,bit(b,6));set(8,8,bit(b,7));set(7,8,bit(b,8));
    for(k=9;k<15;k++)set(14-k,8,bit(b,k));
    for(k=0;k<8;k++)set(size-1-k,8,bit(b,k));
    for(k=8;k<15;k++)set(8,size-15+k,bit(b,k));
    set(8,size-8,true);
  }
  fmt(0);
  if(v>=7){
    var r=v,k;for(k=0;k<12;k++)r=(r<<1)^((r>>>11)*0x1F25);
    var vb=(v<<12)|r;
    for(k=0;k<18;k++){var c=bit(vb,k),a=size-11+k%3,bb=Math.floor(k/3);set(a,bb,c);set(bb,a,c)}
  }
  var n=0;
  for(var right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    for(var vert=0;vert<size;vert++)for(var j=0;j<2;j++){
      var xx=right-j,up=((right+1)&2)===0,yy=up?size-1-vert:vert;
      if(!F[yy][xx]&&n<out.length*8){M[yy][xx]=bit(out[n>>>3],7-(n&7));n++}
    }
  }
  function apply(mask){
    for(var y=0;y<size;y++)for(var x=0;x<size;x++){
      if(F[y][x])continue;var inv;
      switch(mask){
        case 0:inv=(x+y)%2===0;break;
        case 1:inv=y%2===0;break;
        case 2:inv=x%3===0;break;
        case 3:inv=(x+y)%3===0;break;
        case 4:inv=(Math.floor(x/3)+Math.floor(y/2))%2===0;break;
        case 5:inv=x*y%2+x*y%3===0;break;
        case 6:inv=(x*y%2+x*y%3)%2===0;break;
        default:inv=((x+y)%2+x*y%3)%2===0;
      }
      if(inv)M[y][x]=!M[y][x];
    }
  }
  function penalty(){
    var p=0,y,x,run,dark=0;
    for(y=0;y<size;y++){
      run=1;for(x=1;x<size;x++){if(M[y][x]===M[y][x-1]){run++;if(run===5)p+=3;else if(run>5)p++}else run=1}
      run=1;for(x=1;x<size;x++){if(M[x][y]===M[x-1][y]){run++;if(run===5)p+=3;else if(run>5)p++}else run=1}
    }
    for(y=0;y<size-1;y++)for(x=0;x<size-1;x++){var c=M[y][x];if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1])p+=3}
    for(y=0;y<size;y++)for(x=0;x<size;x++)if(M[y][x])dark++;
    p+=(Math.ceil(Math.abs(dark*20-size*size*10)/(size*size))-1)*10;
    return p;
  }
  var best=0,bp=1e9;
  for(var m=0;m<8;m++){apply(m);fmt(m);var pp=penalty();if(pp<bp){bp=pp;best=m}apply(m)}
  apply(best);fmt(best);
  return M;
}
g.QR={
  matrix:encode,
  svg:function(text,o){
    o=o||{};var m=encode(text,o.level||'M'),n=m.length,mg=o.margin==null?2:o.margin,d='',x,y;
    for(y=0;y<n;y++){x=0;while(x<n){if(m[y][x]){var s=x;while(x<n&&m[y][x])x++;d+='M'+(s+mg)+' '+(y+mg)+'h'+(x-s)+'v1h-'+(x-s)+'z'}else x++}}
    var t=n+mg*2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+t+' '+t+'" shape-rendering="crispEdges" role="img" aria-label="QR-код"><rect width="'+t+'" height="'+t+'" fill="'+(o.light||'#ffffff')+'"/><path d="'+d+'" fill="'+(o.dark||'#2b1a12')+'"/></svg>';
  }
};
})(window);
