import { _decorator, Component, Node, resources, TextAsset, Label } from 'cc';
import { ConfigMgr } from './config/ConfigMgr';
import { EquipConfigItem } from './config/EquipConfigItem';
const { ccclass, property } = _decorator;

@ccclass('Example')
export class Example extends Component {

    @property({ type: Label })
    private label = null;

    start() {
        ConfigMgr.init("config/config", this, this.onConfigInitComplete);
    }

    onConfigInitComplete() {
        console.log(ConfigMgr.PetStepLvConfig.get("3_2_3"));

        (this.label as Label).string = `${ConfigMgr.KVConfig.gameName}
${ConfigMgr.KVConfig.version}
${ConfigMgr.KVConfig.a}
${ConfigMgr.KVConfig.b}
${ConfigMgr.KVConfig.c}
${ConfigMgr.KVConfig.f}
${ConfigMgr.PetConfig.get(3).name}
${ConfigMgr.PetStepLvConfig.get("3_2_3").attr}
${ConfigMgr.PetStepLvConfigMap.get(3).get(2).get(3).attr}
${ConfigMgr.AttrConfig.get(3).name}
${ConfigMgr.AttrConfig.get(3).field}
${ConfigMgr.AttrField2IDConfig.get(ConfigMgr.AttrConfig.get(3).field).id}
${ConfigMgr.GoodsConfig.get(20004).name}
${ConfigMgr.GoodsConfig.get(31005).name}
${ConfigMgr.GoodsConfig.get(31005).type}
${(ConfigMgr.GoodsConfig.get(31005) as EquipConfigItem).position}
`;
    }
}

