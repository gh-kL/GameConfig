import cli from "cli-color";
import fs from "fs";
import { IOUtils } from "./utils/IOUtils";
import { TSTypeEnum } from "./TSTypeEnum";
import { CommonUtils } from "./utils/CommonUtils";
import { CSTypeEnum } from "./CSTypeEnum";
import { StringUtils } from "./utils/StringUtils";
import { IConfig } from "./IConfig";
import { SheetType } from "./SheetType";
import { CodeLanguageEnum } from "./CodeLanguageEnum";

/**
 * @Doc 数据Model
 * @Author kL
 * @Date 2020/7/18 11:05
 */
export class DataModel {
    // ------------------began 单例 ------------------
    private static _instance: DataModel;
    public static get Instance() {
        if (this._instance == null) {
            this._instance = new DataModel();
        }
        return this._instance;
    }
    // ------------------ended 单例 ------------------

    public static readonly MainKeyVarName = "mainKey";

    private _config: IConfig;
    public get config() {
        if (!this._config) {
            let content = fs.readFileSync("Config.json", { encoding: "utf-8" });
            this._config = JSON.parse(content);
        }
        return this._config;
    }

    public get originConfigURL() {
        return this.config.origin_json_url;
    }

    public get remarkURL() {
        return this.config.origin_remark_url;
    }

    public get enumURL() {
        return this.config.origin_enum_url;
    }

    private _originConfig: any;
    public get originConfig() {
        if (!this._originConfig) {
            if (IOUtils.fileOrFolderIsExsit(this.originConfigURL)) {
                let content = fs.readFileSync(this.originConfigURL, { encoding: "utf-8" });
                this._originConfig = JSON.parse(content);
            }
        }
        return this._originConfig;
    }

    private _remark: any;
    public get remark() {
        if (!this._remark) {
            if (IOUtils.fileOrFolderIsExsit(this.remarkURL)) {
                let content = fs.readFileSync(this.remarkURL, { encoding: "utf-8" });
                this._remark = JSON.parse(content);
            }
        }
        return this._remark;
    }

    private _enum: any;
    public get enum() {
        if (!this._enum) {
            if (IOUtils.fileOrFolderIsExsit(this.enumURL)) {
                let content = fs.readFileSync(this.enumURL, { encoding: "utf-8" });
                this._enum = JSON.parse(content);
            }
        }
        return this._enum;
    }

    public reset() {
        this._originConfig = null;
        this._remark = null;
        this._enum = null;
    }

    /**
     * 是否为常规类型
     * @param typeStr 
     * @returns 
     */
    public isConventionType(typeStr: string, codeLang: CodeLanguageEnum): boolean {
        switch (codeLang) {
            case CodeLanguageEnum.TS: {
                for (let typeEnumKey in TSTypeEnum) {
                    if (TSTypeEnum[typeEnumKey] == typeStr)
                        return true;
                }
                break;
            }
            case CodeLanguageEnum.CS: {
                // TODO
                break;
            }
        }
        return false;
    }

    /**
     * 获取唯一主键的类型
     * @param configName 
     * @param configType 
     * @returns 
     */
    public getConfigUniqueKeyType(configName: string, codeLang: CodeLanguageEnum, includeEnum: boolean = true) {
        let targetTypeEnum: any;
        switch (codeLang) {
            case CodeLanguageEnum.TS: {
                targetTypeEnum = TSTypeEnum;
                break;
            }
            case CodeLanguageEnum.CS: {
                targetTypeEnum = CSTypeEnum;
                break;
            }
        }

        let configRemark = this.remark[configName];

        if (configRemark.config_other_info.mainKeySubs.length == 1) {
            let mainKeyField = configRemark[configRemark.config_other_info.mainKeyNames[0]];
            if (includeEnum && mainKeyField.enum) {
                return mainKeyField.enum;
            } else {
                if (mainKeyField.fixedType) {
                    // TS需要特殊处理 int
                    if (mainKeyField.fixedType == "int") {
                        switch (codeLang) {
                            case CodeLanguageEnum.TS: {
                                return TSTypeEnum.Int;
                            }
                        }
                    }
                    return mainKeyField.fixedType;
                }
            }
        } else {
            // 多主键都是字符串
            return targetTypeEnum["String"];
        }
    }

