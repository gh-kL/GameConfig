using System.Collections.Generic;

namespace GameConfig
{
    public class GoodsConfigItem
    {
        /// <summary>
        /// 唯一主键
        /// </summary>
        public int UniqueKey { private set; get; }
        /// <summary>
        /// ID（索引）
        /// </summary>
        public int Id { private set; get; }
        /// <summary>
        /// 名称（语言表）
        /// </summary>
        public string Name { private set; get; }
        /// <summary>
        /// 品质
        /// </summary>
        public int Color { private set; get; }
        /// <summary>
        /// 物品类型
        /// </summary>
        public GoodsType Type { private set; get; }
        /// <summary>
        /// 售出价格
        /// </summary>
        public int SellPrice { private set; get; }
        /// <summary>
        /// 描述
        /// </summary>
        public string Desc { private set; get; }

        public GoodsConfigItem(int uniqueKey, int id, string name, int color, GoodsType type, int sellPrice, string desc)
        {
            UniqueKey = uniqueKey;
            Id = id;
            Name = name;
            Color = color;
            Type = type;
            SellPrice = sellPrice;
            Desc = desc;
        }
    }
}