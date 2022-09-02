using System.Collections.Generic;

namespace GameConfig
{
    public class PetStepLvConfigItem
    {
        /// <summary>
        /// 唯一主键
        /// </summary>
        public string UniqueKey { private set; get; }
        /// <summary>
        /// 第1主键
        /// </summary>
        public int MainKey1 { private set; get; }
        /// <summary>
        /// 第2主键
        /// </summary>
        public int MainKey2 { private set; get; }
        /// <summary>
        /// 第3主键
        /// </summary>
        public int MainKey3 { private set; get; }
        /// <summary>
        /// ID（索引）
        /// </summary>
        public int Id { private set; get; }
        /// <summary>
        /// 阶
        /// </summary>
        public int Step { private set; get; }
        /// <summary>
        /// 等级
        /// </summary>
        public int Lv { private set; get; }
        /// <summary>
        /// 属性
        /// </summary>
        public IReadOnlyList<IReadOnlyList<int>> Attr { private set; get; }

        public PetStepLvConfigItem(string uniqueKey, int mainKey1, int mainKey2, int mainKey3, int id, int step, int lv, IReadOnlyList<IReadOnlyList<int>> attr)
        {
            UniqueKey = uniqueKey;
            MainKey1 = mainKey1;
            MainKey2 = mainKey2;
            MainKey3 = mainKey3;
            Id = id;
            Step = step;
            Lv = lv;
            Attr = attr;
        }
    }
}