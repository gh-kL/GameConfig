using GameConfig;
using UnityEngine;
using UnityEngine.UI;

public class Example : MonoBehaviour
{
    public Text text;

    private void Awake()
    {
        ConfigManager.Init("Config/Config");

        text.text = @$"{ConfigManager.KVConfig.GameName}
{ConfigManager.KVConfig.Version}
{ConfigManager.KVConfig.A}
{ConfigManager.KVConfig.B}
{ConfigManager.KVConfig.C}
{ConfigManager.KVConfig.F}
{ConfigManager.PetConfig.Get(3).Name}
{ConfigManager.PetStepLvConfig.Get("3_2_3").Attr[0][1]}
{ConfigManager.PetStepLvConfigMap[3][2][3].Attr[0][1]}
{ConfigManager.AttrConfig.Get(3).Name}
{ConfigManager.AttrConfig.Get(3).Field}
{ConfigManager.AttrField2IDConfig.Get(ConfigManager.AttrConfig.Get(3).Field).Id}
{ConfigManager.GoodsConfig.Get(20004).Name}
{ConfigManager.GoodsConfig.Get(31005).Name}
{ConfigManager.GoodsConfig.Get(31005).Type}
{(ConfigManager.GoodsConfig.Get(31005) as EquipConfigItem).Position}
";
    }
}