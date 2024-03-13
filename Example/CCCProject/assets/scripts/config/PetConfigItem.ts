import { PetType } from "./PetType";

export interface PetConfigItem {
    /**
     * 唯一Key
     */
    readonly uniqueKey: number;
    /**
     * ID（索引）
     */
    readonly id: number;
    /**
     * 类型
     */
    readonly type: PetType;
    /**
     * 名称
     */
    readonly name: string;
    /**
     * 技能
     */
    readonly skills: number[];
}