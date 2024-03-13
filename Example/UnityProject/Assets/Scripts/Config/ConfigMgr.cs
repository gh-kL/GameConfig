using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;

namespace GameConfig
{
    public static class ConfigMgr
    {
        public static BaseConfig<int, PetConfigItem> PetConfig { private set; get; }
        public static BaseConfig<string, PetStepLvConfigItem> PetStepLvConfig { private set; get; }
        public static Dictionary<int, Dictionary<int, Dictionary<int, PetStepLvConfigItem>>> PetStepLvConfigMap { private set; get; }

        public static BaseConfig<string, AttrField2IDConfigItem> AttrField2IDConfig { private set; get; }
        public static BaseConfig<int, AttrConfigItem> AttrConfig { private set; get; }
        public static BaseConfig<int, GoodsConfigItem> GoodsConfig { private set; get; }
        public static BaseConfig<int, EquipConfigItem> EquipConfig { private set; get; }
        public static KVConfig KVConfig { private set; get; }

        public static void Init(string configPath)
        {
            var textAsset = Resources.Load(configPath) as TextAsset;
            var configText = ConfigUtility.DecodeBase64(textAsset.text);
            Parse(configText);
        }
        
        public static void Parse(string configText)
        {
            var sections = configText.Split("#"[0]);

            string section;
            string[] lines;

            // PetConfig
            section = sections[0];
            lines = Regex.Split(section, "\r\n");
            Dictionary<int, PetConfigItem> petConfigData = new Dictionary<int, PetConfigItem>();
            for (int n = 0; n < lines.Length - 1; n += 5)
            {
                var item = new PetConfigItem(ConfigUtility.ParseInt(lines[n]), ConfigUtility.ParseInt(lines[n + 1]), (PetType) ConfigUtility.ParseInt(lines[n + 2]), lines[n + 3], ConfigUtility.ParseIntList(lines[n + 4]));
                petConfigData[item.UniqueKey] = item;
            }
            PetConfig = new BaseConfig<int, PetConfigItem>("PetConfig", petConfigData);

            // PetStepLvConfig
            section = sections[1];
            lines = Regex.Split(section, "\r\n");
            Dictionary<string, PetStepLvConfigItem> petStepLvConfigData = new Dictionary<string, PetStepLvConfigItem>();
            for (int n = 0; n < lines.Length - 1; n += 8)
            {
                var item = new PetStepLvConfigItem(lines[n], ConfigUtility.ParseInt(lines[n + 1]), ConfigUtility.ParseInt(lines[n + 2]), ConfigUtility.ParseInt(lines[n + 3]), ConfigUtility.ParseInt(lines[n + 4]), ConfigUtility.ParseInt(lines[n + 5]), ConfigUtility.ParseInt(lines[n + 6]), ConfigUtility.ParseIntList2(lines[n + 7]));
                petStepLvConfigData[item.UniqueKey] = item;
            }
            PetStepLvConfig = new BaseConfig<string, PetStepLvConfigItem>("PetStepLvConfig", petStepLvConfigData);
            PetStepLvConfigMap = new Dictionary<int, Dictionary<int, Dictionary<int, PetStepLvConfigItem>>>();
            foreach (var keyValuePair in PetStepLvConfig.Data)
            {
                var item = keyValuePair.Value;
                if (!PetStepLvConfigMap.ContainsKey(item.MainKey1))
                    PetStepLvConfigMap[item.MainKey1] = new Dictionary<int, Dictionary<int, PetStepLvConfigItem>>();
                if (!PetStepLvConfigMap[item.MainKey1].ContainsKey(item.MainKey2))
                    PetStepLvConfigMap[item.MainKey1][item.MainKey2] = new Dictionary<int, PetStepLvConfigItem>();
                PetStepLvConfigMap[item.MainKey1][item.MainKey2][item.MainKey3] = item;
            }


            // AttrField2IDConfig
            section = sections[2];
            lines = Regex.Split(section, "\r\n");
            Dictionary<string, AttrField2IDConfigItem> attrField2IDConfigData = new Dictionary<string, AttrField2IDConfigItem>();
            for (int n = 0; n < lines.Length - 1; n += 3)
            {
                var item = new AttrField2IDConfigItem(lines[n], lines[n + 1], ConfigUtility.ParseInt(lines[n + 2]));
                attrField2IDConfigData[item.UniqueKey] = item;
            }
            AttrField2IDConfig = new BaseConfig<string, AttrField2IDConfigItem>("AttrField2IDConfig", attrField2IDConfigData);

            // AttrConfig
            section = sections[3];
            lines = Regex.Split(section, "\r\n");
            Dictionary<int, AttrConfigItem> attrConfigData = new Dictionary<int, AttrConfigItem>();
            for (int n = 0; n < lines.Length - 1; n += 4)
            {
                var item = new AttrConfigItem(ConfigUtility.ParseInt(lines[n]), ConfigUtility.ParseInt(lines[n + 1]), lines[n + 2], lines[n + 3]);
                attrConfigData[item.UniqueKey] = item;
            }
            AttrConfig = new BaseConfig<int, AttrConfigItem>("AttrConfig", attrConfigData);

            // GoodsConfig
            section = sections[4];
            lines = Regex.Split(section, "\r\n");
            Dictionary<int, GoodsConfigItem> goodsConfigData = new Dictionary<int, GoodsConfigItem>();
            for (int n = 0; n < lines.Length - 1; n += 7)
            {
                var item = new GoodsConfigItem(ConfigUtility.ParseInt(lines[n]), ConfigUtility.ParseInt(lines[n + 1]), lines[n + 2], ConfigUtility.ParseInt(lines[n + 3]), (GoodsType) ConfigUtility.ParseInt(lines[n + 4]), ConfigUtility.ParseInt(lines[n + 5]), lines[n + 6]);
                goodsConfigData[item.UniqueKey] = item;
            }
            GoodsConfig = new BaseConfig<int, GoodsConfigItem>("GoodsConfig", goodsConfigData);

            // EquipConfig
            section = sections[5];
            lines = Regex.Split(section, "\r\n");
            var dict5 = goodsConfigData;
            Dictionary<int, EquipConfigItem> dict5_self = new Dictionary<int, EquipConfigItem>();
            for (int n = 0; n < lines.Length - 1; n += 4)
            {
                var parentItem1 = dict5[ConfigUtility.ParseInt(lines[n])] as GoodsConfigItem;
                var item = new EquipConfigItem(ConfigUtility.ParseInt(lines[n]), parentItem1.Id, parentItem1.Name, parentItem1.Color, parentItem1.Type, parentItem1.SellPrice, parentItem1.Desc, (EquipPosition) ConfigUtility.ParseInt(lines[n + 2]), ConfigUtility.ParseIntList2(lines[n + 3]));
                dict5[item.UniqueKey] = item;
                dict5_self[item.UniqueKey] = item;
            }
            EquipConfig = new BaseConfig<int, EquipConfigItem>("EquipConfig", dict5_self);

            // KVConfig
            section = sections[6];
            lines = Regex.Split(section, "\r\n");
            KVConfig = new KVConfig("KVConfig", lines[0], lines[1], ConfigUtility.ParseIntList(lines[2]), ConfigUtility.ParseIntList2(lines[3]), ConfigUtility.ParseStringList(lines[4]), ConfigUtility.ParseInt(lines[5]), ConfigUtility.ParseBool(lines[6]));
        }
    }
}