    /**
     * 获取固定类型
     * @param configName 
     * @param keyName 
     * @returns 
     */
    public getFixedType(configName: string, keyName: string, codeLang: CodeLanguageEnum) {
        let targetTypeEnum: any;

        switch (codeLang) {
            case CodeLanguageEnum.TS: {
                targetTypeEnum = TSTypeEnum;
                break;
            }
            case CodeLanguageEnum.CS: {
                targetTypeEnum = CSTypeEnum;
                break;
            }
        }

        let configRemark = this.remark[configName];

        let result = configRemark && configRemark[keyName].fixedType;

        if (result) {
            let isArray = Array.isArray(result);

            // 方便转换，先转成数组
            if (!isArray)
                result = [result];
            for (let n = result.length - 1; n >= 0; n--) {
                let type = result[n];
                // 计算数组维度
                let typeUseCalc = type.trim();
                let arrayDepth = 0;
                while (typeUseCalc.indexOf("[]") != -1) {
                    typeUseCalc = typeUseCalc.substring(0, typeUseCalc.length - 2);
                    arrayDepth++;
                }
                if (arrayDepth) {
                    let predixType = StringUtils.convertToUpperCamelCase(typeUseCalc);
                    result[n] = targetTypeEnum[`${predixType}List${arrayDepth > 1 ? arrayDepth : ""}`];
                } else {
                    let predixType = StringUtils.convertToUpperCamelCase(type);
                    result[n] = targetTypeEnum[`${predixType}`];
                }
            }
            if (!isArray) {
                result = result[0];
            }
        }
        return result;
    }

    /**
     * 获取指定配置的指定fixed_key的任意一个值
     * （一般用来做值的类型判断）
     * @param configName 
     * @param keyName 
     * @returns 
     */
    public getAnyDataValue(configName, keyName) {
        let result = '';
        let cfg = this.originConfig[configName];

        let fixed_key_index = cfg.fixed_keys.indexOf(keyName);

        for (const key in cfg.data) {
            let data = cfg.data[key];
            if (result === '') {
                let tmpVal = data[fixed_key_index];
                if (tmpVal !== '') {
                    result = tmpVal;
                    break;
                }
            }
        }
        return result;
    }

    /**
     * 获取配置的键的类型
     * @param configName 
     * @param keyName 
     * @param configType TODO 这个还没做
     * @returns 
     */
    public getConfigKeyType(configName: string, keyName: string, codeLang: CodeLanguageEnum) {
        let result = this.getFixedType(configName, keyName, codeLang);

        if (result) {
            if (Array.isArray(result)) {
                // 如果是数组，判断里面的类型是否统一
                let unify = true;
                let targetType;

                for (let n = result.length - 1; n >= 0 && unify; n--) {
                    targetType = result[n];

                    for (let m = result.length - 1; m >= 0 && unify; m--) {
                        let type2 = result[m];
                        if (targetType != type2) {
                            unify = false;
                        }
                    }
                }
                switch (codeLang) {
                    case CodeLanguageEnum.TS: {
                        if (unify) {
                            return targetType + "[]";
                        } else {
                            return "any[]";
                        }
                        break;
                    }
                    case CodeLanguageEnum.CS: {
                        if (unify) {
                            let typeEnumName;
                            for (let ten in CSTypeEnum) {
                                if (CSTypeEnum[ten] == targetType)
                                    typeEnumName = ten;
                            }
                            if (typeEnumName == CSTypeEnum.Bool || typeEnumName == CSTypeEnum.Int || typeEnumName == CSTypeEnum.Float || typeEnumName == CSTypeEnum.String) {
                                return CSTypeEnum[typeEnumName + "List"];
                            } else {
                                let typeEnumNameSplit = typeEnumName.split("List");
                                return CSTypeEnum[typeEnumNameSplit[0] + "List" + (typeEnumNameSplit[1] + 1)];
                            }
                        } else {
                            let rmk = this.remark[configName];
                            let filePath = rmk?.config_other_info ? rmk.config_other_info.filePath : rmk?.filePath;
                            console.log(cli.red(`C#不支持any类型！你清醒一点！表名：${configName}，字段：${keyName}，文件路径：${filePath}`));
                        }
                        break;
                    }
                }
            } else {

                return result;
            }
        }

        result = this.getAnyDataValue(configName, keyName);
        result = this.getValueType(result, codeLang);
        return result;
    }

