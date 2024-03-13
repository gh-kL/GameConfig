"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),exports.StrUtils=void 0;class t{static format(t,...e){if(null!=t&&0<arguments.length){if(1!=arguments.length)if(2==arguments.length&&"object"==typeof e){if(!e)return"";for(var r=0;r<e.length;r++)null!=e[r]&&(n=new RegExp("([【{]"+r+"[】}])","g"),t=t.replace(n,e[r].toString()))}else for(var n,r=1;r<arguments.length;r++)null!=arguments[r]&&(n=new RegExp("([【{]"+(r-1)+"[】}])","g"),t=t.replace(n,arguments[r].toString()));return t}return""}static getStrNum(t){let e=[],r=t.match(/\d+/g);if(r)return r.forEach(t=>{e.push(+t)}),1==e.length?e[0]:e}static convertToLowerCamelCase(t,e=!1){return(e?"_":"")+(t=this.convertToNoUnderline(t))[0].toLowerCase()+t.substring(1,t.length)}static convertToUpperCamelCase(t){return(t=this.convertToNoUnderline(t))[0].toUpperCase()+t.substring(1,t.length)}static convertToNoUnderline(t){var e=t;if(0<=t.indexOf("_")){var e="",r=t.split("_");for(let t=0;t<r.length;t++){var n=r[t];0<t?e+=n[0].toUpperCase()+n.substring(1,n.length):e+=n}}return e}static getStrCharNum(e,r){let n=0;if(e)for(let t=e.length-1;0<=t;t--)e[t]==r&&n++;return n}static genPassword(t=8,e=!0,r=!0,n=!1,o=!0,l=!1){var a="";if(e||r||n){for(var s=t;0<=s;s--){var i=Math.floor(94*Math.random()+33);!e&&48<=i&&i<=57||!r&&(65<=i&&i<=90||97<=i&&i<=122)||!n&&(33<=i&&i<=47||58<=i&&i<=64||91<=i&&i<=96||123<=i&&i<=127)?s++:a+=String.fromCharCode(i)}null==o||o||(a=l?a.toLowerCase():a.toUpperCase())}return a}static getIndentStr(e,r){let n="";for(let t=0;t<e;t++)n+=r?"\t":"    ";return n}}exports.StrUtils=t;