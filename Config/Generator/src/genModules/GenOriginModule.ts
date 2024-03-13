import cli from "cli-color";
import path from "path";
import xlsx from "node-xlsx";
import {SpecialType} from "../SpecialType";
import {SheetType} from "../SheetType";
import {IOUtils} from "../utils/IOUtils";
import {StrUtils} from "../utils/StrUtils";
import {DataModel} from "../DataModel";
import {CommonUtils} from "../utils/CommonUtils";
import {LineBreak} from "../utils/LineBreak";
import {TSTypeEnum} from "../TSTypeEnum";
import {SheetInfo} from "./SheetInfo";
import {Remark} from "../Remark";
import {RemarkField} from "../RemarkField";

/**
 * @Doc 生成源数据模块
 * @Author kL
 * @Date 2020/7/18 10:22
 */
export class GenOriginModule {
    // ------------------began 单例 ------------------
    private static _instance: GenOriginModule;

    public static get Instance() {
        if (this._instance == null) {
            this._instance = new GenOriginModule();
        }
        return this._instance;
    }

    // ------------------ended 单例 ------------------

    private readonly _sheetFileExts: string[] = [".xls", ".xlsx"];
    private _fileList: string[];    // 文件列表
    private _finalJsonDict: any;    // json min 配置
    private _remark: any;           // 备注
    private _enumSheets: any[];     // 枚举表数据
    private _hSheets: SheetInfo[];  // 横表数据
    private _vSheets: SheetInfo[];  // 竖表数据

    /**
     * 发布
     * @returns
     */
    public gen(): boolean {
        this._fileList = [];
        IOUtils.findFile(DataModel.Instance.config.excel_url, this._sheetFileExts, this._fileList);

        // 过滤正在编辑 office 文件的暂存文件
        this._fileList = this._fileList.filter((file) => {
            return file.indexOf("~$") == -1;
        });

        this._finalJsonDict = {};
        this._remark = {};
        this._hSheets = [];
        this._vSheets = [];
        this._enumSheets = [];

        console.log(`\n================================= 开始生成源数据 =================================\n`);

        let flag = this.collectAndPreproccessSheet();
        flag = flag && this.proccessEnumSheet();
        flag = flag && this.proccessHSheet();
        flag = flag && this.proccessVSheet();
        flag = flag && this.proccessHSheetOverride();
        flag = flag && this.exportData();
        flag = flag && this.checkAndExportExtendsTreeData();
        flag = flag && this.verifyData();

        return flag;
    }

    /**
     * 转化生成字符串为数组
     * "1|2|3" -> [1, 2, 3]
     * @param str
     * @returns
     */
    private convertGenerateToArray(str) {
        let result;
        if (str) {
            if (isNaN(str)) {
                let strSplit = str.split("|");
                for (let m = 0; m < strSplit.length; m++) {
                    let g = +strSplit[m]
                    if (!isNaN(g)) {
                        if (result == null)
                            result = [g];
                        else
                            result.push(g);
                    }
                }
            } else {
                result = [+str];
            }
        }
        return result;
    }

    /**
     * 根据行数据获取唯一主键
     * @param rData
     * @returns
     */
    private getUniqueKey(mainKeySubs: number[], rData: any, defaults: any, configName: string) {
        let result = "";
        let hasNull: boolean;
        let hasValue: boolean;

        for (let n = 0; n < mainKeySubs.length; n++) {
            const sub = mainKeySubs[n];
            let clip = rData[sub];
            if (clip == null) {
                clip = defaults[sub];
            }
            if (clip == null) {
                hasNull = true;
            }
            if (clip != null) {
                hasValue = true;
                result += clip;
                if (n < mainKeySubs.length - 1) {
                    result += "_";
                }
            }
        }
        if (hasValue && hasNull) {
            return {
                error: `${configName}主键数据不完整！数据：${rData}`,
            };
        }
        if (result) {
            return {
                result: result
            };
        }
    }

