using GameConfig;
using UnityEngine;
using UnityEngine.UI;

public class Example : MonoBehaviour
{
    public Text text;

    private void Awake()
    {
        ConfigMgr.Init("Config/Config");

        text.text = @$"{ConfigMgr.KVConfig.GameName}
{ConfigMgr.KVConfig.Version}
{ConfigMgr.KVConfig.A}
{ConfigMgr.KVConfig.B}
{ConfigMgr.KVConfig.C}
{ConfigMgr.KVConfig.F}
{ConfigMgr.PetConfig.Get(3).Name}
{ConfigMgr.PetStepLvConfig.Get("3_2_3").Attr[0][1]}
{ConfigMgr.PetStepLvConfigMap[3][2][3].Attr[0][1]}
{ConfigMgr.AttrConfig.Get(3).Name}
{ConfigMgr.AttrConfig.Get(3).Field}
{ConfigMgr.AttrField2IDConfig.Get(ConfigMgr.AttrConfig.Get(3).Field).Id}
{ConfigMgr.GoodsConfig.Get(20004).Name}
{ConfigMgr.GoodsConfig.Get(31005).Name}
{ConfigMgr.GoodsConfig.Get(31005).Type}
{(ConfigMgr.GoodsConfig.Get(31005) as EquipConfigItem).Position}
";
    }
}