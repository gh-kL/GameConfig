import { BaseConfig } from "./BaseConfig";
import { JsonAsset, resources } from "cc";
import { PetConfigItem } from "./PetConfigItem";
import { PetStepLvConfigItem } from "./PetStepLvConfigItem";
import { AttrField2IDConfigItem } from "./AttrField2IDConfigItem";
import { AttrConfigItem } from "./AttrConfigItem";
import { GoodsConfigItem } from "./GoodsConfigItem";
import { EquipConfigItem } from "./EquipConfigItem";
import { KVConfig } from "./KVConfig";

export class ConfigMgr {
    private static _petConfig: BaseConfig<number, PetConfigItem>;
    public static get PetConfig(): BaseConfig<number, PetConfigItem> { return this._petConfig; }

    private static _petStepLvConfig: BaseConfig<string, PetStepLvConfigItem>;
    public static get PetStepLvConfig(): BaseConfig<string, PetStepLvConfigItem> { return this._petStepLvConfig; }

    private static _petStepLvConfigMap: Map<number, Map<number, Map<number, PetStepLvConfigItem>>>;
    public static get PetStepLvConfigMap(): Map<number, Map<number, Map<number, PetStepLvConfigItem>>> { return this._petStepLvConfigMap; };

    private static _attrField2IDConfig: BaseConfig<string, AttrField2IDConfigItem>;
    public static get AttrField2IDConfig(): BaseConfig<string, AttrField2IDConfigItem> { return this._attrField2IDConfig; }

    private static _attrConfig: BaseConfig<number, AttrConfigItem>;
    public static get AttrConfig(): BaseConfig<number, AttrConfigItem> { return this._attrConfig; }

    private static _goodsConfig: BaseConfig<number, GoodsConfigItem>;
    public static get GoodsConfig(): BaseConfig<number, GoodsConfigItem> { return this._goodsConfig; }

    private static _equipConfig: BaseConfig<number, EquipConfigItem>;
    public static get EquipConfig(): BaseConfig<number, EquipConfigItem> { return this._equipConfig; }

    private static _kVConfig: KVConfig;
    public static get KVConfig(): KVConfig { return this._kVConfig; };

    public static init(path: string, thisObj?: any, completeCallback?: Function) {
        let self = this;
        resources.load("config/config", JsonAsset, (err, asset) => {
            console.log(asset);
            self.parse(asset.json as any);
            if (thisObj && completeCallback) {
                completeCallback.call(thisObj);
            }
        });
    }