    /**
     * 收集并预处理配置表
     * @returns
     */
    private collectAndPreproccessSheet(): boolean {
        // ----------------- began 验证表是否可以使用缓存 -----------------

        let useCacheCfgMap = new Map<string, boolean>();    // <path, 是否可用缓存>
        let nowFileMd5Map = new Map<string, string>();      // <path, md5>

        if (DataModel.Instance.remark) {
            let path2CfgName = {};  // 路径转配置名
            let cfgName2Path = {};  // 配置名转路径
            let cacheFileMd5Map = new Map<string, string>();    // <path, md5>

            for (let cName in DataModel.Instance.remark) {
                let rmk: Remark = DataModel.Instance.remark[cName];
                if (!rmk.filePath)
                    continue;
                path2CfgName[rmk.filePath] = cName;
                cfgName2Path[cName] = path;
                cacheFileMd5Map.set(rmk.filePath, rmk.fileMD5);
            }

            // 找父表，写个闭包不犯法吧
            let findParents = (cfgName: string) => {
                let result: string[] = [];
                let cur = cfgName;
                while (true) {
                    let rmk: Remark = DataModel.Instance.remark[cur];
                    if (rmk?.parent) {
                        cur = rmk.parent;
                        result.push(cur);
                    } else {
                        break;
                    }
                }
                return result;
            };

            // 找子表，写个闭包不犯法吧
            let findSons = (cfgName: string) => {
                let result: string[] = [];
                for (let cName in DataModel.Instance.remark) {
                    let rmk: Remark = DataModel.Instance.remark[cName];
                    if (!rmk?.filePath)
                        continue;
                    let parents = findParents(cName);
                    if (parents.indexOf(cfgName) != -1) {
                        result.push(cName);
                    }
                }
                return result;
            };

            for (let n = 0; n < this._fileList.length; n++) {
                let filePath = this._fileList[n];

                let fileMd5: string;
                if (nowFileMd5Map.has(filePath)) {
                    fileMd5 = nowFileMd5Map.get(filePath);
                } else {
                    fileMd5 = IOUtils.getFileMD5(filePath);
                    nowFileMd5Map.set(filePath, fileMd5);
                }

                let cfgName = path2CfgName[filePath];
                if (!cfgName) {
                    // TODO 没有表示这个文件是新表，其它关系表都不能使用缓存
                    useCacheCfgMap.set(filePath, false);
                    continue;
                }

                let cacheMd5 = cacheFileMd5Map.get(filePath);
                if (cacheMd5 == fileMd5) {
                    !useCacheCfgMap.has(filePath) && useCacheCfgMap.set(filePath, true);
                    continue;
                }

                // 找到祖宗，然后找到所有子孙，将所有子孙全部设为 false
                let parents = findParents(cfgName);
                let ancestry = parents.length ? parents[parents.length - 1] : cfgName;  // 祖宗
                let sons = findSons(ancestry);
                for (let m = 0; m < sons.length; m++) {
                    const son = sons[m];
                    let sonPath = cfgName2Path[son];
                    useCacheCfgMap.set(sonPath, false);
                }
            }

            cfgName2Path = null;
            path2CfgName = null;
            findParents = null;
            findSons = null;
        }

        // ----------------- ended 验证表是否可以使用缓存 -----------------

        // 补齐文件的 MD5 值
        for (let n = 0; n < this._fileList.length; n++) {
            let filePath = this._fileList[n];
            if (nowFileMd5Map.has(filePath))
                continue;
            let fileMD5 = IOUtils.getFileMD5(filePath);
            nowFileMd5Map.set(filePath, fileMD5);
        }

        // 正式开始遍历所有文件
        for (let n = 0; n < this._fileList.length; n++) {
            let filePath = this._fileList[n];
            let fileMD5 = nowFileMd5Map.get(filePath);

            let canUseCache = DataModel.Instance.config.incrementalPublish && useCacheCfgMap.get(filePath);  // 是否可使用缓存

            let sinf: SheetInfo;

            if (!canUseCache) {
                console.log(`正在解析 ${filePath} ${cli.green(`<${fileMD5}>`)}`);
                var sheets = xlsx.parse(filePath);

                if (sheets?.length) {
                    for (let m = 0; m < sheets.length; m++) {
                        let sheet = sheets[m];

                        sinf = {
                            filePath: this._fileList[n],
                            fileMD5: nowFileMd5Map.get(filePath),
                        };

                        sinf.sheetSourceData = sheet.data as any[][];
                        let firstLineData = sinf.sheetSourceData?.at(0); // 表的首行数据
                        if (firstLineData) {
                            // 前面的 Null 保留，中间的 Null 去掉
                            let ident = 0;
                            for (let n = 0; n < firstLineData.length; n++) {
                                if (firstLineData[n] == null)
                                    ident++;
                                else
                                    break;
                            }
                            firstLineData = firstLineData?.filter(d => d);
                            for (let n = 0; n < ident; n++) {
                                firstLineData.unshift(null);
                            }
                        }

                        sinf.sheetName = firstLineData?.at(0);  // 表名称
                        sinf.sheetType = firstLineData?.at(1);  // 表类型（横表、纵表、枚举表）

                        if (!sinf.sheetName || !sinf.sheetType)
                            continue;

                        sinf.sheetType = StrUtils.convertToUpperCamelCase(sinf.sheetType);

                        // 大写的表名
                        sinf.sheetNameUppercase = StrUtils.convertToUpperCamelCase(sinf.sheetName);

                        // 若是横表或竖表都需要加上后缀
                        if (sinf.sheetType == SheetType.Horizontal || sinf.sheetType == SheetType.Vertical)
                            sinf.sheetNameUppercase += DataModel.Instance.config.export_suffix;

                        switch (sinf.sheetType) {
                            // --------------------- 预处理横表
                            case SheetType.Horizontal: {
                                // 推入数据数组
                                this._hSheets.push(sinf);

                                sinf.parent = firstLineData?.at(2);
                                if (sinf.parent)
                                    sinf.parent = StrUtils.convertToUpperCamelCase(sinf.parent) + DataModel.Instance.config.export_suffix;

                                sinf.keyNames = sinf.sheetSourceData[1];
                                sinf.fixedKeyTypes = {};
                                sinf.formats = sinf.sheetSourceData[2];
                                // 主键数组
                                let mainKeys = sinf.sheetSourceData[3];
                                sinf.gens = sinf.sheetSourceData[4];
                                sinf.defaults = sinf.sheetSourceData[5];
                                sinf.annotations = sinf.sheetSourceData[6];
                                sinf.mainKeySubs = [];
                                sinf.mainKeyNames = [];

                                // 处理 keyNames、fixedKeyType
                                for (let n = sinf.keyNames.length - 1; n >= 0; n--) {
                                    if (sinf.keyNames.at(n)?.indexOf("#") == -1) {
                                        console.log(cli.red(`${sinf.sheetNameUppercase}的${sinf.keyNames[n]}字段没有声明类型！文件路径：${filePath}`));
                                        return false;
                                    }

                                    if (sinf.keyNames.at(n)?.at(0) != "#") {    // 如果是列表字段的类型就忽略
                                        let keyNameSplit = sinf.keyNames.at(n)?.split("#");
                                        if (keyNameSplit?.length > 1) {
                                            sinf.keyNames[n] = keyNameSplit[0];
                                            sinf.fixedKeyTypes[sinf.keyNames[n]] = keyNameSplit[1];
                                        }
                                    }
                                }

                                // 截取内容部分
                                sinf.sheetContent = sinf.sheetSourceData.slice(7, sinf.sheetSourceData.length);
                                // 去除空行
                                sinf.sheetContent = sinf.sheetContent.filter(rowData => rowData.filter(ele => ele != null).length);

                                // 检查键是否重复
                                for (let y = 0; y < sinf.keyNames.length; y++) {
                                    const keyName = sinf.keyNames[y];
                                    let repeatIdx = sinf.keyNames.indexOf(keyName);
                                    if (repeatIdx != y && sinf.keyNames.indexOf(keyName) >= 0) {
                                        console.log(cli.red(`${sinf.sheetName}检测到重复的键! 键：${keyName}，文件路径：${filePath}`));
                                        return false;
                                    }
                                }

                                // 检查主键是否重复、是否有默认值
                                for (let y = 0; y < mainKeys.length; y++) {
                                    let mainKey = mainKeys[y];
                                    // 排除掉数字以外的主键
                                    if (isNaN(+mainKey)) {
                                        mainKeys[y] = mainKey = null;
                                        continue;
                                    }
                                    if (CommonUtils.numIsFloat(mainKey)) {
                                        console.log(cli.red(`${sinf.sheetName}主键不支持浮点数! 主键：${sinf.keyNames[y]}，文件路径：${filePath}`));
                                        return false;
                                    }

                                    for (let b = 0; b < mainKeys.length; b++) {
                                        if (y == b)
                                            continue;
                                        if (mainKey == mainKeys[b]) {
                                            console.log(cli.red(`${sinf.sheetName}检测到重复的主键! 主键：${sinf.keyNames[y]}，文件路径：${filePath}`));
                                            return false;
                                        }
                                    }

                                    if (sinf.defaults[y]) {
                                        console.log(cli.red(`${sinf.sheetName}的主键设置了默认值，这是不被允许的。 主键：${sinf.keyNames[y]}，文件路径：${filePath}`));
                                        return false;
                                    }
                                }

                                let mainKeysClear = mainKeys.filter(mk => !isNaN(mk));

                                // 组装 mainKeySubs、mainKeyNames
                                let min = Math.min.apply(null, mainKeysClear);
                                let max = Math.max.apply(null, mainKeysClear);
                                for (let keyId = min; keyId <= max; keyId++) {
                                    let idx = mainKeys.findIndex((id) => id == keyId);
                                    if (idx >= 0) {
                                        sinf.mainKeySubs.push(idx);
                                        sinf.mainKeyNames.push(sinf.keyNames[idx]);
                                    }
                                }

                                if (!sinf.mainKeySubs.length) {
                                    console.log(cli.red(`${sinf.sheetName}没有主键! 文件路径：${filePath}`));
                                    return false;
                                }

                                // 判断特殊类型
                                sinf.arrayColDict = {};
                                sinf.arrayColAll = [];
                                sinf.linkDict = {};
                                for (let y = 0; y < sinf.formats.length; y++) {
                                    const format = sinf.formats[y];
                                    if (format == null)
                                        continue;

                                    let arr = format.split('#');
                                    let type = arr[0];
                                    let behindStr = arr[1];
                                    let keyName = sinf.keyNames[y];
                                    let fixedKeyType = sinf.fixedKeyTypes[keyName];

                                    if (type)
                                        type = StrUtils.convertToLowerCamelCase(type);

                                    switch (type) {
                                        case SpecialType.Array: {
                                            // 盘出数组数据
                                            if (!sinf.arrayColDict[behindStr]) {
                                                let cols = [];
                                                for (let u = 0; u < sinf.formats.length; u++) {
                                                    const format2 = sinf.formats[u];
                                                    if (format2 != format)
                                                        continue;
                                                    cols.push(u);
                                                    if (sinf.arrayColAll.indexOf(u) != -1)
                                                        continue;
                                                    sinf.arrayColAll.push(u);
                                                    // 这里向 keyNames push null 是为了增加它的长度，以免后面有数组数据遍历不到
                                                    while (sinf.keyNames.length < u + 1) {
                                                        sinf.keyNames.push(null);
                                                    }
                                                }

                                                if (cols.length) {
                                                    sinf.arrayColDict[behindStr] = {cols: cols};
                                                }
                                            }
                                            break;
                                        }
                                        case SpecialType.Link: {
                                            let isArray = fixedKeyType.substring(fixedKeyType.length - 2, fixedKeyType.length) === "[]";
                                            let linkName = behindStr.replace("[]", "").trim();
                                            sinf.linkDict[keyName] = {
                                                linkSheetName: linkName,
                                                linkSheetNameUppercase: StrUtils.convertToUpperCamelCase(linkName) + DataModel.Instance.config.export_suffix,
                                                isArray: isArray,
                                            };
                                            break;
                                        }
                                    }
                                }

                                // 处理数组类型
                                for (let arrayKeyName in sinf.arrayColDict) {
                                    let cols = sinf.arrayColDict[arrayKeyName].cols;
                                    let fixedTypes = [];
                                    cols.forEach(col => {
                                        let keyName = sinf.keyNames[col];
                                        if (keyName?.at(0) == "#") { // 如果指定类型
                                            let keyNameSplit = keyName.split("#");
                                            fixedTypes.push(keyNameSplit[1]);
                                        } else {
                                            fixedTypes.push(null);
                                        }
                                    });

                                    if (
                                        fixedTypes.length
                                        && !fixedTypes.find(ft => ft == null)
                                    ) {
                                        sinf.fixedKeyTypes[arrayKeyName] = fixedTypes;
                                    }
                                }
                                break;
                            }
                            // --------------------- 预处理纵表
                            case SheetType.Vertical: {
                                // 推入数据数组
                                this._vSheets.push(sinf);

                                sinf.fixedKeyDatas = {};
                                sinf.fixedKeyTypes = {};
                                sinf.gens = {};
                                sinf.annotations = {};

                                // 截取内容部分
                                sinf.sheetContent = sinf.sheetSourceData.slice(2, sinf.sheetSourceData.length);
                                // 去除空行
                                sinf.sheetContent = sinf.sheetContent.filter(rowData => rowData.filter(ele => ele != null).length);

                                sinf.sheetContent.forEach(rowData => {
                                    if (rowData[0].indexOf("#") == -1) {
                                        console.log(cli.red(`${sinf.sheetNameUppercase}的${rowData[0]}字段没有声明类型！文件路径：${filePath}`));
                                        return false;
                                    }

                                    let keySplit = rowData[0].split("#");
                                    let keyName: string = keySplit[0];
                                    let type: string = keySplit.length > 1 ? keySplit[1] : null;
                                    let gen = this.convertGenerateToArray(rowData[1]);
                                    let data = rowData[2];
                                    let ann = rowData[3];

                                    sinf.fixedKeyDatas[keyName] = data;
                                    if (type) {
                                        sinf.fixedKeyTypes[keyName] = type;
                                    }
                                    if (gen) {
                                        sinf.gens[keyName] = gen;
                                    }
                                    if (ann) {
                                        sinf.annotations[keyName] = ann;
                                    }
                                });
                                break;
                            }
                            // --------------------- 预处理枚举表
                            case SheetType.Enum: {
                                // 推入数据数组
                                this._enumSheets.push(sinf);

                                sinf.gens = firstLineData[2];
                                // 截取内容部分
                                sinf.sheetContent = sinf.sheetSourceData.slice(2, sinf.sheetSourceData.length);
                                // 去除空行
                                sinf.sheetContent = sinf.sheetContent.filter(rowData => rowData.filter(ele => ele != null).length);

                                break;
                            }
                            default: {
                                console.log(cli.red(`不支持的表格配置类型！文件路径：${filePath}，表名：${sinf.sheetName}，表类型：${sinf.sheetType}`));
                                break;
                            }
                        }
                    }
                }
            } else {
                // 使用旧数据

                for (let configName in DataModel.Instance.remark) {
                    let rmk: Remark = DataModel.Instance.remark[configName];

                    if (rmk.filePath != filePath)
                        continue;

                    sinf = {
                        filePath: this._fileList[n],
                        fileMD5: nowFileMd5Map.get(filePath),
                    };

                    sinf.sheetType = rmk.sheetType;
                    sinf.sheetNameUppercase = configName;
                    sinf.isUseOldData = true;

                    switch (sinf.sheetType) {
                        case SheetType.Horizontal: {
                            this._hSheets.push(sinf);
                            sinf.parent = rmk.parent;
                            sinf.isSingleMainKey = rmk.isSingleMainKey;
                            sinf.mainKeySubs = rmk.mainKeySubs;
                            sinf.mainKeyNames = rmk.mainKeyNames;
                            sinf.mainKeyOnlyOneAndIsEnum = rmk.mainKeyOnlyOneAndIsEnum;
                            sinf.oldData = DataModel.Instance.originConfig[configName];
                            sinf.oldRemarkData = rmk;
                            break;
                        }
                        case SheetType.Vertical: {
                            this._vSheets.push(sinf);
                            sinf.oldData = DataModel.Instance.originConfig[configName];
                            sinf.oldRemarkData = rmk;
                            break;
                        }
                        case SheetType.Enum: {
                            this._enumSheets.push(sinf);
                            sinf.gens = rmk.generate;
                            sinf.oldData = DataModel.Instance.enum[configName];
                            break;
                        }
                    }
                }
            }
        }

        return true;
    }

