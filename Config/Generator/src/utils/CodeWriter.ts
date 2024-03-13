import {LineBreak} from "./LineBreak";
import {StrUtils} from "./StrUtils";

export class CodeWriter {
    private _lineBreak: LineBreak;
    public get lineBreak() {
        return this._lineBreak;
    }

    public set lineBreak(value: LineBreak) {
        this._lineBreak = value;
        switch (value) {
            case LineBreak.CRLF: {
                this._lineBreakStr = "\r\n";
                break;
            }
            case LineBreak.LF: {
                this._lineBreakStr = "\n";
                break;
            }
        }
    }

    private _lineBreakStr: string;
    public get lineBreakStr() {
        return this._lineBreakStr;
    }

    private _content: string = "";
    public get content() {
        return this._content;
    }

    private _addCount: number = 0;
    public get addCount() {
        return this._addCount;
    }

    constructor() {
        this.lineBreak = LineBreak.CRLF;
    }

    public add(indent: number, str: string, newLine: number | boolean = 1) {
        this._content += StrUtils.getIndentStr(indent) + str;

        if (typeof newLine == "number") {
            if (newLine > 0) {
                this.newLine(newLine);
            }
        } else if (newLine === true) {
            this.newLine(1);
        }

        this._addCount++;
    }

    public addStr(str: string) {
        this._content += str;
    }

    public newLine(num: number = 1) {
        while (num > 0) {
            this._content += this._lineBreakStr;
            num--;
        }
    }

    public clear() {
        this._content = "";
        this._addCount = 0;
    }
}