    /**
     * 获取值类型
     * @param value 
     * @param jsonParse 
     * @returns 
     */
    public getValueType(value: any, codeLang: CodeLanguageEnum, jsonParse?: boolean) {
        if (jsonParse) {
            try {
                value = JSON.parse(value);
            } catch (e) {
                console.log(cli.yellow("获取值类型，解析JSON出错，", value));
            }
        }

        let targetTypeEnum: any;
        switch (codeLang) {
            case CodeLanguageEnum.TS: {
                targetTypeEnum = TSTypeEnum;
                break;
            }
            case CodeLanguageEnum.CS: {
                targetTypeEnum = CSTypeEnum;
                break;
            }
        }

        if (value === "") {
            switch (codeLang) {
                case CodeLanguageEnum.TS: {
                    return TSTypeEnum.Any;
                    break;
                }
                case CodeLanguageEnum.CS: {
                    return CSTypeEnum.String;
                    break;
                }
            }
        }

        if (value === true || value === false) {
            return targetTypeEnum["Bool"];
        }

        if (typeof value == "number") {
            switch (codeLang) {
                case CodeLanguageEnum.TS: {
                    return TSTypeEnum.Int;
                    break;
                }
                case CodeLanguageEnum.CS: {
                    return CommonUtils.numIsInt(value) ? CSTypeEnum.Int : CSTypeEnum.Float;
                    break;
                }
            }
        }

        if (typeof value == "string") {
            return targetTypeEnum["String"];
        }

        if (Array.isArray(value)) {
            if (value.length == 0) {
                switch (codeLang) {
                    case CodeLanguageEnum.TS: {
                        return TSTypeEnum.AnyList;
                        break;
                    }
                    case CodeLanguageEnum.CS: {
                        console.log(cli.red(`C#不支持解析空数组类型！`));
                        break;
                    }
                }
            }

            let baseTypeNumData = this.getArrayInfo(value, codeLang);

            let isStandardArray = Object.keys(baseTypeNumData).length <= 1;
            let maxDepth = 0;
            if (isStandardArray) {
                let depths = [];
                for (let baseTypeNumDataKey in baseTypeNumData) {
                    let depth2NumObj = baseTypeNumData[baseTypeNumDataKey];
                    for (let depth in depth2NumObj) {
                        if (+depth > maxDepth) {
                            maxDepth = +depth;
                        }
                        if (depths.indexOf(+depth) == -1) {
                            depths.push(+depth);
                        }
                    }
                }
                if (depths.length > 1) {
                    isStandardArray = false;
                }
            }

            let elementType;

            if (isStandardArray) {
                let types = Object.keys(baseTypeNumData);
                if (types.length == 1) {
                    elementType = types[0];
                }
            }

            if (isStandardArray) {
                let depthStr = maxDepth > 1 ? maxDepth : "";
                let prefix = StringUtils.convertToUpperCamelCase(elementType);
                return targetTypeEnum[`${prefix}List${depthStr}`];
            } else {
                switch (codeLang) {
                    case CodeLanguageEnum.TS: {
                        return TSTypeEnum.AnyList;
                        break;
                    }
                    case CodeLanguageEnum.CS: {
                        console.log(cli.red(`C#不支持Any类型的数组！`));
                        break;
                    }
                }
            }
        }

        if (value instanceof Object) {
            switch (codeLang) {
                case CodeLanguageEnum.TS: {
                    return TSTypeEnum.Any;
                    break;
                }
                case CodeLanguageEnum.CS: {
                    console.log(cli.red(`C#不支持Any类型！`));
                    break;
                }
            }
        }
    }

