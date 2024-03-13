import cli from "cli-color";
import path from "path";
import {IOUtils} from "../utils/IOUtils";
import {StrUtils} from "../utils/StrUtils";
import {DataModel} from "../DataModel";
import fs from "fs";
import {CommonUtils} from "../utils/CommonUtils";
import {CSTypeEnum} from "../CSTypeEnum";
import {IConfigExport} from "../IConfigExport";
import {CodeLang} from "../CodeLang";
import {LineBreak} from "../utils/LineBreak";
import {CodeWriter} from "../utils/CodeWriter";
import encBase64 from "crypto-js/enc-base64";
import encUTF8 from "crypto-js/enc-utf8";
import {Remark} from "../Remark";
import {RemarkField} from "../RemarkField";

/**
 * @Doc 生成CS模块
 * @Author kL
 * @Date 2020/7/20 16:02
 */
export class GenCSModule {
    // ------------------began 单例 ------------------
    private static _instance: GenCSModule;

    public static get Instance() {
        if (this._instance == null) {
            this._instance = new GenCSModule();
        }
        return this._instance;
    }

    // ------------------ended 单例 ------------------

    private _codeLang: CodeLang;
    private _export: IConfigExport;
    private _configNames: string[];
    private _configSplitor: string;

    /**
     * 发布
     * @param exportID
     * @returns
     */
    public gen(exportID: number): boolean {
        this._export = DataModel.Instance.config.exports.find(e => e.id == exportID);
        this._codeLang = this._export.code_language;

        console.log(`\n================================= 开始生成 ${this._export.id} 配置 =================================\n`);

        // 移除旧文件
        IOUtils.deleteFolderFileByCondition(this._export.export_script_url, (fullPath) => {
            // 不删除 meta 文件
            if (path.extname(fullPath) == ".meta") {
                return;
            }
            return true;
        });
        IOUtils.makeDir(this._export.export_script_url);

        // 拷贝固定代码
        IOUtils.copy(`templates/${this._export.template_name || this._export.id}/scripts/`, this._export.export_script_url);

        this._configNames = DataModel.Instance.getConfigNamesAndCutDataByConfigType(this._export.id);

        this._configSplitor = DataModel.Instance.config.export_data_splitor;
        if (DataModel.Instance.config.export_data_splitor_random_enabled) {
            this._configSplitor = StrUtils.genPassword(8, true, true, false, true);
        }

        let flag = this.genEnum();
        if (flag) {
            flag = this.genItemAndVertical();
        }
        if (flag) {
            flag = this.genMgr();
        }
        if (flag) {
            // 检查meta文件，如果不存在相应的cs文件，就把meta文件删除 
            IOUtils.deleteFolderFileByCondition(this._export.export_script_url, (fullPath) => {
                let extname = path.extname(fullPath);
                // 不删除 meta 文件
                if (extname == ".meta") {
                    let dirname = path.dirname(fullPath);
                    let filename = path.basename(fullPath);
                    let scriptFullname = path.join(dirname, `${filename.split(".")[0]}.${this._export.script_suffix}`);
                    if (!fs.existsSync(scriptFullname)) {
                        console.log(fullPath, "已被删除");
                        return true;
                    }
                    return;
                }
                return;
            });
        }
        if (flag) {
            flag = this.genConfigText();
        }

        return flag;
    }

    /**
     * 生成枚举类
     * @returns
     */
    private genEnum(): boolean {
        let configEnumTemplate = CommonUtils.getTemplate(this._export, "ConfigEnum.txt");

        let enumNames = Object.keys(DataModel.Instance.enum);
        // 过滤掉不生成的
        enumNames = enumNames.filter(enumName => {
            let rmk: Remark = DataModel.Instance.remark[enumName];
            return rmk.generate?.indexOf(this._export.id) >= 0;
        });

        for (let idx = 0; idx < enumNames.length; idx++) {
            const enumName = enumNames[idx];
            let enumData = DataModel.Instance.enum[enumName];

            let cw = new CodeWriter();
            enumData.forEach((aData, n) => {
                if (aData.annotation) {
                    cw.addStr(CommonUtils.getCommentStr(this._codeLang, aData.annotation, 2) + "\n");
                }
                let isLast = n == enumData.length - 1;
                cw.add(2, `${aData.key} = ${aData.value}${isLast ? "" : ","}`, !isLast);
            });

            let writeContent = StrUtils.format(configEnumTemplate,
                enumName,
                cw.content
            );
            IOUtils.writeTextFile(path.join(this._export.export_script_url, enumName + "." + this._export.script_suffix), writeContent, LineBreak.CRLF, "导出枚举类脚本成功！-> {0}");
        }

        return true;
    }

