import{r as v,j as y,d as B,R as H}from"./main-BvO_9lUK.js";function $(e,r){typeof e=="function"?e(r):e!=null&&(e.current=r)}function R(...e){return r=>e.forEach(t=>$(t,r))}function z(...e){return v.useCallback(R(...e),e)}var V=v.forwardRef((e,r)=>{const{children:t,...n}=e,a=v.Children.toArray(t),o=a.find(M);if(o){const l=o.props.children,c=a.map(u=>u===o?v.Children.count(l)>1?v.Children.only(null):v.isValidElement(l)?l.props.children:null:u);return y.jsx(k,{...n,ref:r,children:v.isValidElement(l)?v.cloneElement(l,void 0,c):null})}return y.jsx(k,{...n,ref:r,children:t})});V.displayName="Slot";var k=v.forwardRef((e,r)=>{const{children:t,...n}=e;if(v.isValidElement(t)){const a=S(t);return v.cloneElement(t,{...F(n,t.props),ref:r?R(r,a):a})}return v.Children.count(t)>1?v.Children.only(null):null});k.displayName="SlotClone";var D=({children:e})=>y.jsx(y.Fragment,{children:e});function M(e){return v.isValidElement(e)&&e.type===D}function F(e,r){const t={...r};for(const n in r){const a=e[n],o=r[n];/^on[A-Z]/.test(n)?a&&o?t[n]=(...c)=>{o(...c),a(...c)}:a&&(t[n]=a):n==="style"?t[n]={...a,...o}:n==="className"&&(t[n]=[a,o].filter(Boolean).join(" "))}return{...e,...t}}function S(e){var n,a;let r=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,t=r&&"isReactWarning"in r&&r.isReactWarning;return t?e.ref:(r=(a=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:a.get,t=r&&"isReactWarning"in r&&r.isReactWarning,t?e.props.ref:e.props.ref||e.ref)}function x(e){var r,t,n="";if(typeof e=="string"||typeof e=="number")n+=e;else if(typeof e=="object")if(Array.isArray(e))for(r=0;r<e.length;r++)e[r]&&(t=x(e[r]))&&(n&&(n+=" "),n+=t);else for(r in e)e[r]&&(n&&(n+=" "),n+=r);return n}function E(){for(var e,r,t=0,n="";t<arguments.length;)(e=arguments[t++])&&(r=x(e))&&(n&&(n+=" "),n+=r);return n}const O=e=>typeof e=="boolean"?"".concat(e):e===0?"0":e,_=E,U=(e,r)=>t=>{var n;if((r==null?void 0:r.variants)==null)return _(e,t==null?void 0:t.class,t==null?void 0:t.className);const{variants:a,defaultVariants:o}=r,l=Object.keys(a).map(i=>{const d=t==null?void 0:t[i],s=o==null?void 0:o[i];if(d===null)return null;const f=O(d)||O(s);return a[i][f]}),c=t&&Object.entries(t).reduce((i,d)=>{let[s,f]=d;return f===void 0||(i[s]=f),i},{}),u=r==null||(n=r.compoundVariants)===null||n===void 0?void 0:n.reduce((i,d)=>{let{class:s,className:f,...h}=d;return Object.entries(h).every(m=>{let[b,g]=m;return Array.isArray(g)?g.includes({...o,...c}[b]):{...o,...c}[b]===g})?[...i,s,f]:i},[]);return _(e,l,u,t==null?void 0:t.class,t==null?void 0:t.className)},q=U("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",{variants:{variant:{default:"bg-primary text-primary-foreground hover:bg-primary/90",destructive:"bg-destructive text-destructive-foreground hover:bg-destructive/90",outline:"border border-input bg-background hover:bg-accent hover:text-accent-foreground",secondary:"bg-secondary text-secondary-foreground hover:bg-secondary/80",ghost:"hover:bg-accent hover:text-accent-foreground",link:"text-primary underline-offset-4 hover:underline",circular:"bg-primary text-primary-foreground hover:bg-primary/90 rounded-full outline outline-2 outline-background shadow-md"},size:{default:"h-10 px-4 py-2",sm:"h-9 rounded-md px-3",lg:"h-11 rounded-md px-8",icon:"h-10 w-10"},isActive:{true:"bg-primary dark:outline-primary/30",false:"bg-white dark:bg-background/90 text-primary hover:text-white hover:outline-white outline-primary dark:outline-primary/30"}},defaultVariants:{isActive:!1,variant:"default",size:"default"}}),G=v.forwardRef(({className:e,variant:r,size:t,isActive:n,asChild:a=!1,...o},l)=>{const c=a?V:"button";return y.jsx(c,{className:B(q({variant:r,size:t,className:e,isActive:n})),ref:l,...o})});G.displayName="Button";var K=Object.defineProperty,w=Object.getOwnPropertySymbols,N=Object.prototype.hasOwnProperty,W=Object.prototype.propertyIsEnumerable,j=(e,r,t)=>r in e?K(e,r,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[r]=t,L=(e,r)=>{for(var t in r||(r={}))N.call(r,t)&&j(e,t,r[t]);if(w)for(var t of w(r))W.call(r,t)&&j(e,t,r[t]);return e},Z=(e,r)=>{var t={};for(var n in e)N.call(e,n)&&r.indexOf(n)<0&&(t[n]=e[n]);if(e!=null&&w)for(var n of w(e))r.indexOf(n)<0&&W.call(e,n)&&(t[n]=e[n]);return t};function J(e){let r=!1;return()=>{r||(r=!0,requestAnimationFrame(()=>{e(),r=!1}))}}var I=({fontSizePx:e,minFontSizePx:r,fontSizePrecisionPx:t,updateFontSizePx:n,breakPredicate:a})=>{const o=Math.ceil(1/t);let l=0;for(;e>r&&l<o&&!a();)e=n(e-t),l++},p=e=>{const r=getComputedStyle(e);return e.clientWidth-parseFloat(r.paddingLeft)-parseFloat(r.paddingRight)},C=e=>{const r=getComputedStyle(e);return e.clientHeight-parseFloat(r.paddingTop)-parseFloat(r.paddingBottom)},Q=e=>{e.innerEl.style.whiteSpace="nowrap",T(e),e.innerEl.scrollWidth>p(e.containerEl)&&(e.innerEl.style.whiteSpace="normal")},T=({innerEl:e,containerEl:r,fontSizePx:t,minFontSizePx:n,maxFontSizePx:a,fontSizePrecisionPx:o,updateFontSizePx:l})=>{let u=0,i=1;for(;u<10;){const d=e.scrollWidth,s=p(r),f=t<a&&d<s,h=t>n&&d>s,m=d/s;if(i===m||!(f||h))break;const b=t/m-t,g=t;if(t=l(t+b),Math.abs(t-g)<=o)break;i=m,u++}I({fontSizePx:t,minFontSizePx:n,updateFontSizePx:l,fontSizePrecisionPx:o,breakPredicate:()=>e.scrollWidth<=p(r)})},A=({innerEl:e,containerEl:r,fontSizePx:t,minFontSizePx:n,maxFontSizePx:a,fontSizePrecisionPx:o,updateFontSizePx:l})=>{t=l((a-n)*.5);let u=(a-n)*.25,i=0;for(;u>o&&i<100;){const d=e.scrollWidth,s=p(r),f=e.scrollHeight,h=C(r);if(d===s&&f===h)break;t<a&&d<=s&&f<=h?t=l(t+u):t>n&&(d>s||f>h)&&(t=l(t-u)),u*=.5,i++}I({fontSizePx:t,minFontSizePx:n,updateFontSizePx:l,fontSizePrecisionPx:o,breakPredicate:()=>e.scrollWidth<=p(r)&&e.scrollHeight<=C(r)})};function X({innerEl:e,containerEl:r,mode:t="multiline",minFontSizePx:n=8,maxFontSizePx:a=160,fontSizePrecisionPx:o=.1}){if(performance.now(),!isFinite(n))throw new Error(`Invalid minFontSizePx (${n})`);if(!isFinite(n))throw new Error(`Invalid maxFontSizePx (${a})`);if(!isFinite(o)||o===0)throw new Error(`Invalid fontSizePrecisionPx (${o})`);r.children.length>1&&console.warn(`AutoTextSize has ${r.children.length-1} siblings. This may interfere with the algorithm.`);const l={display:"flex",alignItems:"start"},c={display:"block"};t==="oneline"?c.whiteSpace="nowrap":t==="multiline"?c.wordBreak="break-word":t==="box"?(c.whiteSpace="pre-wrap",c.wordBreak="break-word"):t==="boxoneline"&&(c.whiteSpace="nowrap"),Object.assign(r.style,l),Object.assign(e.style,c);const u=window.getComputedStyle(e,null).getPropertyValue("font-size");let i=parseFloat(u);const d=f=>(f=Math.min(Math.max(f,n),a),i=f,e.style.fontSize=`${i}px`,i);(i>a||i<n)&&d(i);const s={innerEl:e,containerEl:r,fontSizePx:i,minFontSizePx:n,maxFontSizePx:a,fontSizePrecisionPx:o,updateFontSizePx:d};t==="oneline"?T(s):t==="multiline"?Q(s):(t==="box"||t==="boxoneline")&&A(s)}function Y({innerEl:e,containerEl:r,mode:t,minFontSizePx:n,maxFontSizePx:a,fontSizePrecisionPx:o}){let l;const c=J(()=>{X({innerEl:e,containerEl:r,mode:t,maxFontSizePx:a,minFontSizePx:n,fontSizePrecisionPx:o}),l=[p(r),C(r)]}),u=new ResizeObserver(()=>{const i=l;l=[p(r),C(r)],((i==null?void 0:i[0])!==l[0]||(i==null?void 0:i[1])!==l[1])&&c()});return u.observe(r),c.disconnect=()=>u.disconnect(),c}function ee(e){var r=e,{mode:t,minFontSizePx:n,maxFontSizePx:a,fontSizePrecisionPx:o,as:l="div",children:c}=r,u=Z(r,["mode","minFontSizePx","maxFontSizePx","fontSizePrecisionPx","as","children"]);const i=v.useRef();v.useEffect(()=>{var s;return(s=i.current)==null?void 0:s.call(i)},[c]);const d=v.useCallback(s=>{var f;(f=i.current)==null||f.disconnect();const h=s==null?void 0:s.parentElement;!s||!h||(i.current=Y({innerEl:s,containerEl:h,mode:t,minFontSizePx:n,maxFontSizePx:a,fontSizePrecisionPx:o}))},[t,n,a,o]);return H.createElement(l,L({ref:d},u),c)}export{ee as A,G as B,V as S,X as a,R as c,z as u};
//# sourceMappingURL=index-BbI8HaA5.js.map