    /**
     * 获取数组信息（内部值类型的计数、深度）
     * @param array 
     * @param record 
     * @param depth 
     * @returns 
     */
    private getArrayInfo(array: any, codeLang: CodeLanguageEnum, record?: any, depth?: number) {
        if (record == null) {
            record = {};
        }
        if (depth == null) {
            depth = 1;
        }
        if (Array.isArray(array)) {
            array.forEach((ele, n) => {
                if (Array.isArray(ele)) {
                    this.getArrayInfo(ele, codeLang, record, depth + 1);
                } else {
                    let type = this.getValueType(ele, codeLang);
                    if (type) {
                        if (!record[type]) {
                            record[type] = {};
                        }
                        if (!record[type][depth]) {
                            record[type][depth] = 0;
                        }
                        record[type][depth]++;
                    }
                }
            });
        }
        return record;
    }

    /**
     * 获取父类（直到祖宗）
     * @param configName 
     * @returns 
     */
    public getParents(configName: string, includeSelf?: boolean) {
        let result: string[];
        let rmk = this.remark[configName];
        while (rmk) {
            let parentConfigName = rmk.config_other_info.parent;
            if (parentConfigName) {
                if (!result) {
                    result = [parentConfigName];
                } else {
                    result.push(parentConfigName);
                }
                rmk = this.remark[parentConfigName];
            } else {
                rmk = null;
            }
        }
        if (result && includeSelf) {
            result.unshift(configName);
        }
        return result;
    }

    /**
     * 获取配置的链接信息
     * @param configName 
     */
    public getConfigLinks(configName: string) {
        let result: string[];
        let configRmk = this.remark[configName];
        for (let key in configRmk) {
            let link = configRmk[key].link;
            if (link) {
                if (result) {
                    result.push(link);
                } else {
                    result = [link];
                }
            }
        }
        return result;
    }

    /**
     * 获取主键成员变量名称
     * @param index 
     * @returns 
     */
    public getMainKeyVarName(index: number) {
        return DataModel.MainKeyVarName + index;
    }

    /**
     * 判断是不是主键
     * @param configName 
     * @param keyName 
     * @returns 
     */
    public isMainKey(configName: string, keyName: string) {
        if (keyName.substring(0, DataModel.MainKeyVarName.length) == DataModel.MainKeyVarName)
            return true;

        let configRmk = this.remark[configName];
        if (configRmk?.config_other_info) {
            return configRmk.config_other_info.mainKeyNames.indexOf(keyName) != -1;
        }
        return false;
    }