    /**
     * 处理枚举表
     * @returns
     */
    private proccessEnumSheet(): boolean {
        for (let enumSheetsIndex = 0; enumSheetsIndex < this._enumSheets.length; enumSheetsIndex++) {
            let sinf = this._enumSheets[enumSheetsIndex];

            if (!sinf.isUseOldData) {
                let sheetContent = sinf.sheetContent;

                let enumArray = [];

                for (let u = 0; u < sheetContent.length; u++) {
                    let rowData = sheetContent[u];
                    if (!rowData[0])
                        continue;
                    enumArray.push({
                        key: rowData[0],
                        value: rowData[1],
                        annotation: rowData[2],
                    });
                }

                sinf.enumData = enumArray;
            } else {
                sinf.enumData = sinf.oldData;
            }

            // 记录枚举的导出
            this._remark[sinf.sheetNameUppercase] = <Remark>{
                filePath: sinf.filePath,
                fileMD5: sinf.fileMD5,
                generate: Array.isArray(sinf.gens) ? sinf.gens : this.convertGenerateToArray(sinf.gens),
                sheetType: sinf.sheetType,
            };
        }

        return true;
    }

    /**
     * 处理横配置表
     * @returns
     */
    private proccessHSheet(): boolean {
        for (let configSheetsIndex = 0; configSheetsIndex < this._hSheets.length; configSheetsIndex++) {
            let sinf = this._hSheets[configSheetsIndex];

            if (!sinf.isUseOldData) {
                let dict: any = {};             // dict
                let optimizedDict: any = {};    // 优化后的 dict

                let fixed_keys = [];    // 字段

                for (let m = 0; m < sinf.keyNames.length; m++) {
                    const keyName = sinf.keyNames[m];
                    let pushFixedKey = keyName;
                    // 如果是数组数据
                    if (sinf.arrayColAll.indexOf(m) >= 0) {
                        let arr = sinf.formats[m].split('#');
                        pushFixedKey = arr[1];
                    }
                    if (pushFixedKey && fixed_keys.indexOf(pushFixedKey) == -1) {
                        fixed_keys.push(pushFixedKey);
                    }
                }

                for (let u = 0; u < sinf.sheetContent.length; u++) {
                    let rowData = sinf.sheetContent[u];

                    // 唯一主键
                    let uniqueKeyRst = this.getUniqueKey(sinf.mainKeySubs, rowData, sinf.defaults, sinf.sheetNameUppercase);
                    let uniqueKey = uniqueKeyRst?.result;
                    if (uniqueKeyRst?.error) {
                        console.log(cli.red(uniqueKeyRst.error));
                        return false;
                    }

                    if (!uniqueKey) {
                        // 找不到唯一主键，说明这一行是数组数据，无需处理
                        continue;
                    }

                    let valObj = {
                        // unique_key: uniqueKey,  // 唯一 key
                    };

                    for (let m = 0; m < sinf.keyNames.length; m++) {
                        let keyName = sinf.keyNames[m];

                        // 如果是数组数据
                        if (sinf.arrayColAll.indexOf(m) >= 0) {
                            let arr = sinf.formats[m].split('#');
                            let kName = arr[1];

                            if (!valObj[kName]) {
                                let arrVal = [];
                                for (let q = u; q < sinf.sheetContent.length; q++) {
                                    let rrowData = sinf.sheetContent[q];
                                    let uuniqueKey = this.getUniqueKey(sinf.mainKeySubs, rrowData, sinf.defaults, sinf.sheetNameUppercase)?.result;
                                    if (
                                        !uuniqueKey
                                        || q == u
                                    ) {
                                        let cols = sinf.arrayColDict[kName].cols;
                                        let cvtObj = !cols.find(col => !sinf.keyNames[col]);
                                        let dimension2 = cols.length > 1;   // 如果列数大于1才存储为二维数组
                                        let inner: any = dimension2 ? (cvtObj ? {} : []) : null;
                                        let atLeastOne = false;
                                        cols.forEach(col => {
                                            let innerVal = rrowData[col];
                                            if (innerVal == null) {
                                                innerVal = sinf.defaults[col];
                                            } else {
                                                atLeastOne = true;
                                            }
                                            if (innerVal != null) {
                                                if (dimension2) {
                                                    if (cvtObj) {
                                                        inner[sinf.keyNames[col]] = innerVal;
                                                    } else {
                                                        inner.push(innerVal);
                                                    }
                                                } else {
                                                    arrVal.push(innerVal);
                                                }
                                            }
                                        });
                                        if (atLeastOne) {
                                            if (dimension2) {
                                                if (
                                                    (cvtObj && Object.keys(inner).length)
                                                    || (!cvtObj && inner.length)
                                                ) {
                                                    arrVal.push(inner);
                                                }
                                            }
                                        } else {
                                            break;
                                        }
                                    } else {
                                        // 数组读取结束
                                        break;
                                    }
                                }
                                valObj[kName] = arrVal.length ? arrVal : '';
                            }
                        }
                        // 常规字符串值处理
                        else if (keyName != null) {
                            let val = rowData[m];

                            if (sinf.fixedKeyTypes[m] != TSTypeEnum.String) {
                                val = (val == null || val === '') ? (sinf.defaults[m] == null ? '' : sinf.defaults[m]) : val;
                            }
                            // if (sheetNameUppercase == "EditorBaseConfig" && keyName == "type") {
                            //     console.log(val, " | ", defaults[m]);
                            // }
                            // let withoutWrap = val.replace(/\r/g, '').replace(/\n/g, '');
                            let convertRst = CommonUtils.convertStringToObj(val);
                            if (convertRst.isString) {
                                if (convertRst.mayBeArray) {
                                    console.log(cli.yellow(`这个字段有可能是数组，但填写不合法！文件路径：${sinf.filePath}，表名：${sinf.sheetNameUppercase}, 字段名：${keyName}`));
                                }
                                if (convertRst.mayBeObj) {
                                    console.log(cli.yellow(`这个字段有可能是对象，但填写不合法！文件路径：${sinf.filePath}，表名：${sinf.sheetNameUppercase}, 字段名：${keyName}`));
                                }
                            }
                            valObj[keyName] = convertRst.obj;
                        }
                    }

                    dict[uniqueKey] = valObj;
                }

                // console.log(sheetNameUppercase, fixed_keys)

                optimizedDict = {
                    data: {},
                    fixed_keys: fixed_keys,
                };
                for (let uniqueKey in dict) {
                    let data = dict[uniqueKey];
                    let dataArr = [];
                    fixed_keys.forEach(kn => {
                        dataArr.push(data[kn]);
                    });
                    optimizedDict.data[uniqueKey] = dataArr;
                }

                sinf.dict = dict;
                sinf.optimizedDict = optimizedDict;

                if (this._finalJsonDict[sinf.sheetNameUppercase]) {
                    let anotherRemark: Remark = this._remark[sinf.sheetNameUppercase];
                    console.log(cli.red(`不允许存在相同名称的配置！文件路径：${sinf.filePath}，表名：${sinf.sheetNameUppercase}，另一个文件路径：${anotherRemark.filePath}`));
                    return false;
                } else {
                    this._finalJsonDict[sinf.sheetNameUppercase] = optimizedDict;
                }

                // 处理标记
                if (!this._remark[sinf.sheetNameUppercase])
                    this._remark[sinf.sheetNameUppercase] = {};
                let remark: Remark = this._remark[sinf.sheetNameUppercase];

                if (optimizedDict.fixed_keys) {
                    optimizedDict.fixed_keys.forEach(fixed_key => {
                        var generate;
                        var annotation = "";
                        let findIdx = sinf.keyNames.findIndex(kn => kn == fixed_key);

                        let genIndex;

                        if (sinf.arrayColDict[fixed_key]) {    // 数组
                            // 处理数组annotation
                            let cols = sinf.arrayColDict[fixed_key].cols;
                            cols.forEach(c => {
                                if (!annotation) {
                                    annotation = "[" + sinf.annotations[c];
                                } else {
                                    annotation += ", " + sinf.annotations[c];
                                }
                            });
                            if (annotation) {
                                annotation += "]";
                            }

                            genIndex = cols[0];
                        } else {    // 常规
                            genIndex = findIdx;
                            annotation = sinf.annotations[findIdx];
                        }

                        generate = this.convertGenerateToArray(sinf.gens[genIndex]);

                        let enumName;
                        let fmt = sinf.formats[findIdx];
                        let fmtSplit = fmt && fmt.split("#");
                        if (fmtSplit && fmtSplit.length == 2 && fmtSplit[0] == SpecialType.Enum) {
                            enumName = StrUtils.convertToUpperCamelCase(fmtSplit[1]);
                        }

                        let link = sinf.linkDict[fixed_key];

                        // 保存字段信息
                        if (!remark.fields)
                            remark.fields = {};
                        remark.fields[fixed_key] = <RemarkField>{
                            type: sinf.fixedKeyTypes[fixed_key],
                            generate: generate,
                            annotation: annotation,
                            enum: enumName,
                            link: link?.linkSheetNameUppercase,
                            linkIsArray: link?.isArray,
                        };
                    });
                }

                // 判断唯一主键是不是枚举
                let mainKeyEnumName;
                if (sinf.mainKeySubs.length == 1) {
                    let fmt = sinf.formats[sinf.mainKeySubs[0]];
                    let fmtSplit = fmt && fmt.split("#");
                    if (fmtSplit?.length == 2 && fmtSplit[0] == SpecialType.Enum) {
                        mainKeyEnumName = StrUtils.convertToUpperCamelCase(fmtSplit[1]);
                    }
                }

                // 保存其它信息
                remark.filePath = sinf.filePath;
                remark.fileMD5 = sinf.fileMD5;
                remark.sheetType = sinf.sheetType;
                remark.isSingleMainKey = sinf.mainKeySubs.length == 1;
                remark.parent = sinf.parent;
                remark.mainKeySubs = sinf.mainKeySubs;
                remark.mainKeyNames = sinf.mainKeyNames;
                remark.mainKeyOnlyOneAndIsEnum = sinf.mainKeyNames.length == 1 && mainKeyEnumName;
            } else {
                let dict: any = {}; // dict
                let optimizedDict: any = sinf.oldData;  // 优化后的 dict

                for (let uKey in optimizedDict.data) {
                    let data = {};
                    optimizedDict.data[uKey].forEach((val, n) => {
                        data[optimizedDict.fixed_keys[n]] = val;
                    });
                    dict[uKey] = data;
                }

                sinf.dict = dict;
                sinf.optimizedDict = optimizedDict;

                if (this._finalJsonDict[sinf.sheetNameUppercase]) {
                    let anotherRemark: Remark = this._remark[sinf.sheetNameUppercase];
                    console.log(cli.red(`不允许存在相同名称的配置！文件路径：${sinf.filePath}，表名：${sinf.sheetNameUppercase}，另一个文件路径：${anotherRemark?.filePath}`));
                    return false;
                } else {
                    this._finalJsonDict[sinf.sheetNameUppercase] = optimizedDict;
                }

                // 保存字段信息
                this._remark[sinf.sheetNameUppercase] = sinf.oldRemarkData;
            }
        }

        return true;
    }

