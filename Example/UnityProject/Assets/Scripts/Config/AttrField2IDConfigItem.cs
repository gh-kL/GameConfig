using System.Collections.Generic;

namespace GameConfig
{
    public class AttrField2IDConfigItem
    {
        /// <summary>
        /// 唯一主键
        /// </summary>
        public string UniqueKey { private set; get; }
        /// <summary>
        /// 索引（field）
        /// </summary>
        public string Field { private set; get; }
        /// <summary>
        /// ID
        /// </summary>
        public int Id { private set; get; }

        public AttrField2IDConfigItem(string uniqueKey, string field, int id)
        {
            UniqueKey = uniqueKey;
            Field = field;
            Id = id;
        }
    }
}