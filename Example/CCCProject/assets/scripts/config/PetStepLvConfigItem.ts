export interface PetStepLvConfigItem {
    /**
     * 唯一Key
     **/
    readonly uniqueKey: string;
    /**
     * 第1主键
     **/
    readonly mainKey1: number;
    /**
     * 第2主键
     **/
    readonly mainKey2: number;
    /**
     * 第3主键
     **/
    readonly mainKey3: number;
    /**
     * ID（索引）
     **/
    readonly id: number;
    /**
     * 阶
     **/
    readonly step: number;
    /**
     * 等级
     **/
    readonly lv: number;
    /**
     * 属性
     **/
    readonly attr: number[][];
}