    /**
     * 处理竖配置表
     * @returns
     */
    private proccessVSheet(): boolean {
        for (let configSheetsIndex = 0; configSheetsIndex < this._vSheets.length; configSheetsIndex++) {
            let sinf = this._vSheets[configSheetsIndex];

            if (!sinf.isUseOldData) {
                let dict: any = {};// dict
                let optimizedDict: any = {};// 优化后的 dict

                for (let keyName in sinf.fixedKeyDatas) {
                    let data = sinf.fixedKeyDatas[keyName];

                    let val = data == 0 ? 0 : (data || '');
                    let convertRst = CommonUtils.convertStringToObj(val, true);
                    if (convertRst.isString) {
                        if (convertRst.mayBeArray) {
                            console.log(cli.yellow(`这个字段有可能是数组，但填写不合法！文件路径：${sinf.filePath}，表名：${sinf.sheetNameUppercase}, 字段名：${keyName}`));
                        }
                        if (convertRst.mayBeObj) {
                            console.log(cli.yellow(`这个字段有可能是对象，但填写不合法！文件路径：${sinf.filePath}，表名：${sinf.sheetNameUppercase}, 字段名：${keyName}`));
                        }
                    }

                    // let ft = fixedKeyTypes[keyName];
                    // let ft2 = DataModel.Instance.getValueType(convertRst.obj, CodeLanguageEnum.TS, true);
                    // if (ft != ft2) {
                    //     console.log(cli.yellow(`类型与值不匹配，请检查！${filePath}，表名：${sheetNameUppercase}, 字段名：${keyName}`));
                    // }

                    dict[keyName] = convertRst.obj;
                }

                optimizedDict = dict;

                sinf.dict = dict;
                sinf.optimizedDict = optimizedDict;

                if (this._finalJsonDict[sinf.sheetNameUppercase]) {
                    let anotherRemark = this._remark[sinf.sheetNameUppercase];
                    console.log(cli.red(`不允许存在相同名称的配置！文件路径：${sinf.filePath}，表名：${sinf.sheetNameUppercase}，另一个文件路径：${anotherRemark?.filePath}`));
                    return false;
                } else {
                    this._finalJsonDict[sinf.sheetNameUppercase] = optimizedDict;
                }

                // 处理标记
                if (!this._remark[sinf.sheetNameUppercase]) {
                    this._remark[sinf.sheetNameUppercase] = {};
                }
                let remark: Remark = this._remark[sinf.sheetNameUppercase];

                for (let keyName in dict) {
                    let gen = sinf.gens[keyName];
                    let ann = sinf.annotations[keyName];
                    if (!remark.fields)
                        remark.fields = {};
                    remark.fields[keyName] = <RemarkField>{
                        type: sinf.fixedKeyTypes[keyName],
                        generate: gen,
                        // enum: enumName,
                        annotation: ann,
                    };
                }

                // 保存其它信息
                remark.filePath = sinf.filePath;
                remark.fileMD5 = sinf.fileMD5;
                remark.sheetType = SheetType.Vertical;
            } else {
                let dict: any = {};// dict
                let optimizedDict: any = {};// 优化后的 dict

                dict = sinf.oldData;
                optimizedDict = sinf.oldData;

                sinf.dict = dict;
                sinf.optimizedDict = optimizedDict;

                if (this._finalJsonDict[sinf.sheetNameUppercase]) {
                    let anotherRemark = this._remark[sinf.sheetNameUppercase];
                    console.log(cli.red(`不允许存在相同名称的配置！文件路径：${sinf.filePath}，表名：${sinf.sheetNameUppercase}，另一个文件路径：${anotherRemark?.filePath}`));
                    return false;
                } else {
                    this._finalJsonDict[sinf.sheetNameUppercase] = optimizedDict;
                }

                this._remark[sinf.sheetNameUppercase] = sinf.oldRemarkData;
            }
        }

        return true;
    }