    /**
     * 生成Item类、竖表类
     * @returns
     */
    private genItemAndVertical(): boolean {
        let configItemTemplate = CommonUtils.getTemplate(this._export, "ConfigItem.txt");
        let configSingleTemplate = CommonUtils.getTemplate(this._export, "ConfigSingle.txt");

        for (let n = 0; n < this._configNames.length; n++) {
            let configName = this._configNames[n];
            let cfg = DataModel.Instance.originConfig[configName];
            let configRemark: Remark = DataModel.Instance.remark[configName];
            let parentRemark: Remark = configRemark.parent && DataModel.Instance.remark[configRemark.parent];

            let parents = DataModel.Instance.getParents(configName);
            let bestParentConfigName: string;

            if (parentRemark) {
                bestParentConfigName = StrUtils.convertToLowerCamelCase(parents[parents.length - 1]);
            }

            let parentItemName = parentRemark && (configRemark.parent + DataModel.Instance.config.export_item_suffix);

            if (cfg.fixed_keys) {
                let uniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang);
                let itemClassName = configName + DataModel.Instance.config.export_item_suffix;

                let extendsStr = "";
                let cwField = new CodeWriter();
                let constructorArgsContent = "";
                let constructorExtendsArgsContent = "";
                let cwConstructorArgsAssign = new CodeWriter();

                if (parentRemark) {
                    extendsStr = ` : ${parentItemName}`;
                }

                let fixedKeys = [["uniqueKey", uniqueKeyType, bestParentConfigName]];

                if (!configRemark.isSingleMainKey) {
                    let mainKeyNames = configRemark.mainKeyNames;
                    for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                        let mainKeyName = mainKeyNames[mksIdx];
                        let mainKeyType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, this._codeLang);

                        let mainKeyVarName = DataModel.Instance.getMainKeyVarName(mksIdx + 1);
                        let lowerMainKeyFieldName = mainKeyVarName;

                        fixedKeys.push([lowerMainKeyFieldName, mainKeyType, bestParentConfigName]);
                    }

                    for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                        let mainKeyName = mainKeyNames[mksIdx];
                        let mainKeyType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, this._codeLang);
                        fixedKeys.push([mainKeyName, mainKeyType, bestParentConfigName]);
                    }
                }

                let allFixedKeys = DataModel.Instance.getConfigFixedKeys(configName, this._codeLang, true);
                allFixedKeys = allFixedKeys.filter(arr => !fixedKeys.find(arr2 => arr2[0] == arr[0]))
                fixedKeys = [...fixedKeys, ...allFixedKeys];
                let selfFixedKeys = DataModel.Instance.getConfigFixedKeys(configName, this._codeLang);

                if (!parentRemark) {
                    cwField.addStr(CommonUtils.getCommentStr(this._codeLang, "唯一主键", 2) + "\n");
                    cwField.add(2, `public ${uniqueKeyType} UniqueKey { private set; get; }`);

                    cwConstructorArgsAssign.add(3, `UniqueKey = uniqueKey;`);

                    if (!configRemark.isSingleMainKey) {
                        let mainKeyNames = configRemark.mainKeyNames;
                        for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                            let mainKeyName = mainKeyNames[mksIdx];
                            let mainKeyType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, this._codeLang);

                            cwField.addStr(CommonUtils.getCommentStr(this._codeLang, `第${mksIdx + 1}主键`, 2) + "\n");

                            let mainKeyVarName = DataModel.Instance.getMainKeyVarName(mksIdx + 1);
                            let upperMainKeyFieldName = StrUtils.convertToUpperCamelCase(mainKeyVarName);
                            let lowerMainKeyFieldName = mainKeyVarName;

                            cwField.add(2, `public ${mainKeyType} ${upperMainKeyFieldName} { private set; get; }`);
                            cwConstructorArgsAssign.add(3, `${upperMainKeyFieldName} = ${lowerMainKeyFieldName};`);
                        }
                    }
                }

                for (let idx = 0; idx < fixedKeys.length; idx++) {
                    const fixedKey = fixedKeys[idx];
                    let fixed_key = fixedKey[0];
                    let valType = fixedKey[1];
                    let fromConfig = fixedKey[2];

                    let configRmk: Remark = DataModel.Instance.remark[fromConfig] || configRemark;

                    let isSelfKey = selfFixedKeys.find(arr => arr[0] == fixed_key) != null; // 是否是本配置的key
                    let isMainKey = DataModel.Instance.isMainKey(configName, fixed_key);    // 是否是主键key

                    let lowerCamelFixedKey = StrUtils.convertToLowerCamelCase(fixed_key);
                    let upperCamelFixedKey = StrUtils.convertToUpperCamelCase(fixed_key);

                    let genField = isSelfKey && (!parentRemark || !isMainKey);
                    let field: RemarkField = configRmk?.fields && configRmk.fields[fixed_key];

                    if (genField) {
                        if (field?.annotation) {
                            cwField.addStr(CommonUtils.getCommentStr(this._codeLang, field.annotation, 2) + "\n");
                        }
                    }

                    if (field?.enum) {  // 处理枚举
                        if (valType != CSTypeEnum.Int) {
                            console.log(cli.red("枚举的值不是整数！-> " + configName + " -> " + fixed_key));
                            return false;
                        }
                        valType = field.enum;
                        if (genField) {
                            cwField.add(2, `public ${valType} ${upperCamelFixedKey} { private set; get; }`, false);
                        }
                        constructorArgsContent += `${valType} ${lowerCamelFixedKey}`;
                    } else if (field?.link) {    // 处理表连接
                        let linkConfigName = field.link;
                        let linkedConfigItemName = field.link + DataModel.Instance.config.export_item_suffix;
                        if (field.linkIsArray) {   // 处理表连接（数组形式）
                            if (valType == CSTypeEnum.IntList || valType == CSTypeEnum.StringList) {
                                if (genField) {
                                    cwField.add(2, `public IReadOnlyList<${linkedConfigItemName}> ${upperCamelFixedKey} { private set; get; }`, false);
                                }
                                constructorArgsContent += `IReadOnlyList<${linkedConfigItemName}> ${lowerCamelFixedKey}`;
                            } else {
                                console.log(cli.red("链接的值不是整数数组或字符串数组！-> " + configName + " -> " + fixed_key));
                                return false;
                            }
                        } else {
                            if (genField) {
                                cwField.add(2, `public ${linkedConfigItemName} ${upperCamelFixedKey} { private set; get; }`, false);
                            }
                            constructorArgsContent += `${linkedConfigItemName} ${lowerCamelFixedKey}`;
                        }
                    } else {    // 常规
                        if (genField) {
                            cwField.add(2, `public ${valType} ${upperCamelFixedKey} { private set; get; }`, false);
                        }
                        constructorArgsContent += `${valType} ${lowerCamelFixedKey}`;
                    }

                    if (genField) {
                        cwConstructorArgsAssign.add(3, `${upperCamelFixedKey} = ${lowerCamelFixedKey};`, false);
                    }

                    if (parentRemark) {
                        if (!isSelfKey || isMainKey) {
                            constructorExtendsArgsContent += (constructorExtendsArgsContent ? ", " : "") + lowerCamelFixedKey;
                        }
                    }

                    if (idx < fixedKeys.length - 1) {
                        if (genField) {
                            cwField.newLine();
                            cwConstructorArgsAssign.newLine();
                        }
                        constructorArgsContent += ", ";
                    }
                }

                if (constructorExtendsArgsContent) {
                    constructorExtendsArgsContent = ` : base(${constructorExtendsArgsContent})`;
                }

                let writeContent = StrUtils.format(configItemTemplate,
                    itemClassName,
                    extendsStr,
                    cwField.content,
                    itemClassName,
                    constructorArgsContent,
                    constructorExtendsArgsContent,
                    cwConstructorArgsAssign.content,
                );
                IOUtils.writeTextFile(path.join(this._export.export_script_url, configName + DataModel.Instance.config.export_item_suffix + "." + this._export.script_suffix), writeContent, LineBreak.CRLF, `导出配置Item(${configRemark.sheetType})脚本成功！-> {0}`);

            } else {

                let cwField = new CodeWriter();
                let constructorArgsContent = "";
                let cwConstructorArgsAssign = new CodeWriter();

                let keysNum = Object.keys(cfg).length;
                let curNum = 0;
                for (const fixed_key in cfg) {
                    let val = cfg[fixed_key];
                    let valType = DataModel.Instance.getValueType(val, this._codeLang, false, configName, fixed_key);

                    let field: RemarkField = configRemark.fields && configRemark.fields[fixed_key];
                    if (field?.annotation) {
                        cwField.addStr(CommonUtils.getCommentStr(this._codeLang, field.annotation, 2) + "\n");
                    }

                    let lowerCamelFixedKey = StrUtils.convertToLowerCamelCase(fixed_key);
                    let upperCamelFixedKey = StrUtils.convertToUpperCamelCase(fixed_key);

                    cwField.add(2, `public ${valType} ${upperCamelFixedKey} { private set; get; }`, false);

                    constructorArgsContent += `${valType} ${lowerCamelFixedKey}`;

                    cwConstructorArgsAssign.add(3, `${upperCamelFixedKey} = ${lowerCamelFixedKey};`, false);

                    if (curNum < keysNum - 1) {
                        constructorArgsContent += ", ";
                        cwField.newLine();
                        cwConstructorArgsAssign.newLine();
                    }
                    curNum++;
                }

                let writeContent = StrUtils.format(configSingleTemplate,
                    configName,
                    cwField.content,
                    configName,
                    constructorArgsContent,
                    cwConstructorArgsAssign.content,
                );
                IOUtils.writeTextFile(path.join(this._export.export_script_url, configName + "." + this._export.script_suffix), writeContent, LineBreak.CRLF, `导出配置(${configRemark.sheetType})脚本成功！-> {0}`);
            }
        }

        return true;
    }

    /**
     * 生成Manager类
     * @returns
     */
    private genMgr(): boolean {
        let configMgrTemplate = CommonUtils.getTemplate(this._export, "ConfigMgr.txt");
        let cwField = new CodeWriter();
        let cwParse = new CodeWriter();

        for (let idx = 0; idx < this._configNames.length; idx++) {
            const configName = this._configNames[idx];
            let cfg = DataModel.Instance.originConfig[configName];
            let itemClassName = configName + DataModel.Instance.config.export_item_suffix;
            let configRemark: Remark = DataModel.Instance.remark[configName];

            let parents = DataModel.Instance.getParents(configName);
            let parentsReverse = parents ? [...parents].reverse() : null;
            let parentLayer = parents ? parents.length : 0;

            let lowerCamelConfigName = StrUtils.convertToLowerCamelCase(configName);
            let upperCamelConfigName = StrUtils.convertToUpperCamelCase(configName);

            cwParse.add(3, `// ${configName}`);
            cwParse.add(3, `section = sections[${idx}];`);

            cwParse.add(3, `lines = Regex.Split(section, "\\r\\n");`);

            let fixed_keys = cfg.fixed_keys;

            if (fixed_keys) {
                let uniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang);

                let idxOffset = 1;
                if (!configRemark.isSingleMainKey) {
                    let mainKeyNames = configRemark.mainKeyNames;
                    idxOffset = mainKeyNames.length + 1;
                }

                // if (!parentLayer) {
                cwField.add(2, `public static BaseConfig<${uniqueKeyType}, ${itemClassName}> ${configName} { private set; get; }`, false);
                // }

                let bestParentConfigVarName: string;

                let dictVarName: string;

                if (parentLayer) {
                    dictVarName = `dict${idx}`;
                    bestParentConfigVarName = StrUtils.convertToLowerCamelCase(parents[parents.length - 1]) + "Data";
                    cwParse.add(3, `var ${dictVarName} = ${bestParentConfigVarName};`);
                    cwParse.add(3, `Dictionary<${uniqueKeyType}, ${itemClassName}> ${dictVarName}_self = new Dictionary<${uniqueKeyType}, ${itemClassName}>();`);
                } else {
                    dictVarName = `${lowerCamelConfigName}Data`;
                    cwParse.add(3, `Dictionary<${uniqueKeyType}, ${itemClassName}> ${dictVarName} = new Dictionary<${uniqueKeyType}, ${itemClassName}>();`);
                }

                cwParse.add(3, `for (int n = 0; n < lines.Length - 1; n += ${fixed_keys.length + idxOffset})`);
                cwParse.add(3, `{`);

                if (parentLayer) {
                    parentsReverse.forEach((parent, n) => {
                        let parentConfigItemName = parent + DataModel.Instance.config.export_item_suffix;
                        cwParse.add(4, `var parentItem${n + 1} = ${dictVarName}[${StrUtils.format(DataModel.Instance.getParseFuncNameByType(DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang, false), this._codeLang), `lines[n]`)}] as ${parentConfigItemName};`);
                    });
                }

                let constructorArgsContent = "";

                // 判断唯一主键是枚举
                if (configRemark.mainKeyOnlyOneAndIsEnum) {
                    constructorArgsContent += `(${uniqueKeyType}) `;
                }

                constructorArgsContent += StrUtils.format(DataModel.Instance.getParseFuncNameByType(DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang, false), this._codeLang), `lines[n]`);

                if (!configRemark.isSingleMainKey) {
                    constructorArgsContent += ", ";
                    let mainKeyNames = configRemark.mainKeyNames;
                    for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                        let mainKeyName = mainKeyNames[mksIdx];
                        let valType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, this._codeLang);
                        constructorArgsContent += StrUtils.format(DataModel.Instance.getParseFuncNameByType(valType, this._codeLang), `lines[n + ${mksIdx + 1}]`);
                        if (mksIdx != mainKeyNames.length - 1) {
                            constructorArgsContent += ", ";
                        }
                    }
                }

                if (fixed_keys.length > 0) {
                    constructorArgsContent += ", "
                }

                if (parentLayer) {
                    let addedFixedKeys: string[] = [];
                    parentsReverse.forEach((parent, n) => {
                        let parentFixedKeys = DataModel.Instance.originConfig[parent].fixed_keys;
                        for (let m = 0; m < parentFixedKeys.length; m++) {
                            let fixed_key = parentFixedKeys[m];
                            if (addedFixedKeys.indexOf(fixed_key) != -1)
                                continue;
                            let varName = StrUtils.convertToUpperCamelCase(fixed_key);
                            constructorArgsContent += `parentItem${n + 1}.${varName}, `;
                            addedFixedKeys.push(fixed_key);
                        }
                    });
                }

                for (let idx2 = 0; idx2 < fixed_keys.length; idx2++) {
                    let fixed_key = fixed_keys[idx2];

                    let doContinue = false;
                    if (parentLayer) {
                        for (let g = parents.length - 1; !doContinue && g >= 0; g--) {
                            const parent = parents[g];
                            let parentFixedKeys = DataModel.Instance.originConfig[parent].fixed_keys;
                            if (parentFixedKeys.indexOf(fixed_key) != -1) {
                                doContinue = true;
                            }
                        }
                    }
                    if (doContinue)
                        continue;

                    let valType = DataModel.Instance.getConfigKeyType(configName, fixed_key, this._codeLang);

                    let field = configRemark?.fields && configRemark.fields[fixed_key];
                    if (field?.enum) {  // 处理枚举
                        if (valType != CSTypeEnum.Int) {
                            console.log(cli.red("枚举的值不是整数！-> " + configName + " -> " + fixed_key));
                            return false;
                        }
                        valType = field.enum;
                        constructorArgsContent += `(${valType}) `;
                        constructorArgsContent += StrUtils.format(DataModel.Instance.getParseFuncNameByType(CSTypeEnum.Int, this._codeLang), `lines[n + ${idx2 + idxOffset}]`);
                    } else if (field?.link) {    // 处理表连接
                        let linkConfigName = field.link;
                        if (field.linkIsArray) {   // 处理表连接（数组形式）
                            if (valType == CSTypeEnum.IntList || valType == CSTypeEnum.StringList) {
                                let linkedConfigUniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(field.link, this._codeLang);
                                let linkedConfigItemName = field.link + DataModel.Instance.config.export_item_suffix;
                                constructorArgsContent += `ConfigUtility.GetLinkedConfigs<${linkedConfigUniqueKeyType}, ${linkedConfigItemName}>(${StrUtils.format(DataModel.Instance.getParseFuncNameByType(valType, this._codeLang), `lines[n + ${idx2 + idxOffset}]`)}, ${field.link})`;
                            } else {
                                console.log(cli.red("链接的值不是整数数组或字符串数组！-> " + configName + " -> " + fixed_key));
                                return false;
                            }
                        } else {    // 处理表连接（非数组形式）
                            constructorArgsContent += `${linkConfigName}.Get(${StrUtils.format(DataModel.Instance.getParseFuncNameByType(CSTypeEnum.Int, this._codeLang), `lines[n + ${idx2 + idxOffset}]`)})`;
                        }
                    } else {    // 常规
                        constructorArgsContent += StrUtils.format(DataModel.Instance.getParseFuncNameByType(valType, this._codeLang), `lines[n + ${idx2 + idxOffset}]`);
                    }

                    if (idx2 < fixed_keys.length - 1) {
                        constructorArgsContent += ", ";
                    }
                }

                // 保证逗号不在最后
                if (constructorArgsContent?.length >= 2 && constructorArgsContent.substring(constructorArgsContent.length - 2, constructorArgsContent.length) == ", ") {
                    constructorArgsContent = constructorArgsContent.substring(0, constructorArgsContent.length - 2);
                }

                cwParse.add(4, `var item = new ${itemClassName}(${constructorArgsContent});`);
                if (!parentLayer) {
                    cwParse.add(4, `${dictVarName}[item.UniqueKey] = item;`);
                } else {
                    cwParse.add(4, `${dictVarName}[item.UniqueKey] = item;`);
                    cwParse.add(4, `${dictVarName}_self[item.UniqueKey] = item;`);
                }
                cwParse.add(3, `}`);

                if (!parentLayer) {
                    cwParse.add(3, `${configName} = new BaseConfig<${uniqueKeyType}, ${itemClassName}>("${configName}", ${dictVarName});`, false);
                } else {
                    cwParse.add(3, `${configName} = new BaseConfig<${uniqueKeyType}, ${itemClassName}>("${configName}", ${dictVarName}_self);`, false);
                }

                // -------------------------- began 如果是多主键则生成额外的数据集合与解析 --------------------------

                if (!configRemark.isSingleMainKey) {
                    let mainKeyPrefix = StrUtils.convertToUpperCamelCase(DataModel.MainKeyVarName);

                    cwField.newLine();
                    let mainKeyNames = configRemark.mainKeyNames;

                    let collectionTypeStr = DataModel.Instance.getConfigCollectionTypeByIndex(configName, this._codeLang);

                    let varName = `${upperCamelConfigName}${DataModel.Instance.config.export_collection_suffix}`;

                    cwField.add(2, `public static ${collectionTypeStr} ${varName} { private set; get; }`);

                    cwParse.newLine();

                    cwParse.add(3, `${varName} = new ${collectionTypeStr}();`);
                    cwParse.add(3, `foreach (var keyValuePair in ${upperCamelConfigName}.Data)`);
                    cwParse.add(3, `{`);
                    cwParse.add(4, `var item = keyValuePair.Value;`);

                    for (let mksIdx = 1; mksIdx < mainKeyNames.length; mksIdx++) {
                        cwParse.add(4, `if (!${varName}`, false);

                        let end = mksIdx;
                        for (let w = 0; w < end; w++) {
                            let keyNum = w + 1;
                            if (w != end - 1) {
                                cwParse.add(0, `[item.${mainKeyPrefix}${keyNum}]`, false);
                            } else {
                                cwParse.add(0, `.ContainsKey(item.${mainKeyPrefix}${keyNum})`, false);
                            }
                        }
                        cwParse.add(0, `)`);

                        // ----------------------------------------------------

                        cwParse.add(5, `${varName}`, false);
                        end = mksIdx;
                        for (let w = 0; w < end; w++) {
                            let keyNum = w + 1;
                            if (w != end - 1) {
                                cwParse.add(0, `[item.${mainKeyPrefix}${keyNum}]`, false);
                            } else {
                                let typeStr = DataModel.Instance.getConfigCollectionTypeByIndex(configName, this._codeLang, mksIdx, mainKeyNames.length - 1);
                                cwParse.add(0, `[item.${mainKeyPrefix}${keyNum}] = new ${typeStr}();`);
                            }
                        }
                    }

                    cwParse.add(4, `${varName}`, false);

                    for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                        let keyNum = mksIdx + 1;
                        if (mksIdx != mainKeyNames.length - 1) {
                            cwParse.add(0, `[item.${mainKeyPrefix}${keyNum}]`, false);
                        } else {
                            cwParse.add(0, `[item.${mainKeyPrefix}${keyNum}] = item;`);
                        }
                    }

                    cwParse.add(3, `}`);
                }

                // -------------------------- ended 如果是多主键则生成额外的数据集合与解析 --------------------------

            } else {

                cwField.add(2, `public static ${configName} ${configName} { private set; get; }`, false);

                fixed_keys = Object.keys(cfg);

                let constructorArgsContent = "";

                fixed_keys.forEach((fixed_key, idx2) => {
                    let val = cfg[fixed_key];
                    let valType = DataModel.Instance.getValueType(val, this._codeLang, false, configName, fixed_key);
                    constructorArgsContent += StrUtils.format(DataModel.Instance.getParseFuncNameByType(valType, this._codeLang), `lines[${idx2}]`);

                    if (idx2 < fixed_keys.length - 1) {
                        constructorArgsContent += ", ";
                    }
                });

                cwParse.add(3, `${configName} = new ${configName}("${configName}", ${constructorArgsContent});`, false);
            }

            if (idx < this._configNames.length - 1) {
                cwField.newLine();
                cwParse.newLine(2);
            }
        }

        let writeContent = StrUtils.format(configMgrTemplate,
            cwField.content,
            cwParse.content,
        );
        IOUtils.writeTextFile(path.join(this._export.export_script_url, `${this._export.export_config_manager_name}.${this._export.script_suffix}`), writeContent, LineBreak.CRLF, `成功导出配置管理类脚本（${this._export.export_config_manager_name}）-> {0}`);

        return true;
    }

    /**
     * 生成配置文本
     * @returns
     */
    private genConfigText(): boolean {
        let cw = new CodeWriter();
        // cw.lineBreak = LineBreak.LF;

        for (let idx = 0; idx < this._configNames.length; idx++) {
            const configName = this._configNames[idx];
            let cfg = DataModel.Instance.originConfig[configName];

            let fixed_keys = cfg.fixed_keys;

            if (idx > 0) {
                cw.add(0, "#", false);
            }

            if (fixed_keys) {
                let data = cfg.data;
                for (const uniqueKey in data) {
                    let dat = data[uniqueKey];
                    let uKey: any = !isNaN(+uniqueKey) ? +uniqueKey : uniqueKey;
                    cw.add(0, uKey);

                    let uKeySplit = isNaN(+uniqueKey) && uKey.split("_");
                    let rrrmk: Remark = DataModel.Instance.remark[configName];

                    if (
                        uKeySplit
                        && uKeySplit.length > 1
                        && rrrmk?.mainKeySubs
                        && uKeySplit.length == rrrmk.mainKeySubs.length
                    ) {
                        uKeySplit.forEach(cKey => {
                            cKey = !isNaN(+cKey) ? +cKey : cKey;
                            cw.add(0, cKey);
                        });
                    }

                    for (let n = 0; n < dat.length; n++) {
                        let val = dat[n];
                        if (Array.isArray(val)) {
                            val = JSON.stringify(val);
                        } else {
                            val = val?.toString() || "";
                        }
                        cw.add(0, `${val}`);
                    }
                }
            } else {
                for (const fixed_key in cfg) {
                    let val = cfg[fixed_key];
                    if (Array.isArray(val)) {
                        val = JSON.stringify(val);
                    } else if (val != null) {
                        val = val?.toString() || "";
                    } else {
                        val = "";
                    }
                    cw.add(0, `${val}`);
                }
            }
        }

        let wordArr = encUTF8.parse(cw.content);
        let encContent = encBase64.stringify(wordArr);

        IOUtils.writeTextFile(this._export.export_url, encContent, null, "导出配置文本成功！-> {0}");

        return true;
    }
}