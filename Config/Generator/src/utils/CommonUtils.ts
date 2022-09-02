import fs from "fs";
import {IOUtils} from "./IOUtils";
import cli from "cli-color";

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
    public static getTemplate(exportID: number, filename: string) {
        let url = `templates/${exportID}/template/${filename}`;
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
}