    /**
     * 根据类型获取配置名称数组并裁剪对应“生成至”的数据，并排序
     * @param type 
     */
    public getConfigNamesAndCutDataByConfigType(exportID: number) {
        let result = Object.keys(this.originConfig);

        for (let n = result.length - 1; n >= 0; n--) {
            let configName = result[n];
            let config = this.originConfig[configName];
            let configRemark = this.remark[configName];

            let deleteConfig = false;

            if (Object.keys(configRemark).length == 0) {
                deleteConfig = true;
            } else {
                let sheetType = configRemark.config_other_info?.sheetType || configRemark.sheetType;

                let fixedKeys: string[];
                if (sheetType == SheetType.Horizontal) {
                    fixedKeys = config.fixed_keys;
                } else if (sheetType == SheetType.Vertical) {
                    fixedKeys = Object.keys(config);
                }

                for (let m = fixedKeys.length - 1; m >= 0; m--) {
                    let fixedKey = fixedKeys[m];
                    let fixedRmk = configRemark[fixedKey];
                    let fixedGenerate = fixedRmk.generate;

                    // 判断生成至
                    if (
                        fixedGenerate
                        && Array.isArray(fixedGenerate)
                        && fixedGenerate.indexOf(exportID) == -1
                    ) {
                        // 裁剪数据
                        fixedKeys.splice(m, 1);
                        if (sheetType == SheetType.Horizontal) {
                            for (let uKey in config.data) {
                                let singleData = config.data[uKey];
                                singleData.splice(m, 1);
                            }
                        } else {
                            delete config[fixedKey];
                        }
                    }
                }

                if (fixedKeys.length == 0) {
                    deleteConfig = true;
                }
            }

            if (deleteConfig) {
                result.splice(n, 1);
            }
        }

        // 排序，被连接的类要先生成，父类要先生成
        while (true) {
            let doSwap: boolean;
            let swapAI: number, swapBI: number;
            for (let aI = result.length - 1; !doSwap && aI >= 0; aI--) {
                for (let bI = result.length - 1; !doSwap && bI >= 0; bI--) {
                    if (aI == bI)
                        continue;

                    let a = result[aI];
                    let b = result[bI];

                    let aLinks = this.getConfigLinks(a);
                    let bLinks = this.getConfigLinks(b);

                    if (aLinks && aLinks.indexOf(b) != -1) {
                        if (aI < bI) {
                            doSwap = true;
                            swapAI = aI;
                            swapBI = bI;
                        }
                    } else if (bLinks && bLinks.indexOf(a) != -1) {
                        if (bI < aI) {
                            doSwap = true;
                            swapAI = aI;
                            swapBI = bI;
                        }
                    }

                    let aParents = this.getParents(a);
                    let bParents = this.getParents(b);

                    if (aParents && aParents.indexOf(b) != -1) {
                        if (aI < bI) {
                            doSwap = true;
                            swapAI = aI;
                            swapBI = bI;
                        }
                    } else if (bParents && bParents.indexOf(a) != -1) {
                        if (bI < aI) {
                            doSwap = true;
                            swapAI = aI;
                            swapBI = bI;
                        }
                    }
                }
            }

            if (doSwap) {
                let temp = result[swapBI];
                result[swapBI] = result[swapAI];
                result[swapAI] = temp;
            } else {
                break;
            }
        }

        // console.log(type, result);

        return result;
    }

    /**
     * 获取配置的字段
     * 调用本函数前请保证已经执行过 getConfigNamesAndCutDataByConfigType()，因为要排除掉不生成的字段
     * @param configName 
     * @param includeParent 是否包含父类
     * @returns 
     */
    public getConfigFixedKeys(configName: string, codeLang: CodeLanguageEnum, includeParent?: boolean) {
        let configNames: string[] = [];
        if (includeParent) {
            configNames = this.getParents(configName);
            if (configNames) {
                configNames.reverse();
            } else {
                configNames = [];
            }
        }
        configNames.push(configName);

        let result: string[][] = [];

        configNames.forEach(cfgName => {
            let cfg = this.originConfig[cfgName];
            let cfgRmk = this.remark[cfgName];
            let sheetType = cfgRmk.config_other_info?.sheetType || cfgRmk.sheetType;
            let fixedKeys: string[];
            if (sheetType == SheetType.Horizontal) {
                fixedKeys = cfg.fixed_keys;
            } else if (sheetType == SheetType.Vertical) {
                fixedKeys = Object.keys(cfg);
            }

            fixedKeys.forEach(fk => {
                if (!result.find(arr => arr[0] == fk)) {
                    result.push([fk, this.getConfigKeyType(cfgName, fk, codeLang), cfgName]);
                }
            });
        });

        return result;
    }

