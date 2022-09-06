import { IConfigExport } from "./IConfigExport";

/**
 * @Doc 配置
 * @Author kL
 * @Date 2020/7/18 11:12
 */
export interface IConfig {
    /**
     * 配置表URL（Excel的文件夹路径）
     */
    excel_url: string,
    /**
     * 配置导出脚本后的命名后缀（推荐Config）
     */
    export_suffix: string,
    /**
     * 配置子项导出脚本后的命名后缀（推荐Item）
     */
    export_item_suffix: string,
    /**
     * 多主键配置导出脚本后字典的命名后缀（推荐Map）
     */
    export_collection_suffix: string,
    /**
     * 导出的配置脚本是否生成随机分隔符
     */
    export_data_splitor_random_enabled: boolean,
    /**
     * 固定分隔符
     */
    export_data_splitor: string,
    /**
     * 源配置文件夹路径
     */
     origin_export_url: string,
    /**
     * 源配置 JSON URL
     */
    origin_json_url: string,
    /**
     * 源配置 Remark JSON 的路径
     */
    origin_remark_url: string,
    /**
     * 源配置 Enum JSON 的路径
     */
    origin_enum_url: string,
    /**
     * 源配置继承数据路径
     */
    origin_extends_url:string,
    /**
     * 所有导出项
     */
    exports: IConfigExport[],
}