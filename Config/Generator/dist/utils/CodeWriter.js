"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),exports.CodeWriter=void 0;const t=require("./LineBreak");class e{constructor(){this.singleIndent="    ",this._content="",this._addCount=0,this.lineBreak=t.LineBreak.CRLF}get lineBreak(){return this._lineBreak}set lineBreak(e){switch(this._lineBreak=e){case t.LineBreak.CRLF:this._lineBreakStr="\r\n";break;case t.LineBreak.LF:this._lineBreakStr="\n"}}get lineBreakStr(){return this._lineBreakStr}get content(){return this._content}get addCount(){return this._addCount}add(e,t,n=1){let r="";for(;0<e;)r+=this.singleIndent,e--;this._content+=r+t,"number"==typeof n?0<n&&this.newLine(n):!0===n&&this.newLine(1),this._addCount++}addStr(e){this._content+=e}newLine(e=1){for(;0<e;)this._content+=this._lineBreakStr,e--}clear(){this._content="",this._addCount=0}}exports.CodeWriter=e;