    public getConfigCollectionTypeByIndex(configName: string, codeLang: CodeLanguageEnum, start?: number, end?: number) {
        let mainKeyNames = this.remark[configName].config_other_info.mainKeyNames;
        let itemClassName = configName + DataModel.Instance.config.export_item_suffix;

        if (!start)
            start = 0;
        if (!end)
            end = mainKeyNames.length - 1;

        let collectionTypeName: string;
        switch (codeLang) {
            case CodeLanguageEnum.TS: {
                collectionTypeName = "Map";
                break;
            }
            case CodeLanguageEnum.CS: {
                collectionTypeName = "Dictionary";
            }
        }

        let result = "";
        let bracketStr = "";
        for (let mksIdx = start; mksIdx <= end; mksIdx++) {
            let mainKeyName = mainKeyNames[mksIdx];
            let mainKeyType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, codeLang);
            result += `${collectionTypeName}<${mainKeyType}, `;
            if (mksIdx == end) {
                result += `${itemClassName}`;
            }
            bracketStr += ">";
        }
        result += bracketStr;
        return result;
    }

    /**
     * 根据类型获取解析方法的字符串
     * @param str 
     * @returns 
     */
    public getParseFuncNameByType(str: string, codeLang: CodeLanguageEnum) {
        switch (codeLang) {
            case CodeLanguageEnum.TS: {
                console.log(cli.red("TS没有这个烦恼，是从哪里调进来的？！你清醒一点！"));
                break;
            }
            case CodeLanguageEnum.CS: {
                switch (str) {
                    case CSTypeEnum.Bool:
                        return "ConfigUtility.ParseBool({0})";
                    case CSTypeEnum.Int:
                        return "ConfigUtility.ParseInt({0})";
                    case CSTypeEnum.Float:
                        return "ConfigUtility.ParseFloat({0})";
                    case CSTypeEnum.String:
                        return "{0}";

                    case CSTypeEnum.BoolList:
                        return "ConfigUtility.ParseBoolList({0})";
                    case CSTypeEnum.IntList:
                        return "ConfigUtility.ParseIntList({0})";
                    case CSTypeEnum.FloatList:
                        return "ConfigUtility.ParseFloatList({0})";
                    case CSTypeEnum.StringList:
                        return "ConfigUtility.ParseStringList({0})";

                    case CSTypeEnum.BoolList2:
                        return "ConfigUtility.ParseBoolList2({0})";
                    case CSTypeEnum.IntList2:
                        return "ConfigUtility.ParseIntList2({0})";
                    case CSTypeEnum.FloatList2:
                        return "ConfigUtility.ParseFloatList2({0})";
                    case CSTypeEnum.StringList2:
                        return "ConfigUtility.ParseStringList2({0})";

                    case CSTypeEnum.BoolList3:
                        return "ConfigUtility.ParseBoolList3({0})";
                    case CSTypeEnum.IntList3:
                        return "ConfigUtility.ParseIntList3({0})";
                    case CSTypeEnum.FloatList3:
                        return "ConfigUtility.ParseFloatList3({0})";
                    case CSTypeEnum.StringList3:
                        return "ConfigUtility.ParseStringList3({0})";

                    case CSTypeEnum.BoolList4:
                        return "ConfigUtility.ParseBoolList4({0})";
                    case CSTypeEnum.IntList4:
                        return "ConfigUtility.ParseIntList4({0})";
                    case CSTypeEnum.FloatList4:
                        return "ConfigUtility.ParseFloatList4({0})";
                    case CSTypeEnum.StringList4:
                        return "ConfigUtility.ParseStringList4({0})";

                    case CSTypeEnum.BoolList5:
                        return "ConfigUtility.ParseBoolList5({0})";
                    case CSTypeEnum.IntList5:
                        return "ConfigUtility.ParseIntList5({0})";
                    case CSTypeEnum.FloatList5:
                        return "ConfigUtility.ParseFloatList5({0})";
                    case CSTypeEnum.StringList5:
                        return "ConfigUtility.ParseStringList5({0})";
                }
                break;
            }
        }
    }
}