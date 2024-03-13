import cli from "cli-color";
import path from "path";
import {IOUtils} from "../utils/IOUtils";
import {StrUtils} from "../utils/StrUtils";
import {DataModel} from "../DataModel";
import {CommonUtils} from "../utils/CommonUtils";
import {TSTypeEnum} from "../TSTypeEnum";
import {IConfigExport} from "../IConfigExport";
import {CodeLang} from "../CodeLang";
import {LineBreak} from "../utils/LineBreak";
import {CodeWriter} from "../utils/CodeWriter";
import {Remark} from "../Remark";
import {RemarkField} from "../RemarkField";

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
        IOUtils.deleteFile(this._export.export_url);
        IOUtils.deleteFolderFile(this._export.export_script_url, false);
        IOUtils.makeDir(this._export.export_script_url);

        // 拷贝固定代码
        IOUtils.copy(`templates/${this._export.template_name || this._export.id}/scripts/`, this._export.export_script_url);

        this._configNames = DataModel.Instance.getConfigNamesAndCutDataByConfigType(exportID);

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
            let rrmk: Remark = DataModel.Instance.remark[enumName];
            return rrmk?.generate?.indexOf(this._export.id) >= 0;
        });

        for (let idx = 0; idx < enumNames.length; idx++) {
            const enumName = enumNames[idx];
            let enumData = DataModel.Instance.enum[enumName];

            let cw = new CodeWriter();
            enumData.forEach((aData, n) => {
                if (aData.annotation) {
                    cw.addStr(CommonUtils.getCommentStr(this._codeLang, aData.annotation, 1) + "\n");
                }
                let isNumber = CommonUtils.numIsInt(+aData.value);
                if (isNumber) {
                    cw.add(1, `${aData.key} = ${aData.value}`, false);
                } else {
                    cw.add(1, `${aData.key} = "${aData.value}"`, false);
                }
                if (n < enumData.length - 1)
                    cw.add(0, `,`);
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

            let parentItemName = parentRemark && (configRemark.parent + DataModel.Instance.config.export_item_suffix);

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

                if (!configRemark.parent) {
                    cwField.addStr(CommonUtils.getCommentStr(this._codeLang, "唯一Key", 1) + "\n");
                    cwField.add(1, `readonly uniqueKey: ${uniqueKeyType};`);
                    // -------------------------- began 如果是多主键则生成额外的主键数据 --------------------------
                    if (!configRemark.isSingleMainKey) {
                        let mainKeyNames = configRemark.mainKeyNames;
                        for (let mksIdx = 0; mksIdx < mainKeyNames.length; mksIdx++) {
                            let mainKeyName = mainKeyNames[mksIdx];
                            let mainKeyType = DataModel.Instance.getConfigKeyType(configName, mainKeyName, this._codeLang);

                            cwField.addStr(CommonUtils.getCommentStr(this._codeLang, `第${mksIdx + 1}主键`, 1) + "\n");
                            cwField.add(1, `readonly ${DataModel.Instance.getMainKeyVarName(mksIdx + 1)}: ${mainKeyType};`);
                        }
                    }
                    // -------------------------- ended 如果是多主键则生成额外的主键数据 --------------------------
                }

                for (let idx = 0; idx < cfg.fixed_keys.length; idx++) {
                    let fixed_key = cfg.fixed_keys[idx];

                    // 排除掉父类的字段
                    if (parentRemark) {
                        if (parentRemark?.fields && parentRemark.fields[fixed_key]) {
                            continue;
                        }
                    }

                    let lowerCamelFixedKey = StrUtils.convertToLowerCamelCase(fixed_key);

                    let field: RemarkField = configRemark?.fields && configRemark.fields[fixed_key];
                    if (field?.annotation) {
                        cwField.addStr(CommonUtils.getCommentStr(this._codeLang, field.annotation, 1) + "\n");
                    }

                    let valType = DataModel.Instance.getConfigKeyType(configName, fixed_key, this._codeLang);

                    if (field?.enum) {  // 处理枚举
                        if (valType != TSTypeEnum.Int && valType != TSTypeEnum.String) {
                            console.log(cli.red("枚举的值不是整数或字符串！-> " + valType + " " + TSTypeEnum.Int + " " + configName + " -> " + fixed_key));
                            return false;
                        }
                        valType = field.enum;
                        cwField.add(1, `readonly ${lowerCamelFixedKey}: ${valType};`, false);
                        let importStr = `import { ${valType} } from "./${valType}";`;
                        if (cwImport.content.indexOf(importStr) == -1) {
                            cwImport.add(0, importStr);
                        }
                    } else if (field?.link) {    // 处理表连接
                        let linkConfigName = field.link;
                        let linkedConfigItemName = linkConfigName + DataModel.Instance.config.export_item_suffix;
                        if (field.linkIsArray) {   // 处理表连接（数组形式）
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

                let writeContent = StrUtils.format(configItemTemplate,
                    cwImport.content,
                    itemClassName + extendsStr,
                    cwField.content,
                );

                IOUtils.writeTextFile(path.join(this._export.export_script_url, configName + DataModel.Instance.config.export_item_suffix + "." + this._export.script_suffix), writeContent, LineBreak.CRLF, `导出配置Item(${configRemark.sheetType})脚本成功！-> {0}`);
            } else {

                let cwField = new CodeWriter();

                let keysNum = Object.keys(cfg).length;
                let curNum = 0;
                for (const fixed_key in cfg) {
                    let valType = DataModel.Instance.getConfigKeyType(configName, fixed_key, this._codeLang);

                    let field: RemarkField = configRemark.fields && configRemark.fields[fixed_key];
                    if (field?.annotation) {
                        cwField.addStr(CommonUtils.getCommentStr(this._codeLang, field.annotation, 1) + "\n");
                    }

                    let lowerCamelFixedKey = StrUtils.convertToLowerCamelCase(fixed_key);

                    cwField.add(1, `readonly ${lowerCamelFixedKey}: ${valType};`, false);

                    if (curNum < keysNum - 1) {
                        cwField.newLine();
                    }
                    curNum++;
                }

                let writeContent = StrUtils.format(configSingleTemplate,
                    "",
                    configName,
                    cwField.content,
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
        let configManagerTemplate = CommonUtils.getTemplate(this._export, "ConfigMgr.txt");
        let cwImport = new CodeWriter();
        let cwField = new CodeWriter();
        let cwParse = new CodeWriter();

        let configVarTemplate = CommonUtils.getTemplate(this._export, "ConfigVar.txt");
        let configItemVarTemplate = CommonUtils.getTemplate(this._export, "ConfigItemVar.txt");

        for (let idx = 0; idx < this._configNames.length; idx++) {
            const configName = this._configNames[idx];
            let cfg = DataModel.Instance.originConfig[configName];
            let configRemark: Remark = DataModel.Instance.remark[configName];

            let parents = DataModel.Instance.getParents(configName);
            let parentLayer = parents ? parents.length : 0;

            let itemClassName = configName + DataModel.Instance.config.export_item_suffix;

            let lowerCamelConfigName = StrUtils.convertToLowerCamelCase(configName);

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
                if (!configRemark.isSingleMainKey) {
                    let mainKeyNames = configRemark.mainKeyNames;
                    idxOffset = mainKeyNames.length + 1;
                }

                // if (!parentLayer) {
                cwField.add(0, StrUtils.format(configVarTemplate,
                    `_${lowerCamelConfigName}`,
                    uniqueKeyType,
                    itemClassName,
                    configName,
                    uniqueKeyType,
                    itemClassName,
                    `_${lowerCamelConfigName}`
                ));
                // }

                cwParse.add(2, `totalLength = section.length;`);
                cwParse.add(2, `nAdd = ${fixed_keys.length + idxOffset};`);

                let bestParentConfigVarName: string;

                if (parentLayer) {
                    bestParentConfigVarName = StrUtils.convertToLowerCamelCase(parents[parents.length - 1], true);
                    cwParse.add(2, `let map${idx} = this.${bestParentConfigVarName};`);
                    cwParse.add(2, `let map${idx}_self = new Map<${uniqueKeyType}, ${itemClassName}>();`);
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

                if (!configRemark.isSingleMainKey) {
                    let mainKeyNames = configRemark.mainKeyNames;
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
                            let varName = StrUtils.convertToLowerCamelCase(fixed_key);
                            cwParse.add(0, `${varName}: parentItem${n + 1}.${varName}, `, false);
                            addedFixedKeys.push(fixed_key);
                        }
                    });
                }

                let hasAppened: boolean;
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
                    let field: RemarkField = configRemark?.fields && configRemark.fields[fixed_key];

                    if (field?.enum) {  // 处理枚举
                        if (valType != TSTypeEnum.Int && valType != TSTypeEnum.String) {
                            console.log(cli.red(`枚举的数值不是整数也不是字符串，这是不被允许的! 表名：${configName}，字段：${fixed_key}，文件路径：${configRemark.filePath}`));
                            return false;
                        }
                        cwParse.add(0, `${StrUtils.convertToLowerCamelCase(fixed_key)}: section[n + ${idx2 + idxOffset}]`, false);
                    } else if (field?.link) {    // 处理表连接
                        let linkConfigName = field.link;
                        let linkConfigNameLower = StrUtils.convertToLowerCamelCase(linkConfigName);
                        if (field.linkIsArray) {   // 处理表连接（数组形式）
                            if (valType == TSTypeEnum.IntList || valType == TSTypeEnum.StringList) {
                                let linkedConfigUniqueKeyType = DataModel.Instance.getConfigUniqueKeyType(field.link, this._codeLang);
                                let linkedConfigItemName = field.link + DataModel.Instance.config.export_item_suffix;
                                cwParse.add(0, `${StrUtils.convertToLowerCamelCase(fixed_key)}: this.getLinkedConfigs<${linkedConfigUniqueKeyType}, ${linkedConfigItemName}>(section[n + ${idx2 + idxOffset}], this.${field.link})`, false);
                            } else {
                                console.log(cli.red(`链接的值不是整数数组或字符串数组！表名：${configName}，字段：${fixed_key}，文件路径：${configRemark.filePath}`));
                                // FIXME
                                console.log(valType);
                                return false;
                            }
                        } else {    // 处理表连接（非数组形式）
                            cwParse.add(0, `${StrUtils.convertToLowerCamelCase(fixed_key)}: this._${linkConfigNameLower}.get(section[n + ${idx2 + idxOffset}])`, false);
                        }
                    } else {    // 常规
                        cwParse.add(0, `${StrUtils.convertToLowerCamelCase(fixed_key)}: section[n + ${idx2 + idxOffset}]`, false);
                    }

                    if (idx2 == fixed_keys.length - 1) {
                        cwParse.add(0, ` };`);
                    } else {
                        cwParse.add(0, `, `, false);
                    }
                    hasAppened = true;
                }

                if (!hasAppened) {
                    cwParse.add(0, ` };`);
                }

                if (!parentLayer) {
                    cwParse.add(3, `map${idx}.set(item.uniqueKey, item);`);
                } else {
                    cwParse.add(3, `map${idx}.data.set(item.uniqueKey, item);`);
                    cwParse.add(3, `map${idx}_self.set(item.uniqueKey, item);`);
                }
                cwParse.add(2, `}`);

                if (!parentLayer) {
                    cwParse.add(2, `this._${lowerCamelConfigName} = new BaseConfig<${uniqueKeyType}, ${itemClassName}>("${configName}", map${idx});`);
                } else {
                    cwParse.add(2, `this._${lowerCamelConfigName} = new BaseConfig<${uniqueKeyType}, ${itemClassName}>("${configName}", map${idx}_self);`);
                }

                // -------------------------- began 如果是多主键则生成额外的数据集合与解析 --------------------------

                if (!configRemark.isSingleMainKey) {
                    cwField.newLine();
                    let mainKeyNames = configRemark.mainKeyNames;

                    let collectionTypeStr = DataModel.Instance.getConfigCollectionTypeByIndex(configName, this._codeLang);

                    let varName = `_${lowerCamelConfigName}${DataModel.Instance.config.export_collection_suffix}`;

                    cwField.add(0, StrUtils.format(
                        configItemVarTemplate,
                        varName,
                        collectionTypeStr,
                        configName + DataModel.Instance.config.export_collection_suffix,
                        collectionTypeStr,
                        varName,
                    ));

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

                cwField.add(0, StrUtils.format(
                    configItemVarTemplate,
                    `_${lowerCamelConfigName}`,
                    configName,
                    configName,
                    configName,
                    `_${lowerCamelConfigName}`,
                ));

                fixed_keys = Object.keys(cfg);

                cwParse.add(2, `this._${lowerCamelConfigName} = { configName: "${configName}", `, false);

                fixed_keys.forEach((fixed_key, idx2) => {
                    cwParse.addStr(`${StrUtils.convertToLowerCamelCase(fixed_key)}: section[${idx2}]`);
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

        let writeContent = StrUtils.format(configManagerTemplate,
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

                    let rrrmk: Remark = DataModel.Instance.remark[configName];

                    if (
                        uKeySplit
                        && uKeySplit.length > 1
                        && rrrmk.mainKeySubs
                        && uKeySplit.length == rrrmk.mainKeySubs.length
                    ) {
                        uKeySplit.forEach(cKey => {
                            cKey = !isNaN(+cKey) ? +cKey : cKey;
                            // DataModel.Instance.remark[configName]
                            finalConfig.push(cKey);
                        });
                    }

                    for (let n = 0; n < dat.length; n++) {
                        let val = dat[n];

                        // let fieldName = fixed_keys[n];
                        // let fieldRmk = DataModel.Instance.remark[configName][fieldName];
                        // let fieldType = fieldRmk.fixedType;
                        // console.log(fieldType);

                        finalConfig.push(val);
                    }
                }
            } else {
                for (const fixed_key in cfg) {
                    let val = cfg[fixed_key];

                    // let fieldRmk = DataModel.Instance.remark[configName][fixed_key];
                    // let fieldType = fieldRmk.fixedType;
                    // console.log(fieldType);

                    finalConfig.push(val);
                }
            }
        }

        IOUtils.writeTextFile(this._export.export_url, JSON.stringify(finalConfig), LineBreak.CRLF, "导出配置文本成功！-> {0}");
        return true;
    }
}