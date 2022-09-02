using System.Collections.Generic;

namespace GameConfig
{
    public class EquipConfigItem : GoodsConfigItem
    {
        /// <summary>
        /// 位置
        /// </summary>
        public EquipPosition Position { private set; get; }
        /// <summary>
        /// 属性
        /// </summary>
        public IReadOnlyList<IReadOnlyList<int>> Attr { private set; get; }

        public EquipConfigItem(int uniqueKey, int id, string name, int color, GoodsType type, int sellPrice, string desc, EquipPosition position, IReadOnlyList<IReadOnlyList<int>> attr) : base(uniqueKey, id, name, color, type, sellPrice, desc)
        {
            Position = position;
            Attr = attr;
        }
    }
}