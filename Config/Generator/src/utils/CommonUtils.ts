import fs from "fs";
import {IOUtils} from "./IOUtils";
import cli from "cli-color";
import {StrUtils} from "./StrUtils";
import {CodeLang} from "../CodeLang";
import {DataModel} from "../DataModel";
import {IConfigExport} from "../IConfigExport";

/**
 * @Doc 通用工具
 * @Author kL
 * @Date 2019/3/17 20:13
 */
export class CommonUtils {

    /**
     * 获取模板
     * @param exportID
     * @param filename
     * @returns
     */
    public static getTemplate(expt: IConfigExport, filename: string) {
        let url = `templates/${expt.template_name || expt.id}/template/${filename}`;
        if (IOUtils.fileOrFolderIsExsit(url)) {
            return fs.readFileSync(url, "utf-8");
        }
        console.log(cli.red(`找不到模板文件！${url}`));
    }

    /**
     * 判断数字是否为整数
     * @param {string|int} param
     * @returns
     */
    public static numIsInt(param) {
        if (param === "" || isNaN(param))
            return false;
        return parseInt(param) == parseFloat(param);
    }

    /**
     * 判断数字是否为浮点数
     * @param {string|int} param
     * @returns
     */
    public static numIsFloat(param) {
        if (param === "" || isNaN(param))
            return false;
        return parseInt(param) != parseFloat(param);
    }

    /**
     * 深度复制
     * @param object
     */
    public static deepClone(object: any): any {
        if (object instanceof Array) {
            let array: any[] = [];
            let len = object.length;
            for (let n = 0; n < len; n++) {
                array.push(this.deepClone(object[n]));
            }
            return array;
        } else if (object instanceof Object) {
            let obj = {};
            for (let fieldKey in object) {
                if (object.hasOwnProperty(fieldKey)) {
                    obj[fieldKey] = this.deepClone(object[fieldKey]);
                }
            }
            return obj;
        } else {
            return object;
        }
    }

    /**
     * 转换字符串为对象
     * @param str
     * @param tidy
     * @returns
     */
    public static convertStringToObj(str: string, tidy?: boolean): {
        obj: any,
        isString: boolean,
        mayBeArray?: boolean,
        mayBeObj?: boolean
    } {
        let result: any = {};

        let obj: any;
        let suc = false;

        if (tidy && str && str.replace) {
            str = str.replace(/\t/g, '').replace(/\r/g, '').replace(/\n/g, '');
        }

        try {
            obj = JSON.parse(str);
            suc = true;
        } catch (err) {

        }

        result.obj = suc ? obj : str;
        result.isString = typeof result.obj == "string";

        // if (!suc && result.isString) {
        //     let a = StringUtils.getStrCharNum(str, "[");
        //     let b = StringUtils.getStrCharNum(str, "]");
        //     if (a >= 2 && b >= 2) {
        //         result.mayBeArray = true;
        //     }

        //     a = StringUtils.getStrCharNum(str, "{");
        //     b = StringUtils.getStrCharNum(str, "}");
        //     let c = StringUtils.getStrCharNum(str, ":");
        //     if (a >= 1 && b >= 1 && c >= 1) {
        //         result.mayBeObj = true;
        //     }
        // }

        return result;
    }

    /**
     * 获取注释字符串
     * @param codeLang
     * @param str
     * @param indent
     * @param tab
     * @returns
     */
    public static getCommentStr(codeLang: CodeLang, str: string, indent = 0, tab?: boolean) {
        if (str == null)
            return "";
        if (typeof str != "string")
            str = str + "";
        str.replace(/\r/, "");
        let lines = str.split("\n");
        let result = "";
        switch (codeLang) {
            case CodeLang.CS:
            case CodeLang.ETCS: {
                result += StrUtils.getIndentStr(indent) + "/// <summary>\n";
                for (let n = 0; n < lines.length; n++) {
                    result += StrUtils.getIndentStr(indent) + "/// " + lines[n] + "\n";
                }
                result += StrUtils.getIndentStr(indent, tab) + "/// </summary>";
                break;
            }
            case CodeLang.TS: {
                result += StrUtils.getIndentStr(indent) + "/**\n";
                for (let n = 0; n < lines.length; n++) {
                    result += StrUtils.getIndentStr(indent) + " * " + lines[n] + "\n";
                }
                result += StrUtils.getIndentStr(indent, tab) + " */";
                break;
            }
        }

        return result;
    }
}

