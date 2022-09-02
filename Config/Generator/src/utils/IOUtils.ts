import cli from "cli-color";
import fs from "fs";
import path from "path";
import { StringUtils } from "./StringUtils";
import EncLatin1 from "crypto-js/enc-latin1";
import EncHex from "crypto-js/enc-hex";
import MD5 from "crypto-js/md5";
import { LineBreak } from "./LineBreak";

/**
 * @Doc 通用工具
 * @Author kL
 * @Date 2019/3/19 10:59
 */
export class IOUtils {
    /**
     * 创建路径
     * 使用示例：utility.makeDir(path.join(__dirname, './mkdir/demo/test/'));
     * @param {string} dir 路径
     * @param {function} cb 回调
     */
    public static makeDir(dir: string) {
        if (fs.existsSync(dir)) {
            return true;
        } else {
            if (this.makeDir(path.dirname(dir))) {
                fs.mkdirSync(dir);
                return true;
            }
        }
    }

    /**
     * 递归文件夹获取指定类型文件
     * @param {string} dir 路径
     * @param {array} [exts=[]] 扩展名
     * @param {array} [filesList=[]] 文件列表
     * @returns
     */
    public static findFile(dir: string, exts: string[] = [], filesList: string[] = []) {
        const files = fs.readdirSync(dir);
        files.forEach(item => {
            var fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                this.findFile(path.join(dir, item), exts, filesList);
            } else {
                let extName: string = path.extname(fullPath);
                if (!exts.length || exts.indexOf(extName) != -1) {
                    filesList.push(fullPath);
                }
            }
        });
        return filesList;
    }

    /**
     * 按条件递归文件夹获取文件
     * @param {string} folderPath 文件夹路径
     * @param {function} condition 条件
     * @param {array} filesList 文件列表
     */
    public static findFileByCondition(folderPath: string, condition: Function, filesList: string[] = []) {
        if (fs.existsSync(folderPath)) {  // 如果存在路径
            let files = fs.readdirSync(folderPath);   // 读取目录下所有文件
            files.forEach(filename => {
                let fullPath = path.join(folderPath, filename);
                // 如果是文件夹
                if (fs.statSync(fullPath).isDirectory()) {
                    this.findFileByCondition(fullPath, condition, filesList);    // 递归
                } else {
                    // 如果条件符合
                    if (condition(fullPath)) {
                        filesList.push(fullPath);
                    }
                }
            });
        }
    }

    /**
     * 递归文件夹获取文件夹
     * @param {string} dir 路径
     * @param {array} [dirList=[]] 文件列表
     * @returns
     */
    public static findDirectory(dir: string, dirList: string[] = []) {
        const files = fs.readdirSync(dir);
        files.forEach(item => {
            let fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                dirList.push(fullPath);
                this.findDirectory(path.join(dir, item), dirList);
            }
        });
        return dirList;
    }

    /**
     * 按条件递归文件夹获取文件夹
     * @param {string} dir 路径
     * @param {function} condition 条件
     * @param {array} [dirList=[]] 文件列表
     * @returns
     */
    public static findDirectoryByCondition(dir: string, condition: Function, dirList: string[] = []) {
        const files = fs.readdirSync(dir);
        files.forEach(item => {
            var fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (condition(fullPath)) {
                    dirList.push(fullPath);
                }
                this.findDirectory(path.join(dir, item), dirList);
            }
        });
        return dirList;
    }

    /**
     * 删除文件
     * @param path 文件路径
     */
    public static deleteFile(path: string) {
        if (fs.existsSync(path)) {  // 如果存在路径
            fs.unlinkSync(path); // 删除文件
        }
    }

    /**
     * 按条件递归删除指定目录下的所有文件
     * @param {string} folderPath 文件夹路径
     * @param {条件} condition 条件
     */
    public static deleteFolderFileByCondition(folderPath: string, condition: Function) {
        if (fs.existsSync(folderPath)) {  // 如果存在路径
            let files = fs.readdirSync(folderPath);   // 读取目录下所有文件
            files.forEach(filename => {
                let fullPath = path.join(folderPath, filename);
                // 如果是文件夹
                if (fs.statSync(fullPath).isDirectory()) {
                    this.deleteFolderFileByCondition(fullPath, condition);    // 递归
                } else {
                    // 如果条件符合
                    if (condition(fullPath)) {
                        fs.unlinkSync(fullPath); // 删除文件
                    }
                }
            });
        }
    }

    /**
     * 递归删除指定目录下的所有文件
     * @param {string} folderPath 文件夹路径
     * @param {boolean} delRootDir 是否删除根目录
     */
    public static deleteFolderFile(folderPath: string, delRootDir = true) {
        let files = [];
        if (fs.existsSync(folderPath)) {  // 如果存在路径
            files = fs.readdirSync(folderPath);   // 读取目录下所有文件
            files.forEach(file => {
                let curPath = folderPath + "/" + file;
                if (fs.statSync(curPath).isDirectory()) {   // 如果是文件夹
                    this.deleteFolderFile(curPath);    // 递归删除
                } else {
                    fs.unlinkSync(curPath); // 删除文件
                }
            });
            if (delRootDir) {
                fs.rmdirSync(folderPath); // 删除文件夹本身
            }
        }
    }

    /**
     * 判断文件（夹）是否存在
     * @param path
     */
    public static fileOrFolderIsExsit(path: string) {
        try {
            fs.accessSync(path);
            return true;
        } catch (e) {
            // 文件不存在
            return false;
        }
    }

    /**
     * 获取文件MD5
     * @param filePath
     */
    public static getFileMD5(filePath: string) {
        if (this.fileOrFolderIsExsit(filePath)) {
            let content = fs.readFileSync(filePath, { encoding: "latin1" });
            return MD5(EncLatin1.parse(content)).toString(EncHex);
        }
    }

    /**
     * 写入文件
     * @param {string} writePath 写入路径
     * @param {*} content 内容
     * @param {string} succeedLog 成功文本
     * @param {string} failedLog 失败文本
     * @returns
     */
    public static writeTextFile(writePath: string, content: string, lineBreak?: LineBreak, succeedLog?: string, failedLog?: string) {
        if (!content) {
            return console.log(cli.yellow(`Cannot write null. ->${writePath}`));
        }
        // 换行符转换
        if (lineBreak != null) {
            switch (lineBreak) {
                case LineBreak.CRLF: {
                    let pwd = StringUtils.genPassword(8);
                    content = content.replace(/\r\n/g, pwd);
                    content = content.replace(/\n/g, `\r\n`);
                    content = content.replace(/\r/g, ``);
                    var reg = "/" + pwd + "/g";
                    content = content.replace(eval(reg), `\r\n`);
                    break;
                }
                case LineBreak.LF: {
                    content = content.replace(/\r/g, ``);
                    break;
                }
            }
        }
        try {
            fs.writeFileSync(
                writePath,
                content,
                {
                    encoding: "utf-8"
                }
            );
            if (succeedLog) {
                console.log(cli.green(StringUtils.format(succeedLog, writePath)));
            }
        } catch (error) {
            if (failedLog) {
                console.log(cli.red(StringUtils.format(failedLog, writePath, error || "")));
            } else if (failedLog == null) {
                throw error;
            }
        }
    }

    /**
     * 复制
     * @param {string} from
     * @param {string} to
     */
    public static copy(from: string, to: string) {
        if (fs.existsSync(from) == false)
            return false;

        this.makeDir(to);

        if (fs.statSync(from).isDirectory()) {
            // 拷贝新的内容进去
            var dirs = fs.readdirSync(from);
            let self = this;
            dirs.forEach(function (item) {
                var item_path = path.join(from, item);
                var temp = fs.statSync(item_path);
                if (temp.isFile()) { // 是文件
                    fs.copyFileSync(item_path, path.join(to, item));
                } else if (temp.isDirectory()) { // 是目录
                    self.copy(item_path, path.join(to, item));
                }
            });
        } else {
            var item = path.basename(from);
            fs.copyFileSync(from, path.join(to, item));
        }
    }
}