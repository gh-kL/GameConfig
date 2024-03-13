export interface KVConfig {
    readonly configName: string;
    /**
     * 游戏名称
     */
    readonly gameName: string;
    /**
     * 版本号
     */
    readonly version: string;
    readonly a: number[];
    readonly b: number[][];
    readonly c: string[];
    readonly d: number;
    readonly f: boolean;
}