    public static parse(data: any[]) {
        let pwd = "_D3A_";

        let totalLength = data.length;
        let totalLengthLow = totalLength - 1;
        let sections: any[][] = [];
        let section: any[] = [];
        for (let n = 0; n < totalLength; n++) {
            let value = data[n];
            if (n == totalLengthLow) {
                section.push(value);
                sections.push(section);
            } else if (pwd == value) {
                sections.push(section);
                section = [];
            } else {
                section.push(value);
            }
        }
        let nAdd: number;

        // PetConfig
        section = sections[0];
        totalLength = section.length;
        nAdd = 5;
        let map0 = new Map<number, PetConfigItem>();
        for (let n = 0; n < totalLength; n += nAdd) {
            let item: PetConfigItem = { uniqueKey: section[n], id: section[n + 1], type: section[n + 2], name: section[n + 3], skills: section[n + 4] };
            map0.set(item.uniqueKey, item);
        }
        this._petConfig = new BaseConfig<number, PetConfigItem>("PetConfig", map0);

        // PetStepLvConfig
        section = sections[1];
        totalLength = section.length;
        nAdd = 8;
        let map1 = new Map<string, PetStepLvConfigItem>();
        for (let n = 0; n < totalLength; n += nAdd) {
            let item: PetStepLvConfigItem = { uniqueKey: section[n], mainKey1: section[n + 1], mainKey2: section[n + 2], mainKey3: section[n + 3], id: section[n + 4], step: section[n + 5], lv: section[n + 6], attr: section[n + 7] };
            map1.set(item.uniqueKey, item);
        }
        this._petStepLvConfig = new BaseConfig<string, PetStepLvConfigItem>("PetStepLvConfig", map1);

        this._petStepLvConfigMap = new Map<number, Map<number, Map<number, PetStepLvConfigItem>>>();
        this._petStepLvConfig.data.forEach(item => {
            if (!this._petStepLvConfigMap.has(item.mainKey1))
                this._petStepLvConfigMap.set(item.mainKey1, new Map<number, Map<number, PetStepLvConfigItem>>());
            if (!this._petStepLvConfigMap.get(item.mainKey1).has(item.mainKey2))
                this._petStepLvConfigMap.get(item.mainKey1).set(item.mainKey2, new Map<number, PetStepLvConfigItem>());
            this._petStepLvConfigMap.get(item.mainKey1).get(item.mainKey2).set(item.mainKey3, item);
        });

        // AttrField2IDConfig
        section = sections[2];
        totalLength = section.length;
        nAdd = 3;
        let map2 = new Map<string, AttrField2IDConfigItem>();
        for (let n = 0; n < totalLength; n += nAdd) {
            let item: AttrField2IDConfigItem = { uniqueKey: section[n], field: section[n + 1], id: section[n + 2] };
            map2.set(item.uniqueKey, item);
        }
        this._attrField2IDConfig = new BaseConfig<string, AttrField2IDConfigItem>("AttrField2IDConfig", map2);

        // AttrConfig
        section = sections[3];
        totalLength = section.length;
        nAdd = 4;
        let map3 = new Map<number, AttrConfigItem>();
        for (let n = 0; n < totalLength; n += nAdd) {
            let item: AttrConfigItem = { uniqueKey: section[n], id: section[n + 1], field: section[n + 2], name: section[n + 3] };
            map3.set(item.uniqueKey, item);
        }
        this._attrConfig = new BaseConfig<number, AttrConfigItem>("AttrConfig", map3);

        // GoodsConfig
        section = sections[4];
        totalLength = section.length;
        nAdd = 7;
        let map4 = new Map<number, GoodsConfigItem>();
        for (let n = 0; n < totalLength; n += nAdd) {
            let item: GoodsConfigItem = { uniqueKey: section[n], id: section[n + 1], name: section[n + 2], color: section[n + 3], type: section[n + 4], sellPrice: section[n + 5], desc: section[n + 6] };
            map4.set(item.uniqueKey, item);
        }
        this._goodsConfig = new BaseConfig<number, GoodsConfigItem>("GoodsConfig", map4);

        // EquipConfig
        section = sections[5];
        totalLength = section.length;
        nAdd = 4;
        let map5 = this._goodsConfig;
        let map5_self = new Map<number, EquipConfigItem>();
        for (let n = 0; n < totalLength; n += nAdd) {
            let parentItem1 = this._goodsConfig.get(section[n]) as GoodsConfigItem;
            let item: EquipConfigItem = { uniqueKey: parentItem1.uniqueKey, id: parentItem1.id, name: parentItem1.name, color: parentItem1.color, type: parentItem1.type, sellPrice: parentItem1.sellPrice, desc: parentItem1.desc, position: section[n + 2], attr: section[n + 3] };
            map5.data.set(item.uniqueKey, item);
            map5_self.set(item.uniqueKey, item);
        }
        this._equipConfig = new BaseConfig<number, EquipConfigItem>("EquipConfig", map5_self);

        // KVConfig
        section = sections[6];
        this._kVConfig = { configName: "KVConfig", gameName: section[0], version: section[1], a: section[2], b: section[3], c: section[4], d: section[5], f: section[6] };

    }

    private static getLinkedConfigs<T, W>(keys: T[], config: BaseConfig<T, W>): W[] {
        let result: W[] = [];
        for (let i = 0; i < keys.length; i++) {
            result.push(config.get(keys[i], true));
        }
        return result;
    }
}