    /**
     * 处理横表的 override
     * 横表的override，就相当于子类与父类有相同的字段，以子类的值为准，覆盖父类的值。
     * @returns
     */
    private proccessHSheetOverride(): boolean {
        if (!DataModel.Instance.config.excel_override_enabled)
            return true;

        let getSheetLayer = (sinf_temp: SheetInfo) => {
            let layerRst = 0;
            let parentSheetName = sinf_temp.parent;
            while (parentSheetName) {
                layerRst++;
                let pSinf = this._hSheets.find(sinf_temp2 => sinf_temp2.sheetNameUppercase == parentSheetName);
                parentSheetName = pSinf?.parent;
                let maxLayer = DataModel.Instance.config.excel_extend_max_layer || 100;
                if (layerRst > maxLayer) {
                    console.log(cli.red(`计算配置层数超过限制${maxLayer}，大概率是表的继承关系出现了死循环，请排查！文件路径：${sinf_temp.filePath}`));
                    break;
                }
            }
            return layerRst;
        };

        // 将横表数组排序，继承层级越大的越靠前（即子表在父表之前）
        this._hSheets.sort((a, b) => {
            let aLayer = getSheetLayer(a);
            let bLayer = getSheetLayer(b);
            return bLayer - aLayer;
        });

        // 遍历横表
        for (let n = 0; n < this._hSheets.length; n++) {
            const sinf = this._hSheets[n];
            let pSinf = sinf.parent && this._hSheets.find(hs => hs.sheetNameUppercase == sinf.parent);
            // 无父表则跳过
            if (!pSinf || sinf == pSinf)
                continue;

            let rmk: Remark = this._remark[sinf.sheetNameUppercase];
            let pRmk: Remark = this._remark[pSinf.sheetNameUppercase];

            let dict = sinf.dict;
            let optimizedDict = sinf.optimizedDict;

            let pDict = pSinf.dict;
            let pOptimizedDict = pSinf.optimizedDict;

            // 遍历所有数据
            for (let key in optimizedDict.data) {
                let uniqueKey = CommonUtils.numIsInt(key) ? +key : key;

                let dat = optimizedDict.data[uniqueKey];

                let pNewObj = {};  // 整一个新的对象
                let pOldObj = pDict[uniqueKey];

                let pOldObjNoExist = !pOldObj;

                // 如果找不到父表对应主键的数据，那就处理一下默认值
                if (pOldObjNoExist) {
                    pOldObj = {};
                    if (pSinf.keyNames) {
                        for (let m = 0; m < pSinf.keyNames.length; m++) {
                            const pKeyName = pSinf.keyNames[m];
                            if (!pKeyName)
                                continue;
                            let pFieldVal = pSinf.mainKeyNames?.indexOf(pKeyName) >= 0 ? dict[pKeyName] : pSinf?.defaults?.at(m);
                            pOldObj[pKeyName] = pFieldVal;
                        }
                    }
                }

                // 将旧对象的值先拷贝一便到新对象
                for (const key in pOldObj) {
                    pNewObj[key] = pOldObj[key];
                }

                for (let m = 0; m < optimizedDict.fixed_keys.length; m++) {
                    const fiexdKey = optimizedDict.fixed_keys[m];

                    // 判断该表是否与父表有相同字段，有则将数据覆盖到父表，无则跳过
                    let parentHasSameKey = pOptimizedDict.fixed_keys.find(fk => fk == fiexdKey);
                    if (!parentHasSameKey)
                        continue;

                    let fiexdType: string;
                    let pFiexdType: string;

                    if (sinf.fixedKeyTypes) {
                        fiexdType = sinf.fixedKeyTypes[fiexdKey];
                    } else if (rmk?.fields[fiexdKey]) {
                        let field: RemarkField = rmk.fields[fiexdKey];
                        fiexdType = field.type;
                    }
                    if (pSinf.fixedKeyTypes) {
                        pFiexdType = pSinf.fixedKeyTypes[fiexdKey];
                    } else if (pRmk?.fields[fiexdKey]) {
                        let field: RemarkField = pRmk.fields[fiexdKey];
                        pFiexdType = field.type;
                    }

                    if (fiexdType && pFiexdType && fiexdType != pFiexdType) {
                        console.log(cli.red(`子表 ${sinf.sheetNameUppercase} 的 ${fiexdKey} 与 父表 ${pSinf.sheetNameUppercase} 的 ${fiexdKey} 类型不一致，请排查！子表文件路径：${sinf.filePath}，父表文件路径：${pSinf.filePath}`));
                        return false;
                    }

                    pNewObj[fiexdKey] = dat[m];

                    if (
                        DataModel.Instance.config.excel_override_warning_enabled
                        && !pOldObjNoExist
                        && !DataModel.Instance.valEquip(pOldObj[fiexdKey], dat[m])
                    ) {
                        console.log(cli.yellow(`${sinf.sheetNameUppercase} 的 ${fiexdKey}（${dat[m]}）覆盖了 ${pSinf.sheetNameUppercase} 的 ${fiexdKey}（${pOldObj[fiexdKey]}）`));
                    }
                }

                // 将新对象覆盖到数据字典
                pDict[uniqueKey] = pNewObj;

                // 将新对象的数据覆盖到优化后的字典
                let pObjArr = [];
                for (let m = 0; m < pOptimizedDict.fixed_keys.length; m++) {
                    const fiexdKey = pOptimizedDict.fixed_keys[m];
                    pObjArr.push(pNewObj[fiexdKey]);
                }
                pOptimizedDict.data[uniqueKey] = pObjArr;
            }

            let delFixedKeys: string[] = [];

            for (let m = 0; m < optimizedDict.fixed_keys.length; m++) {
                const fiexdKey = optimizedDict.fixed_keys[m];

                // 判断该表是否与父表有相同字段
                let parentHasSameKey = pOptimizedDict.fixed_keys.find(fk => fk == fiexdKey);

                // 记录要删除的字段，
                // 因为父表已存在该字段，数据也覆盖到父表了，那子表就不需要存在这个字段了，
                // 这也是为了节省数据
                if (
                    parentHasSameKey
                    && delFixedKeys.indexOf(fiexdKey) == -1
                    && sinf.mainKeyNames.indexOf(fiexdKey) == -1
                ) {
                    delFixedKeys.push(fiexdKey);
                }
            }

            // 删除字段数据
            for (let m = 0; m < delFixedKeys.length; m++) {
                const delFK = delFixedKeys[m];

                for (let key in dict) {
                    let dat = dict[key];
                    delete dat[delFK];
                }

                let delIdx = optimizedDict.fixed_keys.indexOf(delFK);
                if (delIdx != -1) {
                    optimizedDict.fixed_keys.splice(delIdx, 1);
                    for (let key in optimizedDict.data) {
                        let dataArr = optimizedDict.data[key];
                        dataArr.splice(delIdx, 1);
                    }
                }

                if (rmk?.fields) {
                    delete rmk.fields[delFK];
                }
            }
        }

        return true;
    }

    /**
     * 导出数据
     */
    private exportData(): boolean {
        // 删除旧文件
        IOUtils.deleteFolderFile(DataModel.Instance.config.origin_export_url, false);
        // 保证文件夹存在
        IOUtils.makeDir(DataModel.Instance.config.origin_export_url);

        // --------------------------- began 导出枚举 ---------------------------
        let enumDict = {};
        for (let enumSheetsIndex = 0; enumSheetsIndex < this._enumSheets.length; enumSheetsIndex++) {
            let sinf = this._enumSheets[enumSheetsIndex];
            enumDict[sinf.sheetNameUppercase] = sinf.enumData;
        }
        let enumJson = JSON.stringify(enumDict, null, 4);
        IOUtils.writeTextFile(DataModel.Instance.enumURL, enumJson, LineBreak.CRLF, null, "导出源配置失败！ -> {0}, {1}");
        // --------------------------- ended 导出枚举 ---------------------------

        // ------------------------- began 导出源数据配置 -------------------------
        for (let configSheetsIndex = 0; configSheetsIndex < this._hSheets.length; configSheetsIndex++) {
            // 导出源数据配置
            let sinf = this._hSheets[configSheetsIndex];
            let json = JSON.stringify(sinf.dict, null, 4);
            IOUtils.writeTextFile(path.join(DataModel.Instance.config.origin_export_url, sinf.sheetNameUppercase + '.json'), json, LineBreak.CRLF, null, "导出源配置失败！ -> {0}, {1}");
        }

        for (let configSheetsIndex = 0; configSheetsIndex < this._vSheets.length; configSheetsIndex++) {
            // 导出源数据配置
            let sinf = this._vSheets[configSheetsIndex];
            let json = JSON.stringify(sinf.dict, null, 4);
            IOUtils.writeTextFile(path.join(DataModel.Instance.config.origin_export_url, sinf.sheetNameUppercase + '.json'), json, LineBreak.CRLF, null, "导出源配置失败！ -> {0}, {1}");
        }

        let finalJson = JSON.stringify(this._finalJsonDict);

        IOUtils.writeTextFile(DataModel.Instance.originConfigURL, finalJson, LineBreak.CRLF, "导出源配置成功！", "导出源配置失败！ -> {0}, {1}");
        // ------------------------- ended 导出源数据配置 -------------------------

        // ------------------------- began 导出 Remark -------------------------
        IOUtils.writeTextFile(DataModel.Instance.remarkURL, JSON.stringify(this._remark, null, 4), LineBreak.CRLF, null, "导出Remark文件失败！ -> {0}, {1}");
        // ------------------------- ended 导出 Remark -------------------------

        return true;
    }

    /**
     * 检查并导出继承数据
     */
    public checkAndExportExtendsTreeData(): boolean {
        let breakGen = false;

        DataModel.Instance.reset();

        let configNames = Object.keys(DataModel.Instance.originConfig);

        // ------------------------------ began 检查继承循环 ------------------------------
        for (let n = configNames.length - 1; n >= 0; n--) {
            let configName = configNames[n];
            let configARmk: Remark = DataModel.Instance.remark[configName];
            if (!configARmk)
                continue;

            let extendArray: string[] = [];

            let tempCfgName = configName;
            let tempRmk = configARmk;

            while (tempRmk.parent) {
                let foundIdx = extendArray.indexOf(tempRmk.parent);
                let rmk: Remark = DataModel.Instance.remark[tempRmk.parent];
                if (!rmk) {
                    breakGen = true;
                    console.log(cli.red(`父类不存在！${tempRmk.parent}，文件路径：${tempRmk.filePath}`));
                    break;
                }

                if (rmk.sheetType != SheetType.Horizontal) {
                    breakGen = true;
                    console.log(cli.red(`不允许非水平表被继承！${tempCfgName}，${tempRmk.parent}，文件路径：${tempRmk.filePath}，${rmk.filePath}`));
                    break;
                }

                if (foundIdx == -1) {
                    tempCfgName = tempRmk.parent;
                    tempRmk = rmk;
                    extendArray.push(tempCfgName);
                } else {
                    breakGen = true;
                    extendArray.push(tempRmk.parent);

                    tempRmk.parent
                    let extendsStr = "";
                    let filePathStr = "";

                    extendArray.forEach((cfgName, m) => {
                        extendsStr += cfgName;
                        let rmk2: Remark = DataModel.Instance.remark[cfgName];
                        filePathStr += rmk2.filePath;
                        if (m != extendArray.length - 1) {
                            extendsStr += "，";
                            filePathStr += "，";
                        }
                    })

                    console.log(cli.red(`循环继承，这是不被允许的！${extendsStr}，文件路径：${filePathStr}`));
                    break;
                }
            }
        }

        // ------------------------------ ended 检查继承循环 ------------------------------

        // ------------------------------ began 检查继承合法性 ------------------------------
        for (let n = configNames.length - 1; n >= 0; n--) {
            let configName = configNames[n];
            let config = DataModel.Instance.originConfig[configName];
            let configRmk: Remark = DataModel.Instance.remark[configName];

            let parents = DataModel.Instance.getParents(configName);

            if (!parents)
                continue;

            for (let m = 0; m < parents.length; m++) {
                let parentConfigName = parents[m];
                let parentRmk: Remark = DataModel.Instance.remark[parentConfigName];
                let parentFilePath = parentRmk.filePath;

                // 检查主键是否一致
                let mainKeysDiffrence = false;
                if (configRmk.mainKeyNames.length == parentRmk.mainKeyNames.length) {
                    for (let k = 0; k < configRmk.mainKeyNames.length; k++) {
                        if (configRmk.mainKeyNames[k] != parentRmk.mainKeyNames[k]) {
                            mainKeysDiffrence = true;
                            break;
                        }
                    }
                } else {
                    mainKeysDiffrence = true;
                }

                if (mainKeysDiffrence) {
                    breakGen = true;
                    console.log(cli.red(`${configName}继承自${configRmk.parent}，然而他们的主键并不一致，这是不被允许的！父表主键：${parentRmk.mainKeyNames}，子表主键：${configRmk.mainKeyNames}，父表文件路径：${parentFilePath}，子表文件路径：${configRmk.filePath}`));
                }

                let parentConfig = DataModel.Instance.originConfig[parentConfigName];

                // 检查是否有重复字段
                for (let k = 0; k < config.fixed_keys.length; k++) {
                    let keyName = config.fixed_keys[k];
                    if (configRmk.mainKeyNames.indexOf(keyName) != -1)
                        continue;

                    if (parentConfig.fixed_keys.indexOf(keyName) != -1) {
                        breakGen = true;
                        console.log(cli.red(`${configName}继承自${configRmk.parent}，${keyName}字段重复了，这是不被允许的！父表文件路径：${parentFilePath}，子表文件路径：${configRmk.filePath}`));
                    }
                }

                // 检查是否有数据缺失
                for (let keyName in config.data) {
                    if (!parentConfig.data[keyName]) {
                        breakGen = true;
                        console.log(cli.red(`${configName}继承自${configRmk.parent}，${configName} 中的 ${keyName} 在 ${configRmk.parent} 中无法找到，这是不被允许的！父表文件路径：${parentFilePath}，子表文件路径：${configRmk.filePath}`));
                    }
                }
            }
        }

        // ------------------------------ ended 检查继承合法性 ------------------------------

        if (breakGen)
            return false;

        let extendsData = {};

        configNames.forEach(configName => {
            let parents = DataModel.Instance.getParents(configName, true);
            if (parents) {
                parents.reverse();
                let temp: any = extendsData;
                parents.forEach(prt => {
                    if (!temp[prt]) {
                        temp[prt] = {};
                    }
                    temp = temp[prt];
                });
            }
        });

        // let recursionCheckEmpty = function (obj: any, keyName?: string, parent?: any) {
        //     let keys = Object.keys(obj);
        //     if (keys && keys.length) {
        //         for (let n = keys.length - 1; n >= 0; n--) {
        //             recursionCheckEmpty(obj[keys[n]], keys[n], obj);
        //         }
        //     } else {
        //         if (obj && keyName && parent) {
        //             parent[keyName] = null;
        //         }
        //     }
        // };
        // recursionCheckEmpty(extendsData);

        IOUtils.writeTextFile(DataModel.Instance.config.origin_extends_url, JSON.stringify(extendsData, null, 4), LineBreak.CRLF, null, "导出Extends文件失败！ -> {0}, {1}");

        // ------------------------------ began 检查继承分支是否有相同主键数据 ------------------------------

        /**
         * 获取子表
         * @param obj
         * @param subs
         * @returns
         */
        let getSubs = function (obj: any, subs?: any[]) {
            let keys = Object.keys(obj);
            if (!subs)
                subs = [];
            if (keys?.length) {
                for (let n = 0; n < keys.length; n++) {
                    subs.push(keys[n]);
                    getSubs(obj[keys[n]], subs);
                }
            }
            return subs;
        }

        let roots = Object.keys(extendsData);
        for (let w = 0; w < roots.length; w++) {
            let obj = extendsData[roots[w]];
            let keys = Object.keys(obj);

            if (!keys?.length)
                continue;

            for (let n = 0; n < keys.length; n++) {
                let aSubs = getSubs(obj[keys[n]]);
                aSubs.push(keys[n]);

                for (let m = 0; m < keys.length && n != m; m++) {
                    let bSubs = getSubs(obj[keys[m]]);
                    bSubs.push(keys[m]);

                    for (let y = 0; y < aSubs.length; y++) {
                        let aConfig = aSubs[y];
                        let aOriCfg = DataModel.Instance.originConfig[aConfig];
                        let aUKeys = aOriCfg?.data ? Object.keys(aOriCfg.data) : null;

                        for (let k = 0; k < bSubs.length; k++) {
                            let bConfig = bSubs[k];
                            let bOriCfg = DataModel.Instance.originConfig[bConfig];
                            let bUKeys = bOriCfg?.data ? Object.keys(bOriCfg.data) : null;

                            for (let u = 0; u < aUKeys.length; u++) {
                                for (let e = 0; e < bUKeys.length; e++) {
                                    if (aUKeys[u] == bUKeys[e]) {
                                        let aRmk: Remark = DataModel.Instance.remark[aConfig];
                                        let bRmk: Remark = DataModel.Instance.remark[bConfig];
                                        console.log(cli.red(`${aConfig}和${bConfig}继承自同一个父表，不允许存在相同的主键数据${aUKeys[u]}。文件路径：${aRmk.filePath}，${bRmk.filePath}`));
                                        breakGen = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ------------------------------ ended 检查继承分支是否有相同主键数据 ------------------------------

        return !breakGen;
    }

    /**
     * 验证数据有效性
     * @returns
     */
    private verifyData(): boolean {
        let breakGen = false;

        DataModel.Instance.reset();

        let configNames = Object.keys(DataModel.Instance.originConfig);

        // ------------------------------ began 检查链接循环 ------------------------------
        for (let n = configNames.length - 1; n >= 0; n--) {
            let configNameA = configNames[n];
            let configARmk: Remark = DataModel.Instance.remark[configNameA];
            if (!configARmk)
                continue;

            // 收集链接到 configNameA 的 config
            let linkToAConfigNames = configNames.filter((configNameB, m) => {
                if (m == n)
                    return false;
                let configBRmk: Remark = DataModel.Instance.remark[configNameB];
                if (!configBRmk)
                    return false;
                let bKeyNames = configBRmk.fields && Object.keys(configBRmk.fields);
                if (bKeyNames) {
                    for (let k = bKeyNames.length - 1; k >= 0; k--) {
                        let keyName = bKeyNames[k];
                        let field = configBRmk.fields[keyName];
                        if (field?.link == configNameA) {
                            return true;
                        }
                    }
                }
                return false;
            });

            if (!linkToAConfigNames.length)
                continue;

            let filePathA = configARmk.filePath;

            if (
                configARmk.sheetType == SheetType.Horizontal
                && !configARmk.isSingleMainKey
            ) {
                breakGen = true;
                linkToAConfigNames.forEach(configNameB => {
                    let configBRmk: Remark = DataModel.Instance.remark[configNameB];
                    console.log(cli.red(`${configNameA} 是多主键配置，不允许被链接（Link）！请检查！文件路径：${filePathA}，${configBRmk.filePath}`));
                });
            }

            let aKeyNames = configARmk.fields && Object.keys(configARmk.fields);
            if (aKeyNames) {
                for (let k = aKeyNames.length - 1; k >= 0; k--) {
                    let keyName = aKeyNames[k];
                    let field = configARmk.fields[keyName];
                    let foundIdx = linkToAConfigNames.indexOf(field?.link);
                    let configNameB = linkToAConfigNames[foundIdx];
                    if (foundIdx != -1) {
                        breakGen = true;
                        let configBRmk: Remark = DataModel.Instance.remark[configNameB];
                        console.log(cli.red(`${configNameA} 和 ${configNameB} 循环链接（Link）了，请检查！文件路径：${filePathA}，${configBRmk.filePath}`));
                    }
                }
            }
        }

        if (breakGen)
            return false;
        // ------------------------------ ended 检查链接循环 ------------------------------

        return !breakGen;
    }
}