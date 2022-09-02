import { GoodsType } from "./GoodsType";

export interface GoodsConfigItem {
    /**
     * 唯一Key
     **/
    readonly uniqueKey: number;
    /**
     * ID（索引）
     **/
    readonly id: number;
    /**
     * 名称（语言表）
     **/
    readonly name: string;
    /**
     * 品质
     **/
    readonly color: number;
    /**
     * 物品类型
     **/
    readonly type: GoodsType;
    /**
     * 售出价格
     **/
    readonly sellPrice: number;
    /**
     * 描述
     **/
    readonly desc: string;
}