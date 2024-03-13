import {SheetType} from "../SheetType";
import {Remark} from "../Remark";

export interface SheetInfo {
    /**
     * 文件路径
     */
    filePath?: string;
    /**
     * 文件MD5
     */
    fileMD5?: string;
    /**
     * 表类型
     */
    sheetType?: SheetType;
    /**
     * 表原始数据
     */
    sheetSourceData?: any[][];
    /**
     * 表内容
     */
    sheetContent?: any[];
    /**
     * 表名
     */
    sheetName?: string;
    /**
     * 表明（大写）
     */
    sheetNameUppercase?: string;
    /**
     * 父表名
     */
    parent?: string;
    /**
     * 字段名称数组
     */
    keyNames?: string[];
    /**
     * 字段类型数组。key=字段名，value=类型
     */
    fixedKeyTypes?: any;
    /**
     * 格式数组
     */
    formats?: any[];
    /**
     * “生成至”数组 | “生成至”字典
     */
    gens?: any[] | {};
    /**
     * 默认值数组
     */
    defaults?: any[];
    /**
     * 注释数组 | 注释字典
     */
    annotations?: string[] | {};
    /**
     * 主键索引数组
     */
    mainKeySubs?: number[];
    /**
     * 主键名称数组
     */
    mainKeyNames?: string[];
    /**
     * 所有数组列数数组
     */
    arrayColAll?: number[];
    /**
     * 数组列字典。key=字段名，value={ cols(列索引数组) }
     */
    arrayColDict?: any;
    /**
     * 连接字典。key=字段名，value={ link(连接表名), isArray(是否为数组) }
     */
    linkDict?: any;
    /**
     * 字段数据。key=字段名，value=值
     */
    fixedKeyDatas?: {};
    /**
     * 是否为单主键
     */
    isSingleMainKey?: boolean;
    /**
     * 主键只有一个，并且是枚举
     */
    mainKeyOnlyOneAndIsEnum?: boolean;
    /**
     * 是否使用老数据
     */
    isUseOldData?: boolean;
    /**
     * 老数据（缓存）
     */
    oldData?: any;
    /**
     * 老Remark数据
     */
    oldRemarkData?: Remark;

    /**
     * 数据字典
     */
    dict?: any;
    /**
     * 优化的数据字典
     */
    optimizedDict?: any;
}