import {SheetType} from "./SheetType";

export interface Remark {
    /**
     * 文件路径
     */
    filePath?: string;
    /**
     * 文件MD5
     */
    fileMD5?: string;
    /**
     * 配置名称
     */
    configName?: string;
    /**
     * 表类型
     */
    sheetType?: SheetType;
    /**
     * “生成至”数组
     */
    generate?: number[];
    /**
     * 父表名
     */
    parent: string;
    /**
     * 是否为单主键
     */
    isSingleMainKey: boolean;
    /**
     * 主键只有一个，并且是枚举
     */
    mainKeyOnlyOneAndIsEnum: boolean;
    /**
     * 主键索引数组
     */
    mainKeySubs: number[];
    /**
     * 主键名称数组
     */
    mainKeyNames: string[];
    /**
     * 字段。key=字段名，val=字段数据
     */
    fields: any;
}