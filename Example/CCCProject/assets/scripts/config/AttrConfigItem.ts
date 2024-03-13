export interface AttrConfigItem {
    /**
     * 唯一Key
     */
    readonly uniqueKey: number;
    /**
     * 索引（id）
     */
    readonly id: number;
    /**
     * 字段
     */
    readonly field: string;
    /**
     * 名称
     */
    readonly name: string;
}