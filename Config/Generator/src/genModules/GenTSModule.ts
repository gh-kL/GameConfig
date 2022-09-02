import cli from "cli-color";
import path from "path";
import { IOUtils } from "../utils/IOUtils";
import { StringUtils } from "../utils/StringUtils";
import { DataModel } from "../DataModel";
import { CommonUtils } from "../utils/CommonUtils";
import { TSTypeEnum } from "../TSTypeEnum";
import { IConfigExport } from "../IConfigExport";
import { CodeLanguageEnum } from "../CodeLanguageEnum";
import { LineBreak } from "../utils/LineBreak";
import { CodeWriter } from "../utils/CodeWriter";

/**
 * @Doc 生成TS模块
 * @Author kL
 * @Date 2020/7/19 17:35
 */
export class GenTSModule {
    // ------------------began 单例 ------------------
    private static _instance: GenTSModule;
    public static get Instance() {
        if (this._instance == null) {
            this._instance = new GenTSModule();
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
        IOUtils.deleteFile(this._export.export_url);
        IOUtils.deleteFolderFile(this._export.export_script_url, false);
        IOUtils.makeDir(this._export.export_script_url);

        // 拷贝固定代码
        IOUtils.copy(`templates/${this._export.id}/scripts/`, this._export.export_script_url);

        this._configNames = DataModel.Instance.getConfigNamesAndCutDataByConfigType(exportID);

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
                cw.add(1, `/**`);
                cw.add(1, ` * ${aData.annotation}`);
                cw.add(1, ` */`);
                let isNumber = CommonUtils.numIsInt(+aData.value);
                if (isNumber) {
                    cw.add(1, `${aData.key} = ${aData.value}`, false);
                } else {
                    cw.add(1, `${aData.key} = "${aData.value}"`, false);
                }
                if (n < enumData.length - 1)
                    cw.add(0, `,`);
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

            let parentItemName = parentRemark && (configRemark.config_other_info.parent + DataModel.Instance.config.export_item_suffix);
            let coi = configRemark.config_other_info;

            if (cfg.fixed_keys) {
                let uniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang);
                let itemClassName = configName + DataModel.Instance.config.export_item_suffix;

                let extendsStr = "";
                let cwImport = new CodeWriter();
                let cwField = new CodeWriter();

                if (parentRemark) {
                    cwImport.add(0, `import { ${parentItemName} } from "./${parentItemName}";`)
                    extendsStr = ` extends ${parentItemName}`;
                }

                if (!configRemark.config_other_info.parent) {
                    cwField.add(1, `/**`);
                    cwField.add(1, ` * 唯一Key`);
                    cwField.add(1, ` **/`);
                    cwField.add(1, `readonly uniqueKey: ${uniqueKeyType};`);
                    // -------------------------- began 如果是多主键则生成额外的主键数据 --------------------------
                    if (coi && !coi.isSingleMainKey) {
                        let mainKeyNames = coi.mainKeyNames;
                        for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                            let mainKeyName = mainKeyNames[mksIdx];
                            let mainKeyType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, this._codeLang);

                            cwField.add(1, `/**`);
                            cwField.add(1, ` * 第${mksIdx + 1}主键`);
                            cwField.add(1, ` **/`);
                            cwField.add(1, `readonly ${DataModel.Instance.getMainKeyVarName(mksIdx + 1)}: ${mainKeyType};`);
                        }
                    }
                    // -------------------------- ended 如果是多主键则生成额外的主键数据 --------------------------
                }

                for (let idx = 0; idx < cfg.fixed_keys.length; idx++) {
                    let fixed_key = cfg.fixed_keys[idx];

                    // 排除掉父类的字段
                    if (parentRemark) {
                        if (parentRemark[fixed_key]) {
                            continue;
                        }
                    }

                    let lowerCamelFixedKey = StringUtils.convertToLowerCamelCase(fixed_key);

                    let annotation;

                    if (configRemark) {
                        if (configRemark[fixed_key]) {
                            annotation = configRemark[fixed_key].annotation;
                        }
                    }
                    if (annotation) {
                        cwField.add(1, `/**`);
                        cwField.add(1, ` * ${annotation}`);
                        cwField.add(1, ` **/`);
                    }

                    let valType = DataModel.Instance.getConfigKeyType(configName, fixed_key, this._codeLang);

                    if (configRemark[fixed_key] && configRemark[fixed_key].enum) {  // 处理枚举
                        if (valType != TSTypeEnum.Int && valType != TSTypeEnum.String) {
                            console.log(cli.red("枚举的值不是整数或字符串！-> " + valType + " " + TSTypeEnum.Int + " " + configName + " -> " + fixed_key));
                            return false;
                        }
                        valType = configRemark[fixed_key].enum;
                        cwField.add(1, `readonly ${lowerCamelFixedKey}: ${valType};`, false);
                        let importStr = `import { ${valType} } from "./${valType}";`;
                        if (cwImport.content.indexOf(importStr) == -1) {
                            cwImport.add(0, importStr);
                        }
                    } else if (configRemark[fixed_key] && configRemark[fixed_key].link) {    // 处理表连接
                        let linkConfigName = configRemark[fixed_key].link;
                        let linkedConfigItemName = linkConfigName + DataModel.Instance.config.export_item_suffix;
                        if (configRemark[fixed_key].linkIsArray) {   // 处理表连接（数组形式）
                            if (valType == TSTypeEnum.IntList || valType == TSTypeEnum.StringList) {
                                cwField.add(1, `readonly ${lowerCamelFixedKey}: ${linkedConfigItemName}[];`, false);
                            } else {
                                console.log(cli.red("链接的值不是整数数组或字符串数组！-> " + configName + " -> " + fixed_key));
                                return false;
                            }
                        } else {    // 处理表连接（非数组形式）
                            cwField.add(1, `readonly ${lowerCamelFixedKey}: ${linkedConfigItemName};`, false);
                        }
                        let importStr = `import { ${linkedConfigItemName} } from "./${linkedConfigItemName}";`
                        if (cwImport.content.indexOf(importStr) == -1) {
                            cwImport.add(0, importStr);
                        }
                    } else {    // 常规
                        cwField.add(1, `readonly ${lowerCamelFixedKey}: ${valType};`, false);
                    }

                    if (idx < cfg.fixed_keys.length - 1) {
                        cwField.newLine();
                    }
                }

                if (cwImport.content != "") {
                    cwImport.newLine();
                }

                let writeContent = StringUtils.format(configItemTemplate,
                    cwImport.content,
                    itemClassName + extendsStr,
                    cwField.content,
                );

