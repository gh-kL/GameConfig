import cli from "cli-color";
import path from "path";
import { IOUtils } from "../utils/IOUtils";
import { StringUtils } from "../utils/StringUtils";
import { DataModel } from "../DataModel";
import fs from "fs";
import { CommonUtils } from "../utils/CommonUtils";
import { CSTypeEnum } from "../CSTypeEnum";
import { IConfigExport } from "../IConfigExport";
import { CodeLanguageEnum } from "../CodeLanguageEnum";
import { LineBreak } from "../utils/LineBreak";
import { CodeWriter } from "../utils/CodeWriter";
import encBase64 from "crypto-js/enc-base64";
import encUTF8 from "crypto-js/enc-utf8";
import hmacSHA512 from 'crypto-js/hmac-sha512';

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

    private _codeLang: CodeLanguageEnum;
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
        IOUtils.copy(`templates/${this._export.id}/scripts/`, this._export.export_script_url);

        this._configNames = DataModel.Instance.getConfigNamesAndCutDataByConfigType(this._export.id);

        this._configSplitor = DataModel.Instance.config.export_data_splitor;
        if (DataModel.Instance.config.export_data_splitor_random_enabled) {
            this._configSplitor = StringUtils.genPassword(8, true, true, false, true);
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
        let configEnumTemplate = CommonUtils.getTemplate(this._export.id, "ConfigEnum.txt");

        let enumNames = Object.keys(DataModel.Instance.enum);
        // 过滤掉不生成的
        enumNames = enumNames.filter(enumName => {
            return !DataModel.Instance.remark[enumName].generate || DataModel.Instance.remark[enumName].generate.indexOf(this._export.id) >= 0;
        });
        for (let idx = 0; idx < enumNames.length; idx++) {
            const enumName = enumNames[idx];
            let enumData = DataModel.Instance.enum[enumName];

            let cw = new CodeWriter();
            enumData.forEach((aData, n) => {
                cw.add(2, `/**`);
                cw.add(2, ` * ${aData.annotation}`);
                cw.add(2, ` */`);
                let isLast = n == enumData.length - 1;
                cw.add(2, `${aData.key} = ${aData.value}${isLast ? "" : ","}`, !isLast);
            });

            let writeContent = StringUtils.format(configEnumTemplate,
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
        let configItemTemplate = CommonUtils.getTemplate(this._export.id, "ConfigItem.txt");
        let configSingleTemplate = CommonUtils.getTemplate(this._export.id, "ConfigSingle.txt");

        for (let n = 0; n < this._configNames.length; n++) {
            let configName = this._configNames[n];
            let cfg = DataModel.Instance.originConfig[configName];
            let configRemark = DataModel.Instance.remark[configName];
            let parentRemark = configRemark.config_other_info
                && configRemark.config_other_info.parent
                && DataModel.Instance.remark[configRemark.config_other_info.parent];

            let parents = DataModel.Instance.getParents(configName);
            let bestParentConfigName: string;

            if (parentRemark) {
                bestParentConfigName = StringUtils.convertToLowerCamelCase(parents[parents.length - 1]);
            }

            let parentItemName = parentRemark && (configRemark.config_other_info.parent + DataModel.Instance.config.export_item_suffix);
            let coi = configRemark.config_other_info;

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

                if (coi && !coi.isSingleMainKey) {
                    let mainKeyNames = coi.mainKeyNames;
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
                    cwField.add(2, `/// <summary>`);
                    cwField.add(2, `/// 唯一主键`);
                    cwField.add(2, `/// </summary>`);
                    cwField.add(2, `public ${uniqueKeyType} UniqueKey { private set; get; }`);

                    cwConstructorArgsAssign.add(3, `UniqueKey = uniqueKey;`);

                    if (coi && !coi.isSingleMainKey) {
                        let mainKeyNames = coi.mainKeyNames;
                        for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                            let mainKeyName = mainKeyNames[mksIdx];
                            let mainKeyType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, this._codeLang);

                            cwField.add(2, `/// <summary>`);
                            cwField.add(2, `/// 第${mksIdx + 1}主键`);
                            cwField.add(2, `/// </summary>`);

                            let mainKeyVarName = DataModel.Instance.getMainKeyVarName(mksIdx + 1);
                            let upperMainKeyFieldName = StringUtils.convertToUpperCamelCase(mainKeyVarName);
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

                    let configRmk = DataModel.Instance.remark[fromConfig] || configRemark;

                    let isSelfKey = selfFixedKeys.find(arr => arr[0] == fixed_key) != null;
                    let isMainKey = DataModel.Instance.isMainKey(configName, fixed_key);

                    let lowerCamelFixedKey = StringUtils.convertToLowerCamelCase(fixed_key);
                    let upperCamelFixedKey = StringUtils.convertToUpperCamelCase(fixed_key);

                    let genField = isSelfKey && (!parentRemark || !isMainKey);

                    if (genField) {
                        let annotation: string;
                        if (configRmk) {
                            if (configRmk[fixed_key]) {
                                annotation = configRmk[fixed_key].annotation;
                            }
                        }
                        if (annotation) {
                            cwField.add(2, `/// <summary>`);
                            cwField.add(2, `/// ${annotation}`);
                            cwField.add(2, `/// </summary>`);
                        }
                    }

                    if (configRmk[fixed_key] && configRmk[fixed_key].enum) {  // 处理枚举
                        if (valType != CSTypeEnum.Int) {
                            console.log(cli.red("枚举的值不是整数！-> " + configName + " -> " + fixed_key));
                            return false;
                        }
                        valType = configRmk[fixed_key].enum;
                        if (genField) {
                            cwField.add(2, `public ${valType} ${upperCamelFixedKey} { private set; get; }`, false);
                        }
                        constructorArgsContent += `${valType} ${lowerCamelFixedKey}`;
                    } else if (configRmk[fixed_key] && configRmk[fixed_key].link) {    // 处理表连接
                        let linkConfigName = configRmk[fixed_key].link;
                        let linkedConfigItemName = configRmk[fixed_key].link + DataModel.Instance.config.export_item_suffix;
                        if (configRmk[fixed_key].linkIsArray) {   // 处理表连接（数组形式）
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

                let writeContent = StringUtils.format(configItemTemplate,
                    itemClassName,
                    extendsStr,
                    cwField.content,
                    itemClassName,
                    constructorArgsContent,
                    constructorExtendsArgsContent,
                    cwConstructorArgsAssign.content,
                );
                IOUtils.writeTextFile(path.join(this._export.export_script_url, configName + DataModel.Instance.config.export_item_suffix + "." + this._export.script_suffix), writeContent, LineBreak.CRLF, `导出配置Item(${configRemark.config_other_info.sheetType})脚本成功！-> {0}`);

            } else {

                let cwField = new CodeWriter();
                let constructorArgsContent = "";
                let cwConstructorArgsAssign = new CodeWriter();

                let keysNum = Object.keys(cfg).length;
                let curNum = 0;
                for (const fixed_key in cfg) {
                    let val = cfg[fixed_key];
                    let valType = DataModel.Instance.getValueType(val, this._codeLang);

                    let lowerCamelFixedKey = StringUtils.convertToLowerCamelCase(fixed_key);
                    let upperCamelFixedKey = StringUtils.convertToUpperCamelCase(fixed_key);

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

                let writeContent = StringUtils.format(configSingleTemplate,
                    configName,
                    cwField.content,
                    configName,
                    constructorArgsContent,
                    cwConstructorArgsAssign.content,
                );
                IOUtils.writeTextFile(path.join(this._export.export_script_url, configName + "." + this._export.script_suffix), writeContent, LineBreak.CRLF, `导出配置Item(${configRemark.config_other_info.sheetType})脚本成功！-> {0}`);
            }
        }

        return true;
    }

    /**
     * 生成Manager类
     * @returns 
     */
    private genMgr(): boolean {
        let configManagerTemplate = CommonUtils.getTemplate(this._export.id, "ConfigManager.txt");
        let cwField = new CodeWriter();
        let cwParse = new CodeWriter();

        for (let idx = 0; idx < this._configNames.length; idx++) {
            const configName = this._configNames[idx];
            let cfg = DataModel.Instance.originConfig[configName];
            let itemClassName = configName + DataModel.Instance.config.export_item_suffix;
            let configRemark = DataModel.Instance.remark[configName];

            let parents = DataModel.Instance.getParents(configName);
            let parentsReverse = parents ? [...parents].reverse() : null;
            let parentLayer = parents ? parents.length : 0;
            let parentRmks = [];
            if (parentLayer) {
                parents.forEach(pa => {
                    parentRmks.push(DataModel.Instance.remark[pa]);
                });
            }

            let coi = configRemark.config_other_info;

            let lowerCamelConfigName = StringUtils.convertToLowerCamelCase(configName);
            let upperCamelConfigName = StringUtils.convertToUpperCamelCase(configName);

            cwParse.add(3, `// ${configName}`);
            cwParse.add(3, `section = sections[${idx}];`);

            cwParse.add(3, `lines = Regex.Split(section, "\\r\\n");`);

            let fixed_keys = cfg.fixed_keys;

            if (fixed_keys) {
                let uniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang);

                let idxOffset = 1;
                if (coi && !coi.isSingleMainKey) {
                    let mainKeyNames = coi.mainKeyNames;
                    idxOffset = mainKeyNames.length + 1;
                }

                if (!parentLayer) {
                    cwField.add(2, `public static BaseConfig<${uniqueKeyType}, ${itemClassName}> ${configName} { private set; get; }`, false);
                }

                let bestParentConfigVarName: string;

                let dictVarName: string;

                if (parentLayer) {
                    dictVarName = `dict${idx}`;
                    bestParentConfigVarName = StringUtils.convertToLowerCamelCase(parents[parents.length - 1]) + "Data";
                    cwParse.add(3, `var ${dictVarName} = ${bestParentConfigVarName};`);
                } else {
                    dictVarName = `${lowerCamelConfigName}Data`;
                    cwParse.add(3, `Dictionary<${uniqueKeyType}, ${itemClassName}> ${dictVarName} = new Dictionary<${uniqueKeyType}, ${itemClassName}>();`);
                }

                cwParse.add(3, `for (int n = 0; n < lines.Length - 1; n += ${fixed_keys.length + idxOffset})`);
                cwParse.add(3, `{`);

                if (parentLayer) {
                    parentsReverse.forEach((parent, n) => {
                        let parentConfigItemName = parent + DataModel.Instance.config.export_item_suffix;
                        cwParse.add(4, `var parentItem${n + 1} = ${dictVarName}[${StringUtils.format(DataModel.Instance.getParseFuncNameByType(DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang, false), this._codeLang), `lines[n]`)}] as ${parentConfigItemName};`);
                    });
                }

                let constructorArgsContent = "";

                // 判断唯一主键是枚举
                if (configRemark.config_other_info && configRemark.config_other_info.mainKeyOnlyOneAndIsEnum) {
                    constructorArgsContent += `(${uniqueKeyType}) `;
                }

                constructorArgsContent += StringUtils.format(DataModel.Instance.getParseFuncNameByType(DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang, false), this._codeLang), `lines[n]`);

                if (coi && !coi.isSingleMainKey) {
                    constructorArgsContent += ", ";
                    let mainKeyNames = coi.mainKeyNames;
                    for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                        let mainKeyName = mainKeyNames[mksIdx];
                        let valType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, this._codeLang);
                        constructorArgsContent += StringUtils.format(DataModel.Instance.getParseFuncNameByType(valType, this._codeLang), `lines[n + ${mksIdx + 1}]`);
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
                            let varName = StringUtils.convertToUpperCamelCase(fixed_key);
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

                    if (configRemark[fixed_key] && configRemark[fixed_key].enum) {  // 处理枚举
                        if (valType != CSTypeEnum.Int) {
                            console.log(cli.red("枚举的值不是整数！-> " + configName + " -> " + fixed_key));
                            return false;
                        }
                        valType = configRemark[fixed_key].enum;
                        constructorArgsContent += `(${valType}) `;
                        constructorArgsContent += StringUtils.format(DataModel.Instance.getParseFuncNameByType(CSTypeEnum.Int, this._codeLang), `lines[n + ${idx2 + idxOffset}]`);
                    } else if (configRemark[fixed_key].link) {    // 处理表连接
                        let linkConfigName = configRemark[fixed_key].link;
                        if (configRemark[fixed_key].linkIsArray) {   // 处理表连接（数组形式）
                            if (valType == CSTypeEnum.IntList || valType == CSTypeEnum.StringList) {
                                let linkedConfigUniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(configRemark[fixed_key].link, this._codeLang);
                                let linkedConfigItemName = configRemark[fixed_key].link + DataModel.Instance.config.export_item_suffix;
                                constructorArgsContent += `ConfigUtility.GetLinkedConfigs<${linkedConfigUniqueKeyType}, ${linkedConfigItemName}>(${StringUtils.format(DataModel.Instance.getParseFuncNameByType(valType, this._codeLang), `lines[n + ${idx2 + idxOffset}]`)}, ${configRemark[fixed_key].link})`
                            } else {
                                console.log(cli.red("链接的值不是整数数组或字符串数组！-> " + configName + " -> " + fixed_key));
                                return false;
                            }
                        } else {    // 处理表连接（非数组形式）
                            constructorArgsContent += `${linkConfigName}.Get(lines[n + ${idx2 + idxOffset}])`;
                        }
                    } else {    // 常规
                        constructorArgsContent += StringUtils.format(DataModel.Instance.getParseFuncNameByType(valType, this._codeLang), `lines[n + ${idx2 + idxOffset}]`);
                    }

                    if (idx2 < fixed_keys.length - 1) {
                        constructorArgsContent += ", ";
                    }
                };

                cwParse.add(4, `var item = new ${itemClassName}(${constructorArgsContent});`);
                cwParse.add(4, `${dictVarName}[item.UniqueKey] = item;`);
                cwParse.add(3, `}`);

                if (!parentLayer) {
                    cwParse.add(3, `${configName} = new BaseConfig<${uniqueKeyType}, ${itemClassName}>("${configName}", ${dictVarName});`, false);
                }

                // -------------------------- began 如果是多主键则生成额外的数据集合与解析 --------------------------

                if (coi && !coi.isSingleMainKey) {
                    let mainKeyPrefix = StringUtils.convertToUpperCamelCase(DataModel.MainKeyVarName);

                    cwField.newLine();
                    let mainKeyNames = coi.mainKeyNames;

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
                    let valType = DataModel.Instance.getValueType(val, this._codeLang);

                    constructorArgsContent += StringUtils.format(DataModel.Instance.getParseFuncNameByType(valType, this._codeLang), `lines[${idx2}]`);

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

        let writeContent = StringUtils.format(configManagerTemplate,
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

                    if (
                        uKeySplit
                        && uKeySplit.length > 1
                        && DataModel.Instance.remark[configName]
                        && DataModel.Instance.remark[configName].config_other_info
                        && DataModel.Instance.remark[configName].config_other_info.mainKeySubs
                        && uKeySplit.length == DataModel.Instance.remark[configName].config_other_info.mainKeySubs.length
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
                            val = val.toString();
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
                        val = val.toString();
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