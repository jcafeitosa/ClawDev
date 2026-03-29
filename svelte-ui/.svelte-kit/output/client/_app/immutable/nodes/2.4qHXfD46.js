import"../chunks/Bzak7iHL.js";import{o as _t}from"../chunks/Ct3mSrsR.js";import{s as fe,d as ye,g as f,e as Z,f as T,p as Te,c as $,r as y,aj as N,n as zt,ai as J,a as Re,aN as De}from"../chunks/DJW_FWg2.js";import{c as G,a as v,f as I}from"../chunks/CufsEo-p.js";import{i as Q,c as Oe}from"../chunks/BlLisNem.js";import{s as Mt}from"../chunks/DhVwA_JB.js";import{s as Ct,a as St}from"../chunks/B8L44Dme.js";import{s as ee}from"../chunks/DOskbVqy.js";import{c as At,I as j,s as V,e as xe,a as ne,i as Ne,b as Fe,d as Be}from"../chunks/B4iHg8RX.js";import{e as Ue,d as Ie}from"../chunks/CJItKuqo.js";import{p as Nt}from"../chunks/tBkfD-l1.js";import"../chunks/C6nr1LQ0.js";import{l as W,s as D}from"../chunks/DFXkUBmq.js";import{b as It}from"../chunks/CKvYAhfF.js";const Pt=!1,Tt=!1,Nr=Object.freeze(Object.defineProperty({__proto__:null,prerender:Tt,ssr:Pt},Symbol.toStringTag,{value:"Module"})),at=768;function it(){return typeof window>"u"?!1:window.innerWidth<at}let de=fe(!it()),Ee=fe(ye(it()));const q={get open(){return f(de)},get isMobile(){return f(Ee)},set(e){Z(de,e,!0)},toggle(){Z(de,!f(de))},init(){if(typeof window>"u")return;const e=window.matchMedia(`(max-width: ${at-1}px)`),t=o=>{Z(Ee,o.matches,!0),Z(de,!o.matches)};e.addEventListener("change",t),Z(Ee,e.matches,!0),Z(de,!e.matches)}},Rt="paperclip.selectedCompanyId";let Lt=fe(ye([])),Ze=fe(ye(typeof window<"u"?localStorage.getItem(Rt):null));const je={get selectedCompanyId(){return f(Ze)},get selectedCompany(){return f(Lt).find(e=>e.id===f(Ze))??null}},Gt=(e,t)=>{const o=new Array(e.length+t.length);for(let r=0;r<e.length;r++)o[r]=e[r];for(let r=0;r<t.length;r++)o[e.length+r]=t[r];return o},Ot=(e,t)=>({classGroupId:e,validator:t}),lt=(e=new Map,t=null,o)=>({nextPart:e,validators:t,classGroupId:o}),Pe="-",Je=[],Et="arbitrary..",jt=e=>{const t=Wt(e),{conflictingClassGroups:o,conflictingClassGroupModifiers:r}=e;return{getClassGroupId:s=>{if(s.startsWith("[")&&s.endsWith("]"))return Vt(s);const a=s.split(Pe),d=a[0]===""&&a.length>1?1:0;return ct(a,d,t)},getConflictingClassGroupIds:(s,a)=>{if(a){const d=r[s],g=o[s];return d?g?Gt(g,d):d:g||Je}return o[s]||Je}}},ct=(e,t,o)=>{if(e.length-t===0)return o.classGroupId;const n=e[t],i=o.nextPart.get(n);if(i){const g=ct(e,t+1,i);if(g)return g}const s=o.validators;if(s===null)return;const a=t===0?e.join(Pe):e.slice(t).join(Pe),d=s.length;for(let g=0;g<d;g++){const p=s[g];if(p.validator(a))return p.classGroupId}},Vt=e=>e.slice(1,-1).indexOf(":")===-1?void 0:(()=>{const t=e.slice(1,-1),o=t.indexOf(":"),r=t.slice(0,o);return r?Et+r:void 0})(),Wt=e=>{const{theme:t,classGroups:o}=e;return Dt(o,t)},Dt=(e,t)=>{const o=lt();for(const r in e){const n=e[r];He(n,o,r,t)}return o},He=(e,t,o,r)=>{const n=e.length;for(let i=0;i<n;i++){const s=e[i];Ft(s,t,o,r)}},Ft=(e,t,o,r)=>{if(typeof e=="string"){Bt(e,t,o);return}if(typeof e=="function"){Ut(e,t,o,r);return}Ht(e,t,o,r)},Bt=(e,t,o)=>{const r=e===""?t:dt(t,e);r.classGroupId=o},Ut=(e,t,o,r)=>{if(Yt(e)){He(e(r),t,o,r);return}t.validators===null&&(t.validators=[]),t.validators.push(Ot(o,e))},Ht=(e,t,o,r)=>{const n=Object.entries(e),i=n.length;for(let s=0;s<i;s++){const[a,d]=n[s];He(d,dt(t,a),o,r)}},dt=(e,t)=>{let o=e;const r=t.split(Pe),n=r.length;for(let i=0;i<n;i++){const s=r[i];let a=o.nextPart.get(s);a||(a=lt(),o.nextPart.set(s,a)),o=a}return o},Yt=e=>"isThemeGetter"in e&&e.isThemeGetter===!0,Kt=e=>{if(e<1)return{get:()=>{},set:()=>{}};let t=0,o=Object.create(null),r=Object.create(null);const n=(i,s)=>{o[i]=s,t++,t>e&&(t=0,r=o,o=Object.create(null))};return{get(i){let s=o[i];if(s!==void 0)return s;if((s=r[i])!==void 0)return n(i,s),s},set(i,s){i in o?o[i]=s:n(i,s)}}},We="!",Qe=":",qt=[],et=(e,t,o,r,n)=>({modifiers:e,hasImportantModifier:t,baseClassName:o,maybePostfixModifierPosition:r,isExternal:n}),Xt=e=>{const{prefix:t,experimentalParseClassName:o}=e;let r=n=>{const i=[];let s=0,a=0,d=0,g;const p=n.length;for(let A=0;A<p;A++){const C=n[A];if(s===0&&a===0){if(C===Qe){i.push(n.slice(d,A)),d=A+1;continue}if(C==="/"){g=A;continue}}C==="["?s++:C==="]"?s--:C==="("?a++:C===")"&&a--}const b=i.length===0?n:n.slice(d);let M=b,S=!1;b.endsWith(We)?(M=b.slice(0,-1),S=!0):b.startsWith(We)&&(M=b.slice(1),S=!0);const O=g&&g>d?g-d:void 0;return et(i,S,M,O)};if(t){const n=t+Qe,i=r;r=s=>s.startsWith(n)?i(s.slice(n.length)):et(qt,!1,s,void 0,!0)}if(o){const n=r;r=i=>o({className:i,parseClassName:n})}return r},Zt=e=>{const t=new Map;return e.orderSensitiveModifiers.forEach((o,r)=>{t.set(o,1e6+r)}),o=>{const r=[];let n=[];for(let i=0;i<o.length;i++){const s=o[i],a=s[0]==="[",d=t.has(s);a||d?(n.length>0&&(n.sort(),r.push(...n),n=[]),r.push(s)):n.push(s)}return n.length>0&&(n.sort(),r.push(...n)),r}},Jt=e=>({cache:Kt(e.cacheSize),parseClassName:Xt(e),sortModifiers:Zt(e),...jt(e)}),Qt=/\s+/,eo=(e,t)=>{const{parseClassName:o,getClassGroupId:r,getConflictingClassGroupIds:n,sortModifiers:i}=t,s=[],a=e.trim().split(Qt);let d="";for(let g=a.length-1;g>=0;g-=1){const p=a[g],{isExternal:b,modifiers:M,hasImportantModifier:S,baseClassName:O,maybePostfixModifierPosition:A}=o(p);if(b){d=p+(d.length>0?" "+d:d);continue}let C=!!A,U=r(C?O.substring(0,A):O);if(!U){if(!C){d=p+(d.length>0?" "+d:d);continue}if(U=r(O),!U){d=p+(d.length>0?" "+d:d);continue}C=!1}const X=M.length===0?"":M.length===1?M[0]:i(M).join(":"),H=S?X+We:X,F=H+U;if(s.indexOf(F)>-1)continue;s.push(F);const w=n(U,C);for(let k=0;k<w.length;++k){const L=w[k];s.push(H+L)}d=p+(d.length>0?" "+d:d)}return d},to=(...e)=>{let t=0,o,r,n="";for(;t<e.length;)(o=e[t++])&&(r=mt(o))&&(n&&(n+=" "),n+=r);return n},mt=e=>{if(typeof e=="string")return e;let t,o="";for(let r=0;r<e.length;r++)e[r]&&(t=mt(e[r]))&&(o&&(o+=" "),o+=t);return o},oo=(e,...t)=>{let o,r,n,i;const s=d=>{const g=t.reduce((p,b)=>b(p),e());return o=Jt(g),r=o.cache.get,n=o.cache.set,i=a,a(d)},a=d=>{const g=r(d);if(g)return g;const p=eo(d,o);return n(d,p),p};return i=s,(...d)=>i(to(...d))},ro=[],P=e=>{const t=o=>o[e]||ro;return t.isThemeGetter=!0,t},ut=/^\[(?:(\w[\w-]*):)?(.+)\]$/i,ft=/^\((?:(\w[\w-]*):)?(.+)\)$/i,so=/^\d+\/\d+$/,no=/^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,ao=/\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,io=/^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,lo=/^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,co=/^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,me=e=>so.test(e),h=e=>!!e&&!Number.isNaN(Number(e)),se=e=>!!e&&Number.isInteger(Number(e)),Ve=e=>e.endsWith("%")&&h(e.slice(0,-1)),te=e=>no.test(e),pt=()=>!0,mo=e=>ao.test(e)&&!io.test(e),Ye=()=>!1,uo=e=>lo.test(e),fo=e=>co.test(e),po=e=>!l(e)&&!c(e),go=e=>ae(e,ht,Ye),l=e=>ut.test(e),le=e=>ae(e,vt,mo),tt=e=>ae(e,$o,h),bo=e=>ae(e,yt,pt),ho=e=>ae(e,xt,Ye),ot=e=>ae(e,gt,Ye),vo=e=>ae(e,bt,fo),Me=e=>ae(e,wt,uo),c=e=>ft.test(e),he=e=>ce(e,vt),xo=e=>ce(e,xt),rt=e=>ce(e,gt),yo=e=>ce(e,ht),wo=e=>ce(e,bt),Ce=e=>ce(e,wt,!0),ko=e=>ce(e,yt,!0),ae=(e,t,o)=>{const r=ut.exec(e);return r?r[1]?t(r[1]):o(r[2]):!1},ce=(e,t,o=!1)=>{const r=ft.exec(e);return r?r[1]?t(r[1]):o:!1},gt=e=>e==="position"||e==="percentage",bt=e=>e==="image"||e==="url",ht=e=>e==="length"||e==="size"||e==="bg-size",vt=e=>e==="length",$o=e=>e==="number",xt=e=>e==="family-name",yt=e=>e==="number"||e==="weight",wt=e=>e==="shadow",_o=()=>{const e=P("color"),t=P("font"),o=P("text"),r=P("font-weight"),n=P("tracking"),i=P("leading"),s=P("breakpoint"),a=P("container"),d=P("spacing"),g=P("radius"),p=P("shadow"),b=P("inset-shadow"),M=P("text-shadow"),S=P("drop-shadow"),O=P("blur"),A=P("perspective"),C=P("aspect"),U=P("ease"),X=P("animate"),H=()=>["auto","avoid","all","avoid-page","page","left","right","column"],F=()=>["center","top","bottom","left","right","top-left","left-top","top-right","right-top","bottom-right","right-bottom","bottom-left","left-bottom"],w=()=>[...F(),c,l],k=()=>["auto","hidden","clip","visible","scroll"],L=()=>["auto","contain","none"],u=()=>[c,l,d],Y=()=>[me,"full","auto",...u()],pe=()=>[se,"none","subgrid",c,l],ge=()=>["auto",{span:["full",se,c,l]},se,c,l],ie=()=>[se,"auto",c,l],we=()=>["auto","min","max","fr",c,l],be=()=>["start","end","center","between","around","evenly","stretch","baseline","center-safe","end-safe"],_=()=>["start","end","center","stretch","center-safe","end-safe"],x=()=>["auto",...u()],z=()=>[me,"auto","full","dvw","dvh","lvw","lvh","svw","svh","min","max","fit",...u()],m=()=>[e,c,l],oe=()=>[...F(),rt,ot,{position:[c,l]}],B=()=>["no-repeat",{repeat:["","x","y","space","round"]}],re=()=>["auto","cover","contain",yo,go,{size:[c,l]}],Le=()=>[Ve,he,le],E=()=>["","none","full",g,c,l],K=()=>["",h,he,le],ke=()=>["solid","dashed","dotted","double"],qe=()=>["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity"],R=()=>[h,Ve,rt,ot],Xe=()=>["","none",O,c,l],$e=()=>["none",h,c,l],_e=()=>["none",h,c,l],Ge=()=>[h,c,l],ze=()=>[me,"full",...u()];return{cacheSize:500,theme:{animate:["spin","ping","pulse","bounce"],aspect:["video"],blur:[te],breakpoint:[te],color:[pt],container:[te],"drop-shadow":[te],ease:["in","out","in-out"],font:[po],"font-weight":["thin","extralight","light","normal","medium","semibold","bold","extrabold","black"],"inset-shadow":[te],leading:["none","tight","snug","normal","relaxed","loose"],perspective:["dramatic","near","normal","midrange","distant","none"],radius:[te],shadow:[te],spacing:["px",h],text:[te],"text-shadow":[te],tracking:["tighter","tight","normal","wide","wider","widest"]},classGroups:{aspect:[{aspect:["auto","square",me,l,c,C]}],container:["container"],columns:[{columns:[h,l,c,a]}],"break-after":[{"break-after":H()}],"break-before":[{"break-before":H()}],"break-inside":[{"break-inside":["auto","avoid","avoid-page","avoid-column"]}],"box-decoration":[{"box-decoration":["slice","clone"]}],box:[{box:["border","content"]}],display:["block","inline-block","inline","flex","inline-flex","table","inline-table","table-caption","table-cell","table-column","table-column-group","table-footer-group","table-header-group","table-row-group","table-row","flow-root","grid","inline-grid","contents","list-item","hidden"],sr:["sr-only","not-sr-only"],float:[{float:["right","left","none","start","end"]}],clear:[{clear:["left","right","both","none","start","end"]}],isolation:["isolate","isolation-auto"],"object-fit":[{object:["contain","cover","fill","none","scale-down"]}],"object-position":[{object:w()}],overflow:[{overflow:k()}],"overflow-x":[{"overflow-x":k()}],"overflow-y":[{"overflow-y":k()}],overscroll:[{overscroll:L()}],"overscroll-x":[{"overscroll-x":L()}],"overscroll-y":[{"overscroll-y":L()}],position:["static","fixed","absolute","relative","sticky"],inset:[{inset:Y()}],"inset-x":[{"inset-x":Y()}],"inset-y":[{"inset-y":Y()}],start:[{start:Y()}],end:[{end:Y()}],top:[{top:Y()}],right:[{right:Y()}],bottom:[{bottom:Y()}],left:[{left:Y()}],visibility:["visible","invisible","collapse"],z:[{z:[se,"auto",c,l]}],basis:[{basis:[me,"full","auto",a,...u()]}],"flex-direction":[{flex:["row","row-reverse","col","col-reverse"]}],"flex-wrap":[{flex:["nowrap","wrap","wrap-reverse"]}],flex:[{flex:[h,me,"auto","initial","none",l]}],grow:[{grow:["",h,c,l]}],shrink:[{shrink:["",h,c,l]}],order:[{order:[se,"first","last","none",c,l]}],"grid-cols":[{"grid-cols":pe()}],"col-start-end":[{col:ge()}],"col-start":[{"col-start":ie()}],"col-end":[{"col-end":ie()}],"grid-rows":[{"grid-rows":pe()}],"row-start-end":[{row:ge()}],"row-start":[{"row-start":ie()}],"row-end":[{"row-end":ie()}],"grid-flow":[{"grid-flow":["row","col","dense","row-dense","col-dense"]}],"auto-cols":[{"auto-cols":we()}],"auto-rows":[{"auto-rows":we()}],gap:[{gap:u()}],"gap-x":[{"gap-x":u()}],"gap-y":[{"gap-y":u()}],"justify-content":[{justify:[...be(),"normal"]}],"justify-items":[{"justify-items":[..._(),"normal"]}],"justify-self":[{"justify-self":["auto",..._()]}],"align-content":[{content:["normal",...be()]}],"align-items":[{items:[..._(),{baseline:["","last"]}]}],"align-self":[{self:["auto",..._(),{baseline:["","last"]}]}],"place-content":[{"place-content":be()}],"place-items":[{"place-items":[..._(),"baseline"]}],"place-self":[{"place-self":["auto",..._()]}],p:[{p:u()}],px:[{px:u()}],py:[{py:u()}],ps:[{ps:u()}],pe:[{pe:u()}],pt:[{pt:u()}],pr:[{pr:u()}],pb:[{pb:u()}],pl:[{pl:u()}],m:[{m:x()}],mx:[{mx:x()}],my:[{my:x()}],ms:[{ms:x()}],me:[{me:x()}],mt:[{mt:x()}],mr:[{mr:x()}],mb:[{mb:x()}],ml:[{ml:x()}],"space-x":[{"space-x":u()}],"space-x-reverse":["space-x-reverse"],"space-y":[{"space-y":u()}],"space-y-reverse":["space-y-reverse"],size:[{size:z()}],w:[{w:[a,"screen",...z()]}],"min-w":[{"min-w":[a,"screen","none",...z()]}],"max-w":[{"max-w":[a,"screen","none","prose",{screen:[s]},...z()]}],h:[{h:["screen","lh",...z()]}],"min-h":[{"min-h":["screen","lh","none",...z()]}],"max-h":[{"max-h":["screen","lh",...z()]}],"font-size":[{text:["base",o,he,le]}],"font-smoothing":["antialiased","subpixel-antialiased"],"font-style":["italic","not-italic"],"font-weight":[{font:[r,ko,bo]}],"font-stretch":[{"font-stretch":["ultra-condensed","extra-condensed","condensed","semi-condensed","normal","semi-expanded","expanded","extra-expanded","ultra-expanded",Ve,l]}],"font-family":[{font:[xo,ho,t]}],"fvn-normal":["normal-nums"],"fvn-ordinal":["ordinal"],"fvn-slashed-zero":["slashed-zero"],"fvn-figure":["lining-nums","oldstyle-nums"],"fvn-spacing":["proportional-nums","tabular-nums"],"fvn-fraction":["diagonal-fractions","stacked-fractions"],tracking:[{tracking:[n,c,l]}],"line-clamp":[{"line-clamp":[h,"none",c,tt]}],leading:[{leading:[i,...u()]}],"list-image":[{"list-image":["none",c,l]}],"list-style-position":[{list:["inside","outside"]}],"list-style-type":[{list:["disc","decimal","none",c,l]}],"text-alignment":[{text:["left","center","right","justify","start","end"]}],"placeholder-color":[{placeholder:m()}],"text-color":[{text:m()}],"text-decoration":["underline","overline","line-through","no-underline"],"text-decoration-style":[{decoration:[...ke(),"wavy"]}],"text-decoration-thickness":[{decoration:[h,"from-font","auto",c,le]}],"text-decoration-color":[{decoration:m()}],"underline-offset":[{"underline-offset":[h,"auto",c,l]}],"text-transform":["uppercase","lowercase","capitalize","normal-case"],"text-overflow":["truncate","text-ellipsis","text-clip"],"text-wrap":[{text:["wrap","nowrap","balance","pretty"]}],indent:[{indent:u()}],"vertical-align":[{align:["baseline","top","middle","bottom","text-top","text-bottom","sub","super",c,l]}],whitespace:[{whitespace:["normal","nowrap","pre","pre-line","pre-wrap","break-spaces"]}],break:[{break:["normal","words","all","keep"]}],wrap:[{wrap:["break-word","anywhere","normal"]}],hyphens:[{hyphens:["none","manual","auto"]}],content:[{content:["none",c,l]}],"bg-attachment":[{bg:["fixed","local","scroll"]}],"bg-clip":[{"bg-clip":["border","padding","content","text"]}],"bg-origin":[{"bg-origin":["border","padding","content"]}],"bg-position":[{bg:oe()}],"bg-repeat":[{bg:B()}],"bg-size":[{bg:re()}],"bg-image":[{bg:["none",{linear:[{to:["t","tr","r","br","b","bl","l","tl"]},se,c,l],radial:["",c,l],conic:[se,c,l]},wo,vo]}],"bg-color":[{bg:m()}],"gradient-from-pos":[{from:Le()}],"gradient-via-pos":[{via:Le()}],"gradient-to-pos":[{to:Le()}],"gradient-from":[{from:m()}],"gradient-via":[{via:m()}],"gradient-to":[{to:m()}],rounded:[{rounded:E()}],"rounded-s":[{"rounded-s":E()}],"rounded-e":[{"rounded-e":E()}],"rounded-t":[{"rounded-t":E()}],"rounded-r":[{"rounded-r":E()}],"rounded-b":[{"rounded-b":E()}],"rounded-l":[{"rounded-l":E()}],"rounded-ss":[{"rounded-ss":E()}],"rounded-se":[{"rounded-se":E()}],"rounded-ee":[{"rounded-ee":E()}],"rounded-es":[{"rounded-es":E()}],"rounded-tl":[{"rounded-tl":E()}],"rounded-tr":[{"rounded-tr":E()}],"rounded-br":[{"rounded-br":E()}],"rounded-bl":[{"rounded-bl":E()}],"border-w":[{border:K()}],"border-w-x":[{"border-x":K()}],"border-w-y":[{"border-y":K()}],"border-w-s":[{"border-s":K()}],"border-w-e":[{"border-e":K()}],"border-w-t":[{"border-t":K()}],"border-w-r":[{"border-r":K()}],"border-w-b":[{"border-b":K()}],"border-w-l":[{"border-l":K()}],"divide-x":[{"divide-x":K()}],"divide-x-reverse":["divide-x-reverse"],"divide-y":[{"divide-y":K()}],"divide-y-reverse":["divide-y-reverse"],"border-style":[{border:[...ke(),"hidden","none"]}],"divide-style":[{divide:[...ke(),"hidden","none"]}],"border-color":[{border:m()}],"border-color-x":[{"border-x":m()}],"border-color-y":[{"border-y":m()}],"border-color-s":[{"border-s":m()}],"border-color-e":[{"border-e":m()}],"border-color-t":[{"border-t":m()}],"border-color-r":[{"border-r":m()}],"border-color-b":[{"border-b":m()}],"border-color-l":[{"border-l":m()}],"divide-color":[{divide:m()}],"outline-style":[{outline:[...ke(),"none","hidden"]}],"outline-offset":[{"outline-offset":[h,c,l]}],"outline-w":[{outline:["",h,he,le]}],"outline-color":[{outline:m()}],shadow:[{shadow:["","none",p,Ce,Me]}],"shadow-color":[{shadow:m()}],"inset-shadow":[{"inset-shadow":["none",b,Ce,Me]}],"inset-shadow-color":[{"inset-shadow":m()}],"ring-w":[{ring:K()}],"ring-w-inset":["ring-inset"],"ring-color":[{ring:m()}],"ring-offset-w":[{"ring-offset":[h,le]}],"ring-offset-color":[{"ring-offset":m()}],"inset-ring-w":[{"inset-ring":K()}],"inset-ring-color":[{"inset-ring":m()}],"text-shadow":[{"text-shadow":["none",M,Ce,Me]}],"text-shadow-color":[{"text-shadow":m()}],opacity:[{opacity:[h,c,l]}],"mix-blend":[{"mix-blend":[...qe(),"plus-darker","plus-lighter"]}],"bg-blend":[{"bg-blend":qe()}],"mask-clip":[{"mask-clip":["border","padding","content","fill","stroke","view"]},"mask-no-clip"],"mask-composite":[{mask:["add","subtract","intersect","exclude"]}],"mask-image-linear-pos":[{"mask-linear":[h]}],"mask-image-linear-from-pos":[{"mask-linear-from":R()}],"mask-image-linear-to-pos":[{"mask-linear-to":R()}],"mask-image-linear-from-color":[{"mask-linear-from":m()}],"mask-image-linear-to-color":[{"mask-linear-to":m()}],"mask-image-t-from-pos":[{"mask-t-from":R()}],"mask-image-t-to-pos":[{"mask-t-to":R()}],"mask-image-t-from-color":[{"mask-t-from":m()}],"mask-image-t-to-color":[{"mask-t-to":m()}],"mask-image-r-from-pos":[{"mask-r-from":R()}],"mask-image-r-to-pos":[{"mask-r-to":R()}],"mask-image-r-from-color":[{"mask-r-from":m()}],"mask-image-r-to-color":[{"mask-r-to":m()}],"mask-image-b-from-pos":[{"mask-b-from":R()}],"mask-image-b-to-pos":[{"mask-b-to":R()}],"mask-image-b-from-color":[{"mask-b-from":m()}],"mask-image-b-to-color":[{"mask-b-to":m()}],"mask-image-l-from-pos":[{"mask-l-from":R()}],"mask-image-l-to-pos":[{"mask-l-to":R()}],"mask-image-l-from-color":[{"mask-l-from":m()}],"mask-image-l-to-color":[{"mask-l-to":m()}],"mask-image-x-from-pos":[{"mask-x-from":R()}],"mask-image-x-to-pos":[{"mask-x-to":R()}],"mask-image-x-from-color":[{"mask-x-from":m()}],"mask-image-x-to-color":[{"mask-x-to":m()}],"mask-image-y-from-pos":[{"mask-y-from":R()}],"mask-image-y-to-pos":[{"mask-y-to":R()}],"mask-image-y-from-color":[{"mask-y-from":m()}],"mask-image-y-to-color":[{"mask-y-to":m()}],"mask-image-radial":[{"mask-radial":[c,l]}],"mask-image-radial-from-pos":[{"mask-radial-from":R()}],"mask-image-radial-to-pos":[{"mask-radial-to":R()}],"mask-image-radial-from-color":[{"mask-radial-from":m()}],"mask-image-radial-to-color":[{"mask-radial-to":m()}],"mask-image-radial-shape":[{"mask-radial":["circle","ellipse"]}],"mask-image-radial-size":[{"mask-radial":[{closest:["side","corner"],farthest:["side","corner"]}]}],"mask-image-radial-pos":[{"mask-radial-at":F()}],"mask-image-conic-pos":[{"mask-conic":[h]}],"mask-image-conic-from-pos":[{"mask-conic-from":R()}],"mask-image-conic-to-pos":[{"mask-conic-to":R()}],"mask-image-conic-from-color":[{"mask-conic-from":m()}],"mask-image-conic-to-color":[{"mask-conic-to":m()}],"mask-mode":[{mask:["alpha","luminance","match"]}],"mask-origin":[{"mask-origin":["border","padding","content","fill","stroke","view"]}],"mask-position":[{mask:oe()}],"mask-repeat":[{mask:B()}],"mask-size":[{mask:re()}],"mask-type":[{"mask-type":["alpha","luminance"]}],"mask-image":[{mask:["none",c,l]}],filter:[{filter:["","none",c,l]}],blur:[{blur:Xe()}],brightness:[{brightness:[h,c,l]}],contrast:[{contrast:[h,c,l]}],"drop-shadow":[{"drop-shadow":["","none",S,Ce,Me]}],"drop-shadow-color":[{"drop-shadow":m()}],grayscale:[{grayscale:["",h,c,l]}],"hue-rotate":[{"hue-rotate":[h,c,l]}],invert:[{invert:["",h,c,l]}],saturate:[{saturate:[h,c,l]}],sepia:[{sepia:["",h,c,l]}],"backdrop-filter":[{"backdrop-filter":["","none",c,l]}],"backdrop-blur":[{"backdrop-blur":Xe()}],"backdrop-brightness":[{"backdrop-brightness":[h,c,l]}],"backdrop-contrast":[{"backdrop-contrast":[h,c,l]}],"backdrop-grayscale":[{"backdrop-grayscale":["",h,c,l]}],"backdrop-hue-rotate":[{"backdrop-hue-rotate":[h,c,l]}],"backdrop-invert":[{"backdrop-invert":["",h,c,l]}],"backdrop-opacity":[{"backdrop-opacity":[h,c,l]}],"backdrop-saturate":[{"backdrop-saturate":[h,c,l]}],"backdrop-sepia":[{"backdrop-sepia":["",h,c,l]}],"border-collapse":[{border:["collapse","separate"]}],"border-spacing":[{"border-spacing":u()}],"border-spacing-x":[{"border-spacing-x":u()}],"border-spacing-y":[{"border-spacing-y":u()}],"table-layout":[{table:["auto","fixed"]}],caption:[{caption:["top","bottom"]}],transition:[{transition:["","all","colors","opacity","shadow","transform","none",c,l]}],"transition-behavior":[{transition:["normal","discrete"]}],duration:[{duration:[h,"initial",c,l]}],ease:[{ease:["linear","initial",U,c,l]}],delay:[{delay:[h,c,l]}],animate:[{animate:["none",X,c,l]}],backface:[{backface:["hidden","visible"]}],perspective:[{perspective:[A,c,l]}],"perspective-origin":[{"perspective-origin":w()}],rotate:[{rotate:$e()}],"rotate-x":[{"rotate-x":$e()}],"rotate-y":[{"rotate-y":$e()}],"rotate-z":[{"rotate-z":$e()}],scale:[{scale:_e()}],"scale-x":[{"scale-x":_e()}],"scale-y":[{"scale-y":_e()}],"scale-z":[{"scale-z":_e()}],"scale-3d":["scale-3d"],skew:[{skew:Ge()}],"skew-x":[{"skew-x":Ge()}],"skew-y":[{"skew-y":Ge()}],transform:[{transform:[c,l,"","none","gpu","cpu"]}],"transform-origin":[{origin:w()}],"transform-style":[{transform:["3d","flat"]}],translate:[{translate:ze()}],"translate-x":[{"translate-x":ze()}],"translate-y":[{"translate-y":ze()}],"translate-z":[{"translate-z":ze()}],"translate-none":["translate-none"],accent:[{accent:m()}],appearance:[{appearance:["none","auto"]}],"caret-color":[{caret:m()}],"color-scheme":[{scheme:["normal","dark","light","light-dark","only-dark","only-light"]}],cursor:[{cursor:["auto","default","pointer","wait","text","move","help","not-allowed","none","context-menu","progress","cell","crosshair","vertical-text","alias","copy","no-drop","grab","grabbing","all-scroll","col-resize","row-resize","n-resize","e-resize","s-resize","w-resize","ne-resize","nw-resize","se-resize","sw-resize","ew-resize","ns-resize","nesw-resize","nwse-resize","zoom-in","zoom-out",c,l]}],"field-sizing":[{"field-sizing":["fixed","content"]}],"pointer-events":[{"pointer-events":["auto","none"]}],resize:[{resize:["none","","y","x"]}],"scroll-behavior":[{scroll:["auto","smooth"]}],"scroll-m":[{"scroll-m":u()}],"scroll-mx":[{"scroll-mx":u()}],"scroll-my":[{"scroll-my":u()}],"scroll-ms":[{"scroll-ms":u()}],"scroll-me":[{"scroll-me":u()}],"scroll-mt":[{"scroll-mt":u()}],"scroll-mr":[{"scroll-mr":u()}],"scroll-mb":[{"scroll-mb":u()}],"scroll-ml":[{"scroll-ml":u()}],"scroll-p":[{"scroll-p":u()}],"scroll-px":[{"scroll-px":u()}],"scroll-py":[{"scroll-py":u()}],"scroll-ps":[{"scroll-ps":u()}],"scroll-pe":[{"scroll-pe":u()}],"scroll-pt":[{"scroll-pt":u()}],"scroll-pr":[{"scroll-pr":u()}],"scroll-pb":[{"scroll-pb":u()}],"scroll-pl":[{"scroll-pl":u()}],"snap-align":[{snap:["start","end","center","align-none"]}],"snap-stop":[{snap:["normal","always"]}],"snap-type":[{snap:["none","x","y","both"]}],"snap-strictness":[{snap:["mandatory","proximity"]}],touch:[{touch:["auto","none","manipulation"]}],"touch-x":[{"touch-pan":["x","left","right"]}],"touch-y":[{"touch-pan":["y","up","down"]}],"touch-pz":["touch-pinch-zoom"],select:[{select:["none","text","all","auto"]}],"will-change":[{"will-change":["auto","scroll","contents","transform",c,l]}],fill:[{fill:["none",...m()]}],"stroke-w":[{stroke:[h,he,le,tt]}],stroke:[{stroke:["none",...m()]}],"forced-color-adjust":[{"forced-color-adjust":["auto","none"]}]},conflictingClassGroups:{overflow:["overflow-x","overflow-y"],overscroll:["overscroll-x","overscroll-y"],inset:["inset-x","inset-y","start","end","top","right","bottom","left"],"inset-x":["right","left"],"inset-y":["top","bottom"],flex:["basis","grow","shrink"],gap:["gap-x","gap-y"],p:["px","py","ps","pe","pt","pr","pb","pl"],px:["pr","pl"],py:["pt","pb"],m:["mx","my","ms","me","mt","mr","mb","ml"],mx:["mr","ml"],my:["mt","mb"],size:["w","h"],"font-size":["leading"],"fvn-normal":["fvn-ordinal","fvn-slashed-zero","fvn-figure","fvn-spacing","fvn-fraction"],"fvn-ordinal":["fvn-normal"],"fvn-slashed-zero":["fvn-normal"],"fvn-figure":["fvn-normal"],"fvn-spacing":["fvn-normal"],"fvn-fraction":["fvn-normal"],"line-clamp":["display","overflow"],rounded:["rounded-s","rounded-e","rounded-t","rounded-r","rounded-b","rounded-l","rounded-ss","rounded-se","rounded-ee","rounded-es","rounded-tl","rounded-tr","rounded-br","rounded-bl"],"rounded-s":["rounded-ss","rounded-es"],"rounded-e":["rounded-se","rounded-ee"],"rounded-t":["rounded-tl","rounded-tr"],"rounded-r":["rounded-tr","rounded-br"],"rounded-b":["rounded-br","rounded-bl"],"rounded-l":["rounded-tl","rounded-bl"],"border-spacing":["border-spacing-x","border-spacing-y"],"border-w":["border-w-x","border-w-y","border-w-s","border-w-e","border-w-t","border-w-r","border-w-b","border-w-l"],"border-w-x":["border-w-r","border-w-l"],"border-w-y":["border-w-t","border-w-b"],"border-color":["border-color-x","border-color-y","border-color-s","border-color-e","border-color-t","border-color-r","border-color-b","border-color-l"],"border-color-x":["border-color-r","border-color-l"],"border-color-y":["border-color-t","border-color-b"],translate:["translate-x","translate-y","translate-none"],"translate-none":["translate","translate-x","translate-y","translate-z"],"scroll-m":["scroll-mx","scroll-my","scroll-ms","scroll-me","scroll-mt","scroll-mr","scroll-mb","scroll-ml"],"scroll-mx":["scroll-mr","scroll-ml"],"scroll-my":["scroll-mt","scroll-mb"],"scroll-p":["scroll-px","scroll-py","scroll-ps","scroll-pe","scroll-pt","scroll-pr","scroll-pb","scroll-pl"],"scroll-px":["scroll-pr","scroll-pl"],"scroll-py":["scroll-pt","scroll-pb"],touch:["touch-x","touch-y","touch-pz"],"touch-x":["touch"],"touch-y":["touch"],"touch-pz":["touch"]},conflictingClassGroupModifiers:{"font-size":["leading"]},orderSensitiveModifiers:["*","**","after","backdrop","before","details-content","file","first-letter","first-line","marker","placeholder","selection"]}},zo=oo(_o);function Ke(...e){return zo(At(e))}function Mo(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"}]];j(e,D({name:"activity"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Co(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["line",{x1:"12",x2:"12",y1:"2",y2:"22"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"}]];j(e,D({name:"dollar-sign"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function So(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["path",{d:"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"}],["path",{d:"M8 10v4"}],["path",{d:"M12 10v2"}],["path",{d:"M16 10v6"}]];j(e,D({name:"folder-kanban"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Ao(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["polyline",{points:"22 12 16 12 14 15 10 15 8 12 2 12"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"}]];j(e,D({name:"inbox"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function No(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1"}]];j(e,D({name:"layout-dashboard"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Io(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["rect",{x:"3",y:"5",width:"6",height:"6",rx:"1"}],["path",{d:"m3 17 2 2 4-4"}],["path",{d:"M13 6h8"}],["path",{d:"M13 12h8"}],["path",{d:"M13 18h8"}]];j(e,D({name:"list-todo"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Po(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["line",{x1:"4",x2:"20",y1:"12",y2:"12"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18"}]];j(e,D({name:"menu"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function To(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["path",{d:"M5 12h14"}],["path",{d:"M12 5v14"}]];j(e,D({name:"plus"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Ro(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["circle",{cx:"11",cy:"11",r:"8"}],["path",{d:"m21 21-4.3-4.3"}]];j(e,D({name:"search"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Lo(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"}],["circle",{cx:"12",cy:"12",r:"3"}]];j(e,D({name:"settings"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Go(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["circle",{cx:"12",cy:"12",r:"10"}],["circle",{cx:"12",cy:"12",r:"6"}],["circle",{cx:"12",cy:"12",r:"2"}]];j(e,D({name:"target"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Oo(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["line",{x1:"10",x2:"14",y1:"2",y2:"2"}],["line",{x1:"12",x2:"15",y1:"14",y2:"11"}],["circle",{cx:"12",cy:"14",r:"8"}]];j(e,D({name:"timer"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function Eo(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{cx:"9",cy:"7",r:"4"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87"}],["path",{d:"M16 3.13a4 4 0 0 1 0 7.75"}]];j(e,D({name:"users"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function kt(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["path",{d:"M18 6 6 18"}],["path",{d:"m6 6 12 12"}]];j(e,D({name:"x"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}function jo(e,t){const o=W(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.474.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const r=[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"}]];j(e,D({name:"zap"},()=>o,{get iconNode(){return r},children:(n,i)=>{var s=G(),a=T(s);V(a,t,"default",{}),v(n,s)},$$slots:{default:!0}}))}var Vo=I('<button class="text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded-md" aria-label="Close sidebar"><!></button>'),Wo=I('<a class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground transition-colors"><!> </a>'),Do=I('<a class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground transition-colors"><!> </a>'),Fo=I('<a class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground transition-colors"><!> </a>'),Bo=I('<button class="fixed inset-0 z-40 bg-black/50" aria-label="Close sidebar"></button>'),Uo=I('<aside data-slot="sidebar"><div class="flex h-14 items-center justify-between px-4"><span class="text-sm font-semibold truncate"> </span> <div class="flex items-center gap-1"><button class="text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded-md hover:bg-sidebar-accent" aria-label="Search"><!></button> <!></div></div> <div class="px-3 pb-2"><button class="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border px-3 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"><!> New Issue</button></div> <nav class="flex-1 overflow-y-auto px-3 pb-4"><div class="space-y-0.5"></div> <div class="mt-6"><div class="mb-1 px-2 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">Work</div> <div class="space-y-0.5"></div></div> <div class="mt-6"><div class="mb-1 px-2 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">Company</div> <div class="space-y-0.5"></div></div></nav></aside> <!>',1);function Ho(e,t){Te(t,!0);const o=()=>St(Nt,"$page",r),[r,n]=Ct(),i=De(()=>{var _;return((_=je.selectedCompany)==null?void 0:_.slug)??je.selectedCompanyId??""}),s=[{label:"Dashboard",href:"dashboard",icon:No},{label:"Inbox",href:"inbox",icon:Ao}],a=[{label:"Issues",href:"issues",icon:Io},{label:"Routines",href:"routines",icon:Oo},{label:"Goals",href:"goals",icon:Go}],d=[{label:"Agents",href:"agents",icon:jo},{label:"Projects",href:"projects",icon:So},{label:"Org",href:"org",icon:Eo},{label:"Costs",href:"costs",icon:Co},{label:"Activity",href:"activity",icon:Mo},{label:"Settings",href:"settings",icon:Lo}];function g(_){return o().url.pathname.includes(`/${f(i)}/${_}`)}var p=Uo(),b=T(p),M=$(b),S=$(M),O=$(S,!0);y(S);var A=N(S,2),C=$(A),U=$(C);Ro(U,{class:"size-4"}),y(C);var X=N(C,2);{var H=_=>{var x=Vo(),z=$(x);kt(z,{class:"size-4"}),y(x),Ie("click",x,()=>q.set(!1)),v(_,x)};Q(X,_=>{q.isMobile&&_(H)})}y(A),y(M);var F=N(M,2),w=$(F),k=$(w);To(k,{class:"size-3.5"}),zt(),y(w),y(F);var L=N(F,2),u=$(L);xe(u,21,()=>s,Ne,(_,x)=>{var z=Wo(),m=$(z);Oe(m,()=>f(x).icon,(B,re)=>{re(B,{class:"size-4 shrink-0"})});var oe=N(m);y(z),J(B=>{ne(z,"href",`/${f(i)}/${f(x).href}`),ne(z,"data-active",B),ee(oe,` ${f(x).label??""}`)},[()=>g(f(x).href)]),v(_,z)}),y(u);var Y=N(u,2),pe=N($(Y),2);xe(pe,21,()=>a,Ne,(_,x)=>{var z=Do(),m=$(z);Oe(m,()=>f(x).icon,(B,re)=>{re(B,{class:"size-4 shrink-0"})});var oe=N(m);y(z),J(B=>{ne(z,"href",`/${f(i)}/${f(x).href}`),ne(z,"data-active",B),ee(oe,` ${f(x).label??""}`)},[()=>g(f(x).href)]),v(_,z)}),y(pe),y(Y);var ge=N(Y,2),ie=N($(ge),2);xe(ie,21,()=>d,Ne,(_,x)=>{var z=Fo(),m=$(z);Oe(m,()=>f(x).icon,(B,re)=>{re(B,{class:"size-4 shrink-0"})});var oe=N(m);y(z),J(B=>{ne(z,"href",`/${f(i)}/${f(x).href}`),ne(z,"data-active",B),ee(oe,` ${f(x).label??""}`)},[()=>g(f(x).href)]),v(_,z)}),y(ie),y(ge),y(L),y(b);var we=N(b,2);{var be=_=>{var x=Bo();Ie("click",x,()=>q.set(!1)),v(_,x)};Q(we,_=>{q.isMobile&&q.open&&_(be)})}J(_=>{var x;Be(b,1,_),ee(O,((x=je.selectedCompany)==null?void 0:x.name)??"ClawDev")},[()=>Fe(Ke("bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-60 shrink-0 flex-col border-r",q.isMobile&&"fixed inset-y-0 left-0 z-50 shadow-xl",q.isMobile&&!q.open&&"-translate-x-full","transition-transform duration-200"))]),v(e,p),Re(),n()}Ue(["click"]);var Yo=I('<button class="p-1 -ml-1 rounded-md hover:bg-accent" aria-label="Toggle sidebar"><!></button>'),Ko=I("<div></div>"),qo=I('<h1 class="text-sm font-semibold truncate"> </h1>'),Xo=I('<span class="text-muted-foreground/40">/</span>'),Zo=I('<a class="hover:text-foreground transition-colors truncate max-w-[120px]"> </a>'),Jo=I("<span> </span>"),Qo=I("<!> <!>",1),er=I('<nav class="flex items-center gap-1.5 text-sm text-muted-foreground truncate"></nav>'),tr=I('<header data-slot="breadcrumb-bar" class="flex h-14 shrink-0 items-center gap-3 border-b px-4"><!> <!></header>');function or(e,t){Te(t,!0);const o=De(()=>It.items);var r=tr(),n=$(r);{var i=p=>{var b=Yo(),M=$(b);Po(M,{class:"size-5"}),y(b),Ie("click",b,()=>q.toggle()),v(p,b)};Q(n,p=>{q.isMobile&&p(i)})}var s=N(n,2);{var a=p=>{var b=Ko();v(p,b)},d=p=>{var b=qo(),M=$(b,!0);y(b),J(()=>ee(M,f(o)[0].label)),v(p,b)},g=p=>{var b=er();xe(b,21,()=>f(o),Ne,(M,S,O)=>{var A=Qo(),C=T(A);{var U=w=>{var k=Xo();v(w,k)};Q(C,w=>{O>0&&w(U)})}var X=N(C,2);{var H=w=>{var k=Zo(),L=$(k,!0);y(k),J(()=>{ne(k,"href",f(S).href),ee(L,f(S).label)}),v(w,k)},F=w=>{var k=Jo(),L=$(k,!0);y(k),J(u=>{Be(k,1,u),ee(L,f(S).label)},[()=>Fe(Ke(O===f(o).length-1&&"text-foreground font-medium","truncate max-w-[200px]"))]),v(w,k)};Q(X,w=>{O<f(o).length-1&&f(S).href?w(H):w(F,-1)})}v(M,A)}),y(b),v(p,b)};Q(s,p=>{f(o).length===0?p(a):f(o).length===1?p(d,1):p(g,-1)})}y(r),v(e,r),Re()}Ue(["click"]);const rr={info:4e3,success:3500,warn:8e3,error:1e4},sr=1500,nr=15e3,ar=3500;let ue=fe(ye([]));const ve=new Map,Se=new Map;function ir(e){var t;return e.dedupeKey??`${e.tone??"info"}|${e.title}|${e.body??""}|${((t=e.action)==null?void 0:t.href)??""}`}const st={get items(){return f(ue)},push(e){const t=Date.now(),o=ir(e),r=Se.get(o);if(r&&t-r<ar)return;Se.set(o,t);for(const[g,p]of Se)t-p>2e4&&Se.delete(g);const n=e.tone??"info",i=Math.min(nr,Math.max(sr,e.ttlMs??rr[n]??4e3)),s=e.id??crypto.randomUUID(),a={id:s,title:e.title,body:e.body,tone:n,ttlMs:i,action:e.action,createdAt:t};Z(ue,[...f(ue),a].slice(-5),!0);const d=setTimeout(()=>this.dismiss(s),i);ve.set(s,d)},dismiss(e){const t=ve.get(e);t&&(clearTimeout(t),ve.delete(e)),Z(ue,f(ue).filter(o=>o.id!==e),!0)},clear(){for(const e of ve.values())clearTimeout(e);ve.clear(),Z(ue,[],!0)}};var lr=I('<p class="text-xs opacity-80 mt-0.5 line-clamp-2"> </p>'),cr=I('<a class="text-xs font-medium underline underline-offset-2 mt-1 inline-block"> </a>'),dr=I('<div><div class="flex-1 min-w-0"><p class="text-sm font-medium truncate"> </p> <!> <!></div> <button class="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5" aria-label="Dismiss"><!></button></div>'),mr=I('<div class="fixed bottom-4 left-4 z-[120] flex flex-col gap-2 w-80" role="region" aria-live="polite" aria-label="Notifications"></div>');function ur(e,t){Te(t,!0);const o=De(()=>st.items),r={info:"border-border bg-card text-card-foreground",success:"border-green-500/30 bg-green-950/80 text-green-100",warn:"border-yellow-500/30 bg-yellow-950/80 text-yellow-100",error:"border-destructive/30 bg-red-950/80 text-red-100"};var n=G(),i=T(n);{var s=a=>{var d=mr();xe(d,21,()=>f(o),g=>g.id,(g,p)=>{var b=dr(),M=$(b),S=$(M),O=$(S,!0);y(S);var A=N(S,2);{var C=w=>{var k=lr(),L=$(k,!0);y(k),J(()=>ee(L,f(p).body)),v(w,k)};Q(A,w=>{f(p).body&&w(C)})}var U=N(A,2);{var X=w=>{var k=cr(),L=$(k,!0);y(k),J(()=>{ne(k,"href",f(p).action.href),ee(L,f(p).action.label)}),v(w,k)};Q(U,w=>{f(p).action&&w(X)})}y(M);var H=N(M,2),F=$(H);kt(F,{class:"size-3.5"}),y(H),y(b),J(w=>{Be(b,1,w),ee(O,f(p).title)},[()=>Fe(Ke("flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in-0 duration-200",r[f(p).tone]))]),Ie("click",H,()=>st.dismiss(f(p).id)),v(g,b)}),y(d),v(a,d)};Q(i,a=>{f(o).length>0&&a(s)})}v(e,n),Re()}Ue(["click"]);const $t="paperclip.theme";function fr(){if(typeof window>"u")return"dark";const e=localStorage.getItem($t);return e==="light"||e==="dark"?e:(document.documentElement.classList.contains("dark"),"dark")}function nt(e){if(typeof document>"u")return;const t=document.documentElement;t.classList.toggle("dark",e==="dark"),t.style.colorScheme=e;const o=document.querySelector('meta[name="theme-color"]');o&&o.setAttribute("content",e==="dark"?"#18181b":"#ffffff")}let Ae=fe(ye(fr()));const pr={get current(){return f(Ae)},set(e){Z(Ae,e,!0),localStorage.setItem($t,e),nt(e)},toggle(){this.set(f(Ae)==="dark"?"light":"dark")},init(){nt(f(Ae))}};var gr=I('<div class="flex h-full overflow-hidden"><!> <div class="flex flex-1 flex-col min-w-0 overflow-hidden"><!> <main class="flex-1 overflow-y-auto"><!></main></div></div> <!>',1);function Ir(e,t){Te(t,!0),_t(()=>{pr.init(),q.init()});var o=gr(),r=T(o),n=$(r);{var i=b=>{Ho(b,{})};Q(n,b=>{(q.open||!q.isMobile)&&b(i)})}var s=N(n,2),a=$(s);or(a,{});var d=N(a,2),g=$(d);Mt(g,()=>t.children),y(d),y(s),y(r);var p=N(r,2);ur(p,{}),v(e,o),Re()}export{Ir as component,Nr as universal};