                IOUtils.writeTextFile(path.join(this._export.export_script_url, configName + DataModel.Instance.config.export_item_suffix + "." + this._export.script_suffix), writeContent, LineBreak.CRLF, `导出配置Item(${configRemark.config_other_info.sheetType})脚本成功！-> {0}`);
            } else {

                let cwField = new CodeWriter();

                let keysNum = Object.keys(cfg).length;
                let curNum = 0;
                for (const fixed_key in cfg) {
                    let valType = DataModel.Instance.getConfigKeyType(configName, fixed_key, this._codeLang);

                    let lowerCamelFixedKey = StringUtils.convertToLowerCamelCase(fixed_key);

                    cwField.add(1, `readonly ${lowerCamelFixedKey}: ${valType};`, false);

                    if (curNum < keysNum - 1) {
                        cwField.newLine();
                    }
                    curNum++;
                }

                let writeContent = StringUtils.format(configSingleTemplate,
                    "",
                    configName,
                    cwField.content,
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
        let configManagerTemplate = CommonUtils.getTemplate(this._export.id, "ConfigMgr.txt");
        let cwImport = new CodeWriter();
        let cwField = new CodeWriter();
        let cwParse = new CodeWriter();

        for (let idx = 0; idx < this._configNames.length; idx++) {
            const configName = this._configNames[idx];
            let cfg = DataModel.Instance.originConfig[configName];
            let configRemark = DataModel.Instance.remark[configName];

            let parents = DataModel.Instance.getParents(configName);
            let parentLayer = parents ? parents.length : 0;
            let parentRmks = [];
            if (parentLayer) {
                parents.forEach(pa => {
                    parentRmks.push(DataModel.Instance.remark[pa]);
                });
            }

            let coi = configRemark.config_other_info;

            let itemClassName = configName + DataModel.Instance.config.export_item_suffix;

            let lowerCamelConfigName = StringUtils.convertToLowerCamelCase(configName);

            cwParse.add(2, `// ${configName}`);
            cwParse.add(2, `section = sections[${idx}];`);

            let fixed_keys = cfg.fixed_keys;

            if (fixed_keys) {
                cwImport.add(0, `import { ${itemClassName} } from "./${itemClassName}";`);

                let uniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(configName, this._codeLang);

                if (!DataModel.Instance.isConventionType(uniqueKeyType, this._codeLang)) {
                    let importStr = `import { ${uniqueKeyType} } from "./${uniqueKeyType}";`;
                    if (cwImport.content.indexOf(importStr) == -1) {
                        cwImport.add(0, importStr);
                    }
                }

                let idxOffset = 1;
                if (coi && !coi.isSingleMainKey) {
                    let mainKeyNames = coi.mainKeyNames;
                    idxOffset = mainKeyNames.length + 1;
                }

                if (!parentLayer) {
                    cwField.add(1, `private static _${lowerCamelConfigName}: BaseConfig<${uniqueKeyType}, ${itemClassName}>;`);
                    cwField.add(1, `public static get ${configName}(): BaseConfig<${uniqueKeyType}, ${itemClassName}> { return this._${lowerCamelConfigName}; }`);
                }

                cwParse.add(2, `totalLength = section.length;`);
                cwParse.add(2, `nAdd = ${fixed_keys.length + idxOffset};`);

                let bestParentConfigVarName: string;

                if (parentLayer) {
                    bestParentConfigVarName = StringUtils.convertToLowerCamelCase(parents[parents.length - 1], true);
                    cwParse.add(2, `let map${idx} = this.${bestParentConfigVarName};`);
                } else {
                    cwParse.add(2, `let map${idx} = new Map<${uniqueKeyType}, ${itemClassName}>();`);
                }
                cwParse.add(2, `for (let n = 0; n < totalLength; n += nAdd) {`);

                if (parentLayer) {
                    parents.forEach((parent, n) => {
                        let parentConfigItemName = parent + DataModel.Instance.config.export_item_suffix;
                        cwParse.add(3, `let parentItem${n + 1} = this.${bestParentConfigVarName}.get(section[n]) as ${parentConfigItemName};`);
                    });
                    cwParse.add(3, `let item: ${itemClassName} = { uniqueKey: parentItem${parentLayer}.uniqueKey, `, false);
                } else {
                    cwParse.add(3, `let item: ${itemClassName} = { uniqueKey: section[n], `, false);
                }

                // 判断唯一主键的类型
                let first_unique_keys = Object.keys(cfg.data)[0];
                let valType = isNaN(+first_unique_keys) ? TSTypeEnum.String : TSTypeEnum.Int;

                if (coi && !coi.isSingleMainKey) {
                    let mainKeyNames = coi.mainKeyNames;
                    for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                        let mainKeyVarName = DataModel.Instance.getMainKeyVarName(mksIdx + 1);
                        if (parentLayer) {
                            cwParse.add(0, `${mainKeyVarName}: parentItem${parentLayer}.${mainKeyVarName}, `, false);
                        } else {
                            cwParse.add(0, `${mainKeyVarName}: section[n + ${mksIdx + 1}], `, false);
                        }
                    }
                }

                if (parentLayer) {
                    let addedFixedKeys: string[] = [];
                    parents.forEach((parent, n) => {
                        let parentFixedKeys = DataModel.Instance.originConfig[parent].fixed_keys;
                        for (let m = 0; m < parentFixedKeys.length; m++) {
                            let fixed_key = parentFixedKeys[m];
                            if (addedFixedKeys.indexOf(fixed_key) != -1)
                                continue;
                            let varName = StringUtils.convertToLowerCamelCase(fixed_key);
                            cwParse.add(0, `${varName}: parentItem${n + 1}.${varName}, `, false);
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
                        if (valType != TSTypeEnum.Int && valType != TSTypeEnum.String) {
                            console.log(cli.red(`枚举的数值不是整数也不是字符串，这是不被允许的! 表名：${configName}，字段：${fixed_key}，文件路径：${configRemark.config_other_info.filePath}`));
                            return false;
                        }
                        cwParse.add(0, `${StringUtils.convertToLowerCamelCase(fixed_key)}: section[n + ${idx2 + idxOffset}]`, false);
                    } else if (configRemark[fixed_key].link) {    // 处理表连接
                        let linkConfigName = configRemark[fixed_key].link;
                        let linkConfigNameLower = StringUtils.convertToLowerCamelCase(linkConfigName);
                        if (configRemark[fixed_key].linkIsArray) {   // 处理表连接（数组形式）
                            if (valType == TSTypeEnum.IntList || valType == TSTypeEnum.StringList) {
                                let linkedConfigUniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(configRemark[fixed_key].link, this._codeLang);
                                let linkedConfigItemName = configRemark[fixed_key].link + DataModel.Instance.config.export_item_suffix;
                                cwParse.add(0, `${StringUtils.convertToLowerCamelCase(fixed_key)}: this.getLinkedConfigs<${linkedConfigUniqueKeyType}, ${linkedConfigItemName}>(section[n + ${idx2 + idxOffset}], this.${configRemark[fixed_key].link})`, false);
                            } else {
                                console.log(cli.red(`链接的值不是整数数组或字符串数组！表名：${configName}，字段：${fixed_key}，文件路径：${configRemark.config_other_info.filePath}`));
                                // FIXME
                                console.log(valType);
                                return false;
                            }
                        } else {    // 处理表连接（非数组形式）
                            cwParse.add(0, `${StringUtils.convertToLowerCamelCase(fixed_key)}: this._${linkConfigNameLower}.get(section[n + ${idx2 + idxOffset}])`, false);
                        }
                    } else {    // 常规
                        cwParse.add(0, `${StringUtils.convertToLowerCamelCase(fixed_key)}: section[n + ${idx2 + idxOffset}]`, false);
                    }

                    if (idx2 == fixed_keys.length - 1) {
                        cwParse.add(0, ` };`);
                    } else {
                        cwParse.add(0, `, `, false);
                    }
                }

                if (!parentLayer) {
                    cwParse.add(3, `map${idx}.set(item.uniqueKey, item);`);
                } else {
                    cwParse.add(3, `map${idx}.data.set(item.uniqueKey, item);`);
                }
                cwParse.add(2, `}`);

                if (!parentLayer) {
                    cwParse.add(2, `this._${lowerCamelConfigName} = new BaseConfig<${uniqueKeyType}, ${itemClassName}>("${configName}", map${idx});`);
                }

                // -------------------------- began 如果是多主键则生成额外的数据集合与解析 --------------------------

                if (coi && !coi.isSingleMainKey) {
                    cwField.newLine();
                    let mainKeyNames = coi.mainKeyNames;

                    let collectionTypeStr = DataModel.Instance.getConfigCollectionTypeByIndex(configName, this._codeLang);

                    let varName = `_${lowerCamelConfigName}${DataModel.Instance.config.export_collection_suffix}`;

                    cwField.add(1, `private static ${varName}: ${collectionTypeStr};`);
                    cwField.add(1, `public static get ${configName}${DataModel.Instance.config.export_collection_suffix}(): ${collectionTypeStr} { return this.${varName}; };`);

                    cwParse.newLine();

                    cwParse.add(2, `this.${varName} = new ${collectionTypeStr}();`);
                    cwParse.add(2, `this._${lowerCamelConfigName}.data.forEach(item => {`);

                    for (let mksIdx = 1; mksIdx < mainKeyNames.length; mksIdx++) {
                        cwParse.add(3, `if (!this.${varName}`, false);

                        let end = mksIdx;
                        for (let w = 0; w < end; w++) {
                            let keyNum = w + 1;
                            if (w != end - 1) {
                                cwParse.add(0, `.get(item.mainKey${keyNum})`, false);
                            } else {
                                cwParse.add(0, `.has(item.mainKey${keyNum})`, false);
                            }
                        }
                        cwParse.add(0, `)`);

                        // ----------------------------------------------------

                        cwParse.add(4, `this.${varName}`, false);
                        end = mksIdx;
                        for (let w = 0; w < end; w++) {
                            let keyNum = w + 1;
                            if (w != end - 1) {
                                cwParse.add(0, `.get(item.mainKey${keyNum})`, false);
                            } else {
                                let typeStr = DataModel.Instance.getConfigCollectionTypeByIndex(configName, this._codeLang, mksIdx, mainKeyNames.length - 1);
                                cwParse.add(0, `.set(item.mainKey${keyNum}, new ${typeStr}());`);
                            }
                        }
                    }

                    cwParse.add(3, `this.${varName}`, false);

                    for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                        let keyNum = mksIdx + 1;
                        if (mksIdx != mainKeyNames.length - 1) {
                            cwParse.add(0, `.get(item.mainKey${keyNum})`, false);
                        } else {
                            cwParse.add(0, `.set(item.mainKey${keyNum}, item);`);
                        }
                    }

                    cwParse.add(2, `});`);
                }

                // -------------------------- ended 如果是多主键则生成额外的数据集合与解析 --------------------------

            } else {
                let importStr = `import { ${configName} } from "./${configName}";`;
                if (cwImport.content.indexOf(importStr) == -1) {
                    cwImport.add(0, importStr);
                }

                cwField.add(1, `private static _${lowerCamelConfigName}: ${configName};`);
                cwField.add(1, `public static get ${configName}(): ${configName} { return this._${lowerCamelConfigName}; };`);

                fixed_keys = Object.keys(cfg);

                cwParse.add(2, `this._${lowerCamelConfigName} = { configName: "${configName}", `, false);

                fixed_keys.forEach((fixed_key, idx2) => {
                    cwParse.addStr(`${StringUtils.convertToLowerCamelCase(fixed_key)}: section[${idx2}]`);
                    if (idx2 == fixed_keys.length - 1) {
                        cwParse.add(0, ` };`);
                    } else {
                        cwParse.addStr(`, `);
                    }
                });
            }

            if (idx < this._configNames.length - 1) {
                cwField.newLine();
                cwParse.newLine();
            }
        }

        let writeContent = StringUtils.format(configManagerTemplate,
            cwImport.content,
            cwField.content,
            this._configSplitor,
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
        let finalConfig = [];
        for (let idx = 0; idx < this._configNames.length; idx++) {
            const configName = this._configNames[idx];
            let cfg = DataModel.Instance.originConfig[configName];

            let fixed_keys = cfg.fixed_keys;

            if (idx > 0) {
                finalConfig.push(this._configSplitor);
            }

            if (fixed_keys) {
                let data = cfg.data;
                for (const uniqueKey in data) {
                    let dat = data[uniqueKey];
                    let uKey: any = !isNaN(+uniqueKey) ? +uniqueKey : uniqueKey;
                    finalConfig.push(uKey);
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
                            finalConfig.push(cKey);
                        });
                    }

                    for (let n = 0; n < dat.length; n++) {
                        let val = dat[n];
                        finalConfig.push(val);
                    }
                }
            } else {
                for (const fixed_key in cfg) {
                    let val = cfg[fixed_key];
                    finalConfig.push(val);
                }
            }
        }

        IOUtils.writeTextFile(this._export.export_url, JSON.stringify(finalConfig), LineBreak.CRLF, "导出配置文本成功！-> {0}");
        return true;
    }
}