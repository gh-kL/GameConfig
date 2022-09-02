import { GoodsConfigItem } from "./GoodsConfigItem";
import { EquipPosition } from "./EquipPosition";

export interface EquipConfigItem extends GoodsConfigItem {
    /**
     * 位置
     **/
    readonly position: EquipPosition;
    /**
     * 属性
     **/
    readonly attr: number[][];
}