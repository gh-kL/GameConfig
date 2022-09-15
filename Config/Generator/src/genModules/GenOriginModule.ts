import cli from "cli-color";
import path from "path";
import xlsx from "node-xlsx";
import { SpecialType } from "../SpecialType";
import { SheetType } from "../SheetType";
import { IOUtils } from "../utils/IOUtils";
import { StringUtils } from "../utils/StringUtils";
import { DataModel } from "../DataModel";
import { CommonUtils } from "../utils/CommonUtils";
import { LineBreak } from "../utils/LineBreak";
import { keys } from "cli-color/lib/xterm-colors";

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
    private _hSheets: any[];        // 横表数据
    private _vSheets: any[];        // 竖表数据

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
        this._enumSheets = [];
        this._hSheets = [];
        this._vSheets = [];

        console.log(`\n================================= 开始生成源数据 =================================\n`);

        let flag = this.collectAndPreproccessSheet();
        if (flag) {
            flag = this.proccessEnumSheet();
        }
        if (flag) {
            flag = this.proccessHSheet();
        }
        if (flag) {
            flag = this.proccessVSheet();
        }
        if (flag) {
            flag = this.exportData();
        }
        if (flag) {
            flag = this.checkAndExportExtendsTreeData();
        }
        if (flag) {
            flag = this.verifyData();
        }

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
     * 判断是否使用旧的数据（MD5如果一样那么表示Excel根本没被改动过，就能取旧数据节省性能）
     * @param filePath
     */
    private canUseOldData(filePath: string): boolean {
        let result = false;

        if (DataModel.Instance.remark && DataModel.Instance.originConfig && DataModel.Instance.enum) {
            for (let cfgName in DataModel.Instance.remark) {
                let rmk = DataModel.Instance.remark[cfgName];
                if ((rmk.filePath || rmk?.config_other_info?.filePath) == filePath) {
                    let lastMD5: string;
                    if (rmk.filePath) {
                        lastMD5 = rmk.fileMD5;
                        filePath = rmk.filePath;
                    } else if (rmk.config_other_info) {
                        lastMD5 = rmk.config_other_info.fileMD5;
                        filePath = rmk?.config_other_info?.filePath;
                    }
                    let nowMD5 = IOUtils.getFileMD5(filePath);
                    if (nowMD5 && nowMD5 == lastMD5) {
                        result = true;
                    }
                }
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
        for (let n = 0; n < this._fileList.length; n++) {
            let filePath = this._fileList[n];
            let fileMD5 = IOUtils.getFileMD5(filePath);

            let doParse = !this.canUseOldData(filePath);

            if (doParse) {
                console.log(`正在解析 ${filePath} ${cli.green(`<${fileMD5}>`)}`);
                var sheets = xlsx.parse(filePath);

                if (sheets && sheets.length) {
                    for (let m = 0; m < sheets.length; m++) {
                        let sheet = sheets[m];
                        let sheetSourceData = sheet.data as any[][];
                        let sheetInfo = sheetSourceData && sheetSourceData[0];      // 表信息
                        if (sheetInfo) {
                            // 前面的 Null 保留，中间的 Null 去掉
                            let ident = 0;
                            for (let n = 0; n < sheetInfo.length; n++) {
                                if (sheetInfo[n] == null) {
                                    ident++;
                                } else {
                                    break;
                                }
                            }
                            sheetInfo = sheetInfo && sheetInfo.filter(si => si != null);
                            for (let n = 0; n < ident; n++) {
                                sheetInfo.unshift(null);
                            }
                        }
                        let sheetName = sheetInfo && sheetInfo[0];                  // 表名称
                        let sheetType = sheetInfo && sheetInfo[1];                  // 表类型（横表、纵表、枚举表）

                        if (!sheetName || !sheetType) {
                            continue;
                        }

                        sheetType = StringUtils.convertToUpperCamelCase(sheetType);

                        // 大写的表名
                        let sheetNameUppercase = StringUtils.convertToUpperCamelCase(sheetName);

                        switch (sheetType) {
                            // --------------------- 预处理横表
                            case SheetType.Horizontal: {
                                // 父表
                                let sheetParent = sheetInfo && sheetInfo[2];
                                if (sheetParent) {
                                    sheetParent = StringUtils.convertToUpperCamelCase(sheetParent) + DataModel.Instance.config.export_suffix;
                                }

                                sheetNameUppercase += DataModel.Instance.config.export_suffix;
                                // 字段名称
                                let keyNames = sheetSourceData[1];
                                // 字段类型
                                let fixedKeyTypes = {};
                                // 格式
                                let formats = sheetSourceData[2];
                                // 主键
                                let mainKeys = sheetSourceData[3];
                                // 生成到...
                                let gens = sheetSourceData[4];
                                // 默认值
                                let defaults = sheetSourceData[5];
                                // 注释
                                let annotations = sheetSourceData[6];

                                // 主键下标
                                let mainKeySubs = [];
                                // 主键名字
                                let mainKeyNames = [];

                                // 处理 keyNames、fixedKeyType
                                for (let n = keyNames.length - 1; n >= 0; n--) {
                                    if (keyNames[n] && keyNames[n].indexOf("#") == -1) {
                                        console.log(cli.red(`${sheetNameUppercase}的${keyNames[n]}字段没有声明类型！文件路径：${filePath}`));
                                        return false;
                                    }

                                    if (keyNames[n] && keyNames[n][0] != "#") { // 如果是列表字段的类型就忽略
                                        let keyNameSplit = keyNames[n] && keyNames[n].split("#");
                                        if (keyNameSplit && keyNameSplit.length > 1) {
                                            keyNames[n] = keyNameSplit[0];
                                            fixedKeyTypes[keyNames[n]] = keyNameSplit[1];
                                        }
                                    }
                                }

                                // 截取内容部分
                                let sheetContent = sheetSourceData.slice(7, sheetSourceData.length);
                                // 去除空行
                                sheetContent = sheetContent.filter(rowData => rowData.filter(ele => ele != null).length);

                                // 检查键是否重复
                                for (let y = 0; y < keyNames.length; y++) {
                                    const kn = keyNames[y];
                                    let repeatIdx = keyNames.indexOf(kn);
                                    if (repeatIdx != y && keyNames.indexOf(kn) >= 0) {
                                        console.log(cli.red(`${sheetName}检测到重复的键! 键：${kn}，文件路径：${filePath}`));
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
                                        console.log(cli.red(`${sheetName}主键不支持浮点数! 主键：${keyNames[y]}，文件路径：${filePath}`));
                                        return false;
                                    }

                                    for (let b = 0; b < mainKeys.length; b++) {
                                        if (y == b)
                                            continue;
                                        if (mainKey == mainKeys[b]) {
                                            console.log(cli.red(`${sheetName}检测到重复的主键! 主键：${keyNames[y]}，文件路径：${filePath}`));
                                            return false;
                                        }
                                    }

                                    if (defaults[y]) {
                                        console.log(cli.red(`${sheetName}的主键设置了默认值，这是不被允许的。 主键：${keyNames[y]}，文件路径：${filePath}`));
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
                                        mainKeySubs.push(idx);
                                        mainKeyNames.push(keyNames[idx]);
                                    }
                                }

                                if (mainKeySubs.length == 0) {
                                    console.log(cli.red(`${sheetName}没有主键! 文件路径：${filePath}`));
                                    return false;
                                }

                                // 数组列字典。key = 字段名，value = { cols(列索引数组) }
                                let arrayColDict = {};
                                // 所有数组列
                                let arrayColAll = [];
                                // 连接字典。key = 字段名，value = { link(连接表名), isArray(是否为数组) }
                                let linkDict = {};

                                // 判断特殊类型
                                for (let y = 0; y < formats.length; y++) {
                                    const fmt = formats[y];
                                    if (
                                        fmt != null
                                        // && isGen(gens[y], expt_id, file)
                                    ) {
                                        let arr = fmt.split('#');
                                        let type = arr[0];
                                        let behindStr = arr[1];
                                        let keyName = keyNames[y];
                                        let fixedKeyType = fixedKeyTypes[keyName];

                                        if (type) {
                                            type = StringUtils.convertToLowerCamelCase(type);
                                        }

                                        switch (type) {
                                            case SpecialType.Array: {
                                                // 盘出数组数据
                                                if (!arrayColDict[behindStr]) {
                                                    let cols = [];
                                                    for (let u = 0; u < formats.length; u++) {
                                                        const ffmt = formats[u];
                                                        if (
                                                            ffmt == fmt
                                                            // && isGen(gens[u], expt_id, file)
                                                        ) {
                                                            cols.push(u);
                                                            if (arrayColAll.indexOf(u) < 0) {
                                                                arrayColAll.push(u);
                                                                // 这里向 keyNames push null 是为了增加它的长度，以免后面有数组数据遍历不到
                                                                while (keyNames.length < u + 1) {
                                                                    keyNames.push(null);
                                                                }
                                                            }
                                                        }
                                                    }

                                                    if (cols.length) {
                                                        arrayColDict[behindStr] = { cols: cols };
                                                    }
                                                }
                                                break;
                                            }
                                            case SpecialType.Link: {
                                                // let isArray = fixedKeyType.substring(fixedKeyType.length - 2, fixedKeyType.length) === "[]";
                                                let isArray = fixedKeyType.substring(fixedKeyType.length - 2, fixedKeyType.length) === "[]";
                                                let linkName = behindStr.replace("[]", "").trim();
                                                linkDict[keyName] = {
                                                    linkSheetName: linkName,
                                                    linkSheetNameUppercase: StringUtils.convertToUpperCamelCase(linkName) + DataModel.Instance.config.export_suffix,
                                                    isArray: isArray,
                                                };
                                                break;
                                            }
                                        }
                                    }
                                }

                                // 处理数组类型
                                for (let arrayKeyName in arrayColDict) {
                                    let cols = arrayColDict[arrayKeyName].cols;
                                    let fixedTypes = [];
                                    cols.forEach(col => {
                                        let keyName = keyNames[col];
                                        if (keyName && keyName[0] == "#") { // 如果指定类型
                                            let keyNameSplit = keyName.split("#");
                                            fixedTypes.push(keyNameSplit[1]);
                                        } else {
                                            fixedTypes.push(null);
                                        }
                                    });
                                    if (fixedTypes.length > 0 && !fixedTypes.find(ft => ft == null)) {
                                        fixedKeyTypes[arrayKeyName] = fixedTypes;
                                    }
                                }

                                // 推入数据
                                this._hSheets.push({
                                    filePath: filePath,
                                    fileMD5: fileMD5,
                                    sheetType: sheetType,
                                    sheetSourceData: sheetSourceData,
                                    sheetName: sheetName,
                                    sheetNameUppercase: sheetNameUppercase,
                                    parent: sheetParent,
                                    mainKeySubs: mainKeySubs,
                                    mainKeyNames: mainKeyNames,
                                    keyNames: keyNames,
                                    fixedKeyTypes: fixedKeyTypes,
                                    formats: formats,
                                    gens: gens,
                                    defaults: defaults,
                                    annotations: annotations,
                                    sheetContent: sheetContent,
                                    arrayColAll: arrayColAll,
                                    arrayColDict: arrayColDict,
                                    linkDict: linkDict,
                                });

                                break;
                            }
                            // --------------------- 预处理纵表
                            case SheetType.Vertical: {
                                sheetNameUppercase += DataModel.Instance.config.export_suffix;

                                // 字段数据
                                let fixedKeyDatas = {};
                                // 字段类型
                                let fixedKeyTypes = {};
                                // 生成到...
                                let gens = {};
                                // 注释
                                let annotations = {};

                                // 截取内容部分
                                let sheetContent = sheetSourceData.slice(2, sheetSourceData.length);

                                // 去除空行
                                sheetContent = sheetContent.filter(rowData => rowData.filter(ele => ele != null).length);

                                sheetContent.forEach(rowData => {
                                    if (rowData[0].indexOf("#") == -1) {
                                        console.log(cli.red(`${sheetNameUppercase}的${rowData[0]}字段没有声明类型！文件路径：${filePath}`));
                                        return false;
                                    }

                                    let keySplit = rowData[0].split("#");
                                    let keyName: string = keySplit[0];
                                    let type: string = keySplit.length > 1 ? keySplit[1] : null;
                                    let gen = this.convertGenerateToArray(rowData[1]);
                                    let data = rowData[2];
                                    let ann = rowData[3];

                                    fixedKeyDatas[keyName] = data;
                                    if (type) {
                                        fixedKeyTypes[keyName] = type;
                                    }
                                    if (gen) {
                                        gens[keyName] = gen;
                                    }
                                    if (ann) {
                                        annotations[keyName] = ann;
                                    }
                                });

                                // 推入数据
                                this._vSheets.push({
                                    filePath: filePath,
                                    fileMD5: fileMD5,
                                    sheetType: sheetType,
                                    sheetSourceData: sheetSourceData,
                                    sheetName: sheetName,
                                    sheetNameUppercase: sheetNameUppercase,
                                    fixedKeyDatas: fixedKeyDatas,
                                    fixedKeyTypes: fixedKeyTypes,
                                    gens: gens,
                                    annotations: annotations,
                                    sheetContent: sheetContent,
                                });
                                break;
                            }
                            // --------------------- 预处理枚举表
                            case SheetType.Enum: {
                                // 生成到...
                                let gens = sheetInfo[2];
                                // 截取内容部分
                                let sheetContent = sheetSourceData.slice(2, sheetSourceData.length);
                                // 去除空行
                                sheetContent = sheetContent.filter(rowData => rowData.filter(ele => ele != null).length);
                                this._enumSheets.push({
                                    filePath: filePath,
                                    fileMD5: fileMD5,
                                    sheetSourceData: sheetSourceData,
                                    sheetName: sheetName,
                                    sheetNameUppercase: sheetNameUppercase,
                                    sheetType: sheetType,
                                    gens: gens,
                                    sheetContent: sheetContent,
                                });

                                break;
                            }
                            default: {
                                console.log(cli.red(`不支持的表格配置类型！文件路径：${filePath}，表名：${sheetName}，表类型：${sheetType}`));
                            }
                        }
                    }
                }
            } else {
                // 使用旧数据

                for (let configName in DataModel.Instance.remark) {
                    let rmk = DataModel.Instance.remark[configName];

                    if ((rmk.filePath || rmk?.config_other_info?.filePath) != filePath)
                        continue;

                    let sheetType;
                    if (rmk.config_other_info) {
                        sheetType = rmk.config_other_info.sheetType;
                    } else {
                        sheetType = rmk.sheetType;
                    }

                    switch (sheetType) {
                        case SheetType.Horizontal: {
                            this._hSheets.push({
                                filePath: filePath,
                                fileMD5: fileMD5,
                                sheetType: sheetType,
                                sheetNameUppercase: configName,
                                parent: rmk.config_other_info.parent,
                                isSingleMainKey: rmk.config_other_info.isSingleMainKey,
                                mainKeySubs: rmk.config_other_info.mainKeySubs,
                                mainKeyNames: rmk.config_other_info.mainKeyNames,
                                mainKeyOnlyOneAndIsEnum: rmk.config_other_info.mainKeyOnlyOneAndIsEnum,
                                isUseOldData: true,
                                oldData: DataModel.Instance.originConfig[configName],
                                oldRemarkData: rmk,
                            });
                            break;
                        }
                        case SheetType.Vertical: {
                            this._vSheets.push({
                                filePath: filePath,
                                fileMD5: fileMD5,
                                sheetType: sheetType,
                                sheetNameUppercase: configName,
                                isUseOldData: true,
                                oldData: DataModel.Instance.originConfig[configName],
                                oldRemarkData: rmk,
                            });
                            break;
                        }
                        case SheetType.Enum: {
                            this._enumSheets.push({
                                filePath: filePath,
                                fileMD5: fileMD5,
                                sheetNameUppercase: configName,
                                sheetType: sheetType,
                                gens: rmk.generate,
                                isUseOldData: true,
                                oldData: DataModel.Instance.enum[configName],
                            });
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
            let sheet = this._enumSheets[enumSheetsIndex];

            let filePath = sheet.filePath;
            let fileMD5 = sheet.fileMD5;

            if (!sheet.isUseOldData) {
                let sheetContent = sheet.sheetContent;

                let enumArray = [];

                for (let u = 0; u < sheetContent.length; u++) {
                    let rowData = sheetContent[u];
                    enumArray.push({
                        key: rowData[0],
                        value: rowData[1],
                        annotation: rowData[2],
                    });
                }

                sheet.enumData = enumArray;
            } else {
                sheet.enumData = sheet.oldData;
            }

            // 记录枚举的导出
            this._remark[sheet.sheetNameUppercase] = {
                filePath: filePath,
                fileMD5: fileMD5,
                generate: Array.isArray(sheet.gens) ? sheet.gens : this.convertGenerateToArray(sheet.gens),
                sheetType: sheet.sheetType,
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
            let sheet = this._hSheets[configSheetsIndex];

            let filePath = sheet.filePath;
            let fileMD5 = sheet.fileMD5;
            let sheetNameUppercase = sheet.sheetNameUppercase;
            let parent = sheet.parent;
            let mainKeySubs = sheet.mainKeySubs;
            let mainKeyNames = sheet.mainKeyNames;

            if (!sheet.isUseOldData) {
                let keyNames = sheet.keyNames;
                let fixedKeyTypes = sheet.fixedKeyTypes;    // 这是个字典 { keyName : type}
                let formats = sheet.formats;
                let gens = sheet.gens;
                let defaults = sheet.defaults;
                let annotations = sheet.annotations;
                let sheetContent = sheet.sheetContent;
                let arrayColAll = sheet.arrayColAll;
                let arrayColDict = sheet.arrayColDict;
                let linkDict = sheet.linkDict;

                let dict: any = {};             // dict
                let optimizedDict: any = {};    // 优化后的 dict

                let fixed_keys = [];    // 字段

                for (let u = 0; u < sheetContent.length; u++) {
                    let rowData = sheetContent[u];

                    // 唯一主键
                    let uniqueKeyRst = this.getUniqueKey(mainKeySubs, rowData, defaults, sheetNameUppercase);
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

                    for (let m = 0; m < keyNames.length; m++) {
                        let keyName = keyNames[m];

                        // 如果是数组数据
                        if (arrayColAll.indexOf(m) >= 0) {
                            let arr = formats[m].split('#');
                            let kName = arr[1];

                            if (!valObj[kName]) {
                                if (fixed_keys.indexOf(kName) == -1) {
                                    fixed_keys.push(kName);
                                }
                                let arrVal = [];
                                for (let q = u; q < sheetContent.length; q++) {
                                    let rrowData = sheetContent[q];
                                    let uuniqueKey = this.getUniqueKey(mainKeySubs, rrowData, defaults, sheetNameUppercase)?.result;
                                    if (
                                        !uuniqueKey
                                        || q == u
                                    ) {
                                        let cols = arrayColDict[kName].cols;
                                        let cvtObj = !cols.find(col => !keyNames[col]);
                                        let dimension2 = cols.length > 1;   // 如果列数大于1才存储为二维数组
                                        let inner: any = dimension2 ? (cvtObj ? {} : []) : null;
                                        let atLeastOne = false;
                                        cols.forEach(col => {
                                            let innerVal = rrowData[col];
                                            if (innerVal == null) {
                                                innerVal = defaults[col];
                                            } else {
                                                atLeastOne = true;
                                            }
                                            if (innerVal != null) {
                                                if (dimension2) {
                                                    if (cvtObj) {
                                                        inner[keyNames[col]] = innerVal;
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
                            if (fixed_keys.indexOf(keyName) == -1) {
                                fixed_keys.push(keyName);
                            }
                            let val = rowData[m];
                            // if (sheetNameUppercase == "DramaConfig" && keyName == "eventId") {
                            //     console.log(val);
                            // }
                            val = val == null ? (defaults[m] == null ? '' : defaults[m]) : val;
                            // let withoutWrap = val.replace(/\r/g, '').replace(/\n/g, '');
                            try {
                                let parseRst = JSON.parse(val);
                                val = parseRst;
                            } catch (err) {
                            }
                            valObj[keyName] = val;
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

                sheet.dict = dict;
                sheet.optimizedDict = optimizedDict;

                if (this._finalJsonDict[sheetNameUppercase]) {
                    let anotherRemark = this._remark[sheetNameUppercase];
                    let anotherFilePath = anotherRemark?.config_other_info ? anotherRemark.config_other_info.filePath : anotherRemark?.filePath;
                    console.log(cli.red(`不允许存在相同名称的配置！文件路径：${filePath}，表名：${sheetNameUppercase}，另一个文件路径：${anotherFilePath}`));
                    return false;
                } else {
                    this._finalJsonDict[sheetNameUppercase] = optimizedDict;
                }

                // 处理标记
                if (!this._remark[sheetNameUppercase]) {
                    this._remark[sheetNameUppercase] = {};
                }

                if (optimizedDict.fixed_keys) {
                    optimizedDict.fixed_keys.forEach(fixed_key => {
                        var generate;
                        var annotation = "";
                        let findIdx = keyNames.findIndex(kn => kn == fixed_key);

                        let genIndex;

                        if (arrayColDict[fixed_key]) {    // 数组
                            // 处理数组annotation
                            let cols = arrayColDict[fixed_key].cols;
                            cols.forEach(c => {
                                if (!annotation) {
                                    annotation = "[" + annotations[c];
                                } else {
                                    annotation += ", " + annotations[c];
                                }
                            });
                            if (annotation) {
                                annotation += "]";
                            }

                            genIndex = cols[0];
                        } else {    // 常规
                            genIndex = findIdx;
                            annotation = annotations[findIdx];
                        }

                        generate = this.convertGenerateToArray(gens[genIndex]);

                        let enumName;
                        let fmt = formats[findIdx];
                        let fmtSplit = fmt && fmt.split("#");
                        if (fmtSplit && fmtSplit.length == 2 && fmtSplit[0] == SpecialType.Enum) {
                            enumName = StringUtils.convertToUpperCamelCase(fmtSplit[1]);
                        }

                        let link = linkDict[fixed_key];

                        // 保存字段信息
                        this._remark[sheetNameUppercase][fixed_key] = {
                            fixedType: fixedKeyTypes[fixed_key],
                            generate: generate,
                            annotation: annotation,
                            enum: enumName,
                            link: link && link.linkSheetNameUppercase,
                            linkIsArray: link && link.isArray,
                        };
                    });
                }

                // 判断唯一主键是不是枚举
                let enumName;
                if (mainKeySubs.length == 1) {
                    let fmt = formats[mainKeySubs[0]];
                    let fmtSplit = fmt && fmt.split("#");
                    if (fmtSplit && fmtSplit.length == 2 && fmtSplit[0] == SpecialType.Enum) {
                        enumName = StringUtils.convertToUpperCamelCase(fmtSplit[1]);
                    }
                }

                // 保存其它信息
                this._remark[sheetNameUppercase].config_other_info = {
                    filePath: filePath,
                    fileMD5: fileMD5,
                    sheetType: sheet.sheetType,
                    isSingleMainKey: mainKeySubs.length == 1,
                    parent: parent,
                    mainKeySubs: mainKeySubs,
                    mainKeyNames: mainKeyNames,
                    mainKeyOnlyOneAndIsEnum: mainKeyNames.length == 1 && enumName
                }
            } else {
                let dict: any = {};                         // dict
                let optimizedDict: any = sheet.oldData;     // 优化后的 dict

                for (let uKey in optimizedDict.data) {
                    let data = {};
                    optimizedDict.data[uKey].forEach((val, n) => {
                        data[optimizedDict.fixed_keys[n]] = val;
                    });
                    dict[uKey] = data;
                }

                sheet.dict = dict;
                sheet.optimizedDict = optimizedDict;

                if (this._finalJsonDict[sheetNameUppercase]) {
                    let anotherRemark = this._remark[sheetNameUppercase];
                    let anotherFilePath = anotherRemark?.config_other_info ? anotherRemark.config_other_info.filePath : anotherRemark?.filePath;
                    console.log(cli.red(`不允许存在相同名称的配置！文件路径：${filePath}，表名：${sheetNameUppercase}，另一个文件路径：${anotherFilePath}`));
                    return false;
                } else {
                    this._finalJsonDict[sheetNameUppercase] = optimizedDict;
                }

                // 保存字段信息
                this._remark[sheetNameUppercase] = sheet.oldRemarkData;
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
            let sheet = this._vSheets[configSheetsIndex];

            let filePath = sheet.filePath;
            let fileMD5 = sheet.fileMD5;
            let sheetNameUppercase = sheet.sheetNameUppercase;

            if (!sheet.isUseOldData) {
                let fixedKeyDatas = sheet.fixedKeyDatas;
                let fixedKeyTypes = sheet.fixedKeyTypes;
                let gens = sheet.gens;
                let annotations = sheet.annotations;

                let dict: any = {};// dict
                let optimizedDict: any = {};// 优化后的 dict

                for (let keyName in fixedKeyDatas) {
                    let data = fixedKeyDatas[keyName];

                    let val = data || '';
                    try {
                        val = val.replace(/\t/g, '').replace(/\r/g, '').replace(/\n/g, '');
                        let parseRst = JSON.parse(val);
                        val = parseRst;
                    } catch (err) {
                    }
                    let valObj = val;

                    dict[keyName] = valObj;
                }

                optimizedDict = dict;

                sheet.dict = dict;
                sheet.optimizedDict = optimizedDict;

                if (this._finalJsonDict[sheetNameUppercase]) {
                    let anotherRemark = this._remark[sheetNameUppercase];
                    let anotherFilePath = anotherRemark?.config_other_info ? anotherRemark.config_other_info.filePath : anotherRemark?.filePath;
                    console.log(cli.red(`不允许存在相同名称的配置！文件路径：${filePath}，表名：${sheetNameUppercase}，另一个文件路径：${anotherFilePath}`));
                    return false;
                } else {
                    this._finalJsonDict[sheetNameUppercase] = optimizedDict;
                }

                // 处理标记
                if (!this._remark[sheetNameUppercase]) {
                    this._remark[sheetNameUppercase] = {};
                }

                for (let keyName in dict) {
                    let gen = gens[keyName];
                    let ann = annotations[keyName];
                    this._remark[sheetNameUppercase][keyName] = {
                        fixedType: fixedKeyTypes[keyName],
                        generate: gen,
                        // enum: enumName,
                        annotation: ann,
                    };
                }

                // 保存其它信息
                this._remark[sheetNameUppercase].config_other_info = {
                    filePath: filePath,
                    fileMD5: fileMD5,
                    sheetType: SheetType.Vertical,
                }
            } else {
                let dict: any = {};// dict
                let optimizedDict: any = {};// 优化后的 dict

                dict = sheet.oldData;
                optimizedDict = sheet.oldData;

                sheet.dict = dict;
                sheet.optimizedDict = optimizedDict;

                if (this._finalJsonDict[sheetNameUppercase]) {
                    let anotherRemark = this._remark[sheetNameUppercase];
                    let anotherFilePath = anotherRemark?.config_other_info ? anotherRemark.config_other_info.filePath : anotherRemark?.filePath;
                    console.log(cli.red(`不允许存在相同名称的配置！文件路径：${filePath}，表名：${sheetNameUppercase}，另一个文件路径：${anotherFilePath}`));
                    return false;
                } else {
                    this._finalJsonDict[sheetNameUppercase] = optimizedDict;
                }

                // 处理标记
                if (!this._remark[sheetNameUppercase]) {
                    this._remark[sheetNameUppercase] = {};
                }

                this._remark[sheetNameUppercase] = sheet.oldRemarkData;
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
            let sheet = this._enumSheets[enumSheetsIndex];
            enumDict[sheet.sheetNameUppercase] = sheet.enumData;
        }
        let enumJson = JSON.stringify(enumDict, null, 4);
        IOUtils.writeTextFile(DataModel.Instance.enumURL, enumJson, LineBreak.CRLF, null, "导出源配置失败！ -> {0}, {1}");
        // --------------------------- ended 导出枚举 ---------------------------

        // ------------------------- began 导出源数据配置 -------------------------
        for (let configSheetsIndex = 0; configSheetsIndex < this._hSheets.length; configSheetsIndex++) {
            // 导出源数据配置
            let sheet = this._hSheets[configSheetsIndex];
            let json = JSON.stringify(sheet.dict, null, 4);
            IOUtils.writeTextFile(path.join(DataModel.Instance.config.origin_export_url, sheet.sheetNameUppercase + '.json'), json, LineBreak.CRLF, null, "导出源配置失败！ -> {0}, {1}");
        }

        for (let configSheetsIndex = 0; configSheetsIndex < this._vSheets.length; configSheetsIndex++) {
            // 导出源数据配置
            let sheet = this._vSheets[configSheetsIndex];
            let json = JSON.stringify(sheet.dict, null, 4);
            IOUtils.writeTextFile(path.join(DataModel.Instance.config.origin_export_url, sheet.sheetNameUppercase + '.json'), json, LineBreak.CRLF, null, "导出源配置失败！ -> {0}, {1}");
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
            let configARmk = DataModel.Instance.remark[configName];
            if (!configARmk.config_other_info)
                continue;

            let extendArray: string[] = [];

            let tempCfgName = configName;
            let tempRmk = configARmk;

            while (tempRmk.config_other_info.parent) {
                let foundIdx = extendArray.indexOf(tempRmk.config_other_info.parent);
                let rmk = DataModel.Instance.remark[tempRmk.config_other_info.parent];
                if (!rmk) {
                    breakGen = true;
                    console.log(cli.red(`父类不存在！${tempRmk.config_other_info.parent}，文件路径：${tempRmk.config_other_info.filePath}`));
                    break;
                }

                if (!rmk.config_other_info) {
                    breakGen = true;
                    console.log(cli.red(`不允许非水平表被继承！${tempCfgName}，${tempRmk.config_other_info.parent}，文件路径：${tempRmk.config_other_info.filePath}，${rmk.filePath}`));
                    break;
                }

                if (foundIdx == -1) {
                    tempCfgName = tempRmk.config_other_info.parent;
                    tempRmk = rmk;
                    extendArray.push(tempCfgName);
                } else {
                    breakGen = true;
                    extendArray.push(tempRmk.config_other_info.parent);

                    tempRmk.config_other_info.parent
                    let extendsStr = "";
                    let filePathStr = "";

                    extendArray.forEach((cfgName, m) => {
                        extendsStr += cfgName;
                        let rmk2 = DataModel.Instance.remark[cfgName];
                        filePathStr += rmk2.config_other_info.filePath;
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
            let configRmk = DataModel.Instance.remark[configName];

            let parents = DataModel.Instance.getParents(configName);

            if (!parents)
                continue;

            for (let m = 0; m < parents.length; m++) {
                let parentConfigName = parents[m];
                let parentConfig = DataModel.Instance.originConfig[parentConfigName];
                let parentRmk = DataModel.Instance.remark[parentConfigName];
                let parentFilePath = parentRmk.config_other_info.filePath;

                // 检查主键是否一致
                let mainKeysDiffrence = false;
                if (configRmk.config_other_info.mainKeyNames.length == parentRmk.config_other_info.mainKeyNames.length) {
                    for (let k = 0; k < configRmk.config_other_info.mainKeyNames.length; k++) {
                        if (configRmk.config_other_info.mainKeyNames[k] != parentRmk.config_other_info.mainKeyNames[k]) {
                            mainKeysDiffrence = true;
                            break;
                        }
                    }
                } else {
                    mainKeysDiffrence = true;
                }

                if (mainKeysDiffrence) {
                    breakGen = true;
                    console.log(cli.red(`${configName}继承自${configRmk.config_other_info.parent}，然而他们的主键并不一致，这是不被允许的！父表主键：${parentRmk.config_other_info.mainKeyNames}，子表主键：${configRmk.config_other_info.mainKeyNames}，父表文件路径：${parentFilePath}，子表文件路径：${configRmk.config_other_info.filePath}`));
                }

                // 检查是否有重复字段
                for (let k = 0; k < config.fixed_keys.length; k++) {
                    let keyName = config.fixed_keys[k];
                    if (configRmk.config_other_info.mainKeyNames.indexOf(keyName) != -1)
                        continue;

                    if (parentConfig.fixed_keys.indexOf(keyName) != -1) {
                        breakGen = true;
                        console.log(cli.red(`${configName}继承自${configRmk.config_other_info.parent}，${keyName}字段重复了，这是不被允许的！父表文件路径：${parentFilePath}，子表文件路径：${configRmk.config_other_info.filePath}`));
                    }
                }

                // 检查是否有数据缺失
                for (let keyName in config.data) {
                    if (!parentConfig.data[keyName]) {
                        breakGen = true;
                        console.log(cli.red(`${configName}继承自${configRmk.config_other_info.parent}，${configName} 中的 ${keyName} 在 ${configRmk.config_other_info.parent} 中无法找到，这是不被允许的！父表文件路径：${parentFilePath}，子表文件路径：${configRmk.config_other_info.filePath}`));
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
            if (keys && keys.length) {
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

            if (keys && keys.length) {
                for (let n = 0; n < keys.length; n++) {
                    let aSubs = getSubs(obj[keys[n]]);
                    aSubs.push(keys[n]);

                    for (let m = 0; m < keys.length && n != m; m++) {
                        let bSubs = getSubs(obj[keys[m]]);
                        bSubs.push(keys[m]);

                        for (let y = 0; y < aSubs.length; y++) {
                            let aConfig = aSubs[y];
                            let aOriCfg = DataModel.Instance.originConfig[aConfig];
                            let aUKeys = (aOriCfg && aOriCfg.data) ? Object.keys(aOriCfg.data) : null;

                            for (let k = 0; k < bSubs.length; k++) {
                                let bConfig = bSubs[k];
                                let bOriCfg = DataModel.Instance.originConfig[bConfig];
                                let bUKeys = (bOriCfg && bOriCfg.data) ? Object.keys(bOriCfg.data) : null;

                                for (let u = 0; u < aUKeys.length; u++) {
                                    for (let e = 0; e < bUKeys.length; e++) {
                                        if (aUKeys[u] == bUKeys[e]) {
                                            let aPath = DataModel.Instance.remark[aConfig].config_other_info.filePath;
                                            let bPath = DataModel.Instance.remark[bConfig].config_other_info.filePath;
                                            console.log(cli.red(`${aConfig}和${bConfig}继承自同一个父表，不允许存在相同的主键数据${aUKeys[u]}。文件路径：${aPath}，${bPath}`));
                                            breakGen = true;
                                        }
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
            let configARmk = DataModel.Instance.remark[configNameA];
            if (!configARmk.config_other_info)
                continue;

            let linkToAConfigNames = configNames.filter((configNameB, m) => {
                if (m == n)
                    return false;
                let configBRmk = DataModel.Instance.remark[configNameB];
                if (!configBRmk.config_other_info)
                    return false;
                let bKeyNames = Object.keys(configBRmk);
                for (let k = bKeyNames.length - 1; k >= 0; k--) {
                    let keyName = bKeyNames[k];
                    if (configBRmk[keyName]?.link == configNameA) {
                        return true;
                    }
                }
                return false;
            });

            if (!linkToAConfigNames.length)
                continue;

            let filePathA = configARmk.config_other_info.filePath;
            let aKeyNames = Object.keys(configARmk);
            for (let k = aKeyNames.length - 1; k >= 0; k--) {
                let keyName = aKeyNames[k];
                let foundIdx = linkToAConfigNames.indexOf(configARmk[keyName]?.link);
                let configNameB = linkToAConfigNames[foundIdx];
                if (foundIdx != -1) {
                    breakGen = true;
                    let configBRmk = DataModel.Instance.remark[configNameB];
                    let filePathB = configBRmk.config_other_info.filePath;
                    console.log(cli.red(`${configNameA} 和 ${configNameB} 循环链接（Link）了，请检查！文件路径：${filePathA}，${filePathB}`));
                }
            }
        }

        if (breakGen)
            return false;
        // ------------------------------ ended 检查链接循环 ------------------------------

        return !breakGen